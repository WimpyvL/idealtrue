import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { ListingsSection } from '@/features/admin/dashboard-sections';
import type { Listing, UserProfile } from '@/types';

const managedHost: UserProfile = {
  id: 'host-managed-1',
  displayName: 'Managed Host',
  email: 'managed@example.com',
  photoUrl: '',
  role: 'host',
  referralCode: 'MANAGED1',
  accountStatus: 'active',
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
  hostPlan: 'premium',
  managementMode: 'managed',
  kycStatus: 'verified',
  createdAt: '2026-07-06T10:00:00.000Z',
};

const managedListing: Listing = {
  id: 'listing-managed-1',
  hostId: managedHost.id,
  title: 'Managed Atlantic Villa',
  description: 'Oceanfront managed inventory',
  location: 'Cape Town',
  area: 'Atlantic Seaboard',
  province: 'Western Cape',
  type: 'villa',
  pricePerNight: 6500,
  discount: 0,
  images: ['https://example.com/listing.jpg'],
  videoUrl: null,
  amenities: ['wifi'],
  facilities: ['pool'],
  otherFacility: '',
  adults: 8,
  children: 4,
  bedrooms: 4,
  bathrooms: 3,
  isSelfCatering: true,
  hasRestaurant: false,
  restaurantOffers: [],
  isOccupied: false,
  rating: 0,
  reviews: 0,
  category: 'luxury',
  status: 'pending',
  createdAt: '2026-07-06T10:00:00.000Z',
  settlementProfile: {
    listingId: 'listing-managed-1',
    paymentMethod: 'EFT',
    paymentInstructions: 'Use property-specific reference',
    paymentReferencePrefix: 'ATL',
    updatedAt: '2026-07-06T10:05:00.000Z',
  },
};

describe('ListingsSection managed hosting visibility', () => {
  it('marks managed inventory clearly in the admin listings table', () => {
    render(
      <ListingsSection
        allListings={[managedListing]}
        allUsers={[managedHost]}
        handleUpdateListingStatus={vi.fn()}
        setConfirmDelete={vi.fn()}
        setEditingListing={vi.fn()}
      />,
    );

    expect(screen.getByText('Managed Atlantic Villa')).toBeInTheDocument();
    expect(screen.getByText('managed listing')).toBeInTheDocument();
    expect(screen.getByText('managed host')).toBeInTheDocument();
    expect(screen.getByText('settlement ready')).toBeInTheDocument();
  });
});
