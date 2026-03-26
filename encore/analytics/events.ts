import { Topic } from "encore.dev/pubsub";
import type { Attribute } from "encore.dev/pubsub";
 
export interface PlatformEvent {
  type: string;
  aggregateId: Attribute<string>;
  actorId: Attribute<string>;
  occurredAt: string;
  payload: string;
}

export const platformEvents = new Topic<PlatformEvent>("platform-events", {
  deliveryGuarantee: "at-least-once",
  orderingAttribute: "aggregateId",
});
