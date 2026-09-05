import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';

import { DEFAULT_ENCORE_API_URL } from '../src/lib/encore-client';
import { classifyYocoWebhookOutcome, resolveYocoWebhookCheckoutId } from '../encore/billing/webhook-classification.ts';
import { parseYocoSigningSecret, verifyYocoWebhookSignatureValue } from '../encore/billing/yoco-signature.ts';
import {
  cancelMySubscription,
  changeMySubscription,
  createManagedHostingCheckout,
  getBillingPaymentStatus,
  parseBillingReturnParams,
  startBillingPayment,
  type HostPlan,
} from '../src/lib/billing-client';
import { workflowBilling } from './fixtures/workflows';
import {
  buildBillingPaymentReturnUrl,
  buildBillingSuccessReturnUrl,
  buildHostSubscriptionsReturnUrl,
  buildPricingPaymentReturnUrl,
} from '../encore/billing/payment-return.ts';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

let fetchCalls: FetchCall[] = [];

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  fetchCalls = [];
  Object.defineProperty(globalThis, 'fetch', {
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, init });
      return handler(url, init);
    },
    configurable: true,
    writable: true,
  });
}

function requestBody(index: number) {
  return JSON.parse(String(fetchCalls[index]?.init?.body || '{}')) as Record<string, unknown>;
}

afterEach(() => {
  fetchCalls = [];
});

test('subscription payment client posts plan interval through the standard Yoco endpoint', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments')) {
      return createJsonResponse({
        paymentId: 'payment-subscription-1',
        provider: 'yoco',
        providerMode: 'test',
        status: 'pending',
        redirectUrl: 'https://pay.example/subscription',
        providerReference: 'checkout-subscription-1',
      });
    }
    throw new Error(`Unhandled subscription endpoint: ${url}`);
  });

  const checkout = await startBillingPayment({ purpose: 'subscription', plan: 'professional', billingInterval: 'monthly' });

  assert.equal(checkout.redirectUrl, 'https://pay.example/subscription');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/payments`);
  assert.deepEqual(requestBody(0), { purpose: 'subscription', plan: 'professional', billingInterval: 'monthly' });
});

test('subscription checkout client supports all subscription plans and billing intervals', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments')) {
      const body = requestBody(fetchCalls.length - 1);
      return createJsonResponse({
        paymentId: `payment-${body.plan}-${body.billingInterval}`,
        provider: 'yoco',
        providerMode: 'test',
        status: 'pending',
        redirectUrl: `https://pay.example/${body.plan}-${body.billingInterval}`,
        providerReference: `checkout-${body.plan}-${body.billingInterval}`,
      });
    }
    throw new Error(`Unhandled subscription matrix endpoint: ${url}`);
  });

  const scenarios: Array<[HostPlan, 'monthly' | 'annual']> = [
    ['standard', 'monthly'],
    ['professional', 'annual'],
    ['premium', 'monthly'],
  ];

  for (const [plan, billingInterval] of scenarios) {
    const checkout = await startBillingPayment({ purpose: 'subscription', plan, billingInterval });
    assert.equal(checkout.redirectUrl, `https://pay.example/${plan}-${billingInterval}`);
  }

  assert.deepEqual(
    fetchCalls.map((call) => JSON.parse(String(call.init?.body || '{}'))),
    scenarios.map(([plan, billingInterval]) => ({ purpose: 'subscription', plan, billingInterval })),
  );
});

