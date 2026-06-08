# Ideal Stay Payment Flow Diagrams

Author signature: (|/) Klaasvaakie

These diagrams describe the current payment flow in this checkout. The canonical path is `POST /billing/payments` -> `billing_payment_intents` -> Yoco Checkout -> webhook/status reconciliation. Older `billing_checkout_sessions` paths still exist only as compatibility for legacy return URLs and admin history.

## 1. System Context

```mermaid
flowchart LR
  host["Host or admin user"]
  pricing["Pricing page\n/src/pages/PricingPage.tsx"]
  social["Content Studio\n/src/pages/SocialDashboard.tsx"]
  client["Billing client\n/src/lib/billing-client.ts"]
  proxy["Same-origin Encore proxy"]
  billing["Encore billing service\n/encore/billing/api.ts"]
  yoco["Yoco Checkout API\nhttps://payments.yoco.com/api/checkouts"]
  db[("billing-db")]
  identity[("identity-db")]
  ops["Ops notifications"]

  host --> pricing
  host --> social
  pricing --> client
  social --> client
  client --> proxy
  proxy --> billing
  billing --> db
  billing --> yoco
  billing --> identity
  billing --> ops
```

## 2. Start Payment Sequence

```mermaid
sequenceDiagram
  autonumber
  actor User as Host/Admin user
  participant UI as PricingPage or SocialDashboard
  participant Client as startBillingPayment()
  participant Billing as POST /billing/payments
  participant DB as billing_payment_intents
  participant Yoco as Yoco Checkout API

  User->>UI: Click plan / managed hosting / credit top-up
  UI->>Client: startBillingPayment({ purpose, plan?, billingInterval?, credits? })
  Client->>Billing: POST /billing/payments
  Billing->>Billing: requireRole("host", "admin")
  Billing->>Billing: Validate purpose-specific payload
  Billing->>DB: INSERT pending payment intent
  Billing->>Yoco: POST /api/checkouts with amount, return URLs, metadata.paymentIntentId
  Yoco-->>Billing: checkout id + redirectUrl
  Billing->>DB: UPDATE intent with provider_checkout_id, redirect_url, provider_mode
  Billing-->>Client: { paymentId, providerMode, redirectUrl, providerReference }
  Client-->>UI: Payment object
  UI->>Yoco: window.location.assign(redirectUrl)
```

## 3. Purpose Routing

```mermaid
flowchart TD
  start["POST /billing/payments"]
  auth{"User role is\nhost or admin?"}
  purpose{"purpose"}
  sub["subscription\nRequires plan + billingInterval\nAmount from HOST_PLANS"]
  setup["host_billing_setup\nRequires no card currently on file\nAmount R2"]
  managed["managed_hosting\nAmount R650"]
  credits["content_credits\nRequires positive credits\nAmount from credit pack pricing"]
  intent["createBillingPaymentIntent()\nInsert billing_payment_intents row"]
  reject["Reject with APIError"]

  start --> auth
  auth -- no --> reject
  auth -- yes --> purpose
  purpose -- subscription --> sub
  purpose -- host_billing_setup --> setup
  purpose -- managed_hosting --> managed
  purpose -- content_credits --> credits
  purpose -- unsupported --> reject
  sub --> intent
  setup --> intent
  managed --> intent
  credits --> intent
```

## 4. Canonical Data Model

```mermaid
erDiagram
  billing_payment_intents {
    text id PK
    text user_id
    text purpose "subscription | content_credits | host_billing_setup | managed_hosting"
    text provider "yoco"
    text provider_mode "live | test"
    text status "pending | paid | failed | cancelled"
    text currency "ZAR"
    integer amount
    text host_plan
    text billing_interval
    integer credit_quantity
    text provider_checkout_id
    text provider_order_id
    text provider_payment_id
    text redirect_url
    jsonb metadata
    timestamptz paid_at
  }

  billing_webhook_events {
    text id PK
    text provider
    text event_type
    text signature
    jsonb payload
    timestamptz processed_at
  }

  subscriptions {
    text id PK
    text user_id
    text checkout_session_id "payment intent id is reused here"
    text plan
    text status
    integer amount
    text billing_interval
  }

  host_billing_accounts {
    text user_id PK
    text plan
    text billing_source
    text billing_status
    boolean card_on_file
  }

  content_credit_wallets {
    text user_id PK
    integer balance
  }

  content_credit_ledger {
    text id PK
    text user_id
    integer delta
    text reason
    text reference_id
  }

  billing_payment_intents ||--o{ billing_webhook_events : "matched by metadata.paymentIntentId or metadata.checkoutId/provider_checkout_id"
  billing_payment_intents ||--o| subscriptions : "subscription fulfillment"
  billing_payment_intents ||--o| host_billing_accounts : "host setup / managed hosting fulfillment"
  billing_payment_intents ||--o{ content_credit_ledger : "credit purchase fulfillment"
  content_credit_wallets ||--o{ content_credit_ledger : "balance movement"
```

## 5. Return URL And Status Resolution

```mermaid
flowchart TD
  yocoReturn["Yoco redirects back to Ideal Stay"]
  url{"Return URL contains"}
  paymentId["payment_id + billing_status\nCurrent standard"]
  checkoutId["checkout_id + billing_status\nLegacy compatibility"]
  pricing["/pricing handles subscription + managed_hosting"]
  social["/host/social handles content_credits"]
  statusNew["GET /billing/payments/:paymentId?billingStatus=..."]
  statusOld["GET /billing/checkouts/:checkoutId"]
  reconcileIntent["reconcilePendingPaymentIntent()"]
  reconcileLegacy["reconcilePendingCheckout()"]
  paid{"status paid?"}
  success["Refresh profile/entitlements\nShow success\nNavigate as needed"]
  pending["Poll or tell user webhook is still confirming"]
  fail["Show cancelled/failed message"]

  yocoReturn --> url
  url -- payment_id --> paymentId
  url -- checkout_id --> checkoutId
  paymentId --> pricing
  paymentId --> social
  checkoutId --> pricing
  checkoutId --> social
  pricing --> statusNew
  social --> statusNew
  pricing --> statusOld
  social --> statusOld
  statusNew --> reconcileIntent
  statusOld --> reconcileLegacy
  reconcileIntent --> paid
  reconcileLegacy --> paid
  paid -- yes --> success
  paid -- pending --> pending
  paid -- cancelled or failed --> fail
```

