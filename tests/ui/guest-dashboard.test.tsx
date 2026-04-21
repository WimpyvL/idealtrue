import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import GuestDashboard from '@/pages/GuestDashboard';
import type { Booking, Listing, UserProfile } from '@/types';

const profile: UserProfile = {
  id: 'guest-1',
  displayName: 'Guest Example',
  email: 'guest@example.com',
  photoUrl: '',
  role: 'guest',
  referralCode: 'GUEST-1',
  accountStatus: 'active',
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
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

function makeBooking(id: string, overrides: Partial<Booking> = {}): Booking {
  return {
    id,
    listingId: listing.id,
    guestId: profile.id,
    hostId: listing.hostId,
    checkIn: '2026-05-01',
    checkOut: '2026-05-03',
    totalPrice: 3600,
    breakageDeposit: 500,
    guests: {
      adults: 2,
      children: 1,
    },
    inquiryState: 'APPROVED',
    paymentState: 'INITIATED',
    paymentMethod: 'eft',
    paymentInstructions: 'Use your booking id as reference',
    paymentReference: null,
    paymentProofUrl: null,
    viewedAt: '2026-04-20T09:00:00.000Z',
    respondedAt: '2026-04-20T10:00:00.000Z',
    paymentUnlockedAt: '2026-04-20T11:00:00.000Z',
    paymentSubmittedAt: null,
    paymentConfirmedAt: null,
    expiresAt: '2026-04-22T10:00:00.000Z',
    bookedAt: null,
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T11:00:00.000Z',
    ...overrides,
  };
}

describe('GuestDashboard', () => {
  it('shows stay value, deposit, and full guest exposure on the stay card', () => {
    render(
      <MemoryRouter>
        <GuestDashboard
          profile={profile}
          bookings={[makeBooking('booking-1')]}
          listings={[listing]}
          onReview={vi.fn()}
          onExplore={vi.fn()}
          onChat={vi.fn()}
          onSubmitPaymentProof={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Stay value')).toBeInTheDocument();
    expect(screen.getByText('Breakage deposit')).toBeInTheDocument();
    expect(screen.getByText('Full guest exposure')).toBeInTheDocument();
    expect(screen.getByText('R3,600')).toBeInTheDocument();
    expect(screen.getByText('R500')).toBeInTheDocument();
    expect(screen.getByText('R4,100')).toBeInTheDocument();
    expect(screen.getByText('Payment state')).toBeInTheDocument();
    expect(screen.getByText('Payment unlocked. Submit payment proof before the approval window closes.')).toBeInTheDocument();
  });

  it('shows under-review payment copy with the payment reference on the card itself', () => {
    render(
      <MemoryRouter>
        <GuestDashboard
          profile={profile}
          bookings={[
            makeBooking('booking-review', {
              paymentSubmittedAt: '2026-04-21T08:00:00.000Z',
              paymentReference: 'IDEAL-123',
            }),
          ]}
          listings={[listing]}
          onReview={vi.fn()}
          onExplore={vi.fn()}
          onChat={vi.fn()}
          onSubmitPaymentProof={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Payment proof submitted. Host confirmation is still pending.')).toBeInTheDocument();
    expect(screen.getByText('Payment reference:')).toBeInTheDocument();
    expect(screen.getByText('IDEAL-123')).toBeInTheDocument();
    expect(screen.getByText(/Host confirmation must land/)).toBeInTheDocument();
  });
});
