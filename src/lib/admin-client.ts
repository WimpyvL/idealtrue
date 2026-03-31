import { encoreRequest } from './encore-client';
import type { Booking, Listing, Notification, PlatformSettings, Referral, Review, Subscription, UserProfile } from '@/types';

type EncoreUserRole = 'guest' | 'host' | 'admin';
type EncoreHostPlan = 'standard' | 'professional' | 'premium';
type EncoreKycStatus = 'none' | 'pending' | 'verified' | 'rejected';
type EncoreReferralTier = 'bronze' | 'silver' | 'gold';
type EncoreReferralRewardStatus = 'pending' | 'earned' | 'paid' | 'rejected';

interface EncoreUser {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string | null;
  role: EncoreUserRole;
  isAdmin: boolean;
  hostPlan: EncoreHostPlan;
  kycStatus: EncoreKycStatus;
  balance: number;
  referralCount: number;
  tier: EncoreReferralTier;
  referralCode?: string | null;
  referredByCode?: string | null;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  trigger: 'signup' | 'booking' | 'subscription';
  program: 'guest' | 'host';
  amount: number;
  status: EncoreReferralRewardStatus;
  createdAt: string;
}

export interface AdminCheckout {
  id: string;
  user_id: string;
  checkout_type: 'subscription' | 'content_credits';
  provider: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  currency: string;
  amount: number;
  host_plan?: 'standard' | 'professional' | 'premium' | null;
  billing_interval?: 'monthly' | 'annual' | null;
  credit_quantity?: number | null;
  provider_checkout_id?: string | null;
  provider_payment_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminObservabilityDatabase {
  name: string;
  healthy: boolean;
  latencyMs: number;
}

export interface AdminObservabilitySnapshot {
  checkedAt: string;
  backendStartedAt: string;
  uptimeSeconds: number;
  averageDbPingMs: number;
  healthyDatabases: number;
  totalDatabases: number;
  databases: AdminObservabilityDatabase[];
  encoreCloudTracingAvailable: boolean;
  encoreCloudMetricsAvailable: boolean;
  encoreCloudLogsAvailable: boolean;
}

interface EncoreSubscription {
  id: string;
  user_id: string;
  plan: 'standard' | 'professional' | 'premium';
  status: 'active' | 'expired' | 'cancelled';
  amount: number;
  billing_interval: 'monthly' | 'annual';
  starts_at: string;
  ends_at: string;
  created_at: string;
}

interface EncoreNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  target: string;
  actionPath?: string | null;
  createdAt: string;
}

interface EncorePlatformSettings {
  id: 'global';
  referralRewardAmount: number;
  commissionRate: number;
  minWithdrawalAmount: number;
  platformName: string;
  supportEmail: string;
  cancellationPolicyDays: number;
  maxGuestsPerListing: number;
  enableReviews: boolean;
  enableReferrals: boolean;
  maintenanceMode: boolean;
  updatedAt: string;
}

function mapUser(user: EncoreUser): UserProfile {
  return {
    uid: user.id,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoUrl || '',
    role: user.role,
    isAdmin: user.isAdmin,
    referralCode: user.referralCode || '',
    referredBy: user.referredByCode || null,
    balance: user.balance,
    referralCount: user.referralCount,
    tier: user.tier,
    host_plan: user.hostPlan,
    kycStatus: user.kycStatus,
    paymentMethod: user.paymentMethod || null,
    paymentInstructions: user.paymentInstructions || null,
    paymentReferencePrefix: user.paymentReferencePrefix || null,
    createdAt: user.createdAt,
  };
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

function mapReferralReward(reward: EncoreReferralReward): Referral {
  return {
    id: reward.id,
    referrerUid: reward.referrerId,
    referredUid: reward.referredUserId,
    amount: reward.amount,
    type: reward.trigger,
    program: reward.program,
    status: reward.status === 'paid' ? 'rewarded' : reward.status === 'earned' ? 'confirmed' : reward.status,
    createdAt: reward.createdAt,
  };
}

function mapSubscription(subscription: EncoreSubscription): Subscription {
  return {
    id: subscription.id,
    hostUid: subscription.user_id,
    plan: subscription.plan,
    amount: subscription.amount,
    status: subscription.status,
    startDate: subscription.starts_at,
    endDate: subscription.ends_at,
    createdAt: subscription.created_at,
  };
}

function mapNotification(notification: EncoreNotification): Notification {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    target: notification.target,
    actionPath: notification.actionPath || null,
    createdAt: notification.createdAt,
  };
}

