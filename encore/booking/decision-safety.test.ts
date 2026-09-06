import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingDB } from "./db";
import { catalogDB } from "../catalog/db";
import { updateBookingStatus } from "./api";

vi.mock("../shared/auth", async (original) => ({
  ...await original<typeof import("../shared/auth")>(),
  requireRole: () => ({ userID: "decision-test-admin", role: "admin" }),
}));

const listings: string[] = [];
async function fixture(listingId?: string) {
  const id = `decision-${randomUUID()}`;
  if (!listingId) {
    listingId = id;
    listings.push(listingId);
    await catalogDB.exec`INSERT INTO listings (id, host_id, title, description, location, category, type, price_per_night)
      VALUES (${listingId}, 'decision-host', 'Decision test', 'Test', 'Test', 'stay', 'house', 100)`;
  }
  await bookingDB.exec`INSERT INTO bookings (id, listing_id, guest_id, host_id, check_in, check_out, total_price, expires_at)
    VALUES (${id}, ${listingId}, 'decision-guest', 'decision-host', '2030-01-10', '2030-01-12', 200, NOW() + INTERVAL '48 hours')`;
  return { id, listingId };
}
async function state(id: string) {
  return bookingDB.queryRow<{ inquiry_state: string; payment_state: string; expires_at: string; decline_reason: string; decline_reason_note: string }>`SELECT * FROM bookings WHERE id = ${id}`;
}
async function auditCount(id: string) {
  const row = await bookingDB.queryRow<{ count: number }>`SELECT count(*)::int AS count FROM inquiry_ledger WHERE inquiry_id = ${id}`;
  return row?.count;
}
afterEach(async () => {
  for (const listingId of listings.splice(0)) {
    await bookingDB.exec`DELETE FROM inquiry_ledger WHERE inquiry_id IN (SELECT id FROM bookings WHERE listing_id = ${listingId})`;
    await bookingDB.exec`DELETE FROM bookings WHERE listing_id = ${listingId}`;
    await catalogDB.exec`DELETE FROM listings WHERE id = ${listingId}`;
  }
});

describe.sequential("booking decisions with real databases", () => {
  it("approves with payment, audit and calendar hold; retry preserves expiry", async () => {
    const { id } = await fixture();
    await updateBookingStatus({ id, status: "APPROVED" });
    const approved = await state(id);
    expect(approved?.inquiry_state).toBe("APPROVED");
    expect(approved?.payment_state).toBe("INITIATED");
    expect(await auditCount(id)).toBe(2);
    expect(await catalogDB.queryRow`SELECT id FROM listing_availability_blocks WHERE source_id = ${id}`).not.toBeNull();
    await updateBookingStatus({ id, status: "APPROVED" });
    expect((await state(id))?.expires_at).toEqual(approved?.expires_at);
    expect(await auditCount(id)).toBe(2);
  });
  it("declines with a trimmed reason and no payment unlock; retry adds no audit", async () => {
    const { id } = await fixture();
    await updateBookingStatus({ id, status: "DECLINED", declineReason: "OTHER", declineReasonNote: "  Not suitable  " });
    expect(await state(id)).toMatchObject({ inquiry_state: "DECLINED", payment_state: "UNPAID", decline_reason_note: "Not suitable" });
    await updateBookingStatus({ id, status: "DECLINED", declineReason: "OTHER", declineReasonNote: "changed" });
    expect(await auditCount(id)).toBe(1);
    expect((await state(id))?.decline_reason_note).toBe("Not suitable");
  });
  it("rejects a missing decline reason without changing state or audit", async () => {
    const { id } = await fixture();
    await expect(updateBookingStatus({ id, status: "DECLINED" })).rejects.toThrow("decline reason");
    expect((await state(id))?.inquiry_state).toBe("PENDING");
    expect(await auditCount(id)).toBe(0);
  });
  it("allows only one competing approval or rejection", async () => {
    const { id } = await fixture();
    const results = await Promise.allSettled([
      updateBookingStatus({ id, status: "APPROVED" }),
      updateBookingStatus({ id, status: "DECLINED", declineReason: "HOST_UNAVAILABLE" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const current = await state(id);
    expect(current?.payment_state).toBe(current?.inquiry_state === "APPROVED" ? "INITIATED" : "UNPAID");
  });
  it("allows only one overlapping inquiry to be approved", async () => {
    const first = await fixture();
    const second = await fixture(first.listingId);
    const results = await Promise.allSettled([
      updateBookingStatus({ id: first.id, status: "APPROVED" }),
      updateBookingStatus({ id: second.id, status: "APPROVED" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const states = await Promise.all([state(first.id), state(second.id)]);
    expect(states.filter((row) => row?.inquiry_state === "APPROVED")).toHaveLength(1);
    expect(states.filter((row) => row?.inquiry_state === "PENDING" && row.payment_state === "UNPAID")).toHaveLength(1);
  });
  it("rolls back both decision and audits when final calendar reservation conflicts", async () => {
    const active = await fixture();
    await bookingDB.exec`UPDATE bookings SET inquiry_state = 'APPROVED', payment_state = 'INITIATED' WHERE id = ${active.id}`;
    const candidate = await fixture(active.listingId);
    await expect(updateBookingStatus({ id: candidate.id, status: "APPROVED" })).rejects.toThrow();
    expect(await state(candidate.id)).toMatchObject({ inquiry_state: "PENDING", payment_state: "UNPAID" });
    expect(await auditCount(candidate.id)).toBe(0);
  });
});
