import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ENCORE_API_URL,
  clearEncoreSession,
  encoreRequest,
  getEncoreApiUrl,
} from '../src/lib/encore-client.ts';
import { getEncoreSessionProfile } from '../src/lib/identity-client.ts';
import { getAdminPlatformSettings, listAdminNotifications } from '../src/lib/admin-client.ts';
import { reviewKycSubmission } from '../src/lib/ops-client.ts';
import { getListing, mapReferralStatus, saveListing, submitPaymentProof, updateBookingStatus } from '../src/lib/platform-client.ts';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function getHeaders(init?: RequestInit) {
  return new Headers(init?.headers);
}

let fetchCalls: FetchCall[];

function installWindow() {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        hostname: '127.0.0.1',
      },
    },
    configurable: true,
    writable: true,
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

function createEncoreUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'guest@example.com',
    emailVerified: true,
    displayName: 'Guest Example',
    photoUrl: 'https://cdn.example.com/avatar.jpg',
    role: 'guest',
    hostPlan: 'standard',
    kycStatus: 'verified',
    balance: 1250,
    referralCount: 4,
    tier: 'silver',
    referralCode: 'GUEST123',
    referredByCode: null,
    paymentMethod: 'bank_transfer',
    paymentInstructions: 'Use the booking ID as reference.',
    paymentReferencePrefix: 'IDEAL',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z',
    ...overrides,
  };
}

test.beforeEach(() => {
  installWindow();
  installFetch(() => {
    throw new Error('Fetch was called without a test handler.');
  });
});

test.afterEach(async () => {
  await clearEncoreSession();
  Reflect.deleteProperty(globalThis, 'window');
});

test('uses the same-origin Encore proxy by default', () => {
  assert.equal(getEncoreApiUrl(), DEFAULT_ENCORE_API_URL);
  assert.equal(DEFAULT_ENCORE_API_URL, '/api/encore');
});

test('encoreRequest sends requests through the same-origin proxy', async () => {
  installFetch(() => createJsonResponse({ ok: true }));

  const response = await encoreRequest<{ ok: boolean }>(
    '/secure/resource',
    {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
    },
    { auth: true },
  );

  assert.deepEqual(response, { ok: true });
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/secure/resource`);
  assert.equal(getHeaders(fetchCalls[0]?.init).get('Content-Type'), 'application/json');
  assert.equal(fetchCalls[0]?.init?.credentials, 'same-origin');
  assert.equal(getHeaders(fetchCalls[0]?.init).get('Authorization'), null);
});

test('clearEncoreSession clears the HttpOnly session via the logout route', async () => {
  installFetch(() => new Response(null, { status: 204 }));

  await clearEncoreSession();

  assert.equal(fetchCalls[0]?.url, '/api/auth/logout');
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
});

test('getEncoreSessionProfile maps the Encore user profile from the proxy response', async () => {
  installFetch(() =>
    createJsonResponse({
      user: createEncoreUser({ role: 'host', hostPlan: 'professional' }),
    }),
  );

  const profile = await getEncoreSessionProfile();

  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/auth/session`);
  assert.equal(profile.uid, 'user-1');
  assert.equal(profile.role, 'host');
  assert.equal(profile.host_plan, 'professional');
  assert.equal(profile.kycStatus, 'verified');
  assert.equal(profile.paymentMethod, 'bank_transfer');
});

