import { test, expect } from '@playwright/test';

test('guest booking request, host approval, and guest notification smoke flow', async ({ page }) => {
  const guestUser = {
    id: 'guest-1',
    email: 'guest@example.com',
    emailVerified: true,
    displayName: 'Guest Example',
    photoUrl: '',
    role: 'guest',
    hostPlan: 'standard',
    kycStatus: 'verified',
    balance: 0,
    referralCount: 0,
    tier: 'bronze',
    referralCode: 'GUEST1',
    referredByCode: null,
    paymentMethod: null,
    paymentInstructions: null,
    paymentReferencePrefix: null,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  };

  const hostUser = {
    ...guestUser,
    id: 'host-1',
    email: 'host@example.com',
    displayName: 'Host Example',
    role: 'host',
    hostPlan: 'professional',
    referralCode: 'HOST1',
  };

  const listing = {
    id: 'listing-1',
    hostId: 'host-1',
    title: 'Sea Point Stay',
    description: 'Ocean-facing apartment',
    location: 'Cape Town',
    area: 'Sea Point',
    province: 'Western Cape',
    category: 'apartment',
    type: 'apartment',
    pricePerNight: 1800,
    discountPercent: 10,
    adults: 2,
    children: 1,
    bedrooms: 1,
    bathrooms: 1,
    amenities: ['wifi'],
    facilities: ['parking'],
    restaurantOffers: [],
    images: [],
    videoUrl: null,
    isSelfCatering: true,
    hasRestaurant: false,
    isOccupied: false,
    latitude: -33.9,
    longitude: 18.4,
    blockedDates: [],
    status: 'active',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  };

  let currentSession: typeof guestUser | typeof hostUser | null = null;
  let booking = {
    id: 'booking-1',
    listingId: 'listing-1',
    guestId: 'guest-1',
    hostId: 'host-1',
    checkIn: '2026-05-05T00:00:00.000Z',
    checkOut: '2026-05-08T00:00:00.000Z',
    adults: 1,
    children: 0,
    totalPrice: 5445,
    inquiryState: 'PENDING',
    paymentState: 'UNPAID',
    paymentMethod: 'bank_transfer',
    paymentInstructions: 'Pay within 24 hours.',
    createdAt: '2026-04-01T10:05:00.000Z',
    updatedAt: '2026-04-01T10:05:00.000Z',
  };

  await page.route('**/api/auth/logout', async (route) => {
    currentSession = null;
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/encore/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace('/api/encore', '')}${url.search}`;
    const method = request.method();

    if (path === '/auth/session' && method === 'GET') {
      if (!currentSession) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'not_authenticated' }) });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      currentSession = body.email === hostUser.email ? hostUser : guestUser;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/listings?status=active' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
      return;
    }

    if (path.startsWith('/listings?hostId=') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
      return;
    }

    if (path === '/bookings/me' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bookings: currentSession ? [booking] : [] }) });
      return;
    }

    if (path === '/referrals/rewards' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rewards: [] }) });
      return;
    }

    if (path === '/bookings' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      booking = {
        ...booking,
        ...body,
        id: 'booking-1',
        guestId: currentSession?.id || guestUser.id,
        inquiryState: 'PENDING',
        paymentState: 'UNPAID',
        createdAt: '2026-04-01T10:05:00.000Z',
        updatedAt: '2026-04-01T10:05:00.000Z',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
      return;
    }

    if (path === '/bookings/booking-1/status' && method === 'PATCH') {
      const body = JSON.parse(request.postData() || '{}');
      booking = {
        ...booking,
        inquiryState: body.status,
        paymentState: body.status === 'APPROVED' ? 'INITIATED' : booking.paymentState,
        updatedAt: '2026-04-01T10:10:00.000Z',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
      return;
    }

    if (path === '/reviews/listing-1' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [] }) });
      return;
    }

    if (path === '/ops/my-notifications' && method === 'GET') {
      const notifications =
        currentSession?.id === guestUser.id && booking.inquiryState === 'APPROVED' && booking.paymentState === 'INITIATED'
          ? [
              {
                id: 'notification-1',
                title: 'Payment requested',
                message: 'Your booking was approved. Submit payment to confirm it.',
                type: 'info',
                target: guestUser.id,
                actionPath: '/guest',
                createdAt: '2026-04-01T10:10:00.000Z',
                readAt: null,
              },
            ]
          : [];

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications }) });
      return;
    }

    if (path === '/ops/my-notifications/read' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-01T10:12:00.000Z' }) });
      return;
    }

    if (path === '/ops/my-notifications/read-all' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-01T10:12:00.000Z' }) });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled smoke route: ${method} ${path}` }),
    });
  });

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill(guestUser.email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).last().click();

  await expect(page.getByText('My Stays')).toBeVisible();
  await page.getByText('Sea Point Stay').first().click();
  await page.getByRole('button', { name: /Check-in Add date Checkout Add date/ }).click();
  await page.locator('button[data-day="5/5/2026"]').click();
  await expect(page.getByText('Now choose your check-out date.')).toBeVisible();
  await page.locator('button[data-day="5/8/2026"]').click({ force: true });
  await page.getByRole('button', { name: 'Request to Book' }).click();
  await expect(page.getByText('Booking request sent! The host will contact you shortly.')).toBeVisible();

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill(hostUser.email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).last().click();

  await page.getByRole('link', { name: 'Enquiries' }).click();
  await expect(page.getByRole('heading', { name: 'Sea Point Stay' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();

  await page.goto('/signup');
  await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill(guestUser.email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).last().click();

  await page.getByRole('link', { name: 'My Stays' }).click();
  await expect(page.getByText('Ready for Payment')).toBeVisible();
  await page.getByRole('button', { name: 'Open notifications' }).click();
  await expect(page.getByText('Payment requested')).toBeVisible();
  await expect(page.getByText('1 new')).toBeVisible();
});
