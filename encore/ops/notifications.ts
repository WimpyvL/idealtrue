import { randomUUID } from "node:crypto";
import { opsDB } from "./db";
import {
  buildBookingRequestedNotification,
  buildBookingStatusChangedNotification,
  buildCheckoutStatusChangedNotification,
  buildContentCreditsPurchasedNotification,
  buildKycReviewedNotification,
  buildListingReviewedNotification,
  buildMessageReceivedNotification,
  buildPaymentProofSubmittedNotification,
  buildReferralRewardEarnedNotification,
  buildSubscriptionActivatedNotification,
  type NotificationInput,
} from "./notification-builders";

export interface StoredNotification extends NotificationInput {
  id: string;
  createdAt: string;
}

const NOTIFICATION_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export async function createNotification(input: NotificationInput): Promise<StoredNotification> {
  const dedupeCutoff = new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_MS).toISOString();
  const existing = await opsDB.queryRow<{ id: string; created_at: string }>`
    SELECT id, created_at
    FROM notifications
    WHERE title = ${input.title}
      AND message = ${input.message}
      AND type = ${input.type}
      AND target = ${input.target}
      AND action_path IS NOT DISTINCT FROM ${input.actionPath ?? null}
      AND created_at >= ${dedupeCutoff}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (existing) {
    return {
      id: existing.id,
      createdAt: existing.created_at,
      ...input,
      actionPath: input.actionPath ?? null,
    };
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await opsDB.exec`
    INSERT INTO notifications (id, title, message, type, target, action_path, created_at)
    VALUES (${id}, ${input.title}, ${input.message}, ${input.type}, ${input.target}, ${input.actionPath ?? null}, ${createdAt})
  `;

  return {
    id,
    createdAt,
    ...input,
    actionPath: input.actionPath ?? null,
  };
}

export async function notifyBookingRequested(params: {
  hostId: string;
  listingTitle: string;
  bookingId: string;
}) {
  return createNotification(buildBookingRequestedNotification(params));
}

export async function notifyBookingStatusChanged(params: {
  guestId: string;
  status: "awaiting_guest_payment" | "confirmed" | "cancelled" | "completed" | "declined";
  listingTitle: string;
}) {
  return createNotification(buildBookingStatusChangedNotification(params));
}

export async function notifyPaymentProofSubmitted(params: {
  hostId: string;
  listingTitle: string;
}) {
  return createNotification(buildPaymentProofSubmittedNotification(params));
}

export async function notifyMessageReceived(params: {
  receiverId: string;
  listingTitle: string;
  actionPath: string;
}) {
  return createNotification(buildMessageReceivedNotification(params));
}

export async function notifyReferralRewardEarned(params: {
  referrerId: string;
  amount: number;
}) {
  return createNotification(buildReferralRewardEarnedNotification(params));
}

export async function notifyKycReviewed(params: {
  userId: string;
  status: "verified" | "rejected";
  rejectionReason?: string | null;
}) {
  return createNotification(buildKycReviewedNotification(params));
}

export async function notifyListingReviewed(params: {
  hostId: string;
  listingTitle: string;
  status: "active" | "rejected";
  rejectionReason?: string | null;
}) {
  return createNotification(buildListingReviewedNotification(params));
}

export async function notifySubscriptionActivated(params: {
  userId: string;
  plan: string;
  billingInterval: "monthly" | "annual";
}) {
  return createNotification(buildSubscriptionActivatedNotification(params));
}

export async function notifyContentCreditsPurchased(params: {
  userId: string;
  credits: number;
}) {
  return createNotification(buildContentCreditsPurchasedNotification(params));
}

export async function notifyCheckoutStatusChanged(params: {
  userId: string;
  checkoutType: "subscription" | "content_credits";
  status: "failed" | "cancelled";
  hostPlan?: string | null;
  creditQuantity?: number | null;
}) {
  return createNotification(buildCheckoutStatusChangedNotification(params));
}