export async function listAdminUsers() {
  const response = await encoreRequest<{ users: EncoreUser[] }>('/admin/users', {}, { auth: true });
  return response.users.map(mapUser);
}

export async function updateAdminUser(params: {
  userId: string;
  displayName?: string;
  role?: EncoreUserRole;
  hostPlan?: EncoreHostPlan;
  kycStatus?: EncoreKycStatus;
  balance?: number;
  tier?: EncoreReferralTier;
}) {
  const response = await encoreRequest<{ user: EncoreUser }>(
    `/admin/users/${encodeURIComponent(params.userId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapUser(response.user);
}

export async function deleteAdminUser(userId: string) {
  await encoreRequest<{ deleted: true }>(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function listAdminBookings() {
  const response = await encoreRequest<{ bookings: EncoreBooking[] }>('/admin/bookings', {}, { auth: true });
  return response.bookings.map(mapBooking);
}

export async function listAdminReviews() {
  const response = await encoreRequest<{ reviews: EncoreReview[] }>('/admin/reviews', {}, { auth: true });
  return response.reviews.map(mapReview);
}

export async function updateAdminReviewStatus(reviewId: string, status: 'pending' | 'approved' | 'rejected') {
  const response = await encoreRequest<{ review: EncoreReview }>(
    `/admin/reviews/${encodeURIComponent(reviewId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ reviewId, status }),
    },
    { auth: true },
  );
  return mapReview(response.review);
}

export async function deleteAdminReview(reviewId: string) {
  await encoreRequest<{ deleted: true }>(
    `/admin/reviews/${encodeURIComponent(reviewId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function listAdminListings() {
  const response = await encoreRequest<{ listings: EncoreListing[] }>('/listings', {}, { auth: true });
  return response.listings.map(mapListing);
}

export async function listAdminReferralRewards() {
  const response = await encoreRequest<{ rewards: EncoreReferralReward[] }>('/admin/referrals', {}, { auth: true });
  return response.rewards.map(mapReferralReward);
}

export async function createAdminReferralReward(params: {
  referrerId: string;
  referredUserId: string;
  trigger: 'signup' | 'booking' | 'subscription';
  program?: 'guest' | 'host';
  amount: number;
  status?: EncoreReferralRewardStatus;
}) {
  const response = await encoreRequest<{ reward: EncoreReferralReward }>(
    '/admin/referrals',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapReferralReward(response.reward);
}

export async function deleteAdminReferralReward(rewardId: string) {
  await encoreRequest<{ deleted: true }>(
    `/admin/referrals/${encodeURIComponent(rewardId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function listAdminSubscriptions() {
  const response = await encoreRequest<{ subscriptions: EncoreSubscription[] }>('/admin/subscriptions', {}, { auth: true });
  return response.subscriptions.map(mapSubscription);
}

export async function listAdminCheckouts() {
  const response = await encoreRequest<{ checkouts: AdminCheckout[] }>('/admin/checkouts', {}, { auth: true });
  return response.checkouts;
}

export async function listAdminNotifications() {
  const response = await encoreRequest<{ notifications: EncoreNotification[] }>('/ops/admin/notifications', {}, { auth: true });
  return response.notifications.map(mapNotification);
}

export async function getAdminObservability(): Promise<AdminObservabilitySnapshot | null> {
  try {
    const response = await encoreRequest<{ snapshot: AdminObservabilitySnapshot }>(
      '/ops/admin/observability',
      {},
      { auth: true },
    );
    return response.snapshot;
  } catch (error) {
    if (error instanceof Error && error.message.includes('"code":"not_found"')) {
      return null;
    }
    throw error;
  }
}

export async function createAdminNotification(params: {
  title: string;
  message: string;
  type: Notification['type'];
  target: Notification['target'];
  actionPath?: string | null;
}) {
  const response = await encoreRequest<{ notification: EncoreNotification }>(
    '/ops/admin/notifications',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapNotification(response.notification);
}

export async function deleteAdminNotification(notificationId: string) {
  await encoreRequest<{ deleted: true }>(
    `/ops/admin/notifications/${encodeURIComponent(notificationId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function getAdminPlatformSettings() {
  const response = await encoreRequest<{ settings: EncorePlatformSettings }>('/ops/admin/settings', {}, { auth: true });
  return response.settings;
}

export async function updateAdminPlatformSettings(settings: Partial<PlatformSettings>) {
  const response = await encoreRequest<{ settings: EncorePlatformSettings }>(
    '/ops/admin/settings',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    },
    { auth: true },
  );
  return response.settings;
}