test('standard billing payment client creates all new Yoco payments through one endpoint', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments')) {
      const body = requestBody(fetchCalls.length - 1);
      return createJsonResponse({
        paymentId: `payment-${body.purpose}`,
        provider: 'yoco',
        providerMode: 'test',
        status: 'pending',
        redirectUrl: `https://pay.example/${body.purpose}`,
        providerReference: `checkout-${body.purpose}`,
      });
    }
    throw new Error(`Unhandled standard billing payment endpoint: ${url}`);
  });

  const subscription = await startBillingPayment({ purpose: 'subscription', plan: 'professional', billingInterval: 'monthly' });
  const hostSetup = await startBillingPayment({ purpose: 'host_billing_setup' });
  const managed = await startBillingPayment({ purpose: 'managed_hosting' });
  const credits = await startBillingPayment({ purpose: 'content_credits', credits: 10 });

  assert.equal(subscription.redirectUrl, 'https://pay.example/subscription');
  assert.equal(hostSetup.provider, 'yoco');
  assert.equal(managed.redirectUrl, 'https://pay.example/managed_hosting');
  assert.equal(credits.providerMode, 'test');
  assert.deepEqual(requestBody(0), { purpose: 'subscription', plan: 'professional', billingInterval: 'monthly' });
  assert.deepEqual(requestBody(1), { purpose: 'host_billing_setup' });
  assert.deepEqual(requestBody(2), { purpose: 'managed_hosting' });
  assert.deepEqual(requestBody(3), { purpose: 'content_credits', credits: 10 });
  assert.deepEqual(
    fetchCalls.map((call) => `${call.init?.method || 'GET'} ${call.url.replace(DEFAULT_ENCORE_API_URL, '')}`),
    [
      'POST /billing/payments',
      'POST /billing/payments',
      'POST /billing/payments',
      'POST /billing/payments',
    ],
  );
});

test('managed hosting checkout client creates a managed-hosting Yoco payment', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments')) {
      return createJsonResponse({
        paymentId: 'payment-managed-hosting-1',
        provider: 'yoco',
        providerMode: 'test',
        status: 'pending',
        redirectUrl: 'https://pay.example/managed-hosting',
        providerReference: 'checkout-managed-hosting-1',
      });
    }
    throw new Error(`Unhandled managed hosting checkout endpoint: ${url}`);
  });

  const checkout = await createManagedHostingCheckout();

  assert.equal(checkout.redirectUrl, 'https://pay.example/managed-hosting');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/payments`);
  assert.deepEqual(requestBody(0), { purpose: 'managed_hosting' });
});

test('host billing setup payment client posts through the standard Yoco endpoint', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments')) {
      return createJsonResponse({
        paymentId: 'payment-host-setup-1',
        provider: 'yoco',
        providerMode: 'test',
        status: 'pending',
        redirectUrl: 'https://pay.example/host-card-setup',
        providerReference: workflowBilling.hostCardSetupPaid.checkoutId,
      });
    }
    throw new Error(`Unhandled host billing setup endpoint: ${url}`);
  });

  const checkout = await startBillingPayment({ purpose: 'host_billing_setup' });

  assert.equal(checkout.redirectUrl, 'https://pay.example/host-card-setup');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/payments`);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
  assert.deepEqual(requestBody(0), { purpose: 'host_billing_setup' });
});

