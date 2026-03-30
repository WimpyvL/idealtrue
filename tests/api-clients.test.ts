import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ENCORE_API_URL,
  clearEncoreSession,
  encoreRequest,
  getEncoreApiUrl,
  getEncoreSessionToken,
  setEncoreSessionToken,
} from '../src/lib/encore-client.ts';
import { getEncoreSessionProfile } from '../src/lib/identity-client.ts';
import { getAdminPlatformSettings, listAdminNotifications } from '../src/lib/admin-client.ts';
import { reviewKycSubmission } from '../src/lib/ops-client.ts';
import { submitPaymentProof, updateBookingStatus } from '../src/lib/platform-client.ts';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

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

let storage: MemoryStorage;
let fetchCalls: FetchCall[];

function installWindow() {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
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

test.afterEach(() => {
  clearEncoreSession();
  Reflect.deleteProperty(globalThis, 'window');
});

test('uses the local Encore API URL by default', () => {
  assert.equal(getEncoreApiUrl(), DEFAULT_ENCORE_API_URL);
  assert.equal(DEFAULT_ENCORE_API_URL, 'http://127.0.0.1:4000');
});

test('encoreRequest sends authenticated requests with the local default base URL', async () => {
  setEncoreSessionToken('session-token');
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

  const headers = getHeaders(fetchCalls[0]?.init);
  assert.equal(headers.get('Authorization'), 'Bearer session-token');
  assert.equal(headers.get('Content-Type'), 'application/json');
});

test('encoreRequest rejects authenticated calls when the session token is missing', async () => {
  await assert.rejects(
    encoreRequest('/secure/resource', {}, { auth: true }),
    /Missing Encore session token\./,
  );
});

test('getEncoreSessionProfile refreshes the token and maps the Encore user profile', async () => {
  setEncoreSessionToken('stale-token');
  installFetch(() =>
    createJsonResponse({
      token: 'fresh-token',
      user: createEncoreUser({ role: 'host', hostPlan: 'professional' }),
    }),
  );

  const profile = await getEncoreSessionProfile();

  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/auth/session`);
  assert.equal(getHeaders(fetchCalls[0]?.init).get('Authorization'), 'Bearer stale-token');
  assert.equal(getEncoreSessionToken(), 'fresh-token');
  assert.equal(profile.uid, 'user-1');
  assert.equal(profile.role, 'host');
  assert.equal(profile.host_plan, 'professional');
  assert.equal(profile.kycStatus, 'verified');
  assert.equal(profile.paymentMethod, 'bank_transfer');
});

test('updateBookingStatus sends the booking status patch to the correct endpoint', async () => {
  setEncoreSessionToken('host-token');
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
  setEncoreSessionToken('guest-token');
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
  });
  assert.equal(booking.status, 'payment_submitted');
  assert.equal(booking.paymentReference, 'IDEAL-4100');
  assert.equal(booking.paymentProofUrl, 'https://cdn.example.com/payment-proof.jpg');
});

test('admin notification and settings helpers hit the ops endpoints with auth', async () => {
  setEncoreSessionToken('admin-token');
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
  assert.equal(getHeaders(fetchCalls[0]?.init).get('Authorization'), 'Bearer admin-token');
  assert.equal(getHeaders(fetchCalls[1]?.init).get('Authorization'), 'Bearer admin-token');
  assert.equal(notifications[0]?.type, 'warning');
  assert.equal(settings.platformName, 'Ideal Stay');
});

test('reviewKycSubmission posts structured review decisions instead of prompt text hacks', async () => {
  setEncoreSessionToken('admin-token');
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
}
);
