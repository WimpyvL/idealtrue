import { Subscription } from "encore.dev/pubsub";
import { platformEvents } from "../analytics/events";
import {
  notifyBookingRequested,
  notifyInquiryStatusChanged,
  notifyPaymentCompleted,
  notifyPaymentFailed,
  notifyPaymentInitiated,
  notifyPaymentProofSubmitted,
} from "./notifications";

type InquiryEventPayload = {
  listingId: string;
  listingTitle: string;
  guestId: string;
  hostId: string;
  inquiryState: "PENDING" | "VIEWED" | "RESPONDED" | "APPROVED" | "DECLINED" | "EXPIRED" | "BOOKED";
  paymentState: "UNPAID" | "INITIATED" | "COMPLETED" | "FAILED";
  paymentSubmittedAt?: string | null;
  actor: "host" | "system" | "guest";
};

export const inquiryNotificationProjection = new Subscription(
  platformEvents,
  "inquiry-notification-projection",
  {
    handler: async (event) => {
      if (!event.type.startsWith("inquiry.")) {
        return;
      }

      const payload = JSON.parse(event.payload) as InquiryEventPayload;
      const listingTitle = payload.listingTitle || "your stay";

      if (event.type === "inquiry.created") {
        await notifyBookingRequested({
          hostId: payload.hostId,
          listingTitle,
          bookingId: event.aggregateId,
        });
        return;
      }

      if (event.type === "inquiry.status_changed") {
        if (["VIEWED", "RESPONDED", "APPROVED", "DECLINED", "EXPIRED", "BOOKED"].includes(payload.inquiryState)) {
          await notifyInquiryStatusChanged({
            guestId: payload.guestId,
            inquiryState: payload.inquiryState as "VIEWED" | "RESPONDED" | "APPROVED" | "DECLINED" | "EXPIRED" | "BOOKED",
            listingTitle,
          });
        }
        return;
      }

      if (event.type === "inquiry.payment_submitted") {
        await notifyPaymentProofSubmitted({
          hostId: payload.hostId,
          listingTitle,
        });
        return;
      }

      if (event.type === "inquiry.payment_changed") {
        if (payload.paymentState === "INITIATED") {
          await notifyPaymentInitiated({
            guestId: payload.guestId,
            listingTitle,
          });
          return;
        }

        if (payload.paymentState === "FAILED") {
          await notifyPaymentFailed({
            guestId: payload.guestId,
            listingTitle,
          });
          return;
        }

        if (payload.paymentState === "COMPLETED") {
          await notifyPaymentCompleted({
            guestId: payload.guestId,
            hostId: payload.hostId,
            listingTitle,
          });
        }
      }
    },
  },
);
