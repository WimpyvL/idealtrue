import { APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { extractPrimaryYocoSignature, verifyYocoWebhookSignatureValue } from "./yoco-signature";

export const yocoSecretKey = secret<"YOCO_SECRET_KEY">("YOCO_SECRET_KEY");
export const yocoTestSecretKey = secret<"YOCO_TEST_SECRET_KEY">("YOCO_TEST_SECRET_KEY");
export const yocoWebhookSecret = secret<"YOCO_WEBHOOK_SECRET">("YOCO_WEBHOOK_SECRET");
export const idealStayAppUrl = secret<"IDEAL_STAY_APP_URL">("IDEAL_STAY_APP_URL");
export const yocoPaymentMode = secret<"YOCO_PAYMENT_MODE">("YOCO_PAYMENT_MODE");

const YOCO_API_BASE = process.env.YOCO_API_BASE || "https://payments.yoco.com/api";
const YOCO_REST_API_BASE = process.env.YOCO_REST_API_BASE || "https://api.yoco.com/v1";
const DEFAULT_APP_URL = "https://idealstay.co.za";
const YOCO_FETCH_RETRY_DELAYS_MS = [250, 750];

export interface YocoCheckoutRequest {
  amount: number;
  currency: "ZAR";
  cancelUrl: string;
  successUrl: string;
  failureUrl?: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
}

export interface YocoCheckoutResponse {
  id: string;
  redirectUrl: string;
  status?: string;
  paymentId?: string | null;
  mode?: string;
  processingMode?: "live" | "test";
}

export interface YocoCheckoutStatusResponse {
  id: string;
  status?: string;
  paymentId?: string | null;
  payment_id?: string | null;
  orderId?: string | null;
  order_id?: string | null;
}

export type YocoProviderMode = "live" | "test";

export interface YocoWebhookEvent {
  id?: string;
  type?: string;
  payload?: {
    id?: string;
    order_id?: string;
    orderId?: string;
    status?: string;
    metadata?: Record<string, string>;
    paymentId?: string;
  };
}

export interface YocoOrderResponse {
  id: string;
  status: "open" | "completed" | "cancelled" | string;
  payments?: Array<{
    id?: string;
    order_id?: string;
    status?: "approved" | "failed" | "cancelled" | string;
    payment_source?: string;
  }>;
}

function readOptionalSecret(resolve: () => string) {
  try {
    return resolve();
  } catch {
    return "";
  }
}

function getYocoProviderMode(): YocoProviderMode {
  const configured = (readOptionalSecret(yocoPaymentMode) || process.env.YOCO_PAYMENT_MODE || "test").trim().toLowerCase();
  if (configured === "test") {
    return "test";
  }
  return "live";
}

function getYocoApiKey() {
  const mode = getYocoProviderMode();
  const apiKey = mode === "test" ? yocoTestSecretKey() : yocoSecretKey();
  if (!apiKey) {
    throw APIError.unavailable(mode === "test" ? "YOCO_TEST_SECRET_KEY is not configured." : "YOCO_SECRET_KEY is not configured.");
  }
  return { apiKey, mode };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Author: ( |╲ ) Klaasvaakie
async function fetchYocoWithRetry(url: string, init: RequestInit, operation: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= YOCO_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === YOCO_FETCH_RETRY_DELAYS_MS.length) {
        break;
      }
      await wait(YOCO_FETCH_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw APIError.unavailable(`${operation} could not reach Yoco: ${getErrorMessage(lastError)}`);
}

export function getAppUrl() {
  return (idealStayAppUrl() || DEFAULT_APP_URL).replace(/\/+$/, "");
}

export async function createYocoCheckout(input: YocoCheckoutRequest): Promise<YocoCheckoutResponse> {
  const { apiKey, mode } = getYocoApiKey();

  const idempotencyKey = input.idempotencyKey || input.metadata.checkoutId || input.metadata.externalId;

  const response = await fetchYocoWithRetry(`${YOCO_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(input),
  }, "Yoco checkout creation");

  if (!response.ok) {
    const body = await response.text();
    const replayed = response.headers.get("Idempotent-Replayed");
    const replaySuffix = replayed === "true" ? " (idempotent replay)" : "";
    throw APIError.unavailable(`Yoco checkout creation failed${replaySuffix}: ${body || response.statusText}`);
  }

  const checkout = (await response.json()) as YocoCheckoutResponse;
  if (!checkout.id || !checkout.redirectUrl) {
    throw APIError.unavailable("Yoco checkout creation returned an invalid response.");
  }
  return { ...checkout, processingMode: checkout.processingMode ?? mode };
}

// Author: (|╲) Klaasvaakie
export async function fetchYocoCheckout(checkoutId: string): Promise<YocoCheckoutStatusResponse> {
  const { apiKey } = getYocoApiKey();

  const response = await fetchYocoWithRetry(`${YOCO_API_BASE}/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }, "Yoco checkout lookup");

  if (!response.ok) {
    const body = await response.text();
    throw APIError.unavailable(`Yoco checkout lookup failed: ${body || response.statusText}`);
  }

  return response.json() as Promise<YocoCheckoutStatusResponse>;
}

export async function fetchYocoOrder(orderId: string): Promise<YocoOrderResponse> {
  const { apiKey } = getYocoApiKey();

  const response = await fetchYocoWithRetry(`${YOCO_REST_API_BASE}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }, "Yoco order lookup");

  if (!response.ok) {
    const body = await response.text();
    throw APIError.unavailable(`Yoco order lookup failed: ${body || response.statusText}`);
  }

  return response.json() as Promise<YocoOrderResponse>;
}

export function verifyYocoWebhookSignature(params: {
  rawBody: string;
  signature?: string;
  webhookId?: string;
  webhookTimestamp?: string;
}) {
  const signingSecret = yocoWebhookSecret();
  if (!signingSecret) {
    throw APIError.unavailable("YOCO_WEBHOOK_SECRET is not configured.");
  }
  if (!params.signature || !params.webhookId || !params.webhookTimestamp) {
    throw APIError.permissionDenied("Missing Yoco webhook signature.");
  }

  const timestampMs = Number(params.webhookTimestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    throw APIError.permissionDenied("Invalid Yoco webhook timestamp.");
  }

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > 3 * 60 * 1000) {
    throw APIError.permissionDenied("Yoco webhook timestamp is outside the replay window.");
  }

  const primarySignature = extractPrimaryYocoSignature(params.signature);
  if (!primarySignature) {
    throw APIError.permissionDenied("Yoco webhook signature is malformed.");
  }

  if (!verifyYocoWebhookSignatureValue({
    rawBody: params.rawBody,
    signature: params.signature,
    webhookId: params.webhookId,
    webhookTimestamp: params.webhookTimestamp,
    signingSecret,
  })) {
    throw APIError.permissionDenied("Invalid Yoco webhook signature.");
  }
}
