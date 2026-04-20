export type UserRole = "guest" | "host" | "admin" | "support";
export type HostPlan = "standard" | "professional" | "premium";
export type KycStatus = "none" | "pending" | "verified" | "rejected";
export type ReferralTier = "bronze" | "silver" | "gold";
export type AccountStatus = "active" | "suspended" | "deactivated";
export type ListingStatus = "draft" | "pending" | "active" | "inactive" | "rejected" | "archived";
export type AvailabilityBlockSource = "MANUAL" | "APPROVED_HOLD" | "BOOKED";
export type InquiryState =
  | "PENDING"
  | "VIEWED"
  | "RESPONDED"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED"
  | "BOOKED";
export type PaymentState = "UNPAID" | "INITIATED" | "COMPLETED" | "FAILED";
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
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
  createdAt: string;
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
  paymentProofKey?: string | null;
  paymentProofUrl?: string | null;
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

export interface InquiryLedgerEventRecord {
  id: string;
  inquiryId: string;
  event: "INQUIRY_CREATED" | "STATUS_CHANGED" | "PAYMENT_CHANGED";
  fromState?: string | null;
  toState?: string | null;
  actor: "host" | "system" | "guest";
  metadata?: string | null;
  timestamp: string;
}

export interface MessageRecord {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: "checkin" | "checkout" | "payment_info" | "directions" | "house_rules" | null;
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
    monthlyAmount: 399,
    annualAmount: 3990,
    features: ["Premium support", "Featured campaigns", "Priority operations tooling"],
  },
];
