import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostDashboard from '@/pages/HostDashboard';
import type { Booking, HostBillingAccount, Listing, UserProfile } from '@/types';

const getMyHostBillingAccountMock = vi.fn();

vi.mock('@/lib/billing-client', () => ({
  getMyHostBillingAccount: (...args: unknown[]) => getMyHostBillingAccountMock(...args),
  saveHostBillingCard: vi.fn(),
}));

vi.mock('@/lib/platform-client', () => ({
  updateBookingStatus: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const profile: UserProfile = {
  id: 'host-1',
  displayName: 'Host Example',
  email: 'host@example.com',
  photoUrl: '',
  role: 'host',
  referralCode: 'HOST-1',
  accountStatus: 'active',
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
  hostPlan: 'professional',
  kycStatus: 'verified',
  createdAt: '2026-04-20T08:00:00.000Z',
};

const listing: Listing = {
  id: 'listing-1',
  hostId: 'host-1',
  title: 'Sea Point Stay',
  description: 'Ocean-facing apartment',
  location: 'Cape Town',
  area: 'Sea Point',
  province: 'Western Cape',
  type: 'apartment',
  pricePerNight: 1800,
  discount: 0,
  images: ['https://example.com/listing.jpg'],
  videoUrl: null,
  amenities: ['wifi'],
  facilities: ['parking'],
  otherFacility: '',
  adults: 2,
  children: 0,
  bedrooms: 1,
  bathrooms: 1,
  isSelfCatering: true,
  hasRestaurant: false,
  restaurantOffers: [],
  isOccupied: false,
  rating: 4.8,
  reviews: 12,
  category: 'apartment',
  status: 'active',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

function makeBooking(id: string, inquiryState: Booking['inquiryState']): Booking {
  return {
    id,
    listingId: listing.id,
    guestId: `guest-${id}`,
    hostId: profile.id,
    checkIn: '2026-05-01',
    checkOut: '2026-05-03',
    totalPrice: 3600,
    breakageDeposit: 500,
    guests: {
      adults: 2,
      children: 0,
    },
    inquiryState,
    paymentState: inquiryState === 'APPROVED' ? 'INITIATED' : 'UNPAID',
    createdAt: '2026-04-20T08:00:00.000Z',
    viewedAt: inquiryState === 'VIEWED' || inquiryState === 'RESPONDED' ? '2026-04-20T09:00:00.000Z' : null,
    respondedAt: inquiryState === 'RESPONDED' ? '2026-04-20T10:00:00.000Z' : null,
    paymentUnlockedAt: inquiryState === 'APPROVED' ? '2026-04-20T11:00:00.000Z' : null,
  };
}

describe('HostDashboard', () => {
  beforeEach(() => {
    const billingAccount: HostBillingAccount = {
      userId: profile.id,
      plan: 'professional',
      billingSource: 'paid',
      billingStatus: 'active',
      reminderCount: 0,
      cardOnFile: true,
      cardLabel: 'Visa ending in 4242',
      inReminderWindow: false,
      greylistEligible: false,
      nextAction: 'none',
      currentPeriodStart: '2026-04-01',
      currentPeriodEnd: '2026-05-01',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    };

    getMyHostBillingAccountMock.mockResolvedValue(billingAccount);
  });

  it('shows the full needs-response queue size instead of the preview slice', async () => {
    const bookings = [
      makeBooking('booking-1', 'PENDING'),
      makeBooking('booking-2', 'VIEWED'),
      makeBooking('booking-3', 'RESPONDED'),
      makeBooking('booking-4', 'PENDING'),
      makeBooking('booking-5', 'APPROVED'),
    ];

    render(
      <MemoryRouter>
        <HostDashboard
          profile={profile}
          listings={[listing]}
          bookings={bookings}
          onUpgrade={vi.fn()}
          onChat={vi.fn()}
          onBookingUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getMyHostBillingAccountMock).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Needs Response' })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});
