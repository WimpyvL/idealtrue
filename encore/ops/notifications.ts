import { randomUUID } from "node:crypto";
import { opsDB } from "./db";
import {
  buildBookingRequestedNotification,
  buildBookingStatusChangedNotification,
  buildMessageReceivedNotification,
  buildPaymentProofSubmittedNotification,
  buildReferralRewardEarnedNotification,
  type NotificationInput,
} from "./notification-builders";

export interface StoredNotification extends NotificationInput {
  id: string;
  createdAt: string;
}

export async function createNotification(input: NotificationInput): Promise<StoredNotification> {
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
}) {
  return createNotification(buildMessageReceivedNotification(params));
}

export async function notifyReferralRewardEarned(params: {
  referrerId: string;
  amount: number;
}) {
  return createNotification(buildReferralRewardEarnedNotification(params));
}
