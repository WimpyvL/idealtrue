import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { bookingDB } from "./db";
import { bookingEvidenceBucket } from "./storage";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import { getListing, replaceListingBlockedDates } from "../catalog/api";
import { notifyBookingRequested, notifyBookingStatusChanged, notifyPaymentProofSubmitted } from "../ops/notifications";
import type { BookingRecord, BookingStatus } from "../shared/domain";
import {
  bookingOverlapsBlockedDates,
  computeBookingTotalPrice,
  getBookingStatusTransitionError,
  getPaymentProofSubmissionError,
} from "./workflow";

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
  status: BookingStatus;
  payment_method: string | null;
  payment_instructions: string | null;
  payment_reference: string | null;
  payment_proof_key: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

interface CreateBookingParams {
  listingId: string;
  hostId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice?: number;
}

interface UpdateBookingStatusParams {
  id: string;
  status: BookingStatus;
}

interface SubmitPaymentProofParams {
  id: string;
  paymentReference?: string | null;
  paymentProofFilename?: string | null;
  paymentProofContentType?: string | null;
  paymentProofDataBase64?: string | null;
  paymentProofUrl?: string | null;
}

export interface BookingAccessRecord extends BookingRecord {
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
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
    status: row.status,
    paymentMethod: row.payment_method,
    paymentInstructions: row.payment_instructions,
    paymentReference: row.payment_reference,
    paymentProofKey: row.payment_proof_key,
    paymentProofUrl: row.payment_proof_url,
    paymentSubmittedAt: row.payment_submitted_at,
    paymentConfirmedAt: row.payment_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ALLOWED_PAYMENT_PROOF_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
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

async function resolvePaymentProofUrl(row: BookingRow) {
  if (row.payment_proof_key) {
    const signed = await bookingEvidenceBucket.signedDownloadUrl(row.payment_proof_key, { ttl: 900 });
    return signed.url;
  }

  return row.payment_proof_url;
}

async function mapBookingAccessRecord(row: BookingRow): Promise<BookingAccessRecord> {
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

function buildBookedDateRange(checkIn: string, checkOut: string) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const checkoutDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const bookedDates: string[] = [];

  while (cursor < checkoutDay) {
    bookedDates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return bookedDates;
}

async function syncListingAvailabilityForBookings(listingId: string) {
  const rows = await bookingDB.rawQueryAll<Pick<BookingRow, "check_in" | "check_out">>(
    `
      SELECT check_in, check_out
      FROM bookings
      WHERE listing_id = $1
        AND status IN ('confirmed', 'completed')
    `,
    listingId,
  );

  const blockedDates = Array.from(
    new Set(
      rows.flatMap((row) => buildBookedDateRange(row.check_in, row.check_out)),
    ),
  ).sort();

  await replaceListingBlockedDates(listingId, blockedDates);
}

export async function getBookingById(id: string) {
  const row = await bookingDB.queryRow<BookingRow>`
    SELECT * FROM bookings WHERE id = ${id}
  `;
  return row ? mapBookingAccessRecord(row) : null;
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

    const serverTotalPrice = computeBookingTotalPrice(listing.pricePerNight, parsedCheckIn, parsedCheckOut);

    const id = randomUUID();
    const now = new Date().toISOString();

    await bookingDB.exec`
      INSERT INTO bookings (
        id, listing_id, guest_id, host_id, check_in, check_out, adults, children,
        total_price, status, created_at, updated_at
      )
      VALUES (
        ${id}, ${params.listingId}, ${auth.userID}, ${listing.hostId}, ${params.checkIn},
        ${params.checkOut}, ${params.adults}, ${params.children}, ${serverTotalPrice},
        ${"pending"}, ${now}, ${now}
      )
    `;

    await platformEvents.publish({
      type: "booking.requested",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({
        listingId: params.listingId,
        guestId: auth.userID,
        hostId: listing.hostId,
        status: "pending",
      }),
    });

    try {
      await notifyBookingRequested({
        hostId: listing.hostId,
        listingTitle: listing.title,
        bookingId: id,
      });
    } catch (error) {
      console.error("Failed to create booking notification:", error);
    }

    return {
      booking: {
        id,
        listingId: params.listingId,
        guestId: auth.userID,
        hostId: listing.hostId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: params.adults,
        children: params.children,
        totalPrice: serverTotalPrice,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      },
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
    return { bookings: await Promise.all(rows.map(mapBookingAccessRecord)) };
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
    return { bookings: await Promise.all(rows.map(mapBookingAccessRecord)) };
  },
);

export const updateBookingStatus = api<UpdateBookingStatusParams, { booking: BookingRecord }>(
  { expose: true, method: "PATCH", path: "/bookings/:id/status", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin");
    const existing = await bookingDB.queryRow<BookingRow>`
      SELECT * FROM bookings WHERE id = ${params.id}
    `;
    if (!existing) throw APIError.notFound("Booking not found.");
    if (existing.host_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You cannot update this booking.");
    }

    const nextStatus = params.status;
    const transitionError = getBookingStatusTransitionError(existing.status, nextStatus);
    if (transitionError) {
      throw APIError.failedPrecondition(transitionError);
    }

    const now = new Date().toISOString();
    const paymentConfirmedAt = nextStatus === "confirmed" ? now : existing.payment_confirmed_at;
    await bookingDB.exec`
      UPDATE bookings
      SET status = ${nextStatus},
          payment_confirmed_at = ${paymentConfirmedAt},
          updated_at = ${now}
      WHERE id = ${params.id}
    `;

    if (["confirmed", "completed", "cancelled", "declined"].includes(nextStatus)) {
      await syncListingAvailabilityForBookings(existing.listing_id);
    }

    if (nextStatus === "confirmed" || nextStatus === "cancelled") {
      await platformEvents.publish({
        type: nextStatus === "confirmed" ? "booking.confirmed" : "booking.cancelled",
        aggregateId: existing.id,
        actorId: auth.userID,
        occurredAt: now,
        payload: JSON.stringify({
          listingId: existing.listing_id,
          guestId: existing.guest_id,
          hostId: existing.host_id,
          status: nextStatus,
        }),
      });
    }

    try {
      await notifyBookingStatusChanged({
        guestId: existing.guest_id,
        status: nextStatus as "awaiting_guest_payment" | "confirmed" | "cancelled" | "completed" | "declined",
        listingTitle: await resolveListingTitle(existing.listing_id),
      });
    } catch (error) {
      console.error("Failed to create booking status notification:", error);
    }

    return {
      booking: await mapBookingAccessRecord({
        ...existing,
        status: nextStatus,
        payment_confirmed_at: paymentConfirmedAt,
        updated_at: now,
      }),
    };
  },
);

export const submitPaymentProof = api<SubmitPaymentProofParams, { booking: BookingRecord }>(
  { expose: true, method: "POST", path: "/bookings/:id/payment-proof", auth: true },
  async (params) => {
    const auth = requireAuth();
    const existing = await bookingDB.queryRow<BookingRow>`
      SELECT * FROM bookings WHERE id = ${params.id}
    `;
    if (!existing) throw APIError.notFound("Booking not found.");
    if (existing.guest_id !== auth.userID) {
      throw APIError.permissionDenied("Only the guest can submit payment proof.");
    }
    const paymentProofError = getPaymentProofSubmissionError(existing.status);
    if (paymentProofError) {
      throw APIError.failedPrecondition(paymentProofError);
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

    const now = new Date().toISOString();
    await bookingDB.exec`
      UPDATE bookings
      SET status = ${"payment_submitted"},
          payment_reference = ${params.paymentReference ?? existing.payment_reference},
          payment_proof_key = ${paymentProofKey},
          payment_proof_url = ${paymentProofUrl},
          payment_submitted_at = ${now},
          updated_at = ${now}
      WHERE id = ${params.id}
    `;

    try {
      await notifyPaymentProofSubmitted({
        hostId: existing.host_id,
        listingTitle: await resolveListingTitle(existing.listing_id),
      });
    } catch (error) {
      console.error("Failed to create payment proof notification:", error);
    }

    return {
      booking: await mapBookingAccessRecord({
        ...existing,
        status: "payment_submitted",
        payment_reference: params.paymentReference ?? existing.payment_reference,
        payment_proof_key: paymentProofKey,
        payment_proof_url: paymentProofUrl,
        payment_submitted_at: now,
        updated_at: now,
      }),
    };
  },
);
