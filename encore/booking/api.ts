import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { bookingDB } from "./db";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import type { BookingRecord, BookingStatus } from "../shared/domain";

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
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

interface CreateBookingParams {
  listingId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice: number;
}

interface UpdateBookingStatusParams {
  id: string;
  status: BookingStatus;
}

interface SubmitPaymentProofParams {
  id: string;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
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
    paymentProofUrl: row.payment_proof_url,
    paymentSubmittedAt: row.payment_submitted_at,
    paymentConfirmedAt: row.payment_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const createBooking = api<CreateBookingParams, { booking: BookingRecord }>(
  { expose: true, method: "POST", path: "/bookings", auth: true },
  async (params) => {
    const auth = requireAuth();
    if (auth.userID === params.hostId) {
      throw APIError.failedPrecondition("Hosts cannot create bookings for their own listings.");
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await bookingDB.exec`
      INSERT INTO bookings (
        id, listing_id, guest_id, host_id, check_in, check_out, adults, children,
        total_price, status, created_at, updated_at
      )
      VALUES (
        ${id}, ${params.listingId}, ${auth.userID}, ${params.hostId}, ${params.checkIn},
        ${params.checkOut}, ${params.adults}, ${params.children}, ${params.totalPrice},
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
        hostId: params.hostId,
        status: "pending",
      }),
    });

    return {
      booking: {
        id,
        listingId: params.listingId,
        guestId: auth.userID,
        hostId: params.hostId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: params.adults,
        children: params.children,
        totalPrice: params.totalPrice,
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
    return { bookings: rows.map(mapBooking) };
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
    return { bookings: rows.map(mapBooking) };
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
    if (
      !["awaiting_guest_payment", "confirmed", "cancelled", "completed", "declined"].includes(nextStatus)
    ) {
      throw APIError.invalidArgument("Hosts can only move bookings through the payment and completion workflow.");
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

    return {
      booking: mapBooking({
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
    if (!["awaiting_guest_payment", "payment_submitted"].includes(existing.status)) {
      throw APIError.failedPrecondition("Payment proof can only be submitted after the host requests payment.");
    }

    const now = new Date().toISOString();
    await bookingDB.exec`
      UPDATE bookings
      SET status = ${"payment_submitted"},
          payment_reference = ${params.paymentReference ?? existing.payment_reference},
          payment_proof_url = ${params.paymentProofUrl ?? existing.payment_proof_url},
          payment_submitted_at = ${now},
          updated_at = ${now}
      WHERE id = ${params.id}
    `;

    return {
      booking: mapBooking({
        ...existing,
        status: "payment_submitted",
        payment_reference: params.paymentReference ?? existing.payment_reference,
        payment_proof_url: params.paymentProofUrl ?? existing.payment_proof_url,
        payment_submitted_at: now,
        updated_at: now,
      }),
    };
  },
);
