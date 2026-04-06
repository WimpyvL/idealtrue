import { encoreRequest } from './encore-client';
import type { SerializedImageAsset } from './media-client';
import type { Booking, Listing, Referral, Review } from '@/types';
import {
  mapEncoreBooking,
  mapEncoreListing,
  mapEncoreReferralReward,
  mapEncoreReview,
  type EncoreBooking,
  type EncoreListing,
  type EncoreReferralReward,
  type EncoreReview,
  type SaveListingInput,
  toEncoreListingPayload,
  mapReferralStatus,
} from './domain-mappers';

export type { SaveListingInput } from './domain-mappers';
export { mapReferralStatus } from './domain-mappers';

interface EncoreHostListingQuota {
  plan: 'standard' | 'professional' | 'premium';
  maxListings: number | null;
  usedListings: number;
  canCreate: boolean;
}

export async function listPublicListings() {
  const response = await encoreRequest<{ listings: EncoreListing[] }>('/listings?status=active');
  return response.listings.map(mapEncoreListing);
}

export async function getListing(id: string) {
  const response = await encoreRequest<{ listing: EncoreListing }>(`/listings/${id}`, {}, { auth: true });
  return mapEncoreListing(response.listing);
}

export async function listHostListings(hostId: string) {
  const response = await encoreRequest<{ listings: EncoreListing[] }>(
    `/listings?hostId=${encodeURIComponent(hostId)}`,
    {},
    { auth: true },
  );
  return response.listings.map(mapEncoreListing);
}

export async function getMyListingQuota() {
  const response = await encoreRequest<{ quota: EncoreHostListingQuota }>(
    '/host/listings/quota',
    {},
    { auth: true },
  );
  return response.quota;
}

export async function updateListingBlockedDates(listingId: string, blockedDates: string[]) {
  const response = await encoreRequest<{ listing: EncoreListing }>(
    '/host/listings/availability',
    {
      method: 'PUT',
      body: JSON.stringify({ listingId, blockedDates }),
    },
    { auth: true },
  );
  return mapEncoreListing(response.listing);
}

export async function saveListing(input: SaveListingInput) {
  const response = await encoreRequest<{ listing: EncoreListing }>(
    '/host/listings',
    {
      method: input.id ? 'PUT' : 'POST',
      body: JSON.stringify(toEncoreListingPayload(input)),
    },
    { auth: true },
  );

  return mapEncoreListing(response.listing);
}

export async function deleteListing(id: string) {
  await encoreRequest<{ deleted: true }>(
    `/host/listings/${id}`,
    {
      method: 'DELETE',
    },
    { auth: true },
  );
}

export async function listMyBookings() {
  const response = await encoreRequest<{ bookings: EncoreBooking[] }>('/bookings/me', {}, { auth: true });
  return response.bookings.map(mapEncoreBooking);
}

export async function createBooking(params: {
  listingId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice: number;
}) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    '/bookings',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapEncoreBooking(response.booking);
}

export async function updateBookingStatus(id: string, status: 'awaiting_guest_payment' | 'confirmed' | 'cancelled' | 'completed') {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    },
    { auth: true },
  );

  return mapEncoreBooking(response.booking);
}

export async function submitPaymentProof(params: {
  id: string;
  paymentReference?: string | null;
  paymentProof?: SerializedImageAsset | null;
  paymentProofUrl?: string | null;
}) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${params.id}/payment-proof`,
    {
      method: 'POST',
      body: JSON.stringify({
        paymentReference: params.paymentReference ?? null,
        paymentProof: params.paymentProof ?? null,
        paymentProofUrl: params.paymentProofUrl ?? null,
      }),
    },
    { auth: true },
  );

  return mapEncoreBooking(response.booking);
}

export async function listListingReviews(listingId: string): Promise<Review[]> {
  const response = await encoreRequest<{ reviews: EncoreReview[] }>(`/reviews/${listingId}`);
  return response.reviews.map(mapEncoreReview);
}

export async function createListingReview(params: {
  listingId: string;
  bookingId: string;
  hostId: string;
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
  comment: string;
}) {
  const response = await encoreRequest<{ review: EncoreReview }>(
    '/reviews',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapEncoreReview(response.review);
}

export async function listReferralRewards(): Promise<Referral[]> {
  const response = await encoreRequest<{ rewards: EncoreReferralReward[] }>('/referrals/rewards', {}, { auth: true });
  return response.rewards.map(mapEncoreReferralReward);
}
