import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import CreateListing from '@/pages/CreateListing';

const getListingMock = vi.fn();
const getMyListingQuotaMock = vi.fn();
const saveListingMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'host-1', email: 'host@example.com', displayName: 'Host Example', photoUrl: '' },
    profile: { id: 'host-1', email: 'host@example.com', displayName: 'Host Example', photoUrl: '', role: 'host', hostPlan: 'professional', kycStatus: 'verified' },
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-effective-kyc-status', () => ({
  useEffectiveKycStatus: () => ({
    effectiveKycStatus: 'verified',
  }),
}));

vi.mock('@/lib/geocoding', () => ({
  geocodeAddress: vi.fn(async () => null),
}));

vi.mock('@/lib/platform-client', () => ({
  getListing: (...args: unknown[]) => getListingMock(...args),
  getMyListingQuota: (...args: unknown[]) => getMyListingQuotaMock(...args),
  saveListing: (...args: unknown[]) => saveListingMock(...args),
}));

vi.mock('@/components/ui/image-upload', () => ({
  default: ({ maxFiles }: { maxFiles?: number }) => <div data-testid="image-upload">{maxFiles}</div>,
}));

vi.mock('@/components/ui/video-upload', () => ({
  DEFAULT_VIDEO_UPLOAD_MAX_MB: 250,
  default: () => <div data-testid="video-upload" />,
}));

vi.mock('@/components/KYCModal', () => ({
  default: () => null,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: () => null,
}));

vi.mock('leaflet', () => {
  const marker = { prototype: { options: {} } };
  return {
    default: { icon: () => ({}), Marker: marker },
    icon: () => ({}),
    Marker: marker,
  };
});

describe('CreateListing', () => {
  beforeEach(() => {
    getMyListingQuotaMock.mockResolvedValue({
      plan: 'professional',
      maxListings: null,
      usedListings: 1,
      canCreate: true,
    });
    getListingMock.mockResolvedValue({
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
      discount: 10,
      adults: 2,
      children: 1,
      bedrooms: 1,
      bathrooms: 1,
      amenities: ['wifi'],
      facilities: ['parking'],
      restaurantOffers: ['breakfast'],
      images: [],
      videoUrl: null,
      isSelfCatering: true,
      hasRestaurant: true,
      isOccupied: false,
      coordinates: { lat: -33.9, lng: 18.4 },
      blockedDates: [],
      status: 'active',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    });
    saveListingMock.mockResolvedValue({ id: 'listing-1' });
  });

  it('loads an existing listing from the canonical contract and updates local form state', async () => {
    render(
      <MemoryRouter initialEntries={['/host/edit-listing/listing-1']}>
        <Routes>
          <Route path="/host/edit-listing/:id" element={<CreateListing />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(getListingMock).toHaveBeenCalledWith('listing-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const propertyName = await screen.findByDisplayValue('Sea Point Stay');
    expect(propertyName).toBeInTheDocument();

    fireEvent.change(propertyName, { target: { value: 'Sea Point Penthouse' } });
    expect(screen.getByDisplayValue('Sea Point Penthouse')).toBeInTheDocument();
  });

  it('gives standard hosts 10 photo slots and removes the showcase video uploader', async () => {
    getMyListingQuotaMock.mockResolvedValue({
      plan: 'standard',
      maxListings: 1,
      usedListings: 0,
      canCreate: true,
    });

    render(
      <MemoryRouter initialEntries={['/host/create-listing']}>
        <Routes>
          <Route path="/host/create-listing" element={<CreateListing />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Next' });
    fireEvent.click(screen.getByRole('button', { name: 'Hotels & Resorts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hotels' }));

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }

    expect(await screen.findByText(/standard hosts get 10 images and no video; professional and premium hosts get 20 images and 1 video\./i)).toBeInTheDocument();
    expect(screen.getByTestId('image-upload')).toHaveTextContent('10');
    expect(screen.queryByTestId('video-upload')).not.toBeInTheDocument();
  });
});
