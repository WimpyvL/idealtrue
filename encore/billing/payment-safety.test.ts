import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { billingDB } from "./db";
import { billingPaymentReturn, processStoredYocoWebhookEvent, requeueUnprocessedYocoWebhooks, runPendingBillingPaymentReconciliation } from "./api";
import { fetchYocoCheckout } from "./yoco";

// Only the external provider is mocked; Encore provisions the SQL databases.
vi.mock("./yoco", async (importOriginal) => ({
  ...await importOriginal<typeof import("./yoco")>(),
  getAppUrl: () => "http://localhost:3000",
  fetchYocoCheckout: vi.fn(async () => ({ status: "pending" })),
}));

const ids: string[] = [];
async function intent(mode: "live" | "test" = "test") {
  const id = `safety-${randomUUID()}`;
  ids.push(id);
  await billingDB.exec`
    INSERT INTO billing_payment_intents
      (id, user_id, purpose, amount, credit_quantity, customer_reference, provider_mode, provider_checkout_id)
    VALUES (${id}, ${id}, 'content_credits', 100, 5, ${id}, ${mode}, ${id})
  `;
  return id;
}

async function paymentState(id: string) {
  return billingDB.queryRow<{ status: string }>`SELECT status FROM billing_payment_intents WHERE id = ${id}`;
}

async function returnToApp(id: string, hint = "success") {
  const req = { url: `/billing/payments/${id}/return?billingStatus=${hint}` } as IncomingMessage;
  const res = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 } as unknown as ServerResponse;
  await billingPaymentReturn(req, res);
}

afterEach(async () => {
  vi.mocked(fetchYocoCheckout).mockReset();
  vi.mocked(fetchYocoCheckout).mockResolvedValue({ id: "unused", status: "pending" });
  for (const id of ids.splice(0)) {
    await billingDB.exec`DELETE FROM billing_webhook_events WHERE id = ${id}`;
    await billingDB.exec`DELETE FROM content_credit_ledger WHERE reference_id = ${id}`;
    await billingDB.exec`DELETE FROM content_credit_wallets WHERE user_id = ${id}`;
    await billingDB.exec`DELETE FROM billing_payment_intents WHERE id = ${id}`;
  }
});

describe.sequential("payment trust boundary with real Encore databases", () => {
  it("does not accept success hints as settlement through the public return route", async () => {
    for (const hint of ["success", "%73uccess", "SUCCESS"]) {
      const id = await intent();
      await returnToApp(id, hint);
      expect((await paymentState(id))?.status).toBe("pending");
      const wallet = await billingDB.queryRow`SELECT * FROM content_credit_wallets WHERE user_id = ${id}`;
      expect(wallet).toBeNull();
    }
  });

  it("records verified test settlement without creating spendable credits", async () => {
    const id = await intent();
    vi.mocked(fetchYocoCheckout).mockResolvedValue({ id, status: "completed", paymentId: "test-payment" });
    await returnToApp(id);
    expect((await paymentState(id))?.status).toBe("paid");
    expect(await billingDB.queryRow`SELECT * FROM content_credit_wallets WHERE user_id = ${id}`).toBeNull();
  });

  it("preserves live credit fulfilment and duplicate idempotency", async () => {
    const id = await intent("live");
    vi.mocked(fetchYocoCheckout).mockResolvedValue({ id, status: "completed", paymentId: "live-payment" });
    await returnToApp(id);
    await returnToApp(id);
    expect((await paymentState(id))?.status).toBe("paid");
    const wallet = await billingDB.queryRow<{ balance: number }>`SELECT balance FROM content_credit_wallets WHERE user_id = ${id}`;
    expect(wallet?.balance).toBe(5);
  });

  it("does not borrow the transaction of an overlapping reconciliation", async () => {
    const a = await intent();
    const b = await intent();
    let releaseA!: () => void;
    let releaseB!: () => void;
    let startedA!: () => void;
    let startedB!: () => void;
    const aStarted = new Promise<void>((resolve) => { startedA = resolve; });
    const bStarted = new Promise<void>((resolve) => { startedB = resolve; });
    const aGate = new Promise<void>((resolve) => { releaseA = resolve; });
    const bGate = new Promise<void>((resolve) => { releaseB = resolve; });
    vi.mocked(fetchYocoCheckout).mockImplementation(async (id) => {
      if (id === a) { startedA(); await aGate; }
      if (id === b) { startedB(); await bGate; }
      return { id, status: "completed" };
    });
    const first = returnToApp(a, "failed");
    await aStarted;
    const second = returnToApp(b, "failed");
    try {
      await bStarted;
      releaseA();
      await first;
      expect((await paymentState(a))?.status).toBe("paid");
      expect((await paymentState(b))?.status).toBe("pending");
    } finally {
      releaseA();
      releaseB();
      await Promise.all([first, second]);
    }
    expect((await paymentState(b))?.status).toBe("paid");
  });

  it("also isolates provider-confirmed test payments arriving via stored webhooks", async () => {
    const id = await intent();
    const payload = JSON.stringify({ type: "payment.succeeded", payload: { id: "test-provider-id", metadata: { paymentIntentId: id, userId: id } } });
    await billingDB.exec`INSERT INTO billing_webhook_events (id, event_type, payload) VALUES (${id}, 'payment.succeeded', ${payload}::jsonb)`;
    const storedPayload = await billingDB.queryRow<{ payload_type: string; payload_json: string }>`SELECT jsonb_typeof(payload) AS payload_type, payload::text AS payload_json FROM billing_webhook_events WHERE id = ${id}`;
    expect(storedPayload?.payload_type, storedPayload?.payload_json).toBe("object");
    await processStoredYocoWebhookEvent(id);
    expect((await paymentState(id))?.status).toBe("paid");
    expect(await billingDB.queryRow`SELECT * FROM content_credit_wallets WHERE user_id = ${id}`).toBeNull();
  });

  it("requeues durable events without requiring another provider delivery", async () => {
    const id = `safety-${randomUUID()}`;
    ids.push(id);
    await billingDB.exec`INSERT INTO billing_webhook_events (id, event_type, payload) VALUES (${id}, 'unrelated.event', '{}'::jsonb)`;
    const result = await requeueUnprocessedYocoWebhooks();
    expect(result.failed).toBe(0);
    expect(result.queued).toBeGreaterThanOrEqual(1);
    const stored = await billingDB.queryRow<{ dispatch_attempted_at: string | null }>`SELECT dispatch_attempted_at FROM billing_webhook_events WHERE id = ${id}`;
    expect(stored?.dispatch_attempted_at).not.toBeNull();
  });

  it("gives later pending payments a turn even when the oldest 50 remain pending", async () => {
    for (let index = 0; index < 55; index += 1) await intent();
    const first = await runPendingBillingPaymentReconciliation();
    const second = await runPendingBillingPaymentReconciliation();
    expect(first.checked).toBe(50);
    expect(second.checked).toBe(5);
    expect(first.pending + second.pending).toBe(55);
  });
});
