import { encoreRequest, syncEncoreSession } from './encore-client';
import type { UserProfile } from '@/types';

type EncoreUserRole = 'guest' | 'host' | 'admin';
type EncoreHostPlan = 'free' | 'standard' | 'professional' | 'premium';
type EncoreKycStatus = 'none' | 'pending' | 'verified' | 'rejected';
type EncoreReferralTier = 'bronze' | 'silver' | 'gold';

interface EncoreUser {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string | null;
  role: EncoreUserRole;
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

interface EnsureEncoreProfileParams {
  email: string;
  displayName: string;
  photoUrl?: string | null;
  role?: EncoreUserRole;
  referredByCode?: string | null;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
}

interface UpdateEncoreProfileParams {
  displayName?: string;
  photoUrl?: string | null;
  role?: EncoreUserRole;
  hostPlan?: EncoreHostPlan;
  kycStatus?: EncoreKycStatus;
  referredByCode?: string | null;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
}

function mapEncoreUserToProfile(user: EncoreUser): UserProfile {
  return {
    uid: user.id,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoUrl || '',
    role: user.role,
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

export async function ensureEncoreProfile(params: EnsureEncoreProfileParams) {
  const response = await syncEncoreSession({
    email: params.email,
    displayName: params.displayName,
    photoUrl: params.photoUrl,
    role: params.role || 'guest',
    referredByCode: params.referredByCode,
  });

  return mapEncoreUserToProfile(response.user as EncoreUser);
}

export async function getEncoreSessionProfile() {
  const response = await encoreRequest<{ user: EncoreUser }>('/auth/session', {}, { auth: true });
  return mapEncoreUserToProfile(response.user);
}

export async function updateEncoreProfile(params: UpdateEncoreProfileParams) {
  const response = await encoreRequest<{ user: EncoreUser }>(
    '/users/me',
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapEncoreUserToProfile(response.user);
}

export async function listReferralLeaderboard() {
  const response = await encoreRequest<{ users: EncoreUser[] }>('/users/leaderboard/referrals');
  return response.users.map(mapEncoreUserToProfile);
}

export async function setUserKycStatus(params: { userId: string; kycStatus: EncoreKycStatus }) {
  const response = await encoreRequest<{ user: EncoreUser }>(
    '/admin/users/kyc-status',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapEncoreUserToProfile(response.user);
}

export async function requestProfilePhotoUpload(filename: string) {
  return encoreRequest<{ objectKey: string; uploadUrl: string; publicUrl: string }>(
    '/users/me/photo/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({ filename }),
    },
    { auth: true },
  );
}
