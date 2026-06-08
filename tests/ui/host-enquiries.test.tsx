import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostEnquiries from '@/pages/HostEnquiries';
import type { Booking, Listing } from '@/types';

const mockUseBookingOpsSummaries = vi.fn();

vi.mock('@/hooks/use-booking-ops-summaries', () => ({
  useBookingOpsSummaries: (...args: unknown[]) => mockUseBookingOpsSummaries(...args),
}));

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

function makeReviewBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-review',
    listingId: listing.id,
    guestId: 'guest-1',
    hostId: listing.hostId,
    checkIn: '2026-05-01',
    checkOut: '2026-05-03',
    totalPrice: 3600,
    breakageDeposit: 500,
    guests: {
      adults: 2,
      children: 0,
    },
    inquiryState: 'APPROVED',
    paymentState: 'INITIATED',
    paymentMethod: 'eft',
    paymentInstructions: 'Use the booking id as reference',
    paymentReference: 'IDEAL-123',
    paymentProofAccessible: true,
    paymentProofAccessUrl: '/signed/payment-proof.jpg?sig=abc',
    viewedAt: '2026-04-20T09:00:00.000Z',
    respondedAt: '2026-04-20T10:00:00.000Z',
    paymentUnlockedAt: '2026-04-20T11:00:00.000Z',
    paymentSubmittedAt: '2026-04-21T08:00:00.000Z',
    paymentConfirmedAt: null,
    expiresAt: '2099-04-21T18:00:00.000Z',
    bookedAt: null,
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  };
}

describe('HostEnquiries', () => {
  beforeEach(() => {
    mockUseBookingOpsSummaries.mockReset();
    mockUseBookingOpsSummaries.mockReturnValue({});
  });

  it('blocks confirmation when the stored private proof asset is not accessible', () => {
    render(
      <MemoryRouter>
        <HostEnquiries
          bookings={[
            makeReviewBooking({
              paymentProofAccessible: false,
              paymentProofAccessUrl: null,
            }),
          ]}
          listings={[listing]}
          onChat={vi.fn()}
          onBookingUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        'Private payment proof is not accessible right now. Confirmation stays blocked until the stored asset can be opened.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeDisabled();
  });

  it('uses private-proof access wording when the asset is accessible', () => {
    render(
      <MemoryRouter>
        <HostEnquiries
          bookings={[makeReviewBooking()]}
          listings={[listing]}
          onChat={vi.fn()}
          onBookingUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Open private proof' })).toHaveAttribute(
      'href',
      '/signed/payment-proof.jpg?sig=abc',
    );
    expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeEnabled();
  });

  it('prefers backend ops summary data when it is available', () => {
    mockUseBookingOpsSummaries.mockReturnValue({
      'booking-review': {
        inquiryId: 'booking-review',
        lastActor: 'admin',
        lastEvent: 'DISPUTE_OPENED',
        lastEventAt: '2026-04-21T09:30:00.000Z',
        activeDeadlineKind: 'GUEST_PAYMENT',
        activeDeadlineAt: '2099-04-22T18:00:00.000Z',
        openDisputeCount: 2,
      },
    });

    render(
      <MemoryRouter>
        <HostEnquiries
          bookings={[makeReviewBooking()]}
          listings={[listing]}
          onChat={vi.fn()}
          onBookingUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Last actor: Admin.')).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.textContent === 'Open payment disputes: 2'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Backend deadline: guest payment due/i)).toBeInTheDocument();
  });

  it('moves stale passed enquiries out of active payment queues and disables held-state actions', () => {
    render(
      <MemoryRouter>
        <HostEnquiries
          bookings={[
            makeReviewBooking({
              id: 'stale-approved-hold',
              paymentSubmittedAt: null,
              paymentProofAccessible: false,
              paymentProofAccessUrl: null,
              expiresAt: '2026-04-21T18:00:00.000Z',
            }),
          ]}
          listings={[listing]}
          onChat={vi.fn()}
          onBookingUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Passed' })).toBeInTheDocument();
    expect(screen.getByText(/This enquiry has passed/i)).toBeInTheDocument();
    expect(screen.getByText(/State deactivated/i)).toBeInTheDocument();
    expect(screen.getByText('No guest payments pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm Payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
