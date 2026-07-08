import { Subscription } from "encore.dev/pubsub";
import { billingWebhookEvents } from "./webhook-events";
import { processStoredYocoWebhookEvent } from "./api";

export const yocoWebhookProcessor = new Subscription(
  billingWebhookEvents,
  "yoco-webhook-processor",
  {
    handler: async (event) => {
      await processStoredYocoWebhookEvent(event.eventId);
    },
  },
);
