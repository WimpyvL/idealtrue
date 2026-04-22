import { api, APIError } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { randomUUID } from "node:crypto";
import { bookingDB } from "./db";
import { bookingEvidenceBucket } from "./storage";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import {
  assertListingDateRangeAvailable,
  getListing,
  replaceBookingAvailabilityBlocks,
} from "../catalog/api";
import { identityDB } from "../identity/db";
import type {
  BookingRecord,
  InquiryDeclineReason,
  InquiryLedgerEventRecord,
  InquiryState,
  PaymentState,
} from "../shared/domain";
import {
  bookingOverlapsBlockedDates,
  computeInquiryExpiresAt,
  computeBookingTotalPrice,
  getInquiryStatusTransitionError,
  getPaymentProofSubmissionError,
  getPaymentStateTransitionError,
  shouldExpireInquiry,
} from "./workflow";

type LegacyBookingStatus =
  | "pending"
  | "awaiting_guest_payment"
  | "payment_submitted"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "declined";

type BookingRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  total_price: number;
  breakage_deposit: number | null;
  status: LegacyBookingStatus;
  inquiry_state: InquiryState;
  payment_state: PaymentState;
  payment_method: string | null;
  payment_instructions: string | null;
  payment_reference: string | null;
  payment_proof_key: string | null;
  payment_proof_url: string | null;
  decline_reason: InquiryDeclineReason | null;
  decline_reason_note: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  payment_unlocked_at: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  expires_at: string | null;
  booked_at: string | null;
  created_at: string;
  updated_at: string;
};

type InquiryLedgerRow = {
  id: string;
  inquiry_id: string;
  event: InquiryLedgerEventRecord["event"];
  from_state: string | null;
  to_state: string | null;
  actor: InquiryLedgerEventRecord["actor"];
  metadata: string;
  created_at: string;
};

type HostPaymentDetailsRow = {
  payment_method: string | null;
  payment_instructions: string | null;
  payment_reference_prefix: string | null;
};

interface CreateBookingParams {
  listingId: string;
  hostId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice?: number;
  breakageDeposit?: number | null;
}

interface UpdateBookingStatusParams {
  id: string;
  status: InquiryState;
  declineReason?: InquiryDeclineReason | null;
  declineReasonNote?: string | null;
}

interface SubmitPaymentProofParams {
  id: string;
  paymentReference?: string | null;
  paymentProofFilename?: string | null;
  paymentProofContentType?: string | null;
  paymentProofDataBase64?: string | null;
  paymentProofUrl?: string | null;
}

interface ConfirmPaymentParams {
  id: string;
}

function mapBooking(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    guestId: row.guest_id,
    hostId: row.host_id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    adults: row.adults,
    children: row.children,
    totalPrice: row.total_price,
    breakageDeposit: row.breakage_deposit,
    inquiryState: row.inquiry_state,
    paymentState: row.payment_state,
    paymentMethod: row.payment_method,
    paymentInstructions: row.payment_instructions,
    paymentReference: row.payment_reference,
    paymentProofKey: row.payment_proof_key,
    paymentProofUrl: row.payment_proof_url,
    declineReason: row.decline_reason,
    declineReasonNote: row.decline_reason_note,
    viewedAt: row.viewed_at,
    respondedAt: row.responded_at,
    paymentUnlockedAt: row.payment_unlocked_at,
    paymentSubmittedAt: row.payment_submitted_at,
    paymentConfirmedAt: row.payment_confirmed_at,
    expiresAt: row.expires_at,
    bookedAt: row.booked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedgerEvent(row: InquiryLedgerRow): InquiryLedgerEventRecord {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    event: row.event,
    fromState: row.from_state,
    toState: row.to_state,
    actor: row.actor,
    metadata: row.metadata,
    timestamp: row.created_at,
  };
}

const ALLOWED_PAYMENT_PROOF_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const INQUIRY_DECLINE_REASONS = new Set<InquiryDeclineReason>([
  "DATES_UNAVAILABLE",
  "GUEST_COUNT_NOT_SUPPORTED",
  "BOOKING_REQUIREMENTS_NOT_MET",
  "HOST_UNAVAILABLE",
  "OTHER",
]);

function sanitizePaymentProofFilename(filename: string) {
  const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(0, 120) || "payment-proof.jpg";
}

