import { encoreRequest, setEncoreSessionToken } from './encore-client';
import type { UserProfile } from '@/types';

type EncoreUserRole = 'guest' | 'host' | 'admin';
type EncoreHostPlan = 'standard' | 'professional' | 'premium';
type EncoreKycStatus = 'none' | 'pending' | 'verified' | 'rejected';
type EncoreReferralTier = 'bronze' | 'silver' | 'gold';

interface EncoreUser {
  id: string;
  email: string;
  emailVerified: boolean;
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

interface EncoreLeaderboardUser {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  tier: EncoreReferralTier;
  referralCount: number;
}

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL: string;
  tier: EncoreReferralTier;
  referralCount: number;
}

interface SignupParams {
  email: string;
  displayName: string;
  password: string;
  photoUrl?: string | null;
  role?: EncoreUserRole;
  referredByCode?: string | null;
}

interface LoginParams {
  email: string;
  password: string;
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
    emailVerified: user.emailVerified,
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

async function storeSessionResponse(response: { token: string; user: EncoreUser }) {
  setEncoreSessionToken(response.token);
  return mapEncoreUserToProfile(response.user);
}

export async function signUpWithPassword(params: SignupParams) {
  const response = await encoreRequest<{ token: string; user: EncoreUser }>(
    '/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        displayName: params.displayName,
        password: params.password,
        photoUrl: params.photoUrl,
        role: params.role || 'guest',
        referredByCode: params.referredByCode,
      }),
    },
  );

  return storeSessionResponse(response);
}

export async function signInWithPassword(params: LoginParams) {
  const response = await encoreRequest<{ token: string; user: EncoreUser }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );

  return storeSessionResponse(response);
}

export async function requestPasswordReset(email: string) {
  return encoreRequest<{ ok: true }>(
    '/auth/request-password-reset',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  );
}

export async function resetPasswordWithToken(params: { token: string; password: string }) {
  return encoreRequest<{ ok: true }>(
    '/auth/reset-password',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );
}

export async function requestEmailVerification() {
  return encoreRequest<{ ok: true }>(
    '/auth/request-email-verification',
    {
      method: 'POST',
    },
    { auth: true },
  );
}

export async function verifyEmailToken(token: string) {
  return encoreRequest<{ ok: true }>(
    '/auth/verify-email',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );
}

export async function getEncoreSessionProfile() {
  const response = await encoreRequest<{ token?: string; user: EncoreUser }>('/auth/session', {}, { auth: true });
  if (response.token) {
    setEncoreSessionToken(response.token);
  }
  return mapEncoreUserToProfile(response.user);
}

export async function updateEncoreProfile(params: UpdateEncoreProfileParams) {
  const response = await encoreRequest<{ token?: string; user: EncoreUser }>(
    '/users/me',
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  if (response.token) {
    setEncoreSessionToken(response.token);
  }

  return mapEncoreUserToProfile(response.user);
}

export async function listReferralLeaderboard() {
  const response = await encoreRequest<{ users: EncoreLeaderboardUser[] }>('/users/leaderboard/referrals');
  return response.users.map((user): LeaderboardUser => ({
    uid: user.id,
    displayName: user.displayName,
    photoURL: user.photoUrl || '',
    tier: user.tier,
    referralCount: user.referralCount,
  }));
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