test('getListing and saveListing use the canonical Encore listing contract', async () => {
  installFetch((url, init) => {
    if (url.endsWith('/listings/listing-1')) {
      return createJsonResponse({
        listing: {
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
          images: ['https://cdn.example.com/listing.jpg'],
          videoUrl: null,
          isSelfCatering: true,
          hasRestaurant: false,
          isOccupied: false,
          latitude: -33.9,
          longitude: 18.4,
          blockedDates: [],
          status: 'active',
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
        },
      });
    }

    if (url.endsWith('/host/listings')) {
      return createJsonResponse({
        listing: {
          id: 'listing-2',
          hostId: 'host-1',
          title: 'Winelands Escape',
          description: 'Quiet stay',
          location: 'Stellenbosch',
          area: 'Central',
          province: 'Western Cape',
          category: 'house',
          type: 'house',
          pricePerNight: 2200,
          discountPercent: 5,
          adults: 4,
          children: 2,
          bedrooms: 2,
          bathrooms: 2,
          amenities: ['wifi'],
          facilities: ['pool'],
          restaurantOffers: [],
          images: [],
          videoUrl: null,
          isSelfCatering: true,
          hasRestaurant: false,
          isOccupied: false,
          latitude: null,
          longitude: null,
          blockedDates: [],
          status: 'pending',
          createdAt: '2026-03-02T10:00:00.000Z',
          updatedAt: '2026-03-02T10:00:00.000Z',
        },
      });
    }

    throw new Error(`Unexpected URL: ${url} ${init?.method || 'GET'}`);
  });

  const listing = await getListing('listing-1');
  const savedListing = await saveListing({
    title: 'Winelands Escape',
    description: 'Quiet stay',
    location: 'Stellenbosch',
    area: 'Central',
    province: 'Western Cape',
    category: 'house',
    type: 'house',
    pricePerNight: 2200,
    discount: 5,
    adults: 4,
    children: 2,
    bedrooms: 2,
    bathrooms: 2,
    amenities: ['wifi'],
    facilities: ['pool'],
    restaurant_offers: [],
    images: [],
    video_url: null,
    is_self_catering: true,
    has_restaurant: false,
    is_occupied: false,
    coordinates: null,
    blockedDates: [],
    status: 'pending',
  });

  assert.equal(listing.hostUid, 'host-1');
  assert.equal(fetchCalls[1]?.url, `${DEFAULT_ENCORE_API_URL}/host/listings`);
  assert.equal(fetchCalls[1]?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(fetchCalls[1]?.init?.body)), {
    title: 'Winelands Escape',
    description: 'Quiet stay',
    location: 'Stellenbosch',
    area: 'Central',
    province: 'Western Cape',
    category: 'house',
    type: 'house',
    pricePerNight: 2200,
    discountPercent: 5,
    adults: 4,
    children: 2,
    bedrooms: 2,
    bathrooms: 2,
    amenities: ['wifi'],
    facilities: ['pool'],
    restaurantOffers: [],
    images: [],
    videoUrl: null,
    isSelfCatering: true,
    hasRestaurant: false,
    isOccupied: false,
    latitude: null,
    longitude: null,
    blockedDates: [],
    status: 'pending',
  });
  assert.equal(savedListing.id, 'listing-2');
});

test('updateBookingStatus sends the booking status patch to the correct endpoint', async () => {
  installFetch(() =>
    createJsonResponse({
      booking: {
        id: 'booking-1',
        listingId: 'listing-1',
        guestId: 'guest-1',
        hostId: 'host-1',
        checkIn: '2026-04-10',
        checkOut: '2026-04-12',
        adults: 2,
        children: 1,
        totalPrice: 3200,
        status: 'awaiting_guest_payment',
        paymentMethod: 'bank_transfer',
        paymentInstructions: 'Pay within 24 hours.',
        createdAt: '2026-03-30T09:00:00.000Z',
        updatedAt: '2026-03-30T09:05:00.000Z',
      },
    }),
  );

  const booking = await updateBookingStatus('booking-1', 'awaiting_guest_payment');

  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/bookings/booking-1/status`);
  assert.equal(fetchCalls[0]?.init?.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    id: 'booking-1',
    status: 'awaiting_guest_payment',
  });
  assert.equal(booking.status, 'awaiting_guest_payment');
  assert.equal(booking.paymentInstructions, 'Pay within 24 hours.');
});

test('submitPaymentProof posts the guest payment proof to the booking payment endpoint', async () => {
  installFetch(() =>
    createJsonResponse({
      booking: {
        id: 'booking-9',
        listingId: 'listing-2',
        guestId: 'guest-1',
        hostId: 'host-1',
        checkIn: '2026-04-20',
        checkOut: '2026-04-22',
        adults: 2,
        children: 0,
        totalPrice: 4100,
        status: 'payment_submitted',
        paymentMethod: 'bank_transfer',
        paymentReference: 'IDEAL-4100',
        paymentProofUrl: 'https://cdn.example.com/payment-proof.jpg',
        paymentSubmittedAt: '2026-03-30T11:00:00.000Z',
        createdAt: '2026-03-30T10:30:00.000Z',
        updatedAt: '2026-03-30T11:00:00.000Z',
      },
    }),
  );

  const booking = await submitPaymentProof({
    id: 'booking-9',
    paymentReference: 'IDEAL-4100',
    paymentProofUrl: 'https://cdn.example.com/payment-proof.jpg',
  });

  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/bookings/booking-9/payment-proof`);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    id: 'booking-9',
    paymentReference: 'IDEAL-4100',
    paymentProofUrl: 'https://cdn.example.com/payment-proof.jpg',
    paymentProofFilename: null,
    paymentProofContentType: null,
    paymentProofDataBase64: null,
  });
  assert.equal(booking.status, 'payment_submitted');
  assert.equal(booking.paymentReference, 'IDEAL-4100');
  assert.equal(booking.paymentProofUrl, 'https://cdn.example.com/payment-proof.jpg');
});