function decodeBase64Payload(dataBase64: string) {
  const normalized = dataBase64.trim().replace(/^data:[^;]+;base64,/, "");
  let buffer: Buffer;

  try {
    buffer = Buffer.from(normalized, "base64");
  } catch {
    throw APIError.invalidArgument("Invalid base64 upload payload.");
  }

  if (!buffer.length) {
    throw APIError.invalidArgument("Upload payload was empty.");
  }

  return buffer;
}

function deriveLegacyStatus(inquiryState: InquiryState, paymentState: PaymentState): LegacyBookingStatus {
  if (inquiryState === "BOOKED") {
    return "confirmed";
  }
  if (inquiryState === "DECLINED") {
    return "declined";
  }
  if (inquiryState === "EXPIRED") {
    return "cancelled";
  }
  if (inquiryState === "APPROVED" && paymentState === "INITIATED") {
    return "awaiting_guest_payment";
  }
  if (inquiryState === "APPROVED" && paymentState === "FAILED") {
    return "payment_submitted";
  }
  return "pending";
}

function buildHostPaymentReference(prefix: string | null, inquiryId: string) {
  if (!prefix?.trim()) {
    return null;
  }

  return `${prefix.trim().toUpperCase()}-${inquiryId.slice(0, 8).toUpperCase()}`;
}

async function resolvePaymentProofUrl(row: BookingRow) {
  if (row.payment_proof_key) {
    const signed = await bookingEvidenceBucket.signedDownloadUrl(row.payment_proof_key, { ttl: 900 });
    return signed.url;
  }

  return row.payment_proof_url;
}

async function mapBookingAccessRecord(row: BookingRow): Promise<BookingRecord> {
  return {
    ...mapBooking(row),
    paymentProofUrl: await resolvePaymentProofUrl(row),
  };
}

async function resolveListingTitle(listingId: string) {
  try {
    const { listing } = await getListing({ id: listingId });
    return listing.title;
  } catch {
    return "your stay";
  }
}

async function syncListingAvailabilityForBookings(listingId: string) {
  const rows = await bookingDB.rawQueryAll<
    Pick<BookingRow, "id" | "check_in" | "check_out" | "inquiry_state" | "payment_state">
  >(
    `
      SELECT id, check_in, check_out, inquiry_state, payment_state
      FROM bookings
      WHERE listing_id = $1
        AND (
          (inquiry_state = 'BOOKED' AND payment_state = 'COMPLETED')
          OR (inquiry_state = 'APPROVED' AND payment_state = 'INITIATED')
        )
    `,
    listingId,
  );

  await replaceBookingAvailabilityBlocks(
    listingId,
    rows.map((row) => ({
      bookingId: row.id,
      checkIn: row.check_in,
      checkOut: row.check_out,
      sourceType:
        row.inquiry_state === "BOOKED" && row.payment_state === "COMPLETED" ? "BOOKED" : "APPROVED_HOLD",
    })),
  );
}

async function getHostPaymentDetails(hostId: string): Promise<HostPaymentDetailsRow> {
  const host = await identityDB.queryRow<HostPaymentDetailsRow>`
    SELECT payment_method, payment_instructions, payment_reference_prefix
    FROM users
    WHERE id = ${hostId}
  `;

  return host ?? {
    payment_method: null,
    payment_instructions: null,
    payment_reference_prefix: null,
  };
}

async function appendLedgerEvent(params: {
  inquiryId: string;
  event: InquiryLedgerEventRecord["event"];
  fromState?: string | null;
  toState?: string | null;
  actor: InquiryLedgerEventRecord["actor"];
  metadata?: Record<string, unknown>;
  timestamp: string;
}) {
  const id = randomUUID();
  await bookingDB.exec`
    INSERT INTO inquiry_ledger (id, inquiry_id, event, from_state, to_state, actor, metadata, created_at)
    VALUES (
      ${id},
      ${params.inquiryId},
      ${params.event},
      ${params.fromState ?? null},
      ${params.toState ?? null},
      ${params.actor},
      ${JSON.stringify(params.metadata ?? {})}::jsonb,
      ${params.timestamp}
    )
  `;

  return id;
}

