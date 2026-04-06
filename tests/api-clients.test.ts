import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ENCORE_API_URL,
  clearEncoreSession,
  encoreRequest,
  getEncoreApiUrl,
} from '../src/lib/encore-client.ts';
import { getEncoreSessionProfile } from '../src/lib/identity-client.ts';
import { uploadListingMedia } from '../src/lib/media-client.ts';
import { deleteAdminUser, getAdminPlatformSettings, listAdminNotifications, setAdminUserAccountStatus } from '../src/lib/admin-client.ts';
import { dismissNotification } from '../src/lib/notification-client.ts';
import { reviewKycSubmission } from '../src/lib/ops-client.ts';
import { deleteListing, getListing, mapReferralStatus, saveListing, submitPaymentProof, updateBookingStatus } from '../src/lib/platform-client.ts';

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
    accountStatus: 'active',
    accountStatusReason: null,
    accountStatusChangedAt: null,
    accountStatusChangedBy: null,
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
  assert.equal(profile.id, 'user-1');
  assert.equal(profile.role, 'host');
  assert.equal(profile.hostPlan, 'professional');
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
          rejectionReason: null,
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
          status: 'rejected',
          rejectionReason: 'Photos were too blurry and the description was incomplete.',
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
    restaurantOffers: [],
    images: [],
    videoUrl: null,
    isSelfCatering: true,
    hasRestaurant: false,
    isOccupied: false,
    coordinates: null,
    blockedDates: [],
    status: 'rejected',
    rejectionReason: 'Photos were too blurry and the description was incomplete.',
  });

  assert.equal(listing.hostId, 'host-1');
  assert.equal(listing.rejectionReason, null);
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
    status: 'rejected',
    rejectionReason: 'Photos were too blurry and the description was incomplete.',
  });
  assert.equal(savedListing.id, 'listing-2');
  assert.equal(savedListing.status, 'rejected');
  assert.equal(savedListing.rejectionReason, 'Photos were too blurry and the description was incomplete.');
});

test('deleteListing issues a real DELETE request to the listing endpoint', async () => {
  installFetch((url, init) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/host/listings/listing-9`);
    assert.equal(init?.method, 'DELETE');
    return createJsonResponse({ deleted: true });
  });

  await deleteListing('listing-9');

  assert.equal(fetchCalls.length, 1);
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
    paymentReference: 'IDEAL-4100',
    paymentProof: null,
    paymentProofUrl: 'https://cdn.example.com/payment-proof.jpg',
  });
  assert.equal(booking.status, 'payment_submitted');
  assert.equal(booking.paymentReference, 'IDEAL-4100');
  assert.equal(booking.paymentProofUrl, 'https://cdn.example.com/payment-proof.jpg');
});

test('uploadListingMedia uses a signed upload URL instead of proxying the video through Encore', async () => {
  installFetch((url, init) => {
    if (url.endsWith('/host/listings/media/upload-url')) {
      return createJsonResponse({
        objectKey: 'listing-1/demo-video.mp4',
        uploadUrl: 'https://storage.example.com/listing-1/demo-video.mp4?signature=abc',
        publicUrl: 'https://cdn.example.com/listing-1/demo-video.mp4',
      });
    }

    if (url.startsWith('https://storage.example.com/')) {
      return new Response(null, { status: 200 });
    }

    throw new Error(`Unexpected URL: ${url} ${init?.method || 'GET'}`);
  });

  const file = new File([new Uint8Array([1, 2, 3, 4])], 'demo-video.mp4', { type: 'video/mp4' });
  const publicUrl = await uploadListingMedia({
    listingId: 'listing-1',
    file,
  });

  assert.equal(publicUrl, 'https://cdn.example.com/listing-1/demo-video.mp4');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/host/listings/media/upload-url`);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    listingId: 'listing-1',
    filename: 'demo-video.mp4',
    contentType: 'video/mp4',
  });
  assert.equal(fetchCalls[1]?.url, 'https://storage.example.com/listing-1/demo-video.mp4?signature=abc');
  assert.equal(fetchCalls[1]?.init?.method, 'PUT');
  assert.equal(getHeaders(fetchCalls[1]?.init).get('Content-Type'), 'video/mp4');
  assert.equal(fetchCalls[1]?.init?.body, file);
});

test('uploadListingMedia surfaces bucket CORS failures clearly for direct browser uploads', async () => {
  installFetch((url, init) => {
    if (url.endsWith('/host/listings/media/upload-url')) {
      return createJsonResponse({
        objectKey: 'listing-1/demo-video.mp4',
        uploadUrl:
          'https://storage.googleapis.com/example-bucket/listing-1/demo-video.mp4?signature=abc',
        publicUrl: 'https://cdn.example.com/listing-1/demo-video.mp4',
      });
    }

    if (url.startsWith('https://storage.googleapis.com/')) {
      throw new TypeError('Failed to fetch');
    }

    throw new Error(`Unexpected URL: ${url} ${init?.method || 'GET'}`);
  });

  const file = new File([new Uint8Array([1, 2, 3, 4])], 'demo-video.mp4', { type: 'video/mp4' });

  await assert.rejects(
    () =>
      uploadListingMedia({
        listingId: 'listing-1',
        file,
      }),
    /missing browser CORS/i,
  );
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

test('deleteAdminUser issues a real DELETE request to the admin user endpoint', async () => {
  installFetch((url, init) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/admin/users/user-77`);
    assert.equal(init?.method, 'DELETE');
    return createJsonResponse({ deleted: true });
  });

  await deleteAdminUser('user-77');

  assert.equal(fetchCalls.length, 1);
});

test('setAdminUserAccountStatus posts structured suspension changes to the admin endpoint', async () => {
  installFetch((url, init) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/admin/users/account-status`);
    assert.equal(init?.method, 'POST');
    return createJsonResponse({
      user: createEncoreUser({
        id: 'user-77',
        accountStatus: 'suspended',
        accountStatusReason: 'Chargeback investigation still open.',
        accountStatusChangedAt: '2026-04-06T11:00:00.000Z',
        accountStatusChangedBy: 'admin-1',
      }),
      notification: {
        id: 'notif-77',
        title: 'Account suspended',
        message: 'Your account has been suspended. Chargeback investigation still open.',
        type: 'warning',
        target: 'user-77',
        actionPath: '/account',
        createdAt: '2026-04-06T11:00:00.000Z',
      },
    });
  });

  const response = await setAdminUserAccountStatus({
    userId: 'user-77',
    accountStatus: 'suspended',
    reason: 'Chargeback investigation still open.',
  });

  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    userId: 'user-77',
    accountStatus: 'suspended',
    reason: 'Chargeback investigation still open.',
  });
  assert.equal(response.user.accountStatus, 'suspended');
  assert.equal(response.user.accountStatusReason, 'Chargeback investigation still open.');
  assert.equal(response.notification?.title, 'Account suspended');
});

test('dismissNotification issues a real DELETE request to the per-user notification endpoint', async () => {
  installFetch((url, init) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/ops/my-notifications/notif-9`);
    assert.equal(init?.method, 'DELETE');
    return createJsonResponse({ ok: true, dismissedAt: '2026-04-06T10:15:00.000Z' });
  });

  const response = await dismissNotification('notif-9');

  assert.deepEqual(response, { ok: true, dismissedAt: '2026-04-06T10:15:00.000Z' });
  assert.equal(fetchCalls.length, 1);
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
