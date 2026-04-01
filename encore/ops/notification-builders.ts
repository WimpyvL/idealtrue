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
}): NotificationInput {
  return {
    title: "New message",
    message: `You have a new message about ${params.listingTitle}.`,
    type: "info",
    target: params.receiverId,
    actionPath: null,
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