async function publishInquiryEvent(params: {
  type: "inquiry.created" | "inquiry.status_changed" | "inquiry.payment_changed" | "inquiry.payment_submitted";
  inquiry: BookingRow;
  listingTitle: string;
  actorId: string;
  actor: "host" | "system" | "guest";
  occurredAt: string;
}) {
  await platformEvents.publish({
    type: params.type,
    aggregateId: params.inquiry.id,
    actorId: params.actorId,
    occurredAt: params.occurredAt,
    payload: JSON.stringify({
      listingId: params.inquiry.listing_id,
      listingTitle: params.listingTitle,
      guestId: params.inquiry.guest_id,
      hostId: params.inquiry.host_id,
      inquiryState: params.inquiry.inquiry_state,
      paymentState: params.inquiry.payment_state,
      paymentSubmittedAt: params.inquiry.payment_submitted_at,
      declineReason: params.inquiry.decline_reason,
      declineReasonNote: params.inquiry.decline_reason_note,
      actor: params.actor,
    }),
  });
}

async function persistInquiryStateChange(params: {
  inquiry: BookingRow;
  nextInquiryState: InquiryState;
  actorId: string;
  actor: "host" | "system" | "guest";
  now: string;
  viewedAt?: string | null;
  respondedAt?: string | null;
  paymentUnlockedAt?: string | null;
  paymentReference?: string | null;
  declineReason?: InquiryDeclineReason | null;
  declineReasonNote?: string | null;
  expiresAt?: string | null;
  bookedAt?: string | null;
}) {
  if (params.inquiry.inquiry_state === params.nextInquiryState) {
    return params.inquiry;
  }

  const nextRow: BookingRow = {
    ...params.inquiry,
    inquiry_state: params.nextInquiryState,
    status: deriveLegacyStatus(params.nextInquiryState, params.inquiry.payment_state),
    viewed_at: params.viewedAt !== undefined ? params.viewedAt : params.inquiry.viewed_at,
    responded_at: params.respondedAt !== undefined ? params.respondedAt : params.inquiry.responded_at,
    payment_unlocked_at: params.paymentUnlockedAt !== undefined ? params.paymentUnlockedAt : params.inquiry.payment_unlocked_at,
    payment_reference: params.paymentReference !== undefined ? params.paymentReference : params.inquiry.payment_reference,
    decline_reason: params.declineReason !== undefined ? params.declineReason : params.inquiry.decline_reason,
    decline_reason_note:
      params.declineReasonNote !== undefined ? params.declineReasonNote : params.inquiry.decline_reason_note,
    expires_at: params.expiresAt !== undefined ? params.expiresAt : params.inquiry.expires_at,
    booked_at: params.bookedAt !== undefined ? params.bookedAt : params.inquiry.booked_at,
    updated_at: params.now,
  };

  await bookingDB.exec`
    UPDATE bookings
    SET inquiry_state = ${nextRow.inquiry_state},
        status = ${nextRow.status},
        viewed_at = ${nextRow.viewed_at},
        responded_at = ${nextRow.responded_at},
        payment_unlocked_at = ${nextRow.payment_unlocked_at},
        payment_reference = ${nextRow.payment_reference},
        decline_reason = ${nextRow.decline_reason},
        decline_reason_note = ${nextRow.decline_reason_note},
        expires_at = ${nextRow.expires_at},
        booked_at = ${nextRow.booked_at},
        updated_at = ${nextRow.updated_at}
    WHERE id = ${nextRow.id}
  `;

  await appendLedgerEvent({
    inquiryId: nextRow.id,
    event: "STATUS_CHANGED",
    fromState: params.inquiry.inquiry_state,
    toState: nextRow.inquiry_state,
    actor: params.actor,
    metadata: {
      paymentState: nextRow.payment_state,
      declineReason: nextRow.decline_reason,
      declineReasonNote: nextRow.decline_reason_note,
    },
    timestamp: params.now,
  });

  await publishInquiryEvent({
    type: "inquiry.status_changed",
    inquiry: nextRow,
    listingTitle: await resolveListingTitle(nextRow.listing_id),
    actorId: params.actorId,
    actor: params.actor,
    occurredAt: params.now,
  });

  return nextRow;
}

