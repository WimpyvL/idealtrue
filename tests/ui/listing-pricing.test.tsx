import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import PropertyCard from '@/components/PropertyCard';
import type { Listing } from '@/types';

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

class MockIntersectionObserver {
  observe() {}
  disconnect() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

const discountedListing: Listing = {
  id: 'listing-discounted',
  hostId: 'host-1',
  title: 'Discounted Sea Stay',
  description: 'Ocean-facing apartment',
  location: 'Cape Town',
  area: 'Sea Point',
  province: 'Western Cape',
  type: 'Apartment',
  pricePerNight: 1800,
  discount: 10,
  breakageDeposit: 500,
  images: ['https://cdn.example.com/listing.jpg'],
  videoUrl: null,
  amenities: ['wifi'],
  facilities: ['parking'],
  otherFacility: '',
  adults: 2,
  children: 1,
  bedrooms: 1,
  bathrooms: 1,
  isSelfCatering: true,
  hasRestaurant: false,
  restaurantOffers: [],
  isOccupied: false,
  rating: 0,
  reviews: 0,
  category: 'apartment',
  status: 'active',
  createdAt: '2026-04-01T10:00:00.000Z',
};

describe('listing pricing UI', () => {
  it('shows the discounted nightly rate on marketplace listing cards', () => {
    render(<PropertyCard listing={discountedListing} onClick={vi.fn()} />);

    expect(screen.getByText('R1,620')).toBeInTheDocument();
    expect(screen.getByText('R1,800')).toHaveClass('line-through');
    expect(screen.getByText('Save 10%')).toBeInTheDocument();
  });
});
