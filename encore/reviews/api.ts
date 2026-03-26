import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { reviewsDB } from "./db";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import type { ReviewRecord, ReviewStatus } from "../shared/domain";

type ReviewRow = {
  id: string;
  listing_id: string;
  booking_id: string;
  guest_id: string;
  host_id: string;
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
  comment: string;
  status: ReviewStatus;
  created_at: string;
};

interface CreateReviewParams {
  listingId: string;
  bookingId: string;
  hostId: string;
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
  comment: string;
}

function mapReview(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    bookingId: row.booking_id,
    guestId: row.guest_id,
    hostId: row.host_id,
    cleanliness: row.cleanliness,
    accuracy: row.accuracy,
    communication: row.communication,
    location: row.location,
    value: row.value,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const listListingReviews = api<{ listingId: string }, { reviews: ReviewRecord[] }>(
  { expose: true, method: "GET", path: "/reviews/:listingId" },
  async ({ listingId }) => {
    const reviews = await reviewsDB.queryAll<ReviewRow>`
      SELECT * FROM reviews
      WHERE listing_id = ${listingId}
      ORDER BY created_at DESC
    `;
    return { reviews: reviews.map(mapReview) };
  },
);

export const createReview = api<CreateReviewParams, { review: ReviewRecord }>(
  { expose: true, method: "POST", path: "/reviews", auth: true },
  async (params) => {
    const auth = requireAuth();
    const id = randomUUID();
    const now = new Date().toISOString();

    await reviewsDB.exec`
      INSERT INTO reviews (
        id, listing_id, booking_id, guest_id, host_id, cleanliness, accuracy,
        communication, location, value, comment, status, created_at
      )
      VALUES (
        ${id}, ${params.listingId}, ${params.bookingId}, ${auth.userID}, ${params.hostId},
        ${params.cleanliness}, ${params.accuracy}, ${params.communication}, ${params.location},
        ${params.value}, ${params.comment}, ${"pending"}, ${now}
      )
    `;

    await platformEvents.publish({
      type: "review.submitted",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({ listingId: params.listingId, bookingId: params.bookingId }),
    });

    return {
      review: {
        ...params,
        id,
        guestId: auth.userID,
        status: "pending",
        createdAt: now,
      },
    };
  },
);

export const listAllReviews = api<void, { reviews: ReviewRecord[] }>(
  { expose: true, method: "GET", path: "/admin/reviews", auth: true },
  async () => {
    requireRole("admin", "support");
    const reviews = await reviewsDB.queryAll<ReviewRow>`
      SELECT * FROM reviews
      ORDER BY created_at DESC
    `;
    return { reviews: reviews.map(mapReview) };
  },
);

export const updateReviewStatus = api<{ reviewId: string; status: ReviewStatus }, { review: ReviewRecord }>(
  { expose: true, method: "PATCH", path: "/admin/reviews/:reviewId", auth: true },
  async ({ reviewId, status }) => {
    requireRole("admin", "support");
    const existing = await reviewsDB.queryRow<ReviewRow>`
      SELECT * FROM reviews WHERE id = ${reviewId}
    `;
    if (!existing) throw APIError.notFound("Review not found.");

    await reviewsDB.exec`
      UPDATE reviews
      SET status = ${status}
      WHERE id = ${reviewId}
    `;

    return {
      review: mapReview({
        ...existing,
        status,
      }),
    };
  },
);

export const deleteReview = api<{ reviewId: string }, { deleted: true }>(
  { expose: true, method: "DELETE", path: "/admin/reviews/:reviewId", auth: true },
  async ({ reviewId }) => {
    requireRole("admin", "support");
    await reviewsDB.exec`
      DELETE FROM reviews WHERE id = ${reviewId}
    `;
    return { deleted: true };
  },
);
