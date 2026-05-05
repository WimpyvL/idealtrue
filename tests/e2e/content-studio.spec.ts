import { expect, test, type Page } from '@playwright/test';
import { fixedNow, workflowContentDrafts, workflowListings, workflowUsers } from '../fixtures/workflows';

type ContentDraftFixture = typeof workflowContentDrafts.draft;

const hostUser = {
  ...workflowUsers.host,
  isAdmin: false,
};

const listing = {
  ...workflowListings.active,
  images: ['https://cdn.example.com/content-studio-sea-point.jpg'],
};

function contentEntitlements(overrides: Record<string, unknown> = {}) {
  return {
    plan: 'professional',
    contentStudioEnabled: true,
    includedDraftsPerMonth: 60,
    usedDraftsThisMonth: 3,
    remainingIncludedDrafts: 57,
    creditBalance: 4,
    canSchedule: true,
    ...overrides,
  };
}

function draftFixture(overrides: Partial<ContentDraftFixture> = {}): ContentDraftFixture {
  return {
    ...workflowContentDrafts.draft,
    listingId: listing.id,
    listingTitle: listing.title,
    listingLocation: listing.location,
    platform: 'instagram',
    tone: 'professional',
    templateId: 'featured_stay',
    templateName: 'Featured Stay',
    content: 'Book a long weekend at Sea Point Stay.',
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  } as ContentDraftFixture;
}

async function installContentStudioRoutes(page: Page) {
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  let currentDrafts: ContentDraftFixture[] = [];

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/ai/social-image', async (route) => {
    calls.push({ method: route.request().method(), path: '/api/ai/social-image', body: JSON.parse(route.request().postData() || '{}') });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        templateId: 'featured_stay',
        templateName: 'Featured Stay',
        headline: 'Stay at Sea Point Stay',
        caption: 'A coastal weekend worth sharing.',
        bookingUrl: `https://ideal-stay.test/?listingId=${listing.id}`,
        mimeType: 'image/svg+xml',
        dataBase64: 'PHN2Zy8+',
        assets: [
          {
            id: 'featured-stay',
            label: 'Featured Stay',
            width: 1080,
            height: 1350,
            mimeType: 'image/svg+xml',
            fileName: 'ideal-stay-featured.svg',
            dataBase64: 'PHN2Zy8+',
          },
        ],
      }),
    });
  });

  await page.route('**/api/encore/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace('/api/encore', '')}${url.search}`;
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData() || '{}') : {};
    calls.push({ method, path, body });

    if (path === '/auth/session' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: hostUser }) });
      return;
    }

    if (path === '/listings?status=active' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
      return;
    }

    if (path === `/listings?hostId=${encodeURIComponent(hostUser.id)}` && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
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

    if (path === '/billing/content/entitlements' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entitlements: contentEntitlements() }) });
      return;
    }

    if (path === '/billing/content/drafts' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ drafts: currentDrafts }) });
      return;
    }

    if (path === '/billing/content/drafts/generate' && method === 'POST') {
      const generated = draftFixture({
        id: 'content-draft-generated',
        content: 'Generated listing-backed caption for Sea Point Stay.',
        status: 'draft',
        scheduledFor: null,
        publishedAt: null,
      });
      currentDrafts = [generated, ...currentDrafts];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: generated,
          entitlements: contentEntitlements({
            usedDraftsThisMonth: 4,
            remainingIncludedDrafts: 56,
          }),
        }),
      });
      return;
    }

    if (path === '/billing/content/drafts/content-draft-generated' && method === 'PUT') {
      const existing = currentDrafts.find((draft) => draft.id === 'content-draft-generated');
      if (!existing) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'draft_missing' }) });
        return;
      }

      const status = body.status || existing.status;
      const updated = draftFixture({
        ...existing,
        content: String(body.content ?? existing.content),
        status,
        scheduledFor: status === 'scheduled' ? String(body.scheduledFor) : null,
        publishedAt: status === 'published' ? '2026-05-01T10:15:00.000Z' : existing.publishedAt,
        updatedAt: status === 'published' ? '2026-05-01T10:15:00.000Z' : '2026-05-01T09:35:00.000Z',
      });
      currentDrafts = currentDrafts.map((draft) => draft.id === updated.id ? updated : draft);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draft: updated }) });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled content studio route: ${method} ${path}` }),
    });
  });

  return calls;
}

test('host generates a listing-backed draft, schedules it, revisits it, and marks it published', async ({ page }) => {
  const calls = await installContentStudioRoutes(page);

  await page.goto('/host/social');

  await expect(page.getByRole('heading', { name: /Get inspired for Sea Point Stay/i })).toBeVisible();
  await page.getByRole('button', { name: /Generate Post Set/i }).click();

  await expect(page.locator('textarea')).toHaveValue('Generated listing-backed caption for Sea Point Stay.');
  expect(calls.find((call) => call.path === '/billing/content/drafts/generate')?.body).toMatchObject({
    listingId: listing.id,
    platform: 'instagram',
    tone: 'professional',
    templateId: 'featured_stay',
  });
  expect(calls.find((call) => call.path === '/api/ai/social-image')?.body).toMatchObject({
    listingId: listing.id,
    sourceImageUrl: listing.images[0],
  });

  const editor = page.locator('textarea');
  await editor.fill('Edited scheduled caption for the Sea Point weekend.');
  await page.locator('input[type="datetime-local"]').fill('2026-05-01T09:30');
  await page.getByRole('button', { name: 'Schedule' }).click();

  await expect(page.getByRole('button', { name: /Edit scheduled draft for Sea Point Stay/i })).toBeVisible();
  expect(calls.find((call) => call.path === '/billing/content/drafts/content-draft-generated' && call.body.status === 'scheduled')?.body).toMatchObject({
    content: 'Edited scheduled caption for the Sea Point weekend.',
    status: 'scheduled',
    scheduledFor: expect.stringMatching(/^2026-05-01T/),
  });

  await page.reload();
  await expect(page.getByRole('button', { name: /Edit scheduled draft for Sea Point Stay/i })).toBeVisible();
  await page.getByRole('button', { name: /Studio Tools/i }).click();
  await page.getByRole('button', { name: 'Content Calendar' }).click();
  await expect(page.getByRole('button', { name: /Open scheduled draft for Sea Point Stay/i })).toBeVisible();

  await page.getByRole('button', { name: /Open scheduled draft for Sea Point Stay/i }).click();
  await expect(page.locator('textarea')).toHaveValue('Edited scheduled caption for the Sea Point weekend.');
  await page.getByRole('button', { name: 'Publish Logged' }).click();

  await expect(page.getByRole('button', { name: /Edit published draft for Sea Point Stay/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open published draft for Sea Point Stay/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open scheduled draft for Sea Point Stay/i })).toHaveCount(0);
  expect(calls.find((call) => call.path === '/billing/content/drafts/content-draft-generated' && call.body.status === 'published')?.body).toMatchObject({
    status: 'published',
    scheduledFor: null,
  });

  await page.reload();
  await page.getByRole('button', { name: /Studio Tools/i }).click();
  await page.getByRole('button', { name: 'Content Calendar' }).click();
  await expect(page.getByRole('button', { name: /Open published draft for Sea Point Stay/i })).toContainText('Published');
});
