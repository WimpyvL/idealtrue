import { randomUUID } from "node:crypto";
import { opsDB } from "./db";
import {
  buildAccountStatusChangedNotification,
  buildBookingRequestedNotification,
  buildCheckoutStatusChangedNotification,
  buildContentCreditsPurchasedNotification,
  buildInquiryStatusChangedNotification,
  buildKycReviewedNotification,
  buildListingReviewedNotification,
  buildManagedHostAdminAlertNotification,
  buildManagedHostOnboardingRequestedNotification,
  buildMessageReceivedNotification,
  buildPaymentCompletedNotification,
  buildPaymentFailedNotification,
  buildPaymentInitiatedNotification,
  buildPaymentProofSubmittedNotification,
  buildReferralRewardEarnedNotification,
  buildSubscriptionActivatedNotification,
  buildSubscriptionDeactivatedNotification,
  buildSubscriptionGracePeriodStartedNotification,
  buildSubscriptionRenewalDueNotification,
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

export async function notifyInquiryStatusChanged(params: {
  guestId: string;
  inquiryState: "VIEWED" | "RESPONDED" | "APPROVED" | "DECLINED" | "EXPIRED" | "BOOKED";
  listingTitle: string;
  declineReason?:
    | "DATES_UNAVAILABLE"
    | "GUEST_COUNT_NOT_SUPPORTED"
    | "BOOKING_REQUIREMENTS_NOT_MET"
    | "HOST_UNAVAILABLE"
    | "OTHER"
    | null;
  declineReasonNote?: string | null;
}) {
  return createNotification(buildInquiryStatusChangedNotification(params));
}

export async function notifyPaymentProofSubmitted(params: {
  hostId: string;
  listingTitle: string;
}) {
  return createNotification(buildPaymentProofSubmittedNotification(params));
}

export async function notifyPaymentInitiated(params: {
  guestId: string;
  listingTitle: string;
}) {
  return createNotification(buildPaymentInitiatedNotification(params));
}

export async function notifyPaymentFailed(params: {
  guestId: string;
  listingTitle: string;
}) {
  return createNotification(buildPaymentFailedNotification(params));
}

export async function notifyPaymentCompleted(params: {
  guestId: string;
  hostId: string;
  listingTitle: string;
}) {
  const [guestNotification, hostNotification] = await Promise.all([
    createNotification(buildPaymentCompletedNotification({ target: params.guestId, listingTitle: params.listingTitle, isHost: false })),
    createNotification(buildPaymentCompletedNotification({ target: params.hostId, listingTitle: params.listingTitle, isHost: true })),
  ]);

  return { guestNotification, hostNotification };
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
  program?: "host" | "guest";
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

export async function notifySubscriptionRenewalDue(params: {
  userId: string;
  plan: string;
  endsAt: string;
}) {
  return createNotification(buildSubscriptionRenewalDueNotification(params));
}

export async function notifySubscriptionGracePeriodStarted(params: {
  userId: string;
  plan: string;
  graceEndsAt: string;
}) {
  return createNotification(buildSubscriptionGracePeriodStartedNotification(params));
}

export async function notifySubscriptionDeactivated(params: {
  userId: string;
  plan: string;
}) {
  return createNotification(buildSubscriptionDeactivatedNotification(params));
}

export async function notifyContentCreditsPurchased(params: {
  userId: string;
  credits: number;
}) {
  return createNotification(buildContentCreditsPurchasedNotification(params));
}

export async function notifyCheckoutStatusChanged(params: {
  userId: string;
  checkoutType: "subscription" | "content_credits" | "host_billing_setup" | "managed_hosting";
  status: "failed" | "cancelled";
  hostPlan?: string | null;
  creditQuantity?: number | null;
}) {
  return createNotification(buildCheckoutStatusChangedNotification(params));
}

export async function notifyAccountStatusChanged(params: {
  userId: string;
  status: "active" | "suspended" | "deactivated";
  reason?: string | null;
}) {
  return createNotification(buildAccountStatusChangedNotification(params));
}

export async function notifyManagedHostSignupOnboarding(params: {
  userId: string;
  displayName: string;
  email: string;
}) {
  const [hostNotification, adminNotification] = await Promise.all([
    createNotification(buildManagedHostOnboardingRequestedNotification({ userId: params.userId })),
    createNotification(buildManagedHostAdminAlertNotification(params)),
  ]);

  return {
    hostNotification,
    adminNotification,
  };
}