test('referral mapping preserves rejected rewards instead of corrupting them to pending', () => {
  assert.equal(mapReferralStatus('pending'), 'pending');
  assert.equal(mapReferralStatus('earned'), 'rewarded');
  assert.equal(mapReferralStatus('paid'), 'confirmed');
  assert.equal(mapReferralStatus('rejected'), 'rejected');
});

test('admin notification and settings helpers hit the ops endpoints via the proxy', async () => {
  installFetch((url) => {
    if (url.endsWith('/ops/admin/notifications')) {
      return createJsonResponse({
        notifications: [
          {
            id: 'notification-1',
            title: 'Maintenance',
            message: 'We are rolling out a backend patch.',
            type: 'warning',
            target: 'all',
            createdAt: '2026-03-30T12:00:00.000Z',
          },
        ],
      });
    }

    if (url.endsWith('/ops/admin/settings')) {
      return createJsonResponse({
        settings: {
          id: 'global',
          referralRewardAmount: 250,
          commissionRate: 12,
          minWithdrawalAmount: 500,
          platformName: 'Ideal Stay',
          supportEmail: 'support@example.com',
          cancellationPolicyDays: 7,
          maxGuestsPerListing: 12,
          enableReviews: true,
          enableReferrals: true,
          maintenanceMode: false,
          updatedAt: '2026-03-30T12:05:00.000Z',
        },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  });

  const notifications = await listAdminNotifications();
  const settings = await getAdminPlatformSettings();

  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/ops/admin/notifications`);
  assert.equal(fetchCalls[1]?.url, `${DEFAULT_ENCORE_API_URL}/ops/admin/settings`);
  assert.equal(getHeaders(fetchCalls[0]?.init).get('Authorization'), null);
  assert.equal(getHeaders(fetchCalls[1]?.init).get('Authorization'), null);
  assert.equal(notifications[0]?.type, 'warning');
  assert.equal(settings.platformName, 'Ideal Stay');
});

test('reviewKycSubmission posts structured review decisions instead of prompt text hacks', async () => {
  installFetch(() =>
    createJsonResponse({
      submission: {
        id: 'kyc-1',
        userId: 'host-1',
        idType: 'passport',
        idNumber: 'A1234567',
        idImageKey: 'ops/kyc/id.jpg',
        selfieImageKey: 'ops/kyc/selfie.jpg',
        status: 'rejected',
        rejectionReason: 'Document was cropped.',
        submittedAt: '2026-03-29T18:00:00.000Z',
        reviewedAt: '2026-03-30T12:10:00.000Z',
        reviewerId: 'admin-1',
      },
    }),
  );

  const submission = await reviewKycSubmission({
    userId: 'host-1',
    status: 'rejected',
    rejectionReason: 'Document was cropped.',
  });

  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/ops/kyc/submissions/review`);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    userId: 'host-1',
    status: 'rejected',
    rejectionReason: 'Document was cropped.',
  });
  assert.equal(submission.status, 'rejected');
  assert.equal(submission.rejectionReason, 'Document was cropped.');
});
