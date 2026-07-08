import { Topic } from "encore.dev/pubsub";
import type { Attribute } from "encore.dev/pubsub";

export interface BillingWebhookEventMessage {
  eventId: Attribute<string>;
}

export const billingWebhookEvents = new Topic<BillingWebhookEventMessage>("billing-webhook-events", {
  deliveryGuarantee: "at-least-once",
  orderingAttribute: "eventId",
});
