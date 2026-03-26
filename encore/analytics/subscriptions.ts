import { Subscription } from "encore.dev/pubsub";
import { platformEvents } from "./events";
import { analyticsDB } from "./db";

export const analyticsEventProjection = new Subscription(
  platformEvents,
  "analytics-event-projection",
  {
    handler: async (event) => {
      await analyticsDB.rawExec(
        `
        INSERT INTO event_counters (event_type, total_count, updated_at)
        VALUES ($1, 1, NOW())
        ON CONFLICT (event_type)
        DO UPDATE SET
          total_count = event_counters.total_count + 1,
          updated_at = NOW()
        `,
        event.type,
      );
    },
  },
);
