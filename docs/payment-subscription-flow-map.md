# Payment and Subscription Flow Map

Author: ( |╲ ) Klaasvaakie

This maps what the code currently does. It is not a wishlist.

## Current Flow

1. The frontend calls `POST /billing/payments` through `startBillingPayment(...)`.
2. `createBillingPayment` creates a `billing_payment_intents` row with status `pending`.
3. `createBillingPaymentIntent` calls Yoco Checkout and stores `provider_checkout_id`, `redirect_url`, and `provider_mode` on the intent.
4. The browser redirects the user to Yoco.
5. Yoco redirects back to `GET /billing/payments/:paymentId/return?billingStatus=...`.
6. `billingPaymentReturn` calls `reconcilePendingPaymentIntent`, then redirects the browser to `/host?modal=subscriptions...` for subscription-style purchases.
7. The frontend reads `billing_status` and `payment_id` from the URL and calls `GET /billing/payments/:paymentId?billingStatus=success`.
8. `getBillingPaymentStatus` loads the intent and calls `reconcilePendingPaymentIntent` again.
9. `reconcilePendingPaymentIntent` tries, in order:
   - stored successful Yoco webhook lookup,
   - test-mode success shortcut,
   - Yoco checkout lookup,
   - Yoco order lookup if an order id is known.
10. A paid result calls `fulfilSuccessfulPaymentIntent`.
11. Subscription fulfilment calls `activatePlanFromBillingSession`, which writes the `subscriptions` row and updates `identity.users.host_plan`.
12. Managed-hosting fulfilment calls `activateManagedHostingFromPaymentIntent`, which creates a visible premium monthly subscription row and sets `management_mode = managed`.

## Fracture Lines Found

1. User-facing status polling was doing risky reconciliation work. Any unhandled webhook, provider, or database exception became a customer-visible `500`.
2. Webhook lookup originally matched too few Yoco checkout-id shapes, so a successful payment webhook could be stored but not found by reconciliation.
3. Provider lookup originally threw raw Yoco/network failures through Encore as internal errors.
4. If webhook delivery or provider lookup fails, the payment intent can remain `pending`; subscription rows are not written until `fulfilSuccessfulPaymentIntent` runs.

## Working Target Flow

1. `POST /billing/payments` only creates a local intent and Yoco checkout.
2. Signed Yoco webhooks are the primary activation path.
3. Return/status/cron reconciliation are recovery paths, not the only activation path.
4. Frontend status polling must never return `500` for internal reconciliation failures; it returns the stored intent state and logs the failure.
5. Every fulfilment path must end at the same write seam: `fulfilSuccessfulPaymentIntent`.
6. Subscriptions are visible only after `activatePlanFromBillingSession` or `activateManagedHostingFromPaymentIntent` completes.

