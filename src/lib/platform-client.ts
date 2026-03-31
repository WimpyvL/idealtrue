import { encoreRequest } from './encore-client';
import type { Booking, Listing, Referral, Review } from '@/types';

interface EncoreListing {
  id: string;
  hostId: string;
  title: string;
  description: string;
  location: string;
  area?: string | null;
  province?: string | null;
  category: string;
  type: string;
  pricePerNight: number;
  discountPercent: number;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  facilities: string[];
  restaurantOffers: string[];
  images: string[];
  videoUrl?: string | null;
  isSelfCatering: boolean;
  hasRestaurant: boolean;
  isOccupied: boolean;
  latitude?: number | null;
  longitude?: number | null;
  blockedDates?: string[];
  status: 'draft' | 'pending' | 'active' | 'inactive' | 'rejected' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface EncoreBooking {
  id: string;
  listingId: string;
  guestId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice: number;
  status: 'pending' | 'awaiting_guest_payment' | 'payment_submitted' | 'confirmed' | 'cancelled' | 'completed' | 'declined';
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EncoreReview {
  id: string;
  listingId: string;
  bookingId: string;
  guestId: string;
  hostId: string;
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
  comment: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface EncoreReferralReward {
  id: string;
  referrerId: string;
  referredUserId: string;
  trigger: 'signup' | 'booking';
  amount: number;
  status: 'pending' | 'earned' | 'paid' | 'rejected';
  createdAt: string;
}

function mapListing(listing: EncoreListing): Listing {
  return {
    id: listing.id,
    hostUid: listing.hostId,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    area: listing.area || '',
    province: listing.province || '',
    type: listing.type,
    pricePerNight: listing.pricePerNight,
    discount: listing.discountPercent,
    images: listing.images || [],
    video_url: listing.videoUrl || null,
    amenities: listing.amenities || [],
    facilities: listing.facilities || [],
    other_facility: '',
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    is_self_catering: listing.isSelfCatering,
    has_restaurant: listing.hasRestaurant,
    restaurant_offers: listing.restaurantOffers || [],
    is_occupied: listing.isOccupied,
    rating: 0,
    reviews: 0,
    category: listing.category,
    status: listing.status,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    coordinates: listing.latitude != null && listing.longitude != null
      ? { lat: listing.latitude, lng: listing.longitude }
      : undefined,
    blockedDates: listing.blockedDates || [],
  };
}

function mapBooking(booking: EncoreBooking): Booking {
  return {
    id: booking.id,
    listingId: booking.listingId,
    guestUid: booking.guestId,
    hostUid: booking.hostId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    totalPrice: booking.totalPrice,
    guests: {
      adults: booking.adults,
      children: booking.children,
    },
    status: booking.status === 'declined' ? 'cancelled' : booking.status,
    paymentMethod: booking.paymentMethod || null,
    paymentInstructions: booking.paymentInstructions || null,
    paymentReference: booking.paymentReference || null,
    paymentProofUrl: booking.paymentProofUrl || null,
    paymentSubmittedAt: booking.paymentSubmittedAt || null,
    paymentConfirmedAt: booking.paymentConfirmedAt || null,
    createdAt: booking.createdAt,
  };
}

function mapReview(review: EncoreReview): Review {
  return {
    id: review.id,
    listingId: review.listingId,
    guestUid: review.guestId,
    hostUid: review.hostId,
    cleanliness: review.cleanliness,
    accuracy: review.accuracy,
    communication: review.communication,
    location: review.location,
    value: review.value,
    comment: review.comment,
    status: review.status,
    createdAt: review.createdAt,
  };
}

function mapReferral(reward: EncoreReferralReward): Referral {
  return {
    id: reward.id,
    referrerUid: reward.referrerId,
    referredUid: reward.referredUserId,
    amount: reward.amount,
    type: reward.trigger,
    status: reward.status === 'earned' ? 'rewarded' : reward.status === 'rejected' ? 'pending' : 'confirmed',
    createdAt: reward.createdAt,
  };
}

export async function listPublicListings() {
  const response = await encoreRequest<{ listings: EncoreListing[] }>('/listings?status=active');
  return response.listings.map(mapListing);
}

export async function listHostListings(hostId: string) {
  const response = await encoreRequest<{ listings: EncoreListing[] }>(
    `/listings?hostId=${encodeURIComponent(hostId)}`,
    {},
    { auth: true },
  );
  return response.listings.map(mapListing);
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
  return mapListing(response.listing);
}

export async function listMyBookings() {
  const response = await encoreRequest<{ bookings: EncoreBooking[] }>('/bookings/me', {}, { auth: true });
  return response.bookings.map(mapBooking);
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

  return mapBooking(response.booking);
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

  return mapBooking(response.booking);
}

export async function submitPaymentProof(params: {
  id: string;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
}) {
  const response = await encoreRequest<{ booking: EncoreBooking }>(
    `/bookings/${params.id}/payment-proof`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapBooking(response.booking);
}

export async function listReferralRewards() {
  const response = await encoreRequest<{ rewards: EncoreReferralReward[] }>('/referrals/rewards', {}, { auth: true });
  return response.rewards.map(mapReferral);
}

export async function listListingReviews(listingId: string) {
  const response = await encoreRequest<{ reviews: EncoreReview[] }>(`/reviews/${listingId}`);
  return response.reviews.map(mapReview);
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

  return mapReview(response.review);
}
