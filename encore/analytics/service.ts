import { api } from "encore.dev/api";
import { analyticsDB } from "./db";
import { requireRole } from "../shared/auth";

export const listEventCounters = api<void, { counters: { eventType: string; totalCount: number; updatedAt: string }[] }>(
  { expose: true, method: "GET", path: "/analytics/events", auth: true },
  async () => {
    requireRole("admin", "support");
    const counters = await analyticsDB.rawQueryAll<{
      event_type: string;
      total_count: number;
      updated_at: string;
    }>(`SELECT event_type, total_count, updated_at FROM event_counters ORDER BY event_type ASC`);

    return {
      counters: counters.map((item) => ({
        eventType: item.event_type,
        totalCount: item.total_count,
        updatedAt: item.updated_at,
      })),
    };
  },
);

export const compactEventCounters = api(
  { expose: false, method: "POST", path: "/analytics/internal/compact" },
  async () => {
    await analyticsDB.rawExec(
      `
      UPDATE event_counters
      SET updated_at = NOW()
      WHERE total_count >= 0
      `,
    );
    return { ok: true };
  },
);
