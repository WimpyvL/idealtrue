import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { useAdminDashboardData } from '@/features/admin/use-admin-dashboard-data';
import { server } from './msw/server';

describe('useAdminDashboardData', () => {
  it('loads admin data and refreshes derived listing stats after a moderation update', async () => {
    const notify = vi.fn();

    server.use(
      http.get('*/api/encore/admin/users', () =>
        HttpResponse.json({
          users: [
            {
              id: 'user-1',
              email: 'host@example.com',
              emailVerified: true,
              displayName: 'Host One',
              photoUrl: '',
              role: 'host',
              hostPlan: 'professional',
              kycStatus: 'verified',
              balance: 0,
              referralCount: 0,
              tier: 'bronze',
              referralCode: 'HOST1',
              referredByCode: null,
              paymentMethod: null,
              paymentInstructions: null,
              paymentReferencePrefix: null,
              createdAt: '2026-04-01T10:00:00.000Z',
              updatedAt: '2026-04-01T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/listings', () =>
        HttpResponse.json({
          listings: [
            {
              id: 'listing-1',
              hostId: 'user-1',
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
            },
            {
              id: 'listing-2',
              hostId: 'user-1',
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
              createdAt: '2026-04-01T10:00:00.000Z',
              updatedAt: '2026-04-01T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/admin/bookings', () => HttpResponse.json({ bookings: [] })),
      http.get('*/api/encore/admin/reviews', () =>
        HttpResponse.json({
          reviews: [
            {
              id: 'review-1',
              listingId: 'listing-1',
              guestId: 'guest-1',
              hostId: 'user-1',
              cleanliness: 5,
              accuracy: 5,
              communication: 5,
              location: 5,
              value: 5,
              comment: 'Good stay',
              status: 'pending',
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/admin/referrals', () =>
        HttpResponse.json({
          rewards: [
            {
              id: 'referral-1',
              referrerId: 'user-1',
              referredUserId: 'guest-1',
              trigger: 'subscription',
              program: 'host',
              amount: 50,
              status: 'paid',
              createdAt: '2026-04-03T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/admin/subscriptions', () =>
        HttpResponse.json({
          subscriptions: [
            {
              id: 'subscription-1',
              user_id: 'user-1',
              plan: 'professional',
              status: 'active',
              amount: 350,
              billing_interval: 'monthly',
              starts_at: '2026-04-01T10:00:00.000Z',
              ends_at: '2026-05-01T10:00:00.000Z',
              created_at: '2026-04-01T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/admin/checkouts', () =>
        HttpResponse.json({
          checkouts: [
            {
              id: 'checkout-1',
              user_id: 'user-1',
              checkout_type: 'managed_hosting',
              provider: 'yoco',
              status: 'paid',
              currency: 'ZAR',
              amount: 650,
              host_plan: null,
              billing_interval: null,
              credit_quantity: null,
              provider_checkout_id: 'provider-checkout-1',
              provider_payment_id: 'provider-payment-1',
              created_at: '2026-04-04T10:00:00.000Z',
              updated_at: '2026-04-04T10:01:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/admin/billing/host-accounts', () =>
        HttpResponse.json({
          accounts: [
            {
              userId: 'user-1',
              plan: 'professional',
              billingSource: 'paid',
              billingStatus: 'active',
              currentPeriodStart: '2026-04-01T10:00:00.000Z',
              currentPeriodEnd: '2026-05-01T10:00:00.000Z',
              nextAction: 'none',
              reminderCount: 0,
              cardOnFile: true,
              createdAt: '2026-04-01T10:00:00.000Z',
              updatedAt: '2026-04-01T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/ops/admin/notifications', () =>
        HttpResponse.json({
          notifications: [
            {
              id: 'notification-1',
              title: 'Admin notice',
              message: 'Check billing',
              type: 'info',
              target: 'admins',
              actionPath: '/admin',
              readAt: null,
              createdAt: '2026-04-05T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.get('*/api/encore/ops/admin/settings', () =>
        HttpResponse.json({
          settings: {
            featuredListingLimit: 6,
            maxGuestReferralReward: 500,
            maxHostReferralReward: 1500,
            supportEmail: 'support@example.com',
            supportPhone: '+27 21 000 0000',
            maintenanceMode: false,
            allowNewHostApplications: true,
          },
        }),
      ),
      http.get('*/api/encore/ops/kyc/submissions', () =>
        HttpResponse.json({
          submissions: [
            {
              userId: 'user-1',
              status: 'pending',
              idType: 'sa_id',
              idNumberMasked: '******1234',
              idImageUrl: null,
              selfieImageUrl: null,
              rejectionReason: null,
              reviewerId: null,
              reviewedAt: null,
              submittedAt: '2026-04-06T10:00:00.000Z',
              createdAt: '2026-04-06T10:00:00.000Z',
              updatedAt: '2026-04-06T10:00:00.000Z',
              user: {
                id: 'user-1',
                email: 'host@example.com',
                displayName: 'Host One',
                photoUrl: '',
              },
            },
          ],
        }),
      ),
      http.get('*/api/encore/ops/admin/observability', () => HttpResponse.json({ snapshot: null })),
      http.put('*/api/encore/host/listings', async ({ request }) => {
        const body = await request.json() as { id: string; status: string };

        return HttpResponse.json({
          listing: {
            id: body.id,
            hostId: 'user-1',
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
            status: body.status,
            createdAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-01T10:10:00.000Z',
          },
        });
      }),
    );

    const { result } = renderHook(() =>
      useAdminDashboardData({
        notify,
        profileId: 'admin-1',
        profileRole: 'admin',
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allReviews).toHaveLength(1);
    expect(result.current.allReferrals).toHaveLength(1);
    expect(result.current.allSubscriptions).toHaveLength(1);
    expect(result.current.allCheckouts).toHaveLength(1);
    expect(result.current.allHostBillingAccounts).toHaveLength(1);
    expect(result.current.allNotifications).toHaveLength(1);
    expect(result.current.kycSubmissions).toHaveLength(1);
    expect(result.current.pendingKycCount).toBe(1);
    expect(result.current.platformSettings?.supportEmail).toBe('support@example.com');
    expect(result.current.stats.pendingReviews).toBe(1);
    expect(result.current.stats.activeListings).toBe(1);
    expect(result.current.topListings).toHaveLength(1);

    await act(async () => {
      await result.current.handleUpdateListingStatus('listing-2', 'active');
    });

    await waitFor(() => expect(result.current.stats.activeListings).toBe(2));
    expect(result.current.topListings).toHaveLength(2);
    expect(notify).toHaveBeenCalledWith({
      title: 'Status Updated',
      description: 'Listing status updated to active.',
    });
  });
});
