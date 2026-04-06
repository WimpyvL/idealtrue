export type NotificationType = "info" | "warning" | "success" | "error";

export interface NotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  target: string;
  actionPath?: string | null;
}

export function buildBookingRequestedNotification(params: {
  hostId: string;
  listingTitle: string;
  bookingId: string;
}): NotificationInput {
  return {
    title: "New booking request",
    message: `A guest requested a booking for ${params.listingTitle}.`,
    type: "info",
    target: params.hostId,
    actionPath: "/host/enquiries",
  };
}

export function buildBookingStatusChangedNotification(params: {
  guestId: string;
  status: "awaiting_guest_payment" | "confirmed" | "cancelled" | "completed" | "declined";
  listingTitle: string;
}): NotificationInput {
  const statusMessage = {
    awaiting_guest_payment: `Payment has been requested for ${params.listingTitle}.`,
    confirmed: `Your booking for ${params.listingTitle} is confirmed.`,
    cancelled: `Your booking for ${params.listingTitle} was cancelled.`,
    completed: `Your stay at ${params.listingTitle} was marked complete.`,
    declined: `Your booking for ${params.listingTitle} was declined.`,
  }[params.status];

  return {
    title: "Booking updated",
    message: statusMessage,
    type: params.status === "confirmed" ? "success" : params.status === "cancelled" || params.status === "declined" ? "warning" : "info",
    target: params.guestId,
    actionPath: "/guest",
  };
}

export function buildPaymentProofSubmittedNotification(params: {
  hostId: string;
  listingTitle: string;
}): NotificationInput {
  return {
    title: "Payment proof submitted",
    message: `A guest submitted payment proof for ${params.listingTitle}.`,
    type: "info",
    target: params.hostId,
    actionPath: "/host/enquiries",
  };
}

export function buildMessageReceivedNotification(params: {
  receiverId: string;
  listingTitle: string;
  actionPath: string;
}): NotificationInput {
  return {
    title: "New message",
    message: `You have a new message about ${params.listingTitle}.`,
    type: "info",
    target: params.receiverId,
    actionPath: params.actionPath,
  };
}

export function buildReferralRewardEarnedNotification(params: {
  referrerId: string;
  amount: number;
}): NotificationInput {
  return {
    title: "Referral reward earned",
    message: `You earned a referral reward of R${params.amount}.`,
    type: "success",
    target: params.referrerId,
    actionPath: "/referral",
  };
}

export function buildKycReviewedNotification(params: {
  userId: string;
  status: "verified" | "rejected";
  rejectionReason?: string | null;
}): NotificationInput {
  return {
    title: params.status === "verified" ? "KYC approved" : "KYC needs attention",
    message:
      params.status === "verified"
        ? "Your identity verification has been approved."
        : params.rejectionReason?.trim()
          ? `Your identity verification was rejected: ${params.rejectionReason.trim()}`
          : "Your identity verification was rejected. Review your documents and try again.",
    type: params.status === "verified" ? "success" : "warning",
    target: params.userId,
    actionPath: "/account",
  };
}

export function buildListingReviewedNotification(params: {
  hostId: string;
  listingTitle: string;
  status: "active" | "rejected";
  rejectionReason?: string | null;
}): NotificationInput {
  return {
    title: params.status === "active" ? "Listing approved" : "Listing rejected",
    message:
      params.status === "active"
        ? `${params.listingTitle} is now live.`
        : params.rejectionReason?.trim()
          ? `${params.listingTitle} was rejected: ${params.rejectionReason.trim()}`
          : `${params.listingTitle} was rejected during admin review.`,
    type: params.status === "active" ? "success" : "warning",
    target: params.hostId,
    actionPath: "/host/listings",
  };
}

export function buildSubscriptionActivatedNotification(params: {
  userId: string;
  plan: string;
  billingInterval: "monthly" | "annual";
}): NotificationInput {
  const intervalLabel = params.billingInterval === "annual" ? "annual" : "monthly";

  return {
    title: "Subscription activated",
    message: `Your ${params.plan} ${intervalLabel} plan is now active.`,
    type: "success",
    target: params.userId,
    actionPath: "/pricing",
  };
}

export function buildContentCreditsPurchasedNotification(params: {
  userId: string;
  credits: number;
}): NotificationInput {
  return {
    title: "Content credits added",
    message: `${params.credits} content credits were added to your balance.`,
    type: "success",
    target: params.userId,
    actionPath: "/host/social",
  };
}

export function buildCheckoutStatusChangedNotification(params: {
  userId: string;
  checkoutType: "subscription" | "content_credits";
  status: "failed" | "cancelled";
  hostPlan?: string | null;
  creditQuantity?: number | null;
}): NotificationInput {
  const targetThing =
    params.checkoutType === "subscription"
      ? `${params.hostPlan ?? "selected"} plan subscription`
      : `${params.creditQuantity ?? "selected"} content credit purchase`;

  return {
    title: params.status === "failed" ? "Payment failed" : "Payment cancelled",
    message:
      params.status === "failed"
        ? `Your ${targetThing} payment did not complete. Try again when you're ready.`
        : `Your ${targetThing} checkout was cancelled before payment completed.`,
    type: params.status === "failed" ? "error" : "warning",
    target: params.userId,
    actionPath: params.checkoutType === "subscription" ? "/pricing" : "/host/social",
  };
}

export function buildAccountStatusChangedNotification(params: {
  userId: string;
  status: "active" | "suspended" | "deactivated";
  reason?: string | null;
}): NotificationInput {
  if (params.status === "active") {
    return {
      title: "Account reactivated",
      message: "Your account access has been restored.",
      type: "success",
      target: params.userId,
      actionPath: "/account",
    };
  }

  const baseMessage =
    params.status === "suspended"
      ? "Your account has been suspended."
      : "Your account has been deactivated.";
  const detail = params.reason?.trim();

  return {
    title: params.status === "suspended" ? "Account suspended" : "Account deactivated",
    message: detail ? `${baseMessage} ${detail}` : `${baseMessage} Contact support if you need help.`,
    type: params.status === "suspended" ? "warning" : "error",
    target: params.userId,
    actionPath: "/account",
  };
}
