export type BillingReturnStatus = "success" | "cancelled" | "failed";

// Author: (|/) Klaasvaakie
export function buildBillingPaymentReturnUrl(appUrl: string, paymentId: string, status: BillingReturnStatus) {
  const base = appUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({ billingStatus: status });
  return `${base}/api/encore/billing/payments/${encodeURIComponent(paymentId)}/return?${searchParams.toString()}`;
}

// Author: (|/) Klaasvaakie
export function buildPricingPaymentReturnUrl(appUrl: string, paymentId: string, status: BillingReturnStatus) {
  const base = appUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({
    billing_status: status,
    payment_id: paymentId,
  });
  return `${base}/pricing?${searchParams.toString()}`;
}
