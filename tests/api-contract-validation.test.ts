import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_ENCORE_API_URL, clearEncoreSession } from '../src/lib/encore-client.ts';
import { listAdminCheckouts } from '../src/lib/admin-client.ts';
import { getEncoreSessionProfile } from '../src/lib/identity-client.ts';
import { getListing, updateBookingStatus } from '../src/lib/platform-client.ts';

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

function installFetch(handler: FetchHandler) {
  Object.defineProperty(globalThis, 'fetch', {
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return handler(url, init);
    },
    configurable: true,
    writable: true,
  });
}

function validEncoreUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'host@example.com',
    emailVerified: true,
    displayName: 'Host Example',
    photoUrl: '',
    role: 'host',
    isAdmin: false,
    hostPlan: 'professional',
    managementMode: 'self_service',
    kycStatus: 'verified',
    accountStatus: 'active',
    accountStatusReason: null,
    accountStatusChangedAt: null,
    accountStatusChangedBy: null,
    balance: 0,
    referralCount: 0,
    tier: 'bronze',
    referralCode: 'HOST-1',
    referredByCode: null,
    paymentMethod: 'EFT',
    paymentInstructions: 'Use the booking ID as reference.',
    paymentReferencePrefix: 'IDEAL',
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T08:00:00.000Z',
    ...overrides,
  };
}

function validEncoreListing(overrides: Record<string, unknown> = {}) {
  return {
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
    manualBlockedDates: [],
    availabilityBlocks: [],
    settlementProfile: null,
    status: 'active',
    rejectionReason: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

function validEncoreBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    listingId: 'listing-1',
    guestId: 'guest-1',
    hostId: 'host-1',
    checkIn: '2026-04-10',
    checkOut: '2026-04-12',
    adults: 2,
    children: 1,
    totalPrice: 3200,
    inquiryState: 'APPROVED',
    paymentState: 'INITIATED',
    paymentMethod: 'bank_transfer',
    paymentInstructions: 'Pay within 24 hours.',
    createdAt: '2026-03-30T09:00:00.000Z',
    updatedAt: '2026-03-30T09:05:00.000Z',
    ...overrides,
  };
}

test.beforeEach(() => {
  installWindow();
});

test.afterEach(async () => {
  await clearEncoreSession();
  Reflect.deleteProperty(globalThis, 'window');
});

test('identity client rejects malformed session user contracts before mapping profile state', async () => {
  installFetch((url) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/auth/session`);
    return createJsonResponse({
      user: validEncoreUser({ role: 'owner' }),
    });
  });

  await assert.rejects(() => getEncoreSessionProfile(), /Identity user response was invalid/i);
});

test('listing client rejects malformed listing contracts before rendering marketplace state', async () => {
  installFetch((url) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/listings/listing-1`);
    return createJsonResponse({
      listing: validEncoreListing({ pricePerNight: '1800' }),
    });
  });

  await assert.rejects(() => getListing('listing-1'), /Listing response was invalid/i);
});

test('booking client rejects malformed workflow contracts before mutating enquiry state', async () => {
  installFetch((url) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/bookings/booking-1/status`);
    return createJsonResponse({
      booking: validEncoreBooking({ inquiryState: 'PAID_BUT_NOT_REALLY' }),
    });
  });

  await assert.rejects(() => updateBookingStatus('booking-1', 'APPROVED'), /Booking response was invalid/i);
});

test('admin checkout client rejects malformed purchase feed contracts before computing financials', async () => {
  installFetch((url) => {
    assert.equal(url, `${DEFAULT_ENCORE_API_URL}/admin/checkouts`);
    return createJsonResponse({
      checkouts: [
        {
          id: 'payment-1',
          user_id: 'host-1',
          checkout_type: 'managed_hosting',
          provider: 'yoco',
          status: 'settled-but-not-a-real-status',
          currency: 'ZAR',
          amount: 65000,
          host_plan: 'premium',
          billing_interval: null,
          credit_quantity: null,
          provider_checkout_id: 'checkout-1',
          provider_payment_id: 'provider-payment-1',
          created_at: '2026-06-08T08:00:00.000Z',
          updated_at: '2026-06-08T08:00:00.000Z',
        },
      ],
    });
  });

  await assert.rejects(() => listAdminCheckouts(), /Admin checkout response was invalid/i);
});
