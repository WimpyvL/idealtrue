import { APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createHmac, timingSafeEqual } from "node:crypto";

export const yocoSecretKey = secret<"YOCO_SECRET_KEY">("YOCO_SECRET_KEY");
export const yocoWebhookSecret = secret<"YOCO_WEBHOOK_SECRET">("YOCO_WEBHOOK_SECRET");
export const idealStayAppUrl = secret<"IDEAL_STAY_APP_URL">("IDEAL_STAY_APP_URL");

const YOCO_API_BASE = process.env.YOCO_API_BASE || "https://payments.yoco.com/api";
const DEFAULT_APP_URL = "https://ideal-stay.vercel.app";

export interface YocoCheckoutRequest {
  amount: number;
  currency: "ZAR";
  cancelUrl: string;
  successUrl: string;
  failureUrl?: string;
  metadata: Record<string, string>;
}

export interface YocoCheckoutResponse {
  id: string;
  redirectUrl: string;
  status?: string;
  mode?: string;
}

export interface YocoWebhookEvent {
  id?: string;
  type?: string;
  payload?: {
    id?: string;
    status?: string;
    metadata?: Record<string, string>;
    paymentId?: string;
  };
}

export function getAppUrl() {
  return (idealStayAppUrl() || DEFAULT_APP_URL).replace(/\/+$/, "");
}

export async function createYocoCheckout(input: YocoCheckoutRequest): Promise<YocoCheckoutResponse> {
  const apiKey = yocoSecretKey();
  if (!apiKey) {
    throw APIError.unavailable("YOCO_SECRET_KEY is not configured.");
  }

  const response = await fetch(`${YOCO_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw APIError.internal(`Yoco checkout creation failed: ${body || response.statusText}`);
  }

  return response.json() as Promise<YocoCheckoutResponse>;
}

function extractPrimarySignature(signatureHeader: string) {
  return signatureHeader
    .split(/\s+/)
    .map((part) => part.trim())
    .find((part) => part.startsWith("v1,"))
    ?.slice(3);
}

function parseSigningSecret(rawSecret: string) {
  const encoded = rawSecret.startsWith("whsec_") ? rawSecret.slice("whsec_".length) : rawSecret;
  return Buffer.from(encoded, "base64");
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

  const primarySignature = extractPrimarySignature(params.signature);
  if (!primarySignature) {
    throw APIError.permissionDenied("Yoco webhook signature is malformed.");
  }

  const signedContent = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
  const expected = createHmac("sha256", parseSigningSecret(signingSecret))
    .update(signedContent)
    .digest("base64");
  const received = primarySignature.trim();

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw APIError.permissionDenied("Invalid Yoco webhook signature.");
  }
}
