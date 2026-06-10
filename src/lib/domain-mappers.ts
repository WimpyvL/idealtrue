import type {
  AccountStatus,
  Booking,
  HostManagementMode,
  HostPlan,
  KycStatus,
  ListingAdminTagKey,
  Listing,
  ListingAvailabilitySummary,
  ListingSettlementProfile,
  Notification,
  PlatformSettings,
  Referral,
  ReferralTier,
  Review,
  Subscription,
  UserProfile,
  UserRole,
} from '@/types';
import { z } from 'zod';

const userRoleSchema = z.enum(['host', 'guest', 'admin', 'support']);
const referralTierSchema = z.enum(['bronze', 'silver', 'gold']);
const kycStatusSchema = z.enum(['none', 'pending', 'verified', 'rejected']);
const hostPlanSchema = z.enum(['standard', 'professional', 'premium']);
const hostManagementModeSchema = z.enum(['self_service', 'managed']);
const accountStatusSchema = z.enum(['active', 'suspended', 'deactivated']);
const listingStatusSchema = z.enum(['draft', 'pending', 'active', 'inactive', 'rejected', 'archived']);
const inquiryStateSchema = z.enum(['PENDING', 'VIEWED', 'RESPONDED', 'APPROVED', 'DECLINED', 'EXPIRED', 'BOOKED']);
const paymentStateSchema = z.enum(['UNPAID', 'INITIATED', 'COMPLETED', 'FAILED']);
const declineReasonSchema = z.enum(['DATES_UNAVAILABLE', 'GUEST_COUNT_NOT_SUPPORTED', 'BOOKING_REQUIREMENTS_NOT_MET', 'HOST_UNAVAILABLE', 'OTHER']);
const availabilityBlockSourceSchema = z.enum(['MANUAL', 'APPROVED_HOLD', 'BOOKED']);
const notificationTypeSchema = z.enum(['info', 'warning', 'success', 'error']);
const subscriptionStatusSchema = z.enum(['active', 'expired', 'cancelled']);
const referralTriggerSchema = z.enum(['signup', 'booking', 'subscription']);
const referralProgramSchema = z.enum(['guest', 'host']);
const referralRewardStatusSchema = z.enum(['pending', 'earned', 'paid', 'rejected']);

const nullableStringSchema = z.string().nullable().optional();

const listingAvailabilityBlockSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  sourceType: availabilityBlockSourceSchema,
  sourceId: z.string().min(1),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
  nights: z.array(z.string()),
  note: nullableStringSchema,
  bookingId: nullableStringSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const listingSettlementProfileSchema = z.object({
  listingId: z.string().min(1),
  paymentMethod: nullableStringSchema,
  paymentInstructions: nullableStringSchema,
  paymentReferencePrefix: nullableStringSchema,
  updatedAt: z.string().min(1),
});

const listingAdminTagKeySchema = z.enum([
  'payment_setup_review',
  'ops_attention',
  'special_conditions',
  'contact_before_booking',
  'verified_host_pick',
]);

const encoreUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  emailVerified: z.boolean(),
  displayName: z.string().min(1),
  photoUrl: nullableStringSchema,
  role: userRoleSchema,
  isAdmin: z.boolean().optional().default(false),
  hostPlan: hostPlanSchema,
  managementMode: hostManagementModeSchema.optional().default('self_service'),
  kycStatus: kycStatusSchema,
  accountStatus: accountStatusSchema.optional().default('active'),
  accountStatusReason: nullableStringSchema,
  accountStatusChangedAt: nullableStringSchema,
  accountStatusChangedBy: nullableStringSchema,
  balance: z.number(),
  referralCount: z.number(),
  tier: referralTierSchema,
  referralCode: nullableStringSchema,
  referredByCode: nullableStringSchema,
  paymentMethod: nullableStringSchema,
  paymentInstructions: nullableStringSchema,
  paymentReferencePrefix: nullableStringSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const encoreLeaderboardUserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  photoUrl: nullableStringSchema,
  tier: referralTierSchema,
  referralCount: z.number(),
});

