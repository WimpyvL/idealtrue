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
    metadata?: Record<string, unknown>;
  };
};

export function resolveYocoWebhookCheckoutId(event: YocoWebhookCheckoutReferenceEvent) {
  const metadataCheckoutId = event.payload?.metadata?.checkoutId;
  if (typeof metadataCheckoutId === "string" && metadataCheckoutId.trim()) {
    return metadataCheckoutId.trim();
  }

  return event.payload?.id ?? event.id ?? null;
}
