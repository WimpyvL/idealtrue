import { expect, test, type Page } from '@playwright/test';

const hostUser = {
  id: 'host-billing-1',
  email: 'host-billing@example.com',
  emailVerified: true,
  displayName: 'Host Billing',
  photoUrl: '',
  role: 'host',
  isAdmin: false,
  hostPlan: 'standard',
  kycStatus: 'verified',
  accountStatus: 'active',
  accountStatusReason: null,
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
  referralCode: 'HOSTBILL',
  referredByCode: null,
  paymentMethod: null,
  paymentInstructions: null,
  paymentReferencePrefix: null,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

const paidHostUser = {
  ...hostUser,
  hostPlan: 'professional',
};

const billingAccount = {
  userId: hostUser.id,
  plan: 'standard',
  billingSource: 'none',
  status: 'trial',
  cardOnFile: false,
  greylisted: false,
  billingCycleStartedAt: null,
  billingCycleEndsAt: null,
  nextReminderAt: null,
  lastReminderAt: null,
  reminderCount: 0,
  voucherCode: null,
  voucherAssignedAt: null,
  voucherRedeemedAt: null,
  greylistedAt: null,
  greylistReason: null,
  updatedAt: '2026-04-01T10:00:00.000Z',
};

async function installHostBillingRoutes(page: Page) {
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  let currentSession = hostUser;

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/encore/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace('/api/encore', '')}${url.search}`;
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData() || '{}') : {};
    calls.push({ method, path, body });

    if (path === '/auth/session' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/listings?status=active' || path.startsWith('/listings?hostId=')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [] }) });
      return;
    }

    if (path === '/bookings/me' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bookings: [] }) });
      return;
    }

    if (path === '/referrals/rewards' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rewards: [] }) });
      return;
    }

    if (path === '/ops/my-notifications' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      return;
    }

    if (path === '/billing/host/account' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: billingAccount }) });
      return;
    }

    if (path === '/billing/subscriptions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscriptions: currentSession.hostPlan === 'professional'
            ? [{
                id: 'subscription-host-1',
                user_id: currentSession.id,
                plan: 'professional',
                status: 'active',
                amount: 350,
                billing_interval: 'monthly',
                starts_at: '2026-04-01T10:00:00.000Z',
                ends_at: '2026-05-01T10:00:00.000Z',
                created_at: '2026-04-01T10:00:00.000Z',
              }]
            : [],
        }),
      });
      return;
    }

    if (path === '/billing/payments' && method === 'POST') {
      const purpose = String(body.purpose);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: `payment-${purpose}-1`,
          provider: 'yoco',
          providerMode: 'test',
          status: 'pending',
          redirectUrl: `http://127.0.0.1:3000/__yoco/${purpose}`,
          providerReference: `checkout-${purpose}-1`,
        }),
      });
      return;
    }

    if (path === '/billing/payments/payment-subscription-1?billingStatus=success' && method === 'GET') {
      currentSession = paidHostUser;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'paid', purpose: 'subscription', providerMode: 'test' }),
      });
      return;
    }

    if (path === '/billing/payments/payment-managed_hosting-1?billingStatus=success' && method === 'GET') {
      currentSession = paidHostUser;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'paid', purpose: 'managed_hosting', providerMode: 'test' }),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled host billing route: ${method} ${path}` }),
    });
  });

  return calls;
}

test('host pricing subscription starts the standard Yoco checkout and resolves the payment return', async ({ page }) => {
  const calls = await installHostBillingRoutes(page);

  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: /choose how hands-on/i })).toBeVisible();
  await Promise.all([
    page.waitForURL('**/__yoco/subscription'),
    page.getByRole('button', { name: /get more visibility/i }).click(),
  ]);

  expect(calls.find((call) => call.path === '/billing/payments' && call.method === 'POST')?.body).toEqual({
    purpose: 'subscription',
    plan: 'professional',
    billingInterval: 'monthly',
  });

  await page.goto('/pricing?billing_status=success&payment_id=payment-subscription-1');

  await expect(page).toHaveURL(/\/host\?modal=subscriptions$/);
  await expect(page.getByRole('heading', { name: /subscription management/i })).toBeVisible();
  expect(calls.some((call) => call.path === '/billing/payments/payment-subscription-1?billingStatus=success')).toBe(true);
});

test('managed hosting uses the current checkout flow and returns through payment_id', async ({ page }) => {
  const calls = await installHostBillingRoutes(page);

  await page.goto('/pricing');
  await Promise.all([
    page.waitForURL('**/__yoco/managed_hosting'),
    page.getByRole('button', { name: /apply for managed hosting/i }).click(),
  ]);

  expect(calls.find((call) => call.path === '/billing/payments' && call.body.purpose === 'managed_hosting')?.body).toEqual({
    purpose: 'managed_hosting',
  });

  await page.goto('/pricing?billing_status=success&payment_id=payment-managed_hosting-1');

  await expect(page).toHaveURL(/\/host\?modal=subscriptions$/);
  expect(calls.some((call) => call.path === '/billing/payments/payment-managed_hosting-1?billingStatus=success')).toBe(true);
});
