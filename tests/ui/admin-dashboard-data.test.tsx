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
      http.get('*/api/encore/admin/reviews', () => HttpResponse.json({ reviews: [] })),
      http.get('*/api/encore/admin/referrals', () => HttpResponse.json({ rewards: [] })),
      http.get('*/api/encore/admin/subscriptions', () => HttpResponse.json({ subscriptions: [] })),
      http.get('*/api/encore/admin/checkouts', () => HttpResponse.json({ checkouts: [] })),
      http.get('*/api/encore/admin/billing/host-accounts', () => HttpResponse.json({ accounts: [] })),
      http.get('*/api/encore/ops/admin/notifications', () => HttpResponse.json({ notifications: [] })),
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
      http.get('*/api/encore/ops/kyc/submissions', () => HttpResponse.json({ submissions: [] })),
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
