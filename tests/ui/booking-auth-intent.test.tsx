import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import SignupPage from '@/pages/SignupPage';
import type { Listing, UserProfile } from '@/types';

class TestIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class TestResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const guestProfile: UserProfile = {
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
  adults: 4,
  children: 2,
  bedrooms: 2,
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

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    signIn: mockSignIn,
    signUp: mockSignUp,
  }),
}));

vi.mock('@/hooks/use-platform-data', () => ({
  usePlatformData: () => ({
    listings: [listing],
    myListings: [],
    myBookings: [],
    hostBookings: [],
    referrals: [],
    syncUpdatedBooking: vi.fn(),
    syncUpdatedListing: vi.fn(),
    removeListing: vi.fn(),
  }),
}));

vi.mock('@/lib/platform-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/platform-client')>('@/lib/platform-client');
  return {
    ...actual,
    createBooking: vi.fn(),
    listListingReviews: vi.fn().mockResolvedValue([]),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('booking auth intent', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: TestIntersectionObserver,
    });
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: TestResizeObserver,
    });
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue(guestProfile);
    mockSignUp.mockResolvedValue(guestProfile);
  });

  it('carries unauthenticated Book CTA listing and date intent through the signup URL', async () => {
    render(
      <MemoryRouter initialEntries={['/?listingId=listing-1&checkIn=2026-05-02&checkOut=2026-05-04&adults=2&children=1']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Sea Point Stay' });
    await userEvent.click(screen.getByRole('button', { name: /request to book/i }));

    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? '';
      expect(location).toContain('/signup?');
      expect(location).toContain('intent=booking');
      expect(location).toContain('returnTo=');
      expect(decodeURIComponent(location)).toContain('/?listingId=listing-1');
      expect(decodeURIComponent(location)).toContain('checkIn=2026-05-02');
      expect(decodeURIComponent(location)).toContain('checkOut=2026-05-04');
      expect(decodeURIComponent(location)).toContain('adults=2');
      expect(decodeURIComponent(location)).toContain('children=1');
    });
  });

  it('returns guests to the preserved booking path after sign in', async () => {
    render(
      <MemoryRouter initialEntries={['/signup?mode=signin&intent=booking&returnTo=%2F%3FlistingId%3Dlisting-1%26checkIn%3D2026-05-02%26checkOut%3D2026-05-04%26adults%3D2%26children%3D1']}>
        <SignupPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'guest@example.com');
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'safe-password');
    await userEvent.click(screen.getAllByRole('button', { name: /^sign in$/i }).at(-1)!);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'guest@example.com',
        password: 'safe-password',
      });
      expect(screen.getByTestId('location')).toHaveTextContent('/?listingId=listing-1&checkIn=2026-05-02&checkOut=2026-05-04&adults=2&children=1');
    });
  });
});
