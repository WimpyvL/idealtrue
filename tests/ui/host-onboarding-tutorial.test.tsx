import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostOnboardingTutorial from '@/pages/HostOnboardingTutorial';
import type { HostQuickReplySettings, Listing, UserProfile } from '@/types';

const mockGetMyHostQuickReplies = vi.fn<() => Promise<HostQuickReplySettings>>();

vi.mock('@/lib/messaging-client', () => ({
  getMyHostQuickReplies: () => mockGetMyHostQuickReplies(),
}));

const baseProfile: UserProfile = {
  id: 'host-1',
  displayName: 'Host Example',
  email: 'host@example.com',
  emailVerified: true,
  photoUrl: '',
  role: 'host',
  referralCode: 'HOST-1',
  accountStatus: 'active',
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
  hostPlan: 'professional',
  managementMode: 'self_service',
  kycStatus: 'verified',
  paymentMethod: 'EFT',
  paymentInstructions: 'Use the booking ID as reference.',
  paymentReferencePrefix: 'IDEAL',
  createdAt: '2026-04-20T08:00:00.000Z',
};

const baseListing: Listing = {
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
  blockedDates: ['2026-07-01'],
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  settlementProfile: {
    listingId: 'listing-1',
    paymentMethod: 'Managed EFT',
    paymentInstructions: 'Use the listing settlement reference.',
    paymentReferencePrefix: 'SEA',
    updatedAt: '2026-04-02T10:00:00.000Z',
  },
};

function renderTutorial(profile: UserProfile = baseProfile, listings: Listing[] = [baseListing]) {
  return render(
    <MemoryRouter>
      <HostOnboardingTutorial profile={profile} listings={listings} />
    </MemoryRouter>,
  );
}

describe('HostOnboardingTutorial', () => {
  beforeEach(() => {
    mockGetMyHostQuickReplies.mockResolvedValue({
      checkin: 'Check-in is from 14:00.',
      checkout: 'Checkout is by 10:00.',
      paymentInfo: 'Use your booking reference.',
      directions: 'Follow the pin.',
      houseRules: 'No parties.',
    });
  });

  it('explains the required host setup actions and links standard hosts to account payment instructions', async () => {
    renderTutorial();

    expect(screen.getByRole('heading', { name: /get your hosting workspace ready/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add your banking details' })).toBeInTheDocument();
    expect(screen.getByText(/Accommodation payments are handled directly by you/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /add payment instructions/i })[0]).toHaveAttribute('href', '/account');
    expect(await screen.findByText('Account payment instructions ready')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configure quick replies' })).toBeInTheDocument();
    expect(screen.getByText(/house rules, directions, payment info, check-in, and checkout/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit quick replies/i })).toHaveAttribute('href', '/host/quick-replies');
    expect(screen.getByText('Signed: (|/) Klaasvaakie')).toBeInTheDocument();
  });

  it('branches managed hosts away from loose account banking and checks listing settlement setup', async () => {
    renderTutorial({ ...baseProfile, managementMode: 'managed', paymentMethod: null, paymentInstructions: null }, [baseListing]);

    expect(screen.getByRole('heading', { name: 'Confirm listing payment setup' })).toBeInTheDocument();
    expect(screen.getByText(/not in the loose account banking field/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add your banking details' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /review listing payments/i })[0]).toHaveAttribute('href', '/host/listings');
    expect(await screen.findByText('Listing-scoped payment setup ready')).toBeInTheDocument();
  });

  it('shows real missing state for managed listings without settlement profiles', async () => {
    renderTutorial(
      { ...baseProfile, managementMode: 'managed', paymentMethod: null, paymentInstructions: null },
      [{ ...baseListing, settlementProfile: null }],
    );

    expect(await screen.findByText('0/1 listings payment-ready')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /review listing payments/i })[0]).toHaveAttribute('href', '/host/listings');
  });
});
