export type BillingWebhookOutcome = "paid" | "failed" | "cancelled" | "ignored";

function normalizeYocoValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function classifyYocoWebhookOutcome(eventType?: string | null, payloadStatus?: string | null): BillingWebhookOutcome {
  const normalizedEventType = normalizeYocoValue(eventType);
  const normalizedPayloadStatus = normalizeYocoValue(payloadStatus);

  if (
    normalizedEventType === "payment.succeeded" ||
    normalizedEventType === "order.completed" ||
    normalizedEventType.includes("succeed") ||
    normalizedEventType.includes("success") ||
    normalizedPayloadStatus === "succeeded" ||
    normalizedPayloadStatus === "successful" ||
    normalizedPayloadStatus === "approved" ||
    normalizedPayloadStatus === "paid" ||
    normalizedPayloadStatus === "completed"
  ) {
    return "paid";
  }

  if (normalizedEventType.includes("fail") || normalizedEventType === "payment.refunded" || normalizedPayloadStatus === "failed") {
    return "failed";
  }

  if (normalizedEventType.includes("cancel") || normalizedEventType === "order.cancelled" || normalizedPayloadStatus === "cancelled") {
    return "cancelled";
  }

  return "ignored";
}

export type YocoWebhookCheckoutReferenceEvent = {
  id?: string;
  payload?: {
    id?: string;
    checkoutId?: string;
    checkout_id?: string;
    checkout?: {
      id?: string;
      checkoutId?: string;
      checkout_id?: string;
    };
    metadata?: Record<string, unknown>;
  };
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveYocoWebhookCheckoutId(event: YocoWebhookCheckoutReferenceEvent) {
  const metadataCheckoutId = readNonEmptyString(event.payload?.metadata?.checkoutId);
  if (metadataCheckoutId) {
    return metadataCheckoutId;
  }

  const directCheckoutId = readNonEmptyString(event.payload?.checkoutId) ?? readNonEmptyString(event.payload?.checkout_id);
  if (directCheckoutId) {
    return directCheckoutId;
  }

  const nestedCheckoutId =
    readNonEmptyString(event.payload?.checkout?.id) ??
    readNonEmptyString(event.payload?.checkout?.checkoutId) ??
    readNonEmptyString(event.payload?.checkout?.checkout_id);
  if (nestedCheckoutId) {
    return nestedCheckoutId;
  }

  return event.payload?.id ?? event.id ?? null;
}