test('payment status client forwards return billing status for test-mode reconciliation', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments/payment-subscription-1?billingStatus=success')) {
      return createJsonResponse({
        status: 'paid',
        purpose: 'subscription',
        providerMode: 'test',
      });
    }
    throw new Error(`Unhandled payment status endpoint: ${url}`);
  });

  const status = await getBillingPaymentStatus('payment-subscription-1', 'success');

  assert.equal(status.status, 'paid');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/payments/payment-subscription-1?billingStatus=success`);
});

test('billing client rejects malformed checkout start responses before redirecting users', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/payments')) {
      return createJsonResponse({
        paymentId: 'payment-bad-1',
        provider: 'yoco',
        providerMode: 'test',
        status: 'pending',
        redirectUrl: '',
        providerReference: 'checkout-bad-1',
      });
    }
    throw new Error(`Unhandled malformed checkout endpoint: ${url}`);
  });

  await assert.rejects(
    () => startBillingPayment({ purpose: 'subscription', plan: 'professional', billingInterval: 'monthly' }),
    /Billing payment response was invalid/,
  );
});

test('billing return params only accept known statuses with a payment or checkout id', () => {
  assert.deepEqual(parseBillingReturnParams(new URLSearchParams('billing_status=success&payment_id=payment-1')), {
    billingStatus: 'success',
    paymentId: 'payment-1',
    checkoutId: null,
  });
  assert.equal(parseBillingReturnParams(new URLSearchParams('billing_status=weird&payment_id=payment-1')), null);
  assert.equal(parseBillingReturnParams(new URLSearchParams('billing_status=success')), null);
});

test('payment success URLs route through backend reconciliation before returning to pricing', () => {
  assert.equal(
    buildBillingPaymentReturnUrl('https://www.idealstay.co.za/', 'payment 123', 'success'),
    'https://www.idealstay.co.za/api/encore/billing/payments/payment%20123/return?billingStatus=success',
  );
  assert.equal(
    buildHostSubscriptionsReturnUrl('https://www.idealstay.co.za/', 'payment 123', 'success'),
    'https://www.idealstay.co.za/host?modal=subscriptions&billing_status=success&payment_id=payment+123',
  );
  assert.equal(
    buildPricingPaymentReturnUrl('https://www.idealstay.co.za/', 'payment 123', 'success'),
    'https://www.idealstay.co.za/pricing?billing_status=success&payment_id=payment+123',
  );
  assert.equal(
    buildBillingSuccessReturnUrl('https://www.idealstay.co.za/', 'payment 123', 'success', 'subscription'),
    'https://www.idealstay.co.za/host?modal=subscriptions&billing_status=success&payment_id=payment+123',
  );
  assert.equal(
    buildBillingSuccessReturnUrl('https://www.idealstay.co.za/', 'payment 123', 'success', 'managed_hosting'),
    'https://www.idealstay.co.za/host?modal=subscriptions&billing_status=success&payment_id=payment+123',
  );
});

test('subscription cancellation client posts to the host cancellation endpoint', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/subscriptions/subscription-1/cancel')) {
      return createJsonResponse({
        subscription: {
          id: 'subscription-1',
          user_id: 'host-1',
          plan: 'professional',
          status: 'active',
          amount: 350,
          billing_interval: 'monthly',
          starts_at: '2026-07-01T00:00:00.000Z',
          ends_at: '2026-08-01T00:00:00.000Z',
          cancel_at_period_end: true,
          cancelled_at: '2026-07-10T00:00:00.000Z',
          created_at: '2026-07-01T00:00:00.000Z',
        },
      });
    }
    throw new Error(`Unhandled subscription cancellation endpoint: ${url}`);
  });

  const subscription = await cancelMySubscription('subscription-1');

  assert.equal(subscription.cancelAtPeriodEnd, true);
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/subscriptions/subscription-1/cancel`);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
});