## 6. Webhook Reconciliation

```mermaid
sequenceDiagram
  autonumber
  participant Yoco as Yoco
  participant Webhook as POST /billing/webhooks/yoco
  participant Sig as verifyYocoWebhookSignature()
  participant Events as billing_webhook_events
  participant Intent as billing_payment_intents
  participant Legacy as billing_checkout_sessions
  participant Fulfill as fulfilSuccessfulPaymentIntent()

  Yoco->>Webhook: webhook-id + webhook-timestamp + webhook-signature + raw JSON
  Webhook->>Sig: Verify signature over webhook id, timestamp, raw body
  Sig-->>Webhook: valid or reject
  Webhook->>Events: Insert event unless duplicate
  Webhook->>Intent: Find by metadata.paymentIntentId, payload.metadata.checkoutId, provider_checkout_id, or order id
  alt payment intent found
    Webhook->>Fulfill: paid / failed / cancelled outcome
  else no payment intent found
    Webhook->>Legacy: Try old billing_checkout_sessions lookup
    Webhook->>Fulfill: Fulfill legacy session if matched
  else no match
    Webhook-->>Yoco: 202 ignored
  end
  Webhook->>Events: processed_at = now
  Webhook-->>Yoco: 200 ok
```

## 7. Fulfillment By Purpose

```mermaid
flowchart TD
  paid["Payment intent outcome = paid"]
  purpose{"intent.purpose"}

  sub["subscription"]
  subActions["Cancel active subscription rows\nInsert active subscription\nUpdate identity.users.host_plan\nsyncPaidBillingAccount(card_on_file=true)\nPublish subscription.changed\nReward referral conversion\nNotify subscription activated"]

  setup["host_billing_setup"]
  setupActions["markHostBillingSetupComplete()\nSet provider-backed card on file\nUpdate host billing account"]

  managed["managed_hosting"]
  managedActions["identity.users.host_plan = premium\nidentity.users.management_mode = managed\nhost_billing_accounts = premium / paid / active / card_on_file=true\nPublish managed_hosting.paid"]

  credits["content_credits"]
  creditActions["Ensure wallet\nAdd credit quantity to content_credit_wallets\nInsert content_credit_ledger credit_purchase\nNotify content credits purchased"]

  mark["billing_payment_intents.status = paid\nprovider_payment_id set\npaid_at set"]

  paid --> purpose
  purpose -- subscription --> sub --> subActions --> mark
  purpose -- host_billing_setup --> setup --> setupActions --> mark
  purpose -- managed_hosting --> managed --> managedActions --> mark
  purpose -- content_credits --> credits --> creditActions --> mark
```

## 8. Test Mode Fallback Boundary

```mermaid
flowchart TD
  status["GET /billing/payments/:paymentId?billingStatus=success"]
  pending{"Intent still pending?"}
  webhook{"Successful webhook exists?"}
  mode{"provider_mode"}
  live["live mode\nNo return-only fulfillment\nNeed webhook/provider proof"]
  test["test mode + billingStatus=success\nAllowed fallback fulfillment"]
  yocoOrder{"provider_order_id exists?"}
  orderLookup["fetchYocoOrder()\ncompleted => paid\ncancelled => cancelled"]
  stillPending["Return pending"]
  fulfill["fulfilSuccessfulPaymentIntent()"]

  status --> pending
  pending -- no --> stillPending
  pending -- yes --> webhook
  webhook -- yes --> fulfill
  webhook -- no --> mode
  mode -- test --> test --> fulfill
  mode -- live --> live --> yocoOrder
  yocoOrder -- yes --> orderLookup --> fulfill
  yocoOrder -- no --> stillPending
```

## 9. Runtime Configuration

```mermaid
flowchart LR
  mode["YOCO_PAYMENT_MODE\nDefault currently: test"]
  testKey["YOCO_TEST_SECRET_KEY"]
  liveKey["YOCO_SECRET_KEY"]
  webhookSecret["YOCO_WEBHOOK_SECRET"]
  appUrl["IDEAL_STAY_APP_URL"]
  viteMode["VITE_YOCO_PAYMENT_MODE\nPricing test banner only"]
  checkout["createYocoCheckout()"]
  webhook["verifyYocoWebhookSignature()"]
  urls["Return URLs\n/pricing or /host/social or /account"]

  mode -- test --> testKey --> checkout
  mode -- live --> liveKey --> checkout
  webhookSecret --> webhook
  appUrl --> urls --> checkout
  viteMode --> banner["Visible pricing warning\nNo backend authority"]
```

## Current Acceptance Check

- Current paid user-facing flows should start through `startBillingPayment(...)`.
- Current backend paid flows should enter through `POST /billing/payments`.
- New payment state should be stored in `billing_payment_intents`.
- Yoco Checkout payment webhooks must match intents through `payload.metadata.checkoutId` when `metadata.paymentIntentId` is absent.
- Live-mode fulfillment should require webhook or provider proof.
- Test-mode success-return fallback is intentionally narrow and only applies when `provider_mode = test` and `billingStatus=success`.
- Legacy `checkout_id` support should not become the default path again.
