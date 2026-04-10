import type {
  AccountStatus,
  Booking,
  HostPlan,
  KycStatus,
  Listing,
  Notification,
  PlatformSettings,
  Referral,
  ReferralTier,
  Review,
  Subscription,
  UserProfile,
  UserRole,
} from '@/types';

export interface EncoreUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoUrl?: string | null;
  role: UserRole;
  isAdmin: boolean;
  hostPlan: HostPlan;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  accountStatusReason?: string | null;
  accountStatusChangedAt?: string | null;
  accountStatusChangedBy?: string | null;
  balance: number;
  referralCount: number;
  tier: ReferralTier;
  referralCode?: string | null;
  referredByCode?: string | null;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncoreLeaderboardUser {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  tier: ReferralTier;
  referralCount: number;
}

export interface EncoreListing {
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
  breakageDeposit?: number | null;
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
  status: Listing['status'];
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncoreBooking {
  id: string;
  listingId: string;
  guestId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice: number;
  status: Booking['status'];
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncoreReview {
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

export interface EncoreReferralReward {
  id: string;
  referrerId: string;
  referredUserId: string;
  trigger: Referral['trigger'];
  program?: 'guest' | 'host';
  amount: number;
  status: 'pending' | 'earned' | 'paid' | 'rejected';
  createdAt: string;
}

export interface EncoreNotification {
  id: string;
  title: string;
  message: string;
  type: Notification['type'];
  target: string;
  actionPath?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface EncorePlatformSettings {
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

export interface EncoreSubscription {
  id: string;
  user_id: string;
  plan: HostPlan;
  status: Subscription['status'];
  amount: number;
  billing_interval: 'monthly' | 'annual';
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface SaveListingInput {
  id?: string;
  title: string;
  description: string;
  location: string;
  area?: string | null;
  province?: string | null;
  category: string;
  type: string;
  pricePerNight: number;
  discount: number;
  breakageDeposit?: number | null;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  facilities: string[];
  otherFacility?: string | null;
  restaurantOffers: string[];
  images: string[];
  videoUrl?: string | null;
  isSelfCatering: boolean;
  hasRestaurant: boolean;
  isOccupied: boolean;
  coordinates?: { lat: number; lng: number } | null;
  blockedDates?: string[];
  status: Listing['status'];
  rejectionReason?: string | null;
}

export interface LeaderboardUser {
  id: string;
  displayName: string;
  photoUrl: string;
  tier: ReferralTier;
  referralCount: number;
}

export function mapEncoreUserToProfile(user: EncoreUser): UserProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    photoUrl: user.photoUrl || '',
    role: user.role,
    isAdmin: user.isAdmin,
    referralCode: user.referralCode || '',
    referredByCode: user.referredByCode || null,
    accountStatus: user.accountStatus,
    accountStatusReason: user.accountStatusReason || null,
    accountStatusChangedAt: user.accountStatusChangedAt || null,
    accountStatusChangedBy: user.accountStatusChangedBy || null,
    balance: user.balance,
    referralCount: user.referralCount,
    tier: user.tier,
    hostPlan: user.hostPlan,
    kycStatus: user.kycStatus,
    paymentMethod: user.paymentMethod || null,
    paymentInstructions: user.paymentInstructions || null,
    paymentReferencePrefix: user.paymentReferencePrefix || null,
    createdAt: user.createdAt,
  };
}

export function mapEncoreLeaderboardUser(user: EncoreLeaderboardUser): LeaderboardUser {
  return {
    id: user.id,
    displayName: user.displayName,
    photoUrl: user.photoUrl || '',
    tier: user.tier,
    referralCount: user.referralCount,
  };
}

export function mapEncoreListing(listing: EncoreListing): Listing {
  return {
    id: listing.id,
    hostId: listing.hostId,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    area: listing.area || '',
    province: listing.province || '',
    type: listing.type,
    pricePerNight: listing.pricePerNight,
    discount: listing.discountPercent,
    breakageDeposit: listing.breakageDeposit ?? null,
    images: listing.images || [],
    videoUrl: listing.videoUrl || null,
    amenities: listing.amenities || [],
    facilities: listing.facilities || [],
    otherFacility: '',
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    isSelfCatering: listing.isSelfCatering,
    hasRestaurant: listing.hasRestaurant,
    restaurantOffers: listing.restaurantOffers || [],
    isOccupied: listing.isOccupied,
    rating: 0,
    reviews: 0,
    category: listing.category,
    status: listing.status,
    rejectionReason: listing.rejectionReason || null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    coordinates:
      listing.latitude != null && listing.longitude != null
        ? { lat: listing.latitude, lng: listing.longitude }
        : undefined,
    blockedDates: listing.blockedDates || [],
  };
}

export function mapEncoreBooking(booking: EncoreBooking): Booking {
  return {
    id: booking.id,
    listingId: booking.listingId,
    guestId: booking.guestId,
    hostId: booking.hostId,
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

export function mapEncoreReview(review: EncoreReview): Review {
  return {
    id: review.id,
    listingId: review.listingId,
    guestId: review.guestId,
    hostId: review.hostId,
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

export function mapReferralStatus(status: EncoreReferralReward['status']): Referral['status'] {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'earned':
      return 'rewarded';
    case 'paid':
      return 'confirmed';
    case 'rejected':
      return 'rejected';
    default:
      return 'pending';
  }
}

export function mapEncoreReferralReward(reward: EncoreReferralReward): Referral {
  return {
    id: reward.id,
    referrerId: reward.referrerId,
    referredUserId: reward.referredUserId,
    amount: reward.amount,
    trigger: reward.trigger,
    program: reward.program,
    status: mapReferralStatus(reward.status),
    createdAt: reward.createdAt,
  };
}

export function mapEncoreSubscription(subscription: EncoreSubscription): Subscription {
  return {
    id: subscription.id,
    userId: subscription.user_id,
    plan: subscription.plan,
    amount: subscription.amount,
    status: subscription.status,
    startDate: subscription.starts_at,
    endDate: subscription.ends_at,
    createdAt: subscription.created_at,
  };
}

export function mapEncoreNotification(notification: EncoreNotification): Notification {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    target: notification.target,
    actionPath: notification.actionPath || null,
    readAt: notification.readAt || null,
    createdAt: notification.createdAt,
  };
}

export function mapEncorePlatformSettings(settings: EncorePlatformSettings): PlatformSettings {
  return {
    id: settings.id,
    referralRewardAmount: settings.referralRewardAmount,
    commissionRate: settings.commissionRate,
    minWithdrawalAmount: settings.minWithdrawalAmount,
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    cancellationPolicyDays: settings.cancellationPolicyDays,
    maxGuestsPerListing: settings.maxGuestsPerListing,
    enableReviews: settings.enableReviews,
    enableReferrals: settings.enableReferrals,
    maintenanceMode: settings.maintenanceMode,
    updatedAt: settings.updatedAt,
  };
}

export function toEncoreListingPayload(input: SaveListingInput) {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    location: input.location,
    area: input.area ?? null,
    province: input.province ?? null,
    category: input.category,
    type: input.type,
    pricePerNight: Number(input.pricePerNight),
    discountPercent: Number(input.discount || 0),
    breakageDeposit: input.breakageDeposit != null ? Number(input.breakageDeposit) : null,
    adults: Number(input.adults || 1),
    children: Number(input.children || 0),
    bedrooms: Number(input.bedrooms || 1),
    bathrooms: Number(input.bathrooms || 1),
    amenities: input.amenities || [],
    facilities: input.facilities || [],
    restaurantOffers: input.restaurantOffers || [],
    images: input.images || [],
    videoUrl: input.videoUrl || null,
    isSelfCatering: Boolean(input.isSelfCatering),
    hasRestaurant: Boolean(input.hasRestaurant),
    isOccupied: Boolean(input.isOccupied),
    latitude: input.coordinates?.lat ?? null,
    longitude: input.coordinates?.lng ?? null,
    blockedDates: input.blockedDates || [],
    status: input.status,
    rejectionReason: input.status === 'rejected' ? input.rejectionReason ?? null : null,
  };
}
