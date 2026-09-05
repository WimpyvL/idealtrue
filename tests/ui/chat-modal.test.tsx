import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatModal from '@/components/ChatModal';
import type { Booking, Listing } from '@/types';

vi.mock('@/lib/messaging-client', () => ({
  getMyHostQuickReplies: vi.fn(async () => ({
    checkin: null,
    checkout: null,
    paymentInfo: null,
    directions: null,
    houseRules: null,
    updatedAt: null,
  })),
  listMessages: vi.fn(async () => []),
  sendMessage: vi.fn(async (params) => ({
    id: 'message-1',
    bookingId: params.bookingId,
    senderId: 'guest-1',
    receiverId: params.receiverId,
    text: params.text,
    suggestionType: params.suggestionType,
    attachmentUrl: params.attachmentUrl,
    createdAt: '2026-05-10T08:00:00.000Z',
  })),
  uploadMessageAttachment: vi.fn(async () => 'booking-1/guest-1/receipt.pdf'),
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
};

const booking: Booking = {
  id: 'booking-1',
  listingId: listing.id,
  guestId: 'guest-1',
  hostId: listing.hostId,
  checkIn: '2026-06-01',
  checkOut: '2026-06-03',
  totalPrice: 3600,
  breakageDeposit: 500,
  guests: {
    adults: 2,
    children: 0,
  },
  inquiryState: 'APPROVED',
  paymentState: 'INITIATED',
  paymentMethod: 'eft',
  paymentInstructions: 'Use your booking id as reference',
  paymentReference: 'IDEAL-123',
  paymentProofAccessible: false,
  paymentProofAccessUrl: null,
  viewedAt: '2026-04-20T09:00:00.000Z',
  respondedAt: '2026-04-20T10:00:00.000Z',
  paymentUnlockedAt: '2026-04-20T11:00:00.000Z',
  paymentSubmittedAt: null,
  paymentConfirmedAt: null,
  expiresAt: '2026-06-01T10:00:00.000Z',
  bookedAt: null,
  createdAt: '2026-04-20T08:00:00.000Z',
};

describe('ChatModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets an approved guest open the proof-of-payment flow from messages', async () => {
    const onSubmitPaymentProof = vi.fn();

    render(
      <ChatModal
        booking={booking}
        listing={listing}
        currentUserId="guest-1"
        onClose={vi.fn()}
        onSubmitPaymentProof={onSubmitPaymentProof}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /submit proof of payment/i }));

    expect(onSubmitPaymentProof).toHaveBeenCalledWith(booking);
  });

  it('lets a host push payment details into chat once payment is unlocked', async () => {
    const { sendMessage } = await import('@/lib/messaging-client');

    render(
      <ChatModal
        booking={booking}
        listing={listing}
        currentUserId="host-1"
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /send payment details/i }));

    expect(sendMessage).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      receiverId: 'guest-1',
      text: 'Please use these payment details: Use your booking id as reference Use reference IDEAL-123, then submit proof so I can confirm the booking.',
      isSystem: false,
      suggestionType: 'payment_info',
    });
  });

  it('uses host quick reply settings when sending configured actions', async () => {
    const { sendMessage } = await import('@/lib/messaging-client');

    render(
      <ChatModal
        booking={{
          ...booking,
          inquiryState: 'BOOKED',
          paymentState: 'COMPLETED',
          paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
          paymentConfirmedAt: '2026-04-20T16:00:00.000Z',
          bookedAt: '2026-04-20T16:00:00.000Z',
        }}
        listing={listing}
        currentUserId="host-1"
        onClose={vi.fn()}
        hostQuickReplies={{
          directions: 'Use the side gate on Ocean Road.',
          houseRules: 'No parties and quiet hours from 22:00.',
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /send directions/i }));

    expect(sendMessage).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      receiverId: 'guest-1',
      text: 'Use the side gate on Ocean Road.',
      isSystem: false,
      suggestionType: 'directions',
    });
  });

  it('uploads the selected attachment before sending the chat message', async () => {
    const { sendMessage, uploadMessageAttachment } = await import('@/lib/messaging-client');
    const user = userEvent.setup();
    const { container } = render(
      <ChatModal
        booking={booking}
        listing={listing}
        currentUserId="guest-1"
        onClose={vi.fn()}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    const attachment = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });

    await user.upload(fileInput, attachment);
    await expect(screen.findByText('receipt.pdf')).resolves.toBeVisible();
    await user.type(screen.getByPlaceholderText('Type a message...'), 'Please see the receipt.');
    await user.click(submitButton);

    expect(uploadMessageAttachment).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      file: attachment,
    });
    expect(sendMessage).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      receiverId: 'host-1',
      text: 'Please see the receipt.',
      isSystem: false,
      suggestionType: undefined,
      attachmentUrl: 'booking-1/guest-1/receipt.pdf',
    });
  });
});
