export type UserRole = 'host' | 'guest' | 'admin';
export type ReferralTier = 'bronze' | 'silver' | 'gold';
export type KYCStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  emailVerified?: boolean;
  photoURL: string;
  role: UserRole;
  referralCode: string;
  referredBy?: string | null;
  balance: number;
  referralCount: number;
  tier: ReferralTier;
  host_plan?: 'standard' | 'professional' | 'premium';
  kycStatus: KYCStatus;
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
  hostUid: string;
  title: string;
  description: string;
  location: string;
  area: string;
  province: string;
  type: string;
  pricePerNight: number;
  discount: number;
  images: string[];
  video_url: string | null;
  amenities: string[];
  facilities: string[];
  other_facility: string;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  is_self_catering: boolean;
  has_restaurant: boolean;
  restaurant_offers: string[];
  is_occupied: boolean;
  rating: number;
  reviews: number;
  category: string;
  status: 'draft' | 'pending' | 'active' | 'inactive' | 'rejected' | 'archived';
  createdAt: string;
  updatedAt?: string;
  coordinates?: { lat: number; lng: number };
  blockedDates?: string[];
}

export interface Booking {
  id: string;
  listingId: string;
  guestUid: string;
  hostUid: string;
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
  hostUid: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin';
  content: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  referrerUid: string;
  referredUid: string;
  amount: number;
  type: 'signup' | 'booking' | 'subscription';
  program?: 'guest' | 'host';
  status: 'pending' | 'confirmed' | 'rewarded' | 'rejected';
  createdAt: string;
}

export interface Review {
  id: string;
  listingId: string;
  guestUid: string;
  hostUid: string;
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
  hostUid: string;
  plan: 'standard' | 'professional' | 'premium';
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