async function persistPaymentStateChange(params: {
  inquiry: BookingRow;
  nextPaymentState: PaymentState;
  actorId: string;
  actor: "host" | "system" | "guest";
  now: string;
  paymentReference?: string | null;
  paymentProofKey?: string | null;
  paymentProofUrl?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
}) {
  if (params.inquiry.payment_state === params.nextPaymentState) {
    return params.inquiry;
  }

  const nextRow: BookingRow = {
    ...params.inquiry,
    payment_state: params.nextPaymentState,
    status: deriveLegacyStatus(params.inquiry.inquiry_state, params.nextPaymentState),
    payment_reference: params.paymentReference ?? params.inquiry.payment_reference,
    payment_proof_key: params.paymentProofKey ?? params.inquiry.payment_proof_key,
    payment_proof_url: params.paymentProofUrl ?? params.inquiry.payment_proof_url,
    payment_submitted_at: params.paymentSubmittedAt ?? params.inquiry.payment_submitted_at,
    payment_confirmed_at: params.paymentConfirmedAt ?? params.inquiry.payment_confirmed_at,
    updated_at: params.now,
  };

  await bookingDB.exec`
    UPDATE bookings
    SET payment_state = ${nextRow.payment_state},
        status = ${nextRow.status},
        payment_reference = ${nextRow.payment_reference},
        payment_proof_key = ${nextRow.payment_proof_key},
        payment_proof_url = ${nextRow.payment_proof_url},
        payment_submitted_at = ${nextRow.payment_submitted_at},
        payment_confirmed_at = ${nextRow.payment_confirmed_at},
        updated_at = ${nextRow.updated_at}
    WHERE id = ${nextRow.id}
  `;

  await appendLedgerEvent({
    inquiryId: nextRow.id,
    event: "PAYMENT_CHANGED",
    fromState: params.inquiry.payment_state,
    toState: nextRow.payment_state,
    actor: params.actor,
    metadata: { inquiryState: nextRow.inquiry_state },
    timestamp: params.now,
  });

  await publishInquiryEvent({
    type: "inquiry.payment_changed",
    inquiry: nextRow,
    listingTitle: await resolveListingTitle(nextRow.listing_id),
    actorId: params.actorId,
    actor: params.actor,
    occurredAt: params.now,
  });

  return nextRow;
}

async function persistPaymentProofSubmission(params: {
  inquiry: BookingRow;
  actorId: string;
  now: string;
  paymentReference?: string | null;
  paymentProofKey?: string | null;
  paymentProofUrl?: string | null;
}) {
  const nextRow: BookingRow = {
    ...params.inquiry,
    payment_reference: params.paymentReference ?? params.inquiry.payment_reference,
    payment_proof_key: params.paymentProofKey ?? params.inquiry.payment_proof_key,
    payment_proof_url: params.paymentProofUrl ?? params.inquiry.payment_proof_url,
    payment_submitted_at: params.now,
    updated_at: params.now,
  };

  await bookingDB.exec`
    UPDATE bookings
    SET payment_reference = ${nextRow.payment_reference},
        payment_proof_key = ${nextRow.payment_proof_key},
        payment_proof_url = ${nextRow.payment_proof_url},
        payment_submitted_at = ${nextRow.payment_submitted_at},
        updated_at = ${nextRow.updated_at}
    WHERE id = ${nextRow.id}
  `;

  await appendLedgerEvent({
    inquiryId: nextRow.id,
    event: "PAYMENT_CHANGED",
    fromState: params.inquiry.payment_state,
    toState: nextRow.payment_state,
    actor: "guest",
    metadata: { inquiryState: nextRow.inquiry_state, paymentSubmittedAt: params.now },
    timestamp: params.now,
  });

  await publishInquiryEvent({
    type: "inquiry.payment_submitted",
    inquiry: nextRow,
    listingTitle: await resolveListingTitle(nextRow.listing_id),
    actorId: params.actorId,
    actor: "guest",
    occurredAt: params.now,
  });

  return nextRow;
}

async function fetchBookingRow(id: string) {
  return bookingDB.queryRow<BookingRow>`
    SELECT * FROM bookings WHERE id = ${id}
  `;
}

