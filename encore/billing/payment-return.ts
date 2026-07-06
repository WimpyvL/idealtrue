export type BillingReturnStatus = "success" | "cancelled" | "failed";
export type BillingReturnPurpose = "subscription" | "content_credits" | "host_billing_setup" | "managed_hosting";

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

// Author: (|╲) Klaasvaakie
export function buildHostSubscriptionsReturnUrl(appUrl: string, paymentId: string, status: BillingReturnStatus) {
  const base = appUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({
    modal: "subscriptions",
    billing_status: status,
    payment_id: paymentId,
  });
  return `${base}/host?${searchParams.toString()}`;
}

// Author: (|╲) Klaasvaakie
export function buildHostDashboardReturnUrl(appUrl: string, paymentId: string, status: BillingReturnStatus) {
  const base = appUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({
    billing_status: status,
    payment_id: paymentId,
  });
  return `${base}/host?${searchParams.toString()}`;
}

// Author: (|╲) Klaasvaakie
export function buildSocialBillingReturnUrl(appUrl: string, paymentId: string, status: BillingReturnStatus) {
  const base = appUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({
    billing_status: status,
    payment_id: paymentId,
  });
  return `${base}/host/social?${searchParams.toString()}`;
}

// Author: (|╲) Klaasvaakie
export function buildAccountBillingReturnUrl(
  appUrl: string,
  paymentId: string,
  status: BillingReturnStatus,
  billingContext?: string,
) {
  const base = appUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({
    billing_status: status,
    payment_id: paymentId,
  });
  if (billingContext) {
    searchParams.set("billing_context", billingContext);
  }
  return `${base}/account?${searchParams.toString()}`;
}

// Author: (|╲) Klaasvaakie
export function buildBillingSuccessReturnUrl(
  appUrl: string,
  paymentId: string,
  status: BillingReturnStatus,
  purpose: BillingReturnPurpose,
) {
  if (purpose === "subscription") {
    return buildHostSubscriptionsReturnUrl(appUrl, paymentId, status);
  }
  if (purpose === "content_credits") {
    return buildSocialBillingReturnUrl(appUrl, paymentId, status);
  }
  if (purpose === "host_billing_setup") {
    return buildAccountBillingReturnUrl(appUrl, paymentId, status, "host_card_setup");
  }
  return buildHostDashboardReturnUrl(appUrl, paymentId, status);
}
