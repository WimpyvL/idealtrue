import { encoreRequest } from './encore-client';
import type { SerializedImageAsset } from './media-client';
import type {
  Booking,
  BookingOpsSummary,
  InquiryDeclineReason,
  ListingAvailabilityManualBlockInput,
  ListingAvailabilitySummary,
  PaymentDispute,
  PaymentDisputeResolution,
  Referral,
  Review,
} from '@/types';
import {
  mapEncoreBooking,
  mapEncoreListing,
  mapEncoreListingAvailabilitySummary,
  mapEncoreReferralReward,
  mapEncoreReview,
  parseEncoreBooking,
  parseEncoreListing,
  parseEncoreListingAvailabilitySummary,
  parseEncoreReferralReward,
  parseEncoreReview,
  type EncoreBooking,
  type EncoreListing,
  type EncoreListingAvailabilitySummary,
  type EncoreReferralReward,
  type EncoreReview,
  type SaveListingInput,
  toEncoreListingPayload,
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
  return response.listings.map((listing) => mapEncoreListing(parseEncoreListing(listing)));
}

export async function getListing(id: string) {
  const response = await encoreRequest<{ listing: EncoreListing }>(`/listings/${id}`, {}, { auth: true });
  return mapEncoreListing(parseEncoreListing(response.listing));
}

export async function listHostListings(hostId: string) {
  const response = await encoreRequest<{ listings: EncoreListing[] }>(
    `/listings?hostId=${encodeURIComponent(hostId)}`,
    {},
    { auth: true },
  );
  return response.listings.map((listing) => mapEncoreListing(parseEncoreListing(listing)));
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
  return mapEncoreListing(parseEncoreListing(response.listing));
}

export function isEncoreEndpointNotFound(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('"message":"endpoint not found"');
}

export async function updateListingAvailabilityBlocks(listingId: string, manualBlocks: ListingAvailabilityManualBlockInput[]) {
  const response = await encoreRequest<{ listing: EncoreListing; summary: EncoreListingAvailabilitySummary }>(
    '/host/listings/availability/blocks',
    {
      method: 'PUT',
      body: JSON.stringify({ listingId, manualBlocks }),
    },
    { auth: true },
  );

  return {
    listing: mapEncoreListing(parseEncoreListing(response.listing)),
    summary: mapEncoreListingAvailabilitySummary(parseEncoreListingAvailabilitySummary(response.summary)),
  };
}

export async function getListingAvailabilitySummary(listingId: string): Promise<ListingAvailabilitySummary> {
  const response = await encoreRequest<{ summary: EncoreListingAvailabilitySummary }>(
    `/host/listings/${encodeURIComponent(listingId)}/availability-summary`,
    {},
    { auth: true },
  );
  return mapEncoreListingAvailabilitySummary(parseEncoreListingAvailabilitySummary(response.summary));
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

  return mapEncoreListing(parseEncoreListing(response.listing));
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
  return response.bookings.map((booking) => mapEncoreBooking(parseEncoreBooking(booking)));
}

export async function getBookingOpsSummary(id: string): Promise<BookingOpsSummary> {
  const response = await encoreRequest<{ summary: BookingOpsSummary }>(
    `/bookings/${id}/ops-summary`,
    {},
    { auth: true },
  );
  return response.summary;
}

export async function listPaymentDisputes(id: string): Promise<PaymentDispute[]> {
  const response = await encoreRequest<{ disputes: PaymentDispute[] }>(
    `/bookings/${id}/disputes`,
    {},
    { auth: true },
  );
  return response.disputes;
}

export async function openPaymentDispute(params: {
  id: string;
  reason: string;
  details?: string | null;
}): Promise<PaymentDispute> {
  const response = await encoreRequest<{ dispute: PaymentDispute }>(
    `/bookings/${params.id}/disputes`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason: params.reason,
        details: params.details ?? null,
      }),
    },
    { auth: true },
  );
  return response.dispute;
}

export async function resolvePaymentDispute(params: {
  id: string;
  resolution: PaymentDisputeResolution;
  resolutionNote?: string | null;
}): Promise<{ dispute: PaymentDispute; booking: Booking }> {
  const response = await encoreRequest<{ dispute: PaymentDispute; booking: EncoreBooking }>(
    `/bookings/${params.id}/disputes/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({
        resolution: params.resolution,
        resolutionNote: params.resolutionNote ?? null,
      }),
    },
    { auth: true },
  );

  return {
    dispute: response.dispute,
    booking: mapEncoreBooking(parseEncoreBooking(response.booking)),
  };
}

export async function createBooking(params: {
  listingId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice: number;
  breakageDeposit?: number | null;
}) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    '/bookings',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapEncoreBooking(parseEncoreBooking(response.booking));
}

export async function updateBookingStatus(
  id: string,
  status: 'VIEWED' | 'RESPONDED' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'BOOKED',
  options?: {
    declineReason?: InquiryDeclineReason | null;
    declineReasonNote?: string | null;
  },
) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        status,
        declineReason: options?.declineReason ?? null,
        declineReasonNote: options?.declineReasonNote ?? null,
      }),
    },
    { auth: true },
  );

  return mapEncoreBooking(parseEncoreBooking(response.booking));
}

export async function markInquiryViewed(id: string) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${id}/view`,
    {
      method: 'POST',
      body: JSON.stringify({ id }),
    },
    { auth: true },
  );

  return mapEncoreBooking(parseEncoreBooking(response.booking));
}

export async function submitPaymentProof(params: {
  id: string;
  paymentReference?: string | null;
  paymentProof?: SerializedImageAsset | null;
}) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${params.id}/payment-proof`,
    {
      method: 'POST',
      body: JSON.stringify({
        paymentReference: params.paymentReference ?? null,
        paymentProofFilename: params.paymentProof?.filename ?? null,
        paymentProofContentType: params.paymentProof?.contentType ?? null,
        paymentProofDataBase64: params.paymentProof?.dataBase64 ?? null,
      }),
    },
    { auth: true },
  );

  return mapEncoreBooking(parseEncoreBooking(response.booking));
}

export async function confirmPayment(id: string) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${id}/payment-confirm`,
    {
      method: 'POST',
      body: JSON.stringify({ id }),
    },
    { auth: true },
  );

  return mapEncoreBooking(parseEncoreBooking(response.booking));
}

export async function listListingReviews(listingId: string): Promise<Review[]> {
  const response = await encoreRequest<{ reviews: EncoreReview[] }>(`/reviews/${listingId}`);
  return response.reviews.map((review) => mapEncoreReview(parseEncoreReview(review)));
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

  return mapEncoreReview(parseEncoreReview(response.review));
}

export async function listReferralRewards(): Promise<Referral[]> {
  const response = await encoreRequest<{ rewards: EncoreReferralReward[] }>('/referrals/rewards', {}, { auth: true });
  return response.rewards.map((reward) => mapEncoreReferralReward(parseEncoreReferralReward(reward)));
}