const encoreListingSchema = z.object({
  id: z.string().min(1),
  hostId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  location: z.string().min(1),
  area: nullableStringSchema,
  province: nullableStringSchema,
  category: z.string().min(1),
  type: z.string().min(1),
  pricePerNight: z.number(),
  discountPercent: z.number(),
  breakageDeposit: z.number().nullable().optional(),
  adults: z.number(),
  children: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  amenities: z.array(z.string()),
  facilities: z.array(z.string()),
  restaurantOffers: z.array(z.string()),
  images: z.array(z.string()),
  videoUrl: nullableStringSchema,
  isSelfCatering: z.boolean(),
  hasRestaurant: z.boolean(),
  isOccupied: z.boolean(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  blockedDates: z.array(z.string()).optional(),
  manualBlockedDates: z.array(z.string()).optional(),
  availabilityBlocks: z.array(listingAvailabilityBlockSchema).optional(),
  settlementProfile: listingSettlementProfileSchema.nullable().optional(),
  adminTagKey: listingAdminTagKeySchema.nullable().optional(),
  adminTagNote: nullableStringSchema,
  adminTagAppliedAt: nullableStringSchema,
  adminTagAppliedBy: nullableStringSchema,
  status: listingStatusSchema,
  rejectionReason: nullableStringSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const encoreListingAvailabilitySummarySchema = z.object({
  listingId: z.string().min(1),
  manualBlockCount: z.number(),
  manualBlockedDates: z.array(z.string()),
  lockedDates: z.array(z.string()),
  upcomingBlocks: z.array(listingAvailabilityBlockSchema),
});

const encoreBookingSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  guestId: z.string().min(1),
  hostId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.number(),
  children: z.number(),
  totalPrice: z.number(),
  breakageDeposit: z.number().nullable().optional(),
  inquiryState: inquiryStateSchema,
  paymentState: paymentStateSchema,
  paymentMethod: nullableStringSchema,
  paymentInstructions: nullableStringSchema,
  paymentReference: nullableStringSchema,
  paymentProofAccessible: z.boolean().optional(),
  paymentProofAccessUrl: nullableStringSchema,
  declineReason: declineReasonSchema.nullable().optional(),
  declineReasonNote: nullableStringSchema,
  viewedAt: nullableStringSchema,
  respondedAt: nullableStringSchema,
  paymentUnlockedAt: nullableStringSchema,
  paymentSubmittedAt: nullableStringSchema,
  paymentConfirmedAt: nullableStringSchema,
  expiresAt: nullableStringSchema,
  bookedAt: nullableStringSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const encoreReviewSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  bookingId: z.string().min(1).optional(),
  guestId: z.string().min(1),
  hostId: z.string().min(1),
  cleanliness: z.number(),
  accuracy: z.number(),
  communication: z.number(),
  location: z.number(),
  value: z.number(),
  comment: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  createdAt: z.string().min(1),
});

const encoreReferralRewardSchema = z.object({
  id: z.string().min(1),
  referrerId: z.string().min(1),
  referredUserId: z.string().min(1),
  trigger: referralTriggerSchema,
  program: referralProgramSchema.optional(),
  amount: z.number(),
  status: referralRewardStatusSchema,
  createdAt: z.string().min(1),
});

const encoreNotificationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  message: z.string(),
  type: notificationTypeSchema,
  target: z.string().min(1),
  actionPath: nullableStringSchema,
  readAt: nullableStringSchema,
  createdAt: z.string().min(1),
});

const encorePlatformSettingsSchema = z.object({
  id: z.literal('global').optional().default('global'),
  referralRewardAmount: z.number().optional().default(0),
  commissionRate: z.number().optional().default(0),
  minWithdrawalAmount: z.number().optional().default(0),
  platformName: z.string().min(1).optional().default('Ideal Stay'),
  supportEmail: z.string().min(1),
  cancellationPolicyDays: z.number().optional().default(0),
  maxGuestsPerListing: z.number().optional().default(0),
  enableReviews: z.boolean().optional().default(true),
  enableReferrals: z.boolean().optional().default(true),
  maintenanceMode: z.boolean(),
  updatedAt: z.string().min(1).optional().default('1970-01-01T00:00:00.000Z'),
});

const encoreSubscriptionSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  plan: hostPlanSchema,
  status: subscriptionStatusSchema,
  amount: z.number(),
  billing_interval: z.enum(['monthly', 'annual']),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  created_at: z.string().min(1),
});

function parseDomainContract<T>(schema: z.ZodSchema<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(message);
  }
  return parsed.data;
}

export const parseEncoreUser = (value: unknown) => parseDomainContract(encoreUserSchema, value, 'Identity user response was invalid.');
export const parseEncoreLeaderboardUser = (value: unknown) => parseDomainContract(encoreLeaderboardUserSchema, value, 'Referral leaderboard response was invalid.');
export const parseEncoreListing = (value: unknown) => parseDomainContract(encoreListingSchema, value, 'Listing response was invalid.');
export const parseEncoreListingAvailabilitySummary = (value: unknown) => parseDomainContract(encoreListingAvailabilitySummarySchema, value, 'Listing availability response was invalid.');
export const parseEncoreBooking = (value: unknown) => parseDomainContract(encoreBookingSchema, value, 'Booking response was invalid.');
export const parseEncoreReview = (value: unknown) => parseDomainContract(encoreReviewSchema, value, 'Review response was invalid.');
export const parseEncoreReferralReward = (value: unknown) => parseDomainContract(encoreReferralRewardSchema, value, 'Referral reward response was invalid.');
export const parseEncoreSubscription = (value: unknown) => parseDomainContract(encoreSubscriptionSchema, value, 'Subscription response was invalid.');
export const parseEncoreNotification = (value: unknown) => parseDomainContract(encoreNotificationSchema, value, 'Notification response was invalid.');
export const parseEncorePlatformSettings = (value: unknown) => parseDomainContract(encorePlatformSettingsSchema, value, 'Platform settings response was invalid.');