async function expireInquiryIfNeeded(inquiry: BookingRow, now = new Date().toISOString()) {
  if (!shouldExpireInquiry(inquiry.inquiry_state, inquiry.expires_at, now)) {
    return inquiry;
  }

  const transitionError = getInquiryStatusTransitionError(inquiry.inquiry_state, "EXPIRED", "system");
  if (transitionError) {
    return inquiry;
  }

  const updated = await persistInquiryStateChange({
    inquiry,
    nextInquiryState: "EXPIRED",
    actorId: inquiry.host_id,
    actor: "system",
    now,
    expiresAt: inquiry.expires_at,
  });

  if (inquiry.inquiry_state === "APPROVED") {
    await syncListingAvailabilityForBookings(inquiry.listing_id);
  }

  return updated;
}

async function fetchBookingRowFresh(id: string, now = new Date().toISOString()) {
  const row = await fetchBookingRow(id);
  if (!row) {
    return null;
  }

  return expireInquiryIfNeeded(row, now);
}

async function expireInquiryRows(rows: BookingRow[], now = new Date().toISOString()) {
  return Promise.all(rows.map((row) => expireInquiryIfNeeded(row, now)));
}

export async function getBookingById(id: string) {
  const row = await fetchBookingRowFresh(id);
  return row ? mapBookingAccessRecord(row) : null;
}

export async function recordHostInquiryResponseFromMessage(bookingId: string, actorId: string) {
  const now = new Date().toISOString();
  const existing = await fetchBookingRowFresh(bookingId, now);
  if (!existing) {
    return null;
  }

  const transitionError = getInquiryStatusTransitionError(existing.inquiry_state, "RESPONDED", "host");
  if (transitionError) {
    return null;
  }
  return persistInquiryStateChange({
    inquiry: existing,
    nextInquiryState: "RESPONDED",
    actorId,
    actor: "host",
    now,
    respondedAt: now,
    viewedAt: existing.viewed_at ?? now,
    expiresAt: computeInquiryExpiresAt("RESPONDED", now),
  });
}

