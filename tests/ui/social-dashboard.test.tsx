import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SocialDashboard from '@/pages/SocialDashboard';
import type { Listing } from '@/types';

const mockedHostProfile = vi.hoisted(() => ({
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
}));

const createContentCreditsCheckoutMock = vi.fn();
const generateContentDraftMock = vi.fn();
const getCheckoutStatusMock = vi.fn();
const getContentEntitlementsMock = vi.fn();
const listContentDraftsMock = vi.fn();
const updateContentDraftMock = vi.fn();
const generateListingSocialCreativeMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: mockedHostProfile,
  }),
}));

vi.mock('@/lib/billing-client', () => ({
  createContentCreditsCheckout: (...args: unknown[]) => createContentCreditsCheckoutMock(...args),
  generateContentDraft: (...args: unknown[]) => generateContentDraftMock(...args),
  getCheckoutStatus: (...args: unknown[]) => getCheckoutStatusMock(...args),
  getContentEntitlements: (...args: unknown[]) => getContentEntitlementsMock(...args),
  listContentDrafts: (...args: unknown[]) => listContentDraftsMock(...args),
  updateContentDraft: (...args: unknown[]) => updateContentDraftMock(...args),
}));

vi.mock('@/lib/ai-client', () => ({
  generateListingSocialCreative: (...args: unknown[]) => generateListingSocialCreativeMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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
  discount: 10,
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
  rating: 4.8,
  reviews: 12,
  category: 'apartment',
  status: 'active',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

const generatedDraft = {
  id: 'draft-1',
  userId: 'host-1',
  listingId: listing.id,
  listingTitle: listing.title,
  listingLocation: listing.location,
  platform: 'instagram' as const,
  tone: 'professional' as const,
  templateId: 'featured_stay' as const,
  templateName: 'Featured Stay',
  status: 'draft' as const,
  content: 'Book a long weekend at Sea Point Stay.',
  scheduledFor: null,
  publishedAt: null,
  createdAt: '2026-04-26T08:00:00.000Z',
  updatedAt: '2026-04-26T08:00:00.000Z',
};

describe('SocialDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContentEntitlementsMock.mockResolvedValue({
      plan: 'professional',
      contentStudioEnabled: true,
      includedDraftsPerMonth: 60,
      usedDraftsThisMonth: 3,
      remainingIncludedDrafts: 57,
      creditBalance: 2,
      canSchedule: true,
    });
    listContentDraftsMock.mockResolvedValue([]);
    generateContentDraftMock.mockResolvedValue({
      draft: generatedDraft,
      entitlements: {
        plan: 'professional',
        contentStudioEnabled: true,
        includedDraftsPerMonth: 60,
        usedDraftsThisMonth: 4,
        remainingIncludedDrafts: 56,
        creditBalance: 2,
        canSchedule: true,
      },
    });
    generateListingSocialCreativeMock.mockResolvedValue({
      templateId: 'featured_stay',
      templateName: 'Featured Stay',
      headline: 'Stay at Sea Point Stay',
      caption: 'Book now',
      bookingUrl: 'https://ideal-stay.test/?listingId=listing-1',
      mimeType: 'image/svg+xml',
      dataBase64: 'PHN2Zy8+',
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
      assets: [
        {
          id: 'featured-stay',
          label: 'Featured Stay',
          width: 1080,
          height: 1350,
          mimeType: 'image/svg+xml',
          fileName: 'ideal-stay-featured.svg',
          dataBase64: 'PHN2Zy8+',
          dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
        },
      ],
    });
    updateContentDraftMock.mockImplementation(async (params) => ({
      ...generatedDraft,
      ...params,
      status: params.status,
      scheduledFor: params.scheduledFor,
      updatedAt: '2026-04-26T08:30:00.000Z',
    }));
  });

  it('generates a draft and schedules the edited content', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <SocialDashboard listings={[listing]} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getContentEntitlementsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /generate post set/i }));

    await waitFor(() => expect(generateContentDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: listing.id }),
      'instagram',
      'professional',
      'featured_stay',
      {
        includePrice: true,
        includeSpecialOffer: false,
        customHeadline: '',
      },
    ));

    expect(generateListingSocialCreativeMock).toHaveBeenCalledWith({
      listingId: listing.id,
      sourceImageUrl: listing.images[0],
      platform: 'instagram',
      tone: 'professional',
      templateId: 'featured_stay',
      includePrice: true,
      includeSpecialOffer: false,
      customHeadline: '',
    });

    const editor = await screen.findByDisplayValue(generatedDraft.content);
    await user.clear(editor);
    await user.type(editor, 'Edited scheduled caption for the weekend.');

    const scheduleInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await user.type(scheduleInput, '2026-05-01T09:30');
    await user.click(screen.getByRole('button', { name: /schedule/i }));

    await waitFor(() => expect(updateContentDraftMock).toHaveBeenCalledWith({
      draftId: generatedDraft.id,
      content: 'Edited scheduled caption for the weekend.',
      status: 'scheduled',
      scheduledFor: expect.stringMatching(/^2026-05-01T/),
    }));
  });

  it('keeps the content tools and wallet inside the studio tools dropdown', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SocialDashboard listings={[listing]} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getContentEntitlementsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /studio tools/i }));

    expect(screen.getByRole('button', { name: /create post/i })).toBeInTheDocument();
    expect(screen.getByText('New Post Ideas')).toBeInTheDocument();
    expect(screen.getByText('Quick Templates')).toBeInTheDocument();
    expect(screen.getByText('Media Collections')).toBeInTheDocument();
    expect(screen.getByText('Content Calendar')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Credits available')).toBeInTheDocument();
  });
});
