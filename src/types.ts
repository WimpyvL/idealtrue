export type UserRole = 'host' | 'guest' | 'admin' | 'support';
export type ReferralTier = 'bronze' | 'silver' | 'gold';
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type HostPlan = 'standard' | 'professional' | 'premium';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  emailVerified?: boolean;
  photoUrl: string;
  role: UserRole;
  isAdmin?: boolean;
  referralCode: string;
  referredByCode?: string | null;
  accountStatus: AccountStatus;
  accountStatusReason?: string | null;
  accountStatusChangedAt?: string | null;
  accountStatusChangedBy?: string | null;
  balance: number;
  referralCount: number;
  tier: ReferralTier;
  hostPlan?: HostPlan;
  kycStatus: KycStatus;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
  kycData?: {
    idNumber: string;
    idType: 'id_card' | 'passport' | 'drivers_license';
    idImage: string;
    selfieImage: string;
    submittedAt: string;
  };
  createdAt: string;
}

export interface Listing {
  id: string;
  hostId: string;
  title: string;
  description: string;
  location: string;
  area: string;
  province: string;
  type: string;
  pricePerNight: number;
  discount: number;
  breakageDeposit?: number | null;
  images: string[];
  videoUrl: string | null;
  amenities: string[];
  facilities: string[];
  otherFacility: string;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  isSelfCatering: boolean;
  hasRestaurant: boolean;
  restaurantOffers: string[];
  isOccupied: boolean;
  rating: number;
  reviews: number;
  category: string;
  status: 'draft' | 'pending' | 'active' | 'inactive' | 'rejected' | 'archived';
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  coordinates?: { lat: number; lng: number };
  blockedDates?: string[];
}

export interface Booking {
  id: string;
  listingId: string;
  guestId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  guests: {
    adults: number;
    children: number;
  };
  status: 'pending' | 'awaiting_guest_payment' | 'payment_submitted' | 'confirmed' | 'cancelled' | 'completed' | 'declined';
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  paymentSubmittedAt?: string | null;
  paymentConfirmedAt?: string | null;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  listingId: string;
  hostId: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin';
  content: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  amount: number;
  trigger: 'signup' | 'booking' | 'subscription';
  program?: 'guest' | 'host';
  status: 'pending' | 'confirmed' | 'rewarded' | 'rejected';
  createdAt: string;
}

export interface Review {
  id: string;
  listingId: string;
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

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  target: string;
  actionPath?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface PlatformSettings {
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

export interface Subscription {
  id: string;
  userId: string;
  plan: HostPlan;
  amount: number;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: 'checkin' | 'checkout' | 'payment_info' | 'directions' | 'house_rules';
  attachmentUrl?: string;
  createdAt: string;
}
