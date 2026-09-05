export type PaymentMode = "live" | "test";

export function parsePaymentMode(value: string | null | undefined): PaymentMode {
  const mode = value?.trim().toLowerCase();
  if (mode !== "live" && mode !== "test") {
    throw new Error("YOCO_PAYMENT_MODE must be explicitly set to live or test.");
  }
  return mode;
}
