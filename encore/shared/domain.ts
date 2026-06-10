export type UserRole = "guest" | "host" | "admin" | "support";
export type HostPlan = "standard" | "professional" | "premium";
export type HostManagementMode = "self_service" | "managed";
export type KycStatus = "none" | "pending" | "verified" | "rejected";
export type ReferralTier = "bronze" | "silver" | "gold";
export type AccountStatus = "active" | "suspended" | "deactivated";
export type ListingStatus = "draft" | "pending" | "active" | "inactive" | "rejected" | "archived";
export type ListingAdminTagKey =
  | "payment_setup_review"
  | "ops_attention"
  | "special_conditions"
  | "contact_before_booking"
  | "verified_host_pick";
export type AvailabilityBlockSource = "MANUAL" | "APPROVED_HOLD" | "BOOKED";
export type InquiryDeclineReason =
  | "DATES_UNAVAILABLE"
  | "GUEST_COUNT_NOT_SUPPORTED"
  | "BOOKING_REQUIREMENTS_NOT_MET"
  | "HOST_UNAVAILABLE"
  | "OTHER";
export type InquiryState =
  | "PENDING"
  | "VIEWED"
  | "RESPONDED"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED"
  | "BOOKED";
export type PaymentState = "UNPAID" | "INITIATED" | "COMPLETED" | "FAILED";
export type PaymentDisputeResolution = "PAYMENT_CONFIRMED" | "PAYMENT_REJECTED" | "REFUND_OUTSIDE_PLATFORM" | "OTHER";
export type BookingOpsDeadlineKind = "HOST_RESPONSE" | "GUEST_PAYMENT" | "NONE";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReferralProgram = "guest" | "host";
export type ReferralRewardStatus = "pending" | "earned" | "paid" | "rejected";

export interface UserProfile {
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
  managementMode: HostManagementMode;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSettlementProfileRecord {
  listingId: string;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
  updatedAt: string;
}

export interface ListingRecord {
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
  availabilityBlocks?: ListingAvailabilityBlockRecord[];
  settlementProfile?: ListingSettlementProfileRecord | null;
  adminTagKey?: ListingAdminTagKey | null;
  adminTagNote?: string | null;
  adminTagAppliedAt?: string | null;
  adminTagAppliedBy?: string | null;
  status: ListingStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingAvailabilityBlockRecord {
  id: string;
  listingId: string;
  sourceType: AvailabilityBlockSource;
  sourceId: string;
  startsOn: string;
  endsOn: string;
  nights: string[];
  note?: string | null;
  bookingId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingAvailabilityManualBlockInput {
  startsOn: string;
  endsOn: string;
  note?: string | null;
}

export interface ListingAvailabilitySummaryRecord {
  listingId: string;
  manualBlockCount: number;
  manualBlockedDates: string[];
  lockedDates: string[];
  upcomingBlocks: ListingAvailabilityBlockRecord[];
}

export interface BookingRecord {
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
  inquiryState: InquiryState;
  paymentState: PaymentState;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofAccessible?: boolean;
  paymentProofAccessUrl?: string | null;
  declineReason?: InquiryDeclineReason | null;
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

export interface BookingOpsSummaryRecord {
  inquiryId: string;
  lastActor: "host" | "system" | "guest" | "admin" | "support";
  lastEvent: InquiryLedgerEventRecord["event"];
  lastEventAt: string;
  activeDeadlineKind: BookingOpsDeadlineKind;
  activeDeadlineAt?: string | null;
  openDisputeCount: number;
}

export interface PaymentDisputeRecord {
  id: string;
  inquiryId: string;
  status: "OPEN" | "RESOLVED";
  openedBy: "guest" | "host" | "admin" | "support";
  openedByUserId: string;
  reason: string;
  details?: string | null;
  resolution?: PaymentDisputeResolution | null;
  resolutionNote?: string | null;
  resolvedBy?: "host" | "admin" | "support" | null;
  resolvedByUserId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface InquiryLedgerEventRecord {
  id: string;
  inquiryId: string;
  event:
    | "INQUIRY_CREATED"
    | "STATUS_CHANGED"
    | "PAYMENT_CHANGED"
    | "DISPUTE_OPENED"
    | "DISPUTE_RESOLVED";
  fromState?: string | null;
  toState?: string | null;
  actor: "host" | "system" | "guest" | "admin" | "support";
  metadata?: string | null;
  timestamp: string;
}

export type MessageSuggestionType = "checkin" | "checkout" | "payment_info" | "directions" | "house_rules";

export interface HostQuickReplySettingsRecord {
  checkin?: string | null;
  checkout?: string | null;
  paymentInfo?: string | null;
  directions?: string | null;
  houseRules?: string | null;
  updatedAt?: string | null;
}

export interface MessageRecord {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: MessageSuggestionType | null;
  attachmentUrl?: string | null;
  createdAt: string;
}

export interface ReviewRecord {
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
  status: ReviewStatus;
  createdAt: string;
}

export interface ReferralRewardRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  trigger: "signup" | "booking" | "subscription";
  program: ReferralProgram;
  amount: number;
  status: ReferralRewardStatus;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: HostPlan;
  name: string;
  monthlyAmount: number;
  annualAmount: number;
  features: string[];
}

export type DomainEvent =
  | {
      type: "user.registered";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { role: UserRole; email: string };
    }
  | {
      type: "listing.created" | "listing.updated";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { hostId: string; status: ListingStatus };
    }
  | {
      type: "inquiry.created" | "inquiry.status_changed" | "inquiry.payment_changed" | "inquiry.payment_submitted";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: {
        listingId: string;
        listingTitle: string;
        guestId: string;
        hostId: string;
        inquiryState: InquiryState;
        paymentState: PaymentState;
        paymentSubmittedAt?: string | null;
        declineReason?: InquiryDeclineReason | null;
        declineReasonNote?: string | null;
        actor: "host" | "system" | "guest";
      };
    }
  | {
      type: "message.sent";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { bookingId: string; receiverId: string };
    }
  | {
      type: "review.submitted";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { listingId: string; bookingId: string };
    }
  | {
      type: "subscription.changed";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { plan: HostPlan };
    }
  | {
      type: "user.account_status_changed";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { status: AccountStatus; reason?: string | null };
    }
  | {
      type: "referral.reward_earned";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { referrerId: string; referredUserId: string; amount: number };
    };

export const HOST_PLANS: SubscriptionPlan[] = [
  {
    id: "standard",
    name: "Standard",
    monthlyAmount: 149,
    annualAmount: 1490,
    features: ["Verified host badge", "10-photo gallery", "Content studio access"],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyAmount: 350,
    annualAmount: 3500,
    features: ["Analytics insights", "Priority placement", "Advanced promotions"],
  },
  {
    id: "premium",
    name: "Premium",
    monthlyAmount: 499,
    annualAmount: 4990,
    features: ["Premium support", "Featured campaigns", "Priority operations tooling"],
  },
];
