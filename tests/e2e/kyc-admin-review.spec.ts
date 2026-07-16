// ( |╲ ) Author: Klaasvaakie
import { expect, test, type Page } from '@playwright/test';
import { fixedNow, workflowKyc, workflowUsers } from '../fixtures/workflows';

type WorkflowUser = typeof workflowUsers.host;
type KycSubmission = typeof workflowKyc.pending;

const imageBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

function encoreUser(user: WorkflowUser, overrides: Partial<WorkflowUser> = {}) {
  return {
    ...user,
    ...overrides,
    isAdmin: overrides.role === 'admin' || user.role === 'admin',
  };
}

function platformSettings() {
  return {
    id: 'global',
    referralRewardAmount: 50,
    minWithdrawalAmount: 100,
    platformName: 'Ideal Stay',
    supportEmail: 'support@idealstay.test',
    cancellationPolicyDays: 7,
    maxGuestsPerListing: 10,
    enableReviews: true,
    enableReferrals: true,
    maintenanceMode: false,
    updatedAt: fixedNow,
  };
}

async function installKycWorkflowRoutes(page: Page) {
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  let hostUser = encoreUser(workflowUsers.kycPendingHost, { kycStatus: 'none' });
  let adminUser = encoreUser(workflowUsers.admin);
  let currentSession: ReturnType<typeof encoreUser> | null = null;
  let kycSubmission: KycSubmission | null = null;

  await page.route('**/api/auth/logout', async (route) => {
    currentSession = null;
    calls.push({ method: 'POST', path: '/api/auth/logout', body: {} });
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/secure-kyc/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: imageBuffer });
  });

  await page.route('**/api/encore/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace('/api/encore', '')}${url.search}`;
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData() || '{}') : {};
    calls.push({ method, path, body });

    if (path === '/auth/session' && method === 'GET') {
      if (!currentSession) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'unauthenticated', message: 'unauthenticated' }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/auth/login' && method === 'POST') {
      currentSession = body.email === adminUser.email ? adminUser : hostUser;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/users/me' && method === 'PUT') {
      if (!currentSession) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'not_authenticated' }) });
        return;
      }
      const nextSession = encoreUser(currentSession, body as Partial<WorkflowUser>);
      if (nextSession.id === hostUser.id) hostUser = nextSession;
      if (nextSession.id === adminUser.id) adminUser = nextSession;
      currentSession = nextSession;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/ops/kyc/submissions/me' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submission: kycSubmission }) });
      return;
    }

    if (path === '/ops/kyc/submissions' && method === 'POST') {
      kycSubmission = {
        ...workflowKyc.pending,
        idNumber: String(body.idNumber),
        idType: body.idType as KycSubmission['idType'],
        status: 'pending',
        rejectionReason: null,
        submittedAt: fixedNow,
        reviewedAt: null,
        reviewerId: null,
      };
      hostUser = encoreUser(hostUser, { kycStatus: 'pending' });
      currentSession = hostUser;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submission: kycSubmission }) });
      return;
    }

    if (path === '/ops/kyc/submissions' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submissions: kycSubmission ? [kycSubmission] : [] }) });
      return;
    }

    if (path === `/ops/kyc/submissions/${hostUser.id}/assets` && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assets: {
            idImageUrl: `http://127.0.0.1:3000/secure-kyc/${hostUser.id}/id.png`,
            selfieImageUrl: `http://127.0.0.1:3000/secure-kyc/${hostUser.id}/selfie.png`,
          },
        }),
      });
      return;
    }

    if (path === '/ops/kyc/submissions/review' && method === 'POST') {
      kycSubmission = {
        ...(kycSubmission || workflowKyc.pending),
        status: body.status as KycSubmission['status'],
        rejectionReason: (body.rejectionReason as string | undefined) || null,
        reviewedAt: fixedNow,
        reviewerId: adminUser.id,
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submission: kycSubmission }) });
      return;
    }

    if (path === '/admin/users/kyc-status' && method === 'POST') {
      hostUser = encoreUser(hostUser, { kycStatus: body.kycStatus as WorkflowUser['kycStatus'] });
      if (currentSession?.id === hostUser.id) currentSession = hostUser;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: hostUser }) });
      return;
    }

    if (path === '/admin/users' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [adminUser, hostUser] }) });
      return;
    }

    if (path === '/ops/admin/notifications' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notification: {
            id: 'notification-kyc-approved',
            title: body.title,
            message: body.message,
            type: body.type,
            target: body.target,
            actionPath: body.actionPath ?? null,
            readAt: null,
            createdAt: fixedNow,
          },
        }),
      });
      return;
    }

    if (path === '/listings?status=active' || path.startsWith('/listings?hostId=') || path === '/listings') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [] }) });
      return;
    }

    if (path === '/bookings/me' || path === '/admin/bookings') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bookings: [] }) });
      return;
    }

    if (path === '/referrals/rewards' || path === '/admin/referrals') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rewards: [] }) });
      return;
    }

    if (path === '/admin/reviews') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [] }) });
      return;
    }

    if (path === '/admin/subscriptions') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscriptions: [] }) });
      return;
    }

    if (path === '/admin/checkouts') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ checkouts: [] }) });
      return;
    }

    if (path === '/admin/billing/host-accounts') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accounts: [] }) });
      return;
    }

    if (path === '/ops/admin/notifications' || path === '/ops/my-notifications') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      return;
    }

    if (path === '/ops/admin/settings') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: platformSettings() }) });
      return;
    }

    if (path === '/ops/admin/observability') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          snapshot: {
            checkedAt: fixedNow,
            backendStartedAt: fixedNow,
            uptimeSeconds: 120,
            averageDbPingMs: 2,
            healthyDatabases: 1,
            totalDatabases: 1,
            databases: [{ name: 'ops', healthy: true, latencyMs: 2 }],
            encoreCloudTracingAvailable: true,
            encoreCloudMetricsAvailable: true,
            encoreCloudLogsAvailable: true,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled KYC workflow route: ${method} ${path}` }),
    });
  });

  return calls;
}

test('host KYC submission can be reviewed and approved by an admin', async ({ page }) => {
  const calls = await installKycWorkflowRoutes(page);

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await page.getByPlaceholder('you@example.com').fill(workflowUsers.kycPendingHost.email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('form').getByRole('button', { name: /Sign in/ }).click();

  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Verification' }).click();
  const kycDialog = page.getByRole('dialog', { name: 'Host Verification' });
  await expect(kycDialog).toBeVisible();

  await kycDialog.getByLabel('Document Number').fill('9001015009087');
  await kycDialog.locator('input[type="file"]').first().setInputFiles({
    name: 'id-document.png',
    mimeType: 'image/png',
    buffer: imageBuffer,
  });
  await kycDialog.locator('input[type="file"]').last().setInputFiles({
    name: 'selfie.png',
    mimeType: 'image/png',
    buffer: imageBuffer,
  });
  await kycDialog.getByRole('button', { name: 'Submit Verification' }).click();

  await expect(page.getByText('Verification submitted! Admin will review it shortly.')).toBeVisible();
  await expect(page.getByText('pending').first()).toBeVisible();

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await page.getByPlaceholder('you@example.com').fill(workflowUsers.admin.email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('form').getByRole('button', { name: /Sign in/ }).click();

  await page.getByRole('link', { name: 'Admin Panel' }).click();
  await page.getByRole('button', { name: 'KYC Verification' }).click();
  await expect(page.getByRole('heading', { name: 'KYC Verification' })).toBeVisible();
  await expect(page.getByText('KYC Pending Host')).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const reviewDialog = page.getByRole('dialog', { name: 'Review Verification: KYC Pending Host' });
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog.getByText(workflowKyc.pending.idNumberMasked)).toBeVisible();
  await reviewDialog.getByRole('button', { name: 'Approve Verification' }).click();
  await expect(page.getByText('Verification Approved')).toBeVisible();
  await expect(page.getByText('verified').first()).toBeVisible();

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await page.getByPlaceholder('you@example.com').fill(workflowUsers.kycPendingHost.email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('form').getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('link', { name: 'Account' }).click();

  await expect(page.getByText('verified').first()).toBeVisible();
  expect(calls.find((call) => call.path === '/ops/kyc/submissions')?.body).toMatchObject({
    idNumber: '9001015009087',
    idType: 'id_card',
  });
  expect(calls.find((call) => call.path === '/ops/kyc/submissions/review')?.body).toEqual({
    userId: workflowUsers.kycPendingHost.id,
    status: 'verified',
  });
  expect(calls.find((call) => call.path === '/admin/users/kyc-status')?.body).toEqual({
    userId: workflowUsers.kycPendingHost.id,
    kycStatus: 'verified',
  });
});