export const createBooking = api<CreateBookingParams, { booking: BookingRecord }>(
  { expose: true, method: "POST", path: "/bookings", auth: true },
  async (params) => {
    const auth = requireAuth();
    const parsedCheckIn = new Date(params.checkIn);
    const parsedCheckOut = new Date(params.checkOut);
    if (Number.isNaN(parsedCheckIn.getTime()) || Number.isNaN(parsedCheckOut.getTime())) {
      throw APIError.invalidArgument("Check-in and checkout must be valid ISO dates.");
    }

    if (params.adults < 1) {
      throw APIError.invalidArgument("At least one adult is required.");
    }
    if (params.children < 0) {
      throw APIError.invalidArgument("Children count cannot be negative.");
    }

    const { listing } = await getListing({ id: params.listingId });
    if (listing.status !== "active") {
      throw APIError.failedPrecondition("Bookings can only be created for active listings.");
    }
    if (auth.userID === listing.hostId) {
      throw APIError.failedPrecondition("Hosts cannot create bookings for their own listings.");
    }
    if (params.hostId && params.hostId !== listing.hostId) {
      throw APIError.invalidArgument("Listing host information is invalid.");
    }
    if (params.adults > listing.adults || params.children > listing.children) {
      throw APIError.failedPrecondition("Guest count exceeds listing capacity.");
    }
    if (bookingOverlapsBlockedDates(parsedCheckIn, parsedCheckOut, listing.blockedDates)) {
      throw APIError.failedPrecondition("Selected dates are not available for this listing.");
    }
    await assertListingDateRangeAvailable(params.listingId, params.checkIn, params.checkOut);

    const serverTotalPrice = computeBookingTotalPrice(listing.pricePerNight, parsedCheckIn, parsedCheckOut);
    const serverBreakageDeposit = listing.breakageDeposit ?? null;
    if ((params.breakageDeposit ?? null) !== serverBreakageDeposit) {
      throw APIError.failedPrecondition("Listing breakage deposit changed. Please refresh the listing and try again.");
    }
    const hostPaymentDetails = await getHostPaymentDetails(listing.hostId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = computeInquiryExpiresAt("PENDING", now);

    await bookingDB.exec`
      INSERT INTO bookings (
        id, listing_id, guest_id, host_id, check_in, check_out, adults, children,
        total_price, breakage_deposit, status, inquiry_state, payment_state, payment_method, payment_instructions, expires_at, created_at, updated_at
      )
      VALUES (
        ${id},
        ${params.listingId},
        ${auth.userID},
        ${listing.hostId},
        ${params.checkIn},
        ${params.checkOut},
        ${params.adults},
        ${params.children},
        ${serverTotalPrice},
        ${serverBreakageDeposit},
        ${"pending"},
        ${"PENDING"},
        ${"UNPAID"},
        ${hostPaymentDetails.payment_method},
        ${hostPaymentDetails.payment_instructions},
        ${expiresAt},
        ${now},
        ${now}
      )
    `;

    await appendLedgerEvent({
      inquiryId: id,
      event: "INQUIRY_CREATED",
      toState: "PENDING",
      actor: "guest",
      metadata: { paymentState: "UNPAID" },
      timestamp: now,
    });

    const created = (await fetchBookingRow(id))!;
    await publishInquiryEvent({
      type: "inquiry.created",
      inquiry: created,
      listingTitle: listing.title,
      actorId: auth.userID,
      actor: "guest",
      occurredAt: now,
    });

    return {
      booking: await mapBookingAccessRecord(created),
    };
  },
);

export const listMyBookings = api<void, { bookings: BookingRecord[] }>(
  { expose: true, method: "GET", path: "/bookings/me", auth: true },
  async () => {
    const auth = requireAuth();
    const rows = await bookingDB.rawQueryAll<BookingRow>(
      `
      SELECT * FROM bookings
      WHERE guest_id = $1 OR host_id = $1
      ORDER BY created_at DESC
      `,
      auth.userID,
    );
    const freshRows = await expireInquiryRows(rows);
    return { bookings: await Promise.all(freshRows.map(mapBookingAccessRecord)) };
  },
);

export const listAdminBookings = api<void, { bookings: BookingRecord[] }>(
  { expose: true, method: "GET", path: "/admin/bookings", auth: true },
  async () => {
    requireRole("admin", "support");
    const rows = await bookingDB.rawQueryAll<BookingRow>(
      `
      SELECT * FROM bookings
      ORDER BY created_at DESC
      `,
    );
    const freshRows = await expireInquiryRows(rows);
    return { bookings: await Promise.all(freshRows.map(mapBookingAccessRecord)) };
  },
);

export const listInquiryLedger = api<{ id: string }, { events: InquiryLedgerEventRecord[] }>(
  { expose: true, method: "GET", path: "/bookings/:id/ledger", auth: true },
  async ({ id }) => {
    const auth = requireAuth();
    const existing = await fetchBookingRowFresh(id);
    if (!existing) {
      throw APIError.notFound("Inquiry not found.");
    }
    if (![existing.guest_id, existing.host_id].includes(auth.userID) && !["admin", "support"].includes(auth.role)) {
      throw APIError.permissionDenied("You cannot read this inquiry ledger.");
    }

    const rows = await bookingDB.rawQueryAll<InquiryLedgerRow>(
      `
      SELECT id, inquiry_id, event, from_state, to_state, actor, metadata::text AS metadata, created_at
      FROM inquiry_ledger
      WHERE inquiry_id = $1
      ORDER BY created_at ASC
      `,
      id,
    );

    return { events: rows.map(mapLedgerEvent) };
  },
);

export const markInquiryViewed = api<{ id: string }, { booking: BookingRecord }>(
  { expose: true, method: "POST", path: "/bookings/:id/view", auth: true },
  async ({ id }) => {
    const auth = requireRole("host", "admin", "support");
    const now = new Date().toISOString();
    const existing = await fetchBookingRowFresh(id, now);
    if (!existing) throw APIError.notFound("Inquiry not found.");
    if (existing.host_id !== auth.userID && !["admin", "support"].includes(auth.role)) {
      throw APIError.permissionDenied("You cannot update this inquiry.");
    }

    if (existing.inquiry_state !== "PENDING") {
      return { booking: await mapBookingAccessRecord(existing) };
    }

    const updated = await persistInquiryStateChange({
      inquiry: existing,
      nextInquiryState: "VIEWED",
      actorId: auth.userID,
      actor: "host",
      now,
      viewedAt: now,
      expiresAt: computeInquiryExpiresAt("VIEWED", now),
    });

    return { booking: await mapBookingAccessRecord(updated) };
  },
);

export const updateBookingStatus = api<UpdateBookingStatusParams, { booking: BookingRecord }>(
  { expose: true, method: "PATCH", path: "/bookings/:id/status", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin", "support");
    const now = new Date().toISOString();
    const existing = await fetchBookingRowFresh(params.id, now);
    if (!existing) throw APIError.notFound("Inquiry not found.");
    if (existing.host_id !== auth.userID && !["admin", "support"].includes(auth.role)) {
      throw APIError.permissionDenied("You cannot update this inquiry.");
    }

    const nextStatus = params.status;
    const transitionError = getInquiryStatusTransitionError(existing.inquiry_state, nextStatus, "host");
    if (transitionError) {
      throw APIError.failedPrecondition(transitionError);
    }
    const declineReason = nextStatus === "DECLINED" ? params.declineReason ?? null : null;
    const declineReasonNote = nextStatus === "DECLINED" ? params.declineReasonNote?.trim() ?? "" : "";

    if (nextStatus === "DECLINED") {
      if (!declineReason || !INQUIRY_DECLINE_REASONS.has(declineReason)) {
        throw APIError.invalidArgument("A valid decline reason is required when declining an inquiry.");
      }
      if (declineReason === "OTHER" && !declineReasonNote) {
        throw APIError.invalidArgument("Add a short note when selecting Other as the decline reason.");
      }
      if (declineReasonNote.length > 280) {
        throw APIError.invalidArgument("Decline note must stay under 280 characters.");
      }
    }

    const hostPaymentDetails = await getHostPaymentDetails(existing.host_id);
    const paymentReference =
      nextStatus === "APPROVED"
        ? existing.payment_reference ?? buildHostPaymentReference(hostPaymentDetails.payment_reference_prefix, existing.id)
        : existing.payment_reference;

    if (nextStatus === "APPROVED") {
      await assertListingDateRangeAvailable(existing.listing_id, existing.check_in, existing.check_out, {
        excludeSourceType: "APPROVED_HOLD",
        excludeSourceId: existing.id,
      });
    }

    let updated = await persistInquiryStateChange({
      inquiry: existing,
      nextInquiryState: nextStatus,
      actorId: auth.userID,
      actor: "host",
      now,
      viewedAt: existing.viewed_at ?? (nextStatus === "VIEWED" || nextStatus === "RESPONDED" || nextStatus === "APPROVED" || nextStatus === "DECLINED" ? now : existing.viewed_at),
      respondedAt: nextStatus === "RESPONDED" ? now : existing.responded_at,
      paymentUnlockedAt: nextStatus === "APPROVED" ? now : existing.payment_unlocked_at,
      paymentReference,
      declineReason,
      declineReasonNote: declineReasonNote || null,
      expiresAt: computeInquiryExpiresAt(nextStatus, now),
    });

    if (nextStatus === "APPROVED") {
      const paymentTransitionError = getPaymentStateTransitionError(updated.inquiry_state, updated.payment_state, "INITIATED", "host");
      if (paymentTransitionError) {
        throw APIError.failedPrecondition(paymentTransitionError);
      }

      updated = await persistPaymentStateChange({
        inquiry: updated,
        nextPaymentState: "INITIATED",
        actorId: auth.userID,
        actor: "system",
        now,
        paymentReference,
      });
    }

    if (existing.inquiry_state === "APPROVED" || nextStatus === "APPROVED" || nextStatus === "BOOKED") {
      await syncListingAvailabilityForBookings(existing.listing_id);
    }

    return {
      booking: await mapBookingAccessRecord(updated),
    };
  },
);

export const submitPaymentProof = api<SubmitPaymentProofParams, { booking: BookingRecord }>(
  { expose: true, method: "POST", path: "/bookings/:id/payment-proof", auth: true },
  async (params) => {
    const auth = requireAuth();
    const existing = await fetchBookingRowFresh(params.id);
    if (!existing) throw APIError.notFound("Inquiry not found.");
    if (existing.guest_id !== auth.userID) {
      throw APIError.permissionDenied("Only the guest can submit payment proof for this inquiry.");
    }

    const paymentError = getPaymentProofSubmissionError(existing.inquiry_state, existing.payment_state);
    if (paymentError) {
      throw APIError.failedPrecondition(paymentError);
    }

    let paymentProofKey = existing.payment_proof_key;
    let paymentProofUrl = existing.payment_proof_url;

    if (params.paymentProofDataBase64) {
      if (!params.paymentProofFilename || !params.paymentProofContentType) {
        throw APIError.invalidArgument("Payment proof filename and content type are required when uploading a file.");
      }
      if (!ALLOWED_PAYMENT_PROOF_CONTENT_TYPES.has(params.paymentProofContentType)) {
        throw APIError.invalidArgument("Only JPG, PNG, and WEBP payment proof images are supported.");
      }

      const buffer = decodeBase64Payload(params.paymentProofDataBase64);
      if (buffer.byteLength > 700 * 1024) {
        throw APIError.invalidArgument("Payment proof image is too large. Please upload a smaller screenshot.");
      }

      const objectKey = `${existing.host_id}/${existing.id}/${Date.now()}-${sanitizePaymentProofFilename(params.paymentProofFilename)}`;
      await bookingEvidenceBucket.upload(objectKey, buffer, {
        contentType: params.paymentProofContentType,
      });
      paymentProofKey = objectKey;
      paymentProofUrl = null;
    } else if (params.paymentProofUrl !== undefined) {
      paymentProofUrl = params.paymentProofUrl ?? null;
    }

    if (!paymentProofKey && !paymentProofUrl) {
      throw APIError.invalidArgument("Attach a payment proof image or provide a hosted proof link.");
    }

    const now = new Date().toISOString();
    const updated = await persistPaymentProofSubmission({
      inquiry: existing,
      actorId: auth.userID,
      now,
      paymentReference: params.paymentReference ?? existing.payment_reference,
      paymentProofKey,
      paymentProofUrl,
    });

    return {
      booking: await mapBookingAccessRecord(updated),
    };
  },
);

export const confirmPayment = api<ConfirmPaymentParams, { booking: BookingRecord }>(
  { expose: true, method: "POST", path: "/bookings/:id/payment-confirm", auth: true },
  async (params) => {
    const auth = requireAuth();
    const now = new Date().toISOString();
    const existing = await fetchBookingRowFresh(params.id, now);
    if (!existing) throw APIError.notFound("Inquiry not found.");
    if (existing.host_id !== auth.userID) {
      throw APIError.permissionDenied("Only the host can confirm payment for this inquiry.");
    }
    if (!existing.payment_submitted_at) {
      throw APIError.failedPrecondition("The guest has not submitted payment proof yet.");
    }
    if (!existing.payment_proof_key && !existing.payment_proof_url) {
      throw APIError.failedPrecondition("Payment proof is missing for this inquiry.");
    }
    const paymentTransitionError = getPaymentStateTransitionError(existing.inquiry_state, existing.payment_state, "COMPLETED", "host");
    if (paymentTransitionError) {
      throw APIError.failedPrecondition(paymentTransitionError);
    }

    let updated = await persistPaymentStateChange({
      inquiry: existing,
      nextPaymentState: "COMPLETED",
      actorId: auth.userID,
      actor: "host",
      now,
      paymentConfirmedAt: now,
    });

    updated = await persistInquiryStateChange({
      inquiry: updated,
      nextInquiryState: "BOOKED",
      actorId: auth.userID,
      actor: "system",
      now,
      bookedAt: now,
      expiresAt: null,
    });

    await syncListingAvailabilityForBookings(existing.listing_id);

    return {
      booking: await mapBookingAccessRecord(updated),
    };
  },
);

export async function processInquiryExpiryCycle(nowIso = new Date().toISOString()) {
  const staleRows = await bookingDB.queryAll<BookingRow>`
    SELECT *
    FROM bookings
    WHERE inquiry_state IN ('PENDING', 'VIEWED', 'RESPONDED', 'APPROVED')
      AND expires_at IS NOT NULL
      AND expires_at <= ${nowIso}
    ORDER BY expires_at ASC
  `;

  for (const row of staleRows) {
    await expireInquiryIfNeeded(row, nowIso);
  }
}

export const runInquiryExpiryCycle = api(
  {},
  async () => {
    await processInquiryExpiryCycle();
  },
);

export const inquiryExpiryCron = new CronJob("inquiry-expiry-cycle", {
  every: "1h",
  endpoint: runInquiryExpiryCycle,
});
