import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';

import { DEFAULT_ENCORE_API_URL } from '../src/lib/encore-client';
import { classifyYocoWebhookOutcome, resolveYocoWebhookCheckoutId } from '../encore/billing/webhook-classification.ts';
import { parseYocoSigningSecret, verifyYocoWebhookSignatureValue } from '../encore/billing/yoco-signature.ts';
import {
  createManagedHostingCheckout,
  getBillingPaymentStatus,
  parseBillingReturnParams,
  startBillingPayment,
  type HostPlan,
} from '../src/lib/billing-client';
import { workflowBilling } from './fixtures/workflows';
import { buildBillingPaymentReturnUrl, buildPricingPaymentReturnUrl } from '../encore/billing/payment-return.ts';

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
    buildPricingPaymentReturnUrl('https://www.idealstay.co.za/', 'payment 123', 'success'),
    'https://www.idealstay.co.za/pricing?billing_status=success&payment_id=payment+123',
  );
});

test('subscription fulfilment updates an existing checkout subscription row instead of leaving stale plan data behind', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const activationBlock = source.slice(
    source.indexOf('async function activatePlanFromBillingSession'),
    source.indexOf('async function creditWalletFromBillingSession'),
  );

  assert.match(activationBlock, /if \(existingSubscription\) \{/);
  assert.match(activationBlock, /UPDATE subscriptions[\s\S]*SET plan = \$\{session\.host_plan\},[\s\S]*billing_interval = \$\{session\.billing_interval\}/);
  assert.match(activationBlock, /AND checkout_session_id <> \$\{session\.id\}/);
});

test('accepted Yoco webhook events classify into fulfilment-safe billing outcomes', () => {
  assert.equal(classifyYocoWebhookOutcome('payment.created', 'pending'), 'ignored');
  assert.equal(classifyYocoWebhookOutcome('order.completed', 'completed'), 'paid');
  assert.equal(classifyYocoWebhookOutcome('order.cancelled', 'cancelled'), 'cancelled');
  assert.equal(classifyYocoWebhookOutcome('payment.refunded', 'refunded'), 'failed');
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

test('successful Yoco webhook handling persists a provider order id for later reconciliation', () => {
  const source = readFileSync(new URL('../encore/billing/api.ts', import.meta.url), 'utf8');
  const webhookBlock = source.slice(
    source.indexOf('export const yocoWebhook = api.raw('),
    source.indexOf('export const listPlans = api<void, { plans: SubscriptionPlan[] }>('),
  );

  assert.match(webhookBlock, /const providerOrderId = resolveProviderOrderId\(event\);/);
  assert.match(webhookBlock, /await storeProviderOrderId\(paymentIntent\.id, providerOrderId\);/);
});
