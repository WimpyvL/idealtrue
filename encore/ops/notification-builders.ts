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

export function buildInquiryStatusChangedNotification(params: {
  guestId: string;
  inquiryState: "VIEWED" | "RESPONDED" | "APPROVED" | "DECLINED" | "EXPIRED" | "BOOKED";
  listingTitle: string;
}): NotificationInput {
  const statusMessage = {
    VIEWED: `Your inquiry for ${params.listingTitle} has been viewed.`,
    RESPONDED: `The host responded to your inquiry for ${params.listingTitle}.`,
    APPROVED: `${params.listingTitle} is ready for payment.`,
    DECLINED: `Your inquiry for ${params.listingTitle} was declined.`,
    EXPIRED: `Your inquiry for ${params.listingTitle} expired before it was confirmed.`,
    BOOKED: `Your stay at ${params.listingTitle} is confirmed.`,
  }[params.inquiryState];

  return {
    title: "Inquiry updated",
    message: statusMessage,
    type:
      params.inquiryState === "BOOKED" || params.inquiryState === "APPROVED"
        ? "success"
        : params.inquiryState === "DECLINED" || params.inquiryState === "EXPIRED"
          ? "warning"
          : "info",
    target: params.guestId,
    actionPath: "/guest",
  };
}

export function buildInquiryApprovedNotification(params: {
  guestId: string;
  listingTitle: string;
}): NotificationInput {
  return {
    title: "Payment unlocked",
    message: `${params.listingTitle} is approved and ready for payment.`,
    type: "success",
    target: params.guestId,
    actionPath: "/guest",
  };
}

export function buildPaymentCompletedNotification(params: {
  target: string;
  listingTitle: string;
  isHost: boolean;
}): NotificationInput {
  return {
    title: "Booking confirmed",
    message: params.isHost
      ? `Payment completed for ${params.listingTitle}. The stay is now booked.`
      : `Payment completed for ${params.listingTitle}. Your stay is confirmed.`,
    type: "success",
    target: params.target,
    actionPath: params.isHost ? "/host/enquiries" : "/guest",
  };
}

export function buildPaymentInitiatedNotification(params: {
  guestId: string;
  listingTitle: string;
}): NotificationInput {
  return {
    title: "Payment ready",
    message: `${params.listingTitle} has been approved. You can complete payment now.`,
    type: "info",
    target: params.guestId,
    actionPath: "/guest",
  };
}

export function buildPaymentFailedNotification(params: {
  guestId: string;
  listingTitle: string;
}): NotificationInput {
  return {
    title: "Payment failed",
    message: `Payment for ${params.listingTitle} failed. You can retry while the inquiry remains approved.`,
    type: "warning",
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
