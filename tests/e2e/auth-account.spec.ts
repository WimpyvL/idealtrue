import { expect, test, type Page } from '@playwright/test';
import { workflowUsers } from '../fixtures/workflows';

function encoreUser(overrides: Record<string, unknown> = {}) {
  return {
    ...workflowUsers.guest,
    isAdmin: false,
    ...overrides,
  };
}

async function installAuthWorkflowRoutes(page: Page) {
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  let currentSession: ReturnType<typeof encoreUser> | null = null;

  await page.route('**/api/auth/logout', async (route) => {
    currentSession = null;
    calls.push({ method: 'POST', path: '/api/auth/logout', body: {} });
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

    if (path === '/auth/signup' && method === 'POST') {
      currentSession = encoreUser({
        id: 'new-guest-user',
        email: body.email,
        displayName: body.displayName,
        role: body.role || 'guest',
        referredByCode: body.referredByCode ?? null,
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/auth/verify-email' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    if (path === '/auth/login' && method === 'POST') {
      currentSession = encoreUser({
        id: 'new-guest-user',
        email: body.email,
        displayName: 'New Guest',
        emailVerified: true,
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/auth/request-password-reset' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    if (path === '/auth/reset-password' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    if (path === '/listings?status=active' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [] }) });
      return;
    }

    if (path.startsWith('/listings?hostId=') && method === 'GET') {
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

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled auth workflow route: ${method} ${path}` }),
    });
  });

  return calls;
}

test('signup, email verification, and signin use the account lifecycle routes', async ({ page }) => {
  const calls = await installAuthWorkflowRoutes(page);

  await page.goto('/signup?ref=HOST1');
  await expect(page.getByRole('heading', { name: 'Join Ideal Stay' })).toBeVisible();

  await page.getByPlaceholder('Your full name').fill('New Guest');
  await page.getByPlaceholder('you@example.com').fill('new-guest@example.com');
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('input[type="password"]').last().fill('password123');
  await page.getByText("I'm a Guest").click();
  await page.locator('form').getByRole('button', { name: /Create account/ }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Account created. Check your email to verify your address.')).toBeVisible();
  expect(calls.find((call) => call.path === '/auth/signup')?.body).toMatchObject({
    email: 'new-guest@example.com',
    displayName: 'New Guest',
    role: 'guest',
    referredByCode: 'HOST1',
  });

  await page.goto('/signup?mode=verify-email&token=verify-token-1');
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await expect(page.getByText('Your email is verified. You can sign in normally.')).toBeVisible();
  expect(calls.find((call) => call.path === '/auth/verify-email')?.body).toEqual({ token: 'verify-token-1' });

  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await page.getByPlaceholder('you@example.com').fill('new-guest@example.com');
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('form').getByRole('button', { name: /Sign in/ }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(calls.find((call) => call.path === '/auth/login')?.body).toEqual({
    email: 'new-guest@example.com',
    password: 'password123',
  });
});

test('password reset request and token reset stay on the auth workflow', async ({ page }) => {
  const calls = await installAuthWorkflowRoutes(page);

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await page.getByPlaceholder('you@example.com').fill('new-guest@example.com');
  await page.getByRole('button', { name: 'Email me a password reset link' }).click();

  await expect(page.getByText('If that account exists, a reset link has been sent.')).toBeVisible();
  expect(calls.find((call) => call.path === '/auth/request-password-reset')?.body).toEqual({
    email: 'new-guest@example.com',
  });

  await page.goto('/signup?mode=reset-password&token=reset-token-1');
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await page.locator('input[type="password"]').first().fill('new-password123');
  await page.locator('input[type="password"]').last().fill('new-password123');
  await page.locator('form').getByRole('button', { name: /Update password/ }).click();

  await expect(page.getByText('Password updated. You can sign in now.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Join Ideal Stay' })).toBeVisible();
  expect(calls.find((call) => call.path === '/auth/reset-password')?.body).toEqual({
    token: 'reset-token-1',
    password: 'new-password123',
  });
});