export interface EncoreUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoUrl?: string | null;
  role: UserRole;
  isAdmin: boolean;
  hostPlan: HostPlan;
  managementMode: HostManagementMode;
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
  manualBlockedDates?: string[];
  availabilityBlocks?: Listing['availabilityBlocks'];
  settlementProfile?: ListingSettlementProfile | null;
  adminTagKey?: ListingAdminTagKey | null;
  adminTagNote?: string | null;
  adminTagAppliedAt?: string | null;
  adminTagAppliedBy?: string | null;
  status: Listing['status'];
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncoreListingAvailabilitySummary {
  listingId: string;
  manualBlockCount: number;
  manualBlockedDates: string[];
  lockedDates: string[];
  upcomingBlocks: Listing['availabilityBlocks'];
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
  breakageDeposit?: number | null;
  inquiryState: Booking['inquiryState'];
  paymentState: Booking['paymentState'];
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofAccessible?: boolean;
  paymentProofAccessUrl?: string | null;
  declineReason?: Booking['declineReason'];
  declineReasonNote?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  paymentUnlockedAt?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
  expiresAt?: string | null;
  bookedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncoreReview {
  id: string;
  listingId: string;
  bookingId?: string;
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
  hostId?: string;
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
  settlementProfile?: {
    paymentMethod?: string | null;
    paymentInstructions?: string | null;
    paymentReferencePrefix?: string | null;
  } | null;
  adminTagKey?: ListingAdminTagKey | null;
  adminTagNote?: string | null;
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
    managementMode: user.managementMode,
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
    manualBlockedDates: listing.manualBlockedDates || [],
    availabilityBlocks: listing.availabilityBlocks || [],
    settlementProfile: listing.settlementProfile || null,
    adminTagKey: listing.adminTagKey || null,
    adminTagNote: listing.adminTagNote || null,
    adminTagAppliedAt: listing.adminTagAppliedAt || null,
    adminTagAppliedBy: listing.adminTagAppliedBy || null,
  };
}

export function mapEncoreListingAvailabilitySummary(summary: EncoreListingAvailabilitySummary): ListingAvailabilitySummary {
  return {
    listingId: summary.listingId,
    manualBlockCount: summary.manualBlockCount,
    manualBlockedDates: summary.manualBlockedDates || [],
    lockedDates: summary.lockedDates || [],
    upcomingBlocks: summary.upcomingBlocks || [],
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
    breakageDeposit: booking.breakageDeposit ?? null,
    guests: {
      adults: booking.adults,
      children: booking.children,
    },
    inquiryState: booking.inquiryState,
    paymentState: booking.paymentState,
    paymentMethod: booking.paymentMethod || null,
    paymentInstructions: booking.paymentInstructions || null,
    paymentReference: booking.paymentReference || null,
    paymentProofAccessible: Boolean(booking.paymentProofAccessible),
    paymentProofAccessUrl: booking.paymentProofAccessUrl || null,
    declineReason: booking.declineReason || null,
    declineReasonNote: booking.declineReasonNote || null,
    viewedAt: booking.viewedAt || null,
    respondedAt: booking.respondedAt || null,
    paymentUnlockedAt: booking.paymentUnlockedAt || null,
    paymentSubmittedAt: booking.paymentSubmittedAt || null,
    paymentConfirmedAt: booking.paymentConfirmedAt || null,
    expiresAt: booking.expiresAt || null,
    bookedAt: booking.bookedAt || null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
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
    hostId: input.hostId,
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
    settlementProfile: input.settlementProfile
      ? {
          paymentMethod: input.settlementProfile.paymentMethod ?? null,
          paymentInstructions: input.settlementProfile.paymentInstructions ?? null,
          paymentReferencePrefix: input.settlementProfile.paymentReferencePrefix ?? null,
        }
      : undefined,
    adminTagKey: input.adminTagKey ?? null,
    adminTagNote: input.adminTagNote ?? null,
    status: input.status,
    rejectionReason: input.status === 'rejected' ? input.rejectionReason ?? null : null,
  };
}
