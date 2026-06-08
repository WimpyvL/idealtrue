import { encoreRequest } from './encore-client';
import type { UserProfile } from '@/types';
import {
  mapEncoreLeaderboardUser,
  mapEncoreUserToProfile,
  parseEncoreLeaderboardUser,
  parseEncoreUser,
  type EncoreLeaderboardUser,
  type EncoreUser,
  type LeaderboardUser,
} from './domain-mappers';
import { serializeImageFile } from './media-client';

export type { LeaderboardUser } from './domain-mappers';

type EncoreUserRole = EncoreUser['role'];
type EncoreHostPlan = EncoreUser['hostPlan'];
type EncoreKycStatus = EncoreUser['kycStatus'];
type EncoreHostManagementMode = EncoreUser['managementMode'];
export type VerificationEmailStatus = 'sent' | 'failed';
export type VoucherEmailStatus = 'not_applicable' | 'sent' | 'failed';

interface SignupParams {
  email: string;
  displayName: string;
  password: string;
  photoUrl?: string | null;
  role?: EncoreUserRole;
  managementMode?: EncoreHostManagementMode;
  referredByCode?: string | null;
}

interface SignupResponse {
  user: EncoreUser;
  verificationEmailStatus?: VerificationEmailStatus;
}

interface LoginParams {
  email: string;
  password: string;
}

interface GoogleAuthParams {
  credential: string;
  role?: EncoreUserRole;
  managementMode?: EncoreHostManagementMode;
  referredByCode?: string | null;
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

async function storeSessionResponse(response: { user: EncoreUser }) {
  return mapEncoreUserToProfile(parseEncoreUser(response.user));
}

export async function signUpWithPassword(params: SignupParams) {
  const response = await encoreRequest<SignupResponse>(
    '/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        displayName: params.displayName,
        password: params.password,
        photoUrl: params.photoUrl,
        role: params.role || 'guest',
        managementMode: params.managementMode,
        referredByCode: params.referredByCode,
      }),
    },
  );

  return {
    profile: await storeSessionResponse(response),
    verificationEmailStatus: response.verificationEmailStatus ?? 'sent',
  };
}

export async function signInWithPassword(params: LoginParams) {
  const response = await encoreRequest<{ user: EncoreUser }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );

  return storeSessionResponse(response);
}

export async function signInWithGoogle(params: GoogleAuthParams) {
  const response = await encoreRequest<{ user: EncoreUser }>(
    '/auth/google',
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
  return encoreRequest<{ ok: true; voucherEmailStatus?: VoucherEmailStatus; voucherCodeAssigned?: boolean }>(
    '/auth/verify-email',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );
}

export async function getEncoreSessionProfile() {
  const response = await encoreRequest<{ user: EncoreUser }>('/auth/session', {}, { auth: true });
  return mapEncoreUserToProfile(parseEncoreUser(response.user));
}

export async function updateEncoreProfile(params: UpdateEncoreProfileParams): Promise<UserProfile> {
  const response = await encoreRequest<{ user: EncoreUser }>(
    '/users/me',
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapEncoreUserToProfile(parseEncoreUser(response.user));
}

export async function listReferralLeaderboard(): Promise<LeaderboardUser[]> {
  const response = await encoreRequest<{ users: EncoreLeaderboardUser[] }>('/users/leaderboard/referrals');
  return response.users.map((user) => mapEncoreLeaderboardUser(parseEncoreLeaderboardUser(user)));
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
  return mapEncoreUserToProfile(parseEncoreUser(response.user));
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

export async function uploadProfilePhoto(file: File) {
  const serialized = await serializeImageFile(file, {
    maxDimension: 1200,
    maxBytes: 450 * 1024,
    fallbackName: 'profile-photo',
  });

  const response = await encoreRequest<{ photoUrl: string }>(
    '/users/me/photo',
    {
      method: 'POST',
      body: JSON.stringify(serialized),
    },
    { auth: true },
  );

  return response.photoUrl;
}