test('subscription change client posts the target plan and interval through the host change endpoint', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/subscriptions/subscription-1/change')) {
      return createJsonResponse({
        changeType: 'upgrade',
        proratedAmount: 120,
        payment: {
          paymentId: 'payment-change-1',
          provider: 'yoco',
          providerMode: 'test',
          status: 'pending',
          redirectUrl: 'https://pay.example/change-plan',
          providerReference: 'checkout-change-1',
        },
      });
    }
    throw new Error(`Unhandled subscription change endpoint: ${url}`);
  });

  const payment = await changeMySubscription({
    subscriptionId: 'subscription-1',
    plan: 'standard',
    billingInterval: 'monthly',
  });

  assert.equal(payment.payment?.redirectUrl, 'https://pay.example/change-plan');
  assert.equal(payment.changeType, 'upgrade');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/subscriptions/subscription-1/change`);
  assert.deepEqual(requestBody(0), {
    subscriptionId: 'subscription-1',
    plan: 'standard',
    billingInterval: 'monthly',
  });
});

test('subscription upgrades charge only the rounded unused-time difference', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');

  assert.match(source, /function calculateProratedUpgradeAmount/);
  assert.match(source, /Math\.ceil\(remainingRatio \* planDifference\)/);
  assert.match(source, /Math\.max\(0, upgradeAmount\)/);

  const changeEndpoint = source.slice(
    source.indexOf('export const changeMySubscription'),
    source.indexOf('export const cancelAdminSubscription'),
  );
  assert.match(changeEndpoint, /const changeDirection = compareSubscriptionPlans\(subscription, plan, billingInterval\);/);
  assert.match(changeEndpoint, /calculateProratedUpgradeAmount\(subscription, plan, billingInterval\)/);
  assert.match(changeEndpoint, /amount: proratedAmount/);
  assert.match(changeEndpoint, /return \{ payment, changeType: "upgrade", proratedAmount \};/);
});

test('subscription downgrades are scheduled for the next billing date without checkout', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const changeEndpoint = source.slice(
    source.indexOf('export const changeMySubscription'),
    source.indexOf('export const cancelAdminSubscription'),
  );

  assert.match(changeEndpoint, /if \(changeDirection === "downgrade"\)/);
  assert.match(changeEndpoint, /await scheduleSubscriptionDowngrade\(subscription, plan, billingInterval\)/);
  assert.match(changeEndpoint, /return \{ subscription: scheduled, changeType: "downgrade", effectiveAt: scheduled\.pending_change_effective_at \};/);
});

// ( |╲ ) Klaasvaakie - managed-hosting downgrades must flip profile and billing state when the next cycle starts.
test('scheduled subscription downgrades clear managed mode when they become effective', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const expiryBlock = source.slice(
    source.indexOf('async function expireEndedSubscriptions'),
    source.indexOf('async function reconcilePendingPaymentIntent'),
  );

  assert.match(expiryBlock, /SET plan = \$\{subscription\.pending_plan\}/);
  assert.match(expiryBlock, /SET host_plan = \$\{subscription\.pending_plan\},[\s\S]*management_mode = \$\{"self_service"\}/);
  assert.match(expiryBlock, /await syncPaidBillingAccount\(\{[\s\S]*plan: subscription\.pending_plan/);
});

test('subscription expiry gives users a seven day grace period before deactivation', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const expiryBlock = source.slice(
    source.indexOf('async function expireEndedSubscriptions'),
    source.indexOf('async function reconcilePendingPaymentIntent'),
  );

  assert.match(source, /const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;/);
  assert.match(expiryBlock, /const graceEndsAt = addDays\(new Date\(subscription\.ends_at\), SUBSCRIPTION_GRACE_PERIOD_DAYS\);/);
  assert.match(expiryBlock, /status = \$\{"grace_period"\}/);
  assert.match(expiryBlock, /WHERE status = \$\{"grace_period"\}/);
  assert.match(expiryBlock, /grace_ends_at <= \$\{nowIso\}/);
  assert.match(expiryBlock, /await deactivatePaidBillingAccount\(\{ userId: subscription\.user_id, preserveCardOnFile: true \}\);/);
});

test('subscription lifecycle notifications cover due soon grace and deactivation', () => {
  const billingSource = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const notificationsSource = readFileSync(new URL('../encore/ops/notifications.ts', import.meta.url), 'utf8');
  const buildersSource = readFileSync(new URL('../encore/ops/notification-builders.ts', import.meta.url), 'utf8');

  assert.match(notificationsSource, /notifySubscriptionRenewalDue/);
  assert.match(notificationsSource, /notifySubscriptionGracePeriodStarted/);
  assert.match(notificationsSource, /notifySubscriptionDeactivated/);
  assert.match(buildersSource, /buildSubscriptionRenewalDueNotification/);
  assert.match(buildersSource, /buildSubscriptionGracePeriodStartedNotification/);
  assert.match(buildersSource, /buildSubscriptionDeactivatedNotification/);
  assert.match(billingSource, /notifySubscriptionsDueSoon/);
  assert.match(billingSource, /subscription-notification-cycle/);
});

test('subscription fulfilment updates an existing checkout subscription row instead of leaving stale plan data behind', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const activationBlock = source.slice(
    source.indexOf('async function activatePlanFromBillingSession'),
    source.indexOf('async function creditWalletFromBillingSession'),
  );

  assert.match(activationBlock, /if \(existingSubscription\) \{/);
  assert.match(activationBlock, /UPDATE subscriptions[\s\S]*SET plan = \$\{session\.host_plan\},[\s\S]*billing_interval = \$\{session\.billing_interval\}/);
  assert.match(activationBlock, /cancel_at_period_end = \$\{false\}/);
  assert.match(activationBlock, /AND checkout_session_id <> \$\{session\.id\}/);
});

// ( |╲ ) Klaasvaakie - a normal plan purchase must reclaim the account from stale managed-hosting state.
test('self-service subscription fulfilment clears managed mode on the host profile', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const activationBlock = source.slice(
    source.indexOf('async function activatePlanFromBillingSession'),
    source.indexOf('async function creditWalletFromBillingSession'),
  );

  assert.match(activationBlock, /SET host_plan = \$\{session\.host_plan\},[\s\S]*management_mode = \$\{"self_service"\}/);
});

// (|/) Klaasvaakie - this gate keeps the checkout return path tied to real subscription activation instead of a dead-end paid flag.
test('successful checkout return keeps the subscription activation chain wired end to end', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const fulfilmentBlock = source.slice(
    source.indexOf('async function fulfilSuccessfulPaymentIntent'),
    source.indexOf('async function readRawBody'),
  );
  const returnBlock = source.slice(
    source.indexOf('export const billingPaymentReturn = api.raw'),
    source.indexOf('export async function generateContentDraft'),
  );

  assert.match(returnBlock, /await reconcilePendingPaymentIntent\(intent, safeStatus\);/);
  assert.match(returnBlock, /buildBillingSuccessReturnUrl\(getAppUrl\(\), paymentId, safeStatus, intent\.purpose\)/);
  assert.match(fulfilmentBlock, /if \(intent\.purpose === "subscription"\) \{/);
  assert.match(fulfilmentBlock, /await activatePlanFromBillingSession\(billingSession, tx\);/);
  assert.match(fulfilmentBlock, /await markPaymentIntentPaid\(intent, providerPaymentId, tx\);/);
  assert.doesNotMatch(source, /currentBillingFulfilmentTx/);
});

test('managed hosting fulfilment creates a visible premium subscription row', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const functionSource = source.slice(
    source.indexOf('async function activateManagedHostingFromPaymentIntent'),
    source.indexOf('async function markCheckoutPaid'),
  );

  assert.match(functionSource, /await activatePlanFromBillingSession\(\{/);
  assert.match(functionSource, /id: intent\.id/);
  assert.match(functionSource, /host_plan: "premium"/);
  assert.match(functionSource, /billing_interval: "monthly"/);
  assert.match(functionSource, /management_mode = \$\{"managed"\}/);
});

test('subscription cancellation schedules end-of-period access instead of dropping the host immediately', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const cancelBlock = source.slice(
    source.indexOf('async function cancelSubscriptionById'),
    source.indexOf('async function expireEndedSubscriptions'),
  );

  assert.match(cancelBlock, /if \(subscription\.status !== "active"\)/);
  assert.match(cancelBlock, /if \(subscription\.cancel_at_period_end\)/);
  assert.match(cancelBlock, /SET cancel_at_period_end = \$\{true\},[\s\S]*cancelled_at = \$\{now\}/);
  assert.doesNotMatch(cancelBlock, /SET host_plan = \$\{"standard"\}/);
});

test('subscription expiry cycle exists to downgrade ended subscriptions after the paid window closes', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  assert.match(source, /async function expireEndedSubscriptions\(nowIso = new Date\(\)\.toISOString\(\)\)/);
  assert.match(source, /WHERE status = \$\{"active"\}[\s\S]*AND ends_at <= \$\{nowIso\}/);
  assert.match(source, /SET status = \$\{"expired"\}/);
  assert.match(source, /await deactivatePaidBillingAccount\(\{ userId: subscription\.user_id, preserveCardOnFile: true \}\);/);
  assert.match(source, /new CronJob\("subscription-expiry-cycle"/);
});

test('accepted Yoco webhook events classify into fulfilment-safe billing outcomes', () => {
  assert.equal(classifyYocoWebhookOutcome('payment.created', 'pending'), 'ignored');
  assert.equal(classifyYocoWebhookOutcome('order.completed', 'completed'), 'paid');
  assert.equal(classifyYocoWebhookOutcome('order.cancelled', 'cancelled'), 'cancelled');
  assert.equal(classifyYocoWebhookOutcome('payment.refunded', 'refunded'), 'failed');
});

test('provider status mapping accepts common paid status variants before leaving payments pending', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const checkoutStatusBlock = source.slice(
    source.indexOf('function mapYocoCheckoutStatus'),
    source.indexOf('async function createBillingPaymentIntent'),
  );
  const orderStatusBlock = source.slice(
    source.indexOf('function mapYocoOrderStatus'),
    source.indexOf('// Author:', source.indexOf('function mapYocoOrderStatus')),
  );

  for (const status of ['complete', 'success', 'approved', 'captured', 'settled']) {
    assert.match(checkoutStatusBlock, new RegExp(`normalized === "${status}"`));
    assert.match(orderStatusBlock, new RegExp(`normalized === "${status}"`));
  }
});

test('pending billing payment reconciliation cron retries provider lookups for every package type', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const reconciliationBlock = source.slice(
    source.indexOf('async function reconcilePendingPaymentIntentsFromProvider'),
    source.indexOf('async function findSuccessfulWebhookForPaymentIntent'),
  );

  assert.match(reconciliationBlock, /FROM billing_payment_intents/);
  assert.match(reconciliationBlock, /WHERE status = \$\{"pending"\}/);
  assert.match(reconciliationBlock, /provider_checkout_id IS NOT NULL/);
  assert.match(reconciliationBlock, /await reconcilePendingPaymentIntent\(intent\)/);
  assert.match(source, /new CronJob\("pending-billing-payment-reconciliation"/);
  assert.match(source, /path: "\/admin\/billing\/payments\/reconcile"/);
});

test('Yoco webhook handler ignores non-fulfilment events before touching billing state', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  assert.match(source, /function isFulfilmentSafeWebhookOutcome\(outcome: ReturnType<typeof classifyYocoWebhookOutcome>\)/);
  const processorBlock = source.slice(source.indexOf('export async function processStoredYocoWebhookEvent'));
  assert.match(processorBlock, /if \(!isFulfilmentSafeWebhookOutcome\(outcome\)\) \{/);
  assert.match(processorBlock, /SET processed_at = \$\{new Date\(\)\.toISOString\(\)\}/);
});

test('Yoco webhook endpoint acknowledges quickly after persisting and publishing to Encore PubSub', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const handlerBlock = source.slice(
    source.indexOf('export const yocoWebhook = api.raw'),
    source.indexOf('export async function processStoredYocoWebhookEvent'),
  );

  assert.match(handlerBlock, /INSERT INTO billing_webhook_events \(id, provider, event_type, signature, payload\)/);
  assert.match(handlerBlock, /await billingWebhookEvents\.publish\(\{ eventId \}\);/);
  assert.match(handlerBlock, /resp\.end\(JSON\.stringify\(\{ ok: true, accepted: true \}\)\);/);
  assert.doesNotMatch(handlerBlock, /await fulfilSuccessfulPaymentIntent/);
});

test('Encore billing webhook subscription delegates stored event processing from PubSub', () => {
  const source = readFileSync(new URL('../encore/billing/subscriptions.ts', import.meta.url), 'utf8');
  assert.match(source, /new Subscription\(/);
  assert.match(source, /billingWebhookEvents/);
  assert.match(source, /await processStoredYocoWebhookEvent\(event\.eventId\);/);
});

test('Yoco webhook signature verification uses webhook id, timestamp, and raw body exactly', () => {
  const rawBody = JSON.stringify({
    id: 'evt-order-completed-1',
    type: 'order.completed',
    payload: {
      id: 'checkout-123',
      status: 'completed',
      metadata: { paymentIntentId: 'payment-123' },
    },
  });
  const webhookId = 'wh_123';
  const webhookTimestamp = `${Math.floor(Date.now() / 1000)}`;
  const secret = `whsec_${Buffer.from('ideal-stay-yoco-webhook-secret').toString('base64')}`;
  const signature = createHmac('sha256', parseYocoSigningSecret(secret))
    .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
    .digest('base64');

  assert.equal(
    verifyYocoWebhookSignatureValue({
      rawBody,
      signature: `v1,${signature}`,
      webhookId,
      webhookTimestamp,
      signingSecret: secret,
    }),
    true,
  );

  assert.equal(
    verifyYocoWebhookSignatureValue({
      rawBody: `${rawBody} `,
      signature: `v1,${signature}`,
      webhookId,
      webhookTimestamp,
      signingSecret: secret,
    }),
    false,
  );
});

test('Yoco Checkout payment webhooks expose the checkout id inside payload metadata', () => {
  const event = {
    id: 'evt-payment-succeeded-1',
    type: 'payment.succeeded',
    payload: {
      id: 'pay_123',
      status: 'succeeded',
      metadata: {
        checkoutId: 'ch_checkout_123',
      },
    },
  };

  assert.equal(resolveYocoWebhookCheckoutId(event), 'ch_checkout_123');
});

test('Yoco Checkout payment webhooks expose checkout references outside metadata too', () => {
  assert.equal(
    resolveYocoWebhookCheckoutId({
      id: 'evt-payment-succeeded-1',
      payload: {
        id: 'pay_123',
        checkoutId: 'ch_direct_123',
      },
    }),
    'ch_direct_123',
  );

  assert.equal(
    resolveYocoWebhookCheckoutId({
      id: 'evt-payment-succeeded-2',
      payload: {
        id: 'pay_456',
        checkout_id: 'ch_snake_456',
      },
    }),
    'ch_snake_456',
  );

  assert.equal(
    resolveYocoWebhookCheckoutId({
      id: 'evt-payment-succeeded-3',
      payload: {
        id: 'pay_789',
        checkout: { id: 'ch_nested_789' },
      },
    }),
    'ch_nested_789',
  );
});

test('successful Yoco webhook handling persists a provider order id for later reconciliation', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  assert.match(source, /const providerOrderId = resolveProviderOrderId\(event\);/);
  assert.match(source, /await storeProviderOrderId\(paymentIntent\.id, providerOrderId\);/);
});

test('pending payment reconciliation falls back to direct checkout verification before giving up on live payments', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const reconciliationBlock = source.slice(
    source.indexOf('async function reconcilePendingPaymentIntent'),
    source.indexOf('async function reconcilePendingPaymentIntentsFromProvider'),
  );

  assert.match(reconciliationBlock, /if \(intent\.provider_checkout_id\) \{/);
  assert.match(reconciliationBlock, /try \{[\s\S]*const checkout = await fetchYocoCheckout\(intent\.provider_checkout_id, intent\.provider_mode\);/);
  assert.match(reconciliationBlock, /const checkoutStatus = mapYocoCheckoutStatus\(checkout\.status\);/);
  assert.match(reconciliationBlock, /await fulfilSuccessfulPaymentIntent\(intent, providerPaymentId \?\? intent\.provider_checkout_id, tx\);/);
  assert.match(reconciliationBlock, /catch \(error\) \{[\s\S]*Stored Yoco webhook lookup failed/);
  assert.match(reconciliationBlock, /catch \(error\) \{[\s\S]*Yoco checkout lookup failed/);
  assert.match(reconciliationBlock, /catch \(error\) \{[\s\S]*Yoco order lookup failed/);
});

// ( |╲ ) Klaasvaakie - customer-facing status polling must never be the place where internal reconciliation throws a 500.
test('billing payment status polling returns stored state when reconciliation fails internally', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const statusEndpoint = source.slice(
    source.indexOf('export const getBillingPaymentStatus'),
    source.indexOf('export const billingPaymentReturn'),
  );

  assert.match(statusEndpoint, /let resolvedIntent: PaymentIntentRow;/);
  assert.match(statusEndpoint, /try \{[\s\S]*resolvedIntent = await reconcilePendingPaymentIntent\(intent, billingStatus\);/);
  assert.match(statusEndpoint, /catch \(error\) \{[\s\S]*Billing payment status reconciliation failed for \$\{paymentId\}/);
  assert.match(statusEndpoint, /resolvedIntent = \(await getPaymentIntentById\(paymentId\)\) \?\? intent;/);
  assert.match(statusEndpoint, /status: resolvedIntent\.status/);
});

// (|/) Klaasvaakie - provider_order_id is the last lifeline when checkout-only polling misses the fulfilment event.
test('provider order reconciliation persists and reuses provider_order_id before falling back to checkout-only polling', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const reconciliationBlock = source.slice(
    source.indexOf('async function reconcilePendingPaymentIntent'),
    source.indexOf('async function findSuccessfulWebhookForPaymentIntent'),
  );
  const webhookBlock = source.slice(
    source.indexOf('async function findPaymentIntentForWebhook'),
    source.indexOf('function isFulfilmentSafeWebhookOutcome'),
  );

  assert.match(reconciliationBlock, /await storeProviderOrderId\(intent\.id, providerOrderId, tx\);/);
  assert.match(reconciliationBlock, /if \(!intent\.provider_order_id\) \{/);
  assert.match(reconciliationBlock, /const order = await fetchYocoOrder\(intent\.provider_order_id, intent\.provider_mode\);/);
  assert.match(reconciliationBlock, /await fulfilSuccessfulPaymentIntent\(intent, providerPaymentId, tx\);/);
  assert.match(webhookBlock, /WHERE provider_order_id = \$\{orderId\}/);
});

test('stored Yoco webhook reconciliation matches direct and nested checkout references', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const intentWebhookLookup = source.slice(
    source.indexOf('async function findSuccessfulWebhookForPaymentIntent'),
    source.indexOf('async function findSuccessfulWebhookForCheckout'),
  );
  const checkoutWebhookLookup = source.slice(
    source.indexOf('async function findSuccessfulWebhookForCheckout'),
    source.indexOf('async function reconcilePendingCheckout'),
  );

  for (const block of [intentWebhookLookup, checkoutWebhookLookup]) {
    assert.match(block, /payload #>> '\{payload,metadata,checkoutId\}'/);
    assert.match(block, /payload #>> '\{payload,checkoutId\}'/);
    assert.match(block, /payload #>> '\{payload,checkout_id\}'/);
    assert.match(block, /payload #>> '\{payload,checkout,id\}'/);
    assert.match(block, /payload #>> '\{payload,checkout,checkoutId\}'/);
    assert.match(block, /payload #>> '\{payload,checkout,checkout_id\}'/);
  }
});

// ( |╲ ) Klaasvaakie
test('Yoco provider requests retry transient fetch failures before surfacing provider unavailable errors', () => {
  const source = readFileSync(new URL('../encore/billing/yoco.ts', import.meta.url), 'utf8');

  assert.match(source, /const YOCO_FETCH_RETRY_DELAYS_MS = \[250, 750\];/);
  assert.match(source, /async function fetchYocoWithRetry/);
  assert.match(source, /return await fetch\(url, init\);/);
  assert.match(source, /throw APIError\.unavailable\(`\$\{operation\} could not reach Yoco:/);
  assert.match(source, /fetchYocoWithRetry\(`\$\{YOCO_API_BASE\}\/checkouts`/);
  assert.match(source, /fetchYocoWithRetry\(`\$\{YOCO_API_BASE\}\/checkouts\/\$\{encodeURIComponent\(checkoutId\)\}`/);
  assert.match(source, /fetchYocoWithRetry\(`\$\{YOCO_REST_API_BASE\}\/orders\/\$\{encodeURIComponent\(orderId\)\}`/);
});

test('Yoco webhook handling rejects metadata ownership mismatches before subscription activation', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  assert.match(source, /function assertWebhookIntentOwnership\(intent: PaymentIntentRow, event: YocoWebhookEvent\)/);
  assert.match(source, /Webhook metadata did not match the payment owner\./);
  assert.match(source, /assertWebhookIntentOwnership\(paymentIntent, event\);/);
});

test('Yoco webhook duplicate delivery guard keys off event ids before insertion', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  assert.match(source, /const alreadyProcessed = await billingDB\.queryRow<WebhookEventRow>`/);
  assert.match(source, /WHERE id = \$\{eventId\}/);
  assert.match(source, /duplicate: true/);
});

test('Yoco fulfilment is serialized by payment or checkout id before stale state can mutate billing', async () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  assert.match(source, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(source, /withBillingFulfilmentLock\("payment", intent\.id/);
  assert.match(source, /withBillingFulfilmentLock\("checkout", session\.id/);
});
