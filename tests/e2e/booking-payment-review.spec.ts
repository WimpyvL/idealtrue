import { expect, test, type Page } from '@playwright/test';

const guestUser = {
  id: 'guest-1',
  email: 'guest@example.com',
  emailVerified: true,
  displayName: 'Guest Example',
  photoUrl: '',
  role: 'guest',
  isAdmin: false,
  hostPlan: 'standard',
  kycStatus: 'verified',
  accountStatus: 'active',
  accountStatusReason: null,
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
  paymentMethod: 'bank_transfer',
  paymentInstructions: 'Pay into the host trust account.',
  paymentReferencePrefix: 'HOST',
};

const listing = {
  id: 'listing-1',
  hostId: hostUser.id,
  title: 'Sea Point Stay',
  description: 'Ocean-facing apartment',
  location: 'Cape Town',
  area: 'Sea Point',
  province: 'Western Cape',
  category: 'apartment',
  type: 'apartment',
  pricePerNight: 1800,
  discountPercent: 10,
  breakageDeposit: 750,
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
  availabilityBlocks: [],
  status: 'active',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

function bookingIsoDate(date: Date) {
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function calendarDataDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

async function signIn(page: Page, email: string) {
  await page.goto('/signup?mode=signin');
  await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(email === hostUser.email ? 'Host Dashboard' : 'My Stays')).toBeVisible();
}

test('guest request -> host approve -> guest proof -> host confirm -> guest review', async ({ page }) => {
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 5);
  checkInDate.setHours(0, 0, 0, 0);

  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + 3);

  let currentSession: typeof guestUser | typeof hostUser | null = null;
  let reviewPosted = false;
  let reviewRequestBody: Record<string, unknown> | null = null;
  let booking = {
    id: 'booking-1',
    listingId: listing.id,
    guestId: guestUser.id,
    hostId: hostUser.id,
    checkIn: bookingIsoDate(checkInDate),
    checkOut: bookingIsoDate(checkOutDate),
    adults: 1,
    children: 0,
    totalPrice: 5445,
    breakageDeposit: listing.breakageDeposit,
    inquiryState: 'PENDING',
    paymentState: 'UNPAID',
    declineReason: null,
    declineReasonNote: null,
    paymentMethod: 'bank_transfer',
    paymentInstructions: hostUser.paymentInstructions,
    paymentReference: null,
    paymentProofAccessible: false,
    paymentProofAccessUrl: null,
    viewedAt: null,
    respondedAt: null,
    paymentUnlockedAt: null,
    paymentSubmittedAt: null,
    paymentConfirmedAt: null,
    expiresAt: '2026-04-26T10:00:00.000Z',
    bookedAt: null,
    createdAt: '2026-04-24T10:00:00.000Z',
    updatedAt: '2026-04-24T10:00:00.000Z',
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
    const body = request.postData() ? JSON.parse(request.postData() || '{}') : {};

    if (path === '/auth/session' && method === 'GET') {
      if (!currentSession) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'not_authenticated' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/auth/login' && method === 'POST') {
      currentSession = body.email === hostUser.email ? hostUser : guestUser;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentSession }) });
      return;
    }

    if (path === '/listings?status=active' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
      return;
    }

    if (path === `/listings/${listing.id}` && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listing }) });
      return;
    }

    if (path.startsWith('/listings?hostId=') && method === 'GET') {
      const listings = currentSession?.id === hostUser.id ? [listing] : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings }) });
      return;
    }

    if (path === '/bookings/me' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bookings: currentSession ? [booking] : [] }) });
      return;
    }

    if (path === '/bookings' && method === 'POST') {
      booking = {
        ...booking,
        ...body,
        id: 'booking-1',
        guestId: currentSession?.id || guestUser.id,
        inquiryState: 'PENDING',
        paymentState: 'UNPAID',
        paymentReference: null,
        paymentProofAccessible: false,
        paymentProofAccessUrl: null,
        paymentSubmittedAt: null,
        paymentConfirmedAt: null,
        bookedAt: null,
        createdAt: '2026-04-24T10:00:00.000Z',
        updatedAt: '2026-04-24T10:00:00.000Z',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
      return;
    }

    if (path === '/bookings/booking-1/status' && method === 'PATCH') {
      booking = {
        ...booking,
        inquiryState: body.status,
        paymentState: body.status === 'APPROVED' ? 'INITIATED' : booking.paymentState,
        paymentReference: body.status === 'APPROVED' ? 'HOST-booking-1' : booking.paymentReference,
        paymentUnlockedAt: body.status === 'APPROVED' ? '2026-04-24T10:10:00.000Z' : booking.paymentUnlockedAt,
        respondedAt: body.status === 'APPROVED' ? '2026-04-24T10:10:00.000Z' : booking.respondedAt,
        expiresAt: body.status === 'APPROVED' ? '2026-04-25T10:10:00.000Z' : booking.expiresAt,
        updatedAt: '2026-04-24T10:10:00.000Z',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
      return;
    }

    if (path === '/bookings/booking-1/payment-proof' && method === 'POST') {
      expect(body.paymentReference).toBe('HOST-booking-1');
      expect(body.paymentProofFilename).toBe('payment-proof.jpg');
      expect(body.paymentProofContentType).toBe('image/jpeg');
      expect(String(body.paymentProofDataBase64 || '').length).toBeGreaterThan(20);
      booking = {
        ...booking,
        inquiryState: 'APPROVED',
        paymentState: 'INITIATED',
        paymentReference: body.paymentReference,
        paymentProofAccessible: true,
        paymentProofAccessUrl: '/signed/payment-proof.jpg?sig=abc',
        paymentSubmittedAt: '2026-04-24T10:20:00.000Z',
        updatedAt: '2026-04-24T10:20:00.000Z',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
      return;
    }

    if (path === '/bookings/booking-1/payment-confirm' && method === 'POST') {
      booking = {
        ...booking,
        inquiryState: 'BOOKED',
        paymentState: 'COMPLETED',
        paymentConfirmedAt: '2026-04-24T10:30:00.000Z',
        bookedAt: '2026-04-24T10:30:00.000Z',
        expiresAt: null,
        updatedAt: '2026-04-24T10:30:00.000Z',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
      return;
    }

    if (path === `/reviews/${listing.id}` && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [] }) });
      return;
    }

    if (path === '/reviews' && method === 'POST') {
      reviewPosted = true;
      reviewRequestBody = body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          review: {
            id: 'review-1',
            listingId: listing.id,
            bookingId: booking.id,
            guestId: guestUser.id,
            hostId: hostUser.id,
            cleanliness: body.cleanliness,
            accuracy: body.accuracy,
            communication: body.communication,
            location: body.location,
            value: body.value,
            comment: body.comment,
            status: 'pending',
            createdAt: '2026-04-24T10:40:00.000Z',
          },
        }),
      });
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

    if (path === '/ops/my-notifications/read' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-24T10:12:00.000Z' }) });
      return;
    }

    if (path === '/ops/my-notifications/read-all' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-24T10:12:00.000Z' }) });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled booking lifecycle route: ${method} ${path}` }),
    });
  });

  await signIn(page, guestUser.email);
  await page.getByText(listing.title).first().click();
  await page.getByRole('button', { name: /Check-in Add date Checkout Add date/ }).click();
  await page.locator(`button[data-day="${calendarDataDay(checkInDate)}"]`).first().click();
  await expect(page.getByText('Now choose your check-out date.')).toBeVisible();
  await page.locator(`button[data-day="${calendarDataDay(checkOutDate)}"]`).first().click({ force: true });
  await page.getByRole('button', { name: 'Request to Book' }).click();
  await expect(page.getByText('Booking request sent! The host will contact you shortly.')).toBeVisible();

  await signIn(page, hostUser.email);
  await page.getByRole('link', { name: 'Enquiries' }).click();
  await expect(page.getByRole('heading', { name: listing.title }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Inquiry approved. Payment is now unlocked for the guest.')).toBeVisible();
  await expect(page.getByText('Awaiting Guest Payment').first()).toBeVisible();

  await signIn(page, guestUser.email);
  await page.getByRole('link', { name: 'My Stays' }).click();
  await expect(page.getByText('Ready for Payment')).toBeVisible();
  await expect(page.getByText('Payment unlocked. Submit payment proof before the approval window closes.')).toBeVisible();
  await page.getByRole('button', { name: 'Send Proof of Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Submit Payment Proof' })).toBeVisible();
  await page.getByLabel('Payment reference').fill('HOST-booking-1');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'payment-proof.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atpU8sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByText('payment-proof.png')).toBeVisible();
  await page.getByRole('button', { name: 'Submit proof' }).click();
  await expect(page.getByText('Payment proof submitted. The host can now confirm receipt.')).toBeVisible();
  await expect(page.getByText('Payment proof submitted. Host confirmation is still pending.')).toBeVisible();

  await signIn(page, hostUser.email);
  await page.getByRole('link', { name: 'Enquiries' }).click();
  await expect(page.getByRole('heading', { name: 'Awaiting Payment Confirmation' })).toBeVisible();
  await expect(page.getByText('Payment reference:')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open private proof' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Payment' }).click();
  await expect(page.getByText('Payment confirmed. The stay is now booked.')).toBeVisible();
  await expect(page.getByText('Confirmed Stays')).toBeVisible();

  await signIn(page, guestUser.email);
  await page.getByRole('link', { name: 'My Stays' }).click();
  await expect(page.getByText('BOOKED', { exact: true })).toBeVisible();
  await expect(page.getByText('Payment confirmed. Your stay is booked.')).toBeVisible();
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'How was your stay?' })).toBeVisible();
  await page.getByPlaceholder('What did you love? What could be better?').fill('Great stay and clear host communication.');
  await page.getByRole('button', { name: 'Post Review' }).click();
  await expect(page.getByRole('heading', { name: 'How was your stay?' })).toHaveCount(0);

  expect(reviewPosted).toBe(true);
  expect(reviewRequestBody).toMatchObject({
    listingId: listing.id,
    bookingId: booking.id,
    hostId: hostUser.id,
    comment: 'Great stay and clear host communication.',
  });
});
