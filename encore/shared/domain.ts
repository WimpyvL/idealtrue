export type UserRole = "guest" | "host" | "admin" | "support";
export type HostPlan = "standard" | "professional" | "premium";
export type KycStatus = "none" | "pending" | "verified" | "rejected";
export type ReferralTier = "bronze" | "silver" | "gold";
export type ListingStatus = "draft" | "pending" | "active" | "inactive" | "rejected" | "archived";
export type BookingStatus =
  | "pending"
  | "awaiting_guest_payment"
  | "payment_submitted"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "declined";
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
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
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
  status: BookingStatus;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
      type: "booking.requested" | "booking.confirmed" | "booking.cancelled";
      aggregateId: string;
      actorId: string;
      occurredAt: string;
      payload: { listingId: string; guestId: string; hostId: string; status: BookingStatus };
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
    features: ["Verified host badge", "Video slot", "Content studio access"],
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
