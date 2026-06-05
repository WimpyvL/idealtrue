import { createHmac, timingSafeEqual } from "node:crypto";

export function extractPrimaryYocoSignature(signatureHeader: string) {
  return signatureHeader
    .split(/\s+/)
    .map((part) => part.trim())
    .find((part) => part.startsWith("v1,"))
    ?.slice(3);
}

export function parseYocoSigningSecret(rawSecret: string) {
  const encoded = rawSecret.startsWith("whsec_") ? rawSecret.slice("whsec_".length) : rawSecret;
  return Buffer.from(encoded, "base64");
}

export function verifyYocoWebhookSignatureValue(params: {
  rawBody: string;
  signature: string;
  webhookId: string;
  webhookTimestamp: string;
  signingSecret: string;
}) {
  // (|/) Klaasvaakie - Yoco signs the exact raw body with webhook id and timestamp; parsed JSON is not equivalent.
  const primarySignature = extractPrimaryYocoSignature(params.signature);
  if (!primarySignature) {
    return false;
  }

  const signedContent = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
  const expected = createHmac("sha256", parseYocoSigningSecret(params.signingSecret))
    .update(signedContent)
    .digest("base64");
  const received = primarySignature.trim();

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
