import { encoreRequest } from './encore-client';
import type { AccountStatus, AdminHostBillingAccount, Booking, Listing, Notification, PlatformSettings, Referral, Review, Subscription, UserProfile } from '@/types';
import {
  mapEncoreBooking,
  mapEncoreListing,
  mapEncoreNotification,
  mapEncorePlatformSettings,
  mapEncoreReferralReward,
  mapEncoreReview,
  mapEncoreSubscription,
  mapEncoreUserToProfile,
  type EncoreBooking,
  type EncoreListing,
  type EncoreNotification,
  type EncorePlatformSettings,
  type EncoreReferralReward,
  type EncoreReview,
  type EncoreSubscription,
  type EncoreUser,
} from './domain-mappers';

type EncoreReferralTier = EncoreUser['tier'];
type EncoreUserRole = EncoreUser['role'];
type EncoreHostPlan = EncoreUser['hostPlan'];
type EncoreKycStatus = EncoreUser['kycStatus'];

export interface AdminCheckout {
  id: string;
  userId: string;
  checkoutType: 'subscription' | 'content_credits';
  provider: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  currency: string;
  amount: number;
  hostPlan?: 'standard' | 'professional' | 'premium' | null;
  billingInterval?: 'monthly' | 'annual' | null;
  creditQuantity?: number | null;
  providerCheckoutId?: string | null;
  providerPaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminObservabilityDatabase {
  name: string;
  healthy: boolean;
  latencyMs: number;
}

export interface AdminObservabilitySnapshot {
  checkedAt: string;
  backendStartedAt: string;
  uptimeSeconds: number;
  averageDbPingMs: number;
  healthyDatabases: number;
  totalDatabases: number;
  databases: AdminObservabilityDatabase[];
  encoreCloudTracingAvailable: boolean;
  encoreCloudMetricsAvailable: boolean;
  encoreCloudLogsAvailable: boolean;
}

interface EncoreCheckout {
  id: string;
  user_id: string;
  checkout_type: 'subscription' | 'content_credits';
  provider: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  currency: string;
  amount: number;
  host_plan?: 'standard' | 'professional' | 'premium' | null;
  billing_interval?: 'monthly' | 'annual' | null;
  credit_quantity?: number | null;
  provider_checkout_id?: string | null;
  provider_payment_id?: string | null;
  created_at: string;
  updated_at: string;
}

function mapCheckout(checkout: EncoreCheckout): AdminCheckout {
  return {
    id: checkout.id,
    userId: checkout.user_id,
    checkoutType: checkout.checkout_type,
    provider: checkout.provider,
    status: checkout.status,
    currency: checkout.currency,
    amount: checkout.amount,
    hostPlan: checkout.host_plan ?? null,
    billingInterval: checkout.billing_interval ?? null,
    creditQuantity: checkout.credit_quantity ?? null,
    providerCheckoutId: checkout.provider_checkout_id ?? null,
    providerPaymentId: checkout.provider_payment_id ?? null,
    createdAt: checkout.created_at,
    updatedAt: checkout.updated_at,
  };
}

function isAdminObservabilityEnabled() {
  const env = (import.meta as any).env ?? {};
  return env.DEV || env.VITE_ENABLE_ADMIN_OBSERVABILITY === 'true';
}

export async function listAdminUsers() {
  const response = await encoreRequest<{ users: EncoreUser[] }>('/admin/users', {}, { auth: true });
  return response.users.map(mapEncoreUserToProfile);
}

export async function updateAdminUser(params: {
  userId: string;
  displayName?: string;
  role?: EncoreUserRole;
  hostPlan?: EncoreHostPlan;
  kycStatus?: EncoreKycStatus;
  balance?: number;
  tier?: EncoreReferralTier;
}) {
  const response = await encoreRequest<{ user: EncoreUser }>(
    `/admin/users/${encodeURIComponent(params.userId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapEncoreUserToProfile(response.user);
}

export async function deleteAdminUser(userId: string) {
  await encoreRequest<{ deleted: true }>(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function setAdminUserAccountStatus(params: {
  userId: string;
  accountStatus: AccountStatus;
  reason?: string | null;
}) {
  const response = await encoreRequest<{ user: EncoreUser; notification?: EncoreNotification | null }>(
    '/admin/users/account-status',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return {
    user: mapEncoreUserToProfile(response.user),
    notification: response.notification ? mapEncoreNotification(response.notification) : null,
  };
}

export async function listAdminListings(): Promise<Listing[]> {
  const response = await encoreRequest<{ listings: EncoreListing[] }>('/listings', {}, { auth: true });
  return response.listings.map(mapEncoreListing);
}

export async function listAdminBookings(): Promise<Booking[]> {
  const response = await encoreRequest<{ bookings: EncoreBooking[] }>('/admin/bookings', {}, { auth: true });
  return response.bookings.map(mapEncoreBooking);
}

export async function listAdminReviews(): Promise<Review[]> {
  const response = await encoreRequest<{ reviews: EncoreReview[] }>('/admin/reviews', {}, { auth: true });
  return response.reviews.map(mapEncoreReview);
}

export async function listAdminReferralRewards(): Promise<Referral[]> {
  const response = await encoreRequest<{ rewards: EncoreReferralReward[] }>('/admin/referrals', {}, { auth: true });
  return response.rewards.map(mapEncoreReferralReward);
}

export async function createAdminReferralReward(params: {
  referrerId: string;
  referredUserId: string;
  trigger: 'signup' | 'booking' | 'subscription';
  program: 'guest' | 'host';
  amount: number;
}) {
  const response = await encoreRequest<{ reward: EncoreReferralReward }>(
    '/admin/referrals',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapEncoreReferralReward(response.reward);
}

export async function deleteAdminReferralReward(referralId: string) {
  await encoreRequest<{ deleted: true }>(
    `/admin/referrals/${encodeURIComponent(referralId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function listAdminSubscriptions(): Promise<Subscription[]> {
  const response = await encoreRequest<{ subscriptions: EncoreSubscription[] }>('/admin/subscriptions', {}, { auth: true });
  return response.subscriptions.map(mapEncoreSubscription);
}

export async function listAdminCheckouts(): Promise<AdminCheckout[]> {
  const response = await encoreRequest<{ checkouts: EncoreCheckout[] }>('/admin/checkouts', {}, { auth: true });
  return response.checkouts.map(mapCheckout);
}

export async function listAdminHostBillingAccounts(): Promise<AdminHostBillingAccount[]> {
  const response = await encoreRequest<{ accounts: AdminHostBillingAccount[] }>(
    '/admin/billing/host-accounts',
    {},
    { auth: true },
  );
  return response.accounts;
}

export async function setAdminHostGreylist(params: {
  userId: string;
  greylisted: boolean;
  reason?: string | null;
}) {
  const response = await encoreRequest<{ account: AdminHostBillingAccount }>(
    '/admin/billing/host-accounts/greylist',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return response.account;
}

export async function listAdminNotifications(): Promise<Notification[]> {
  const response = await encoreRequest<{ notifications: EncoreNotification[] }>('/ops/admin/notifications', {}, { auth: true });
  return response.notifications.map(mapEncoreNotification);
}

export async function createAdminNotification(params: {
  title: string;
  message: string;
  type: Notification['type'];
  target: string;
  actionPath?: string | null;
}) {
  const response = await encoreRequest<{ notification: EncoreNotification }>(
    '/ops/admin/notifications',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapEncoreNotification(response.notification);
}

export async function deleteAdminNotification(notificationId: string) {
  await encoreRequest<{ deleted: true }>(
    `/ops/admin/notifications/${encodeURIComponent(notificationId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function getAdminPlatformSettings(): Promise<PlatformSettings> {
  const response = await encoreRequest<{ settings: EncorePlatformSettings }>('/ops/admin/settings', {}, { auth: true });
  return mapEncorePlatformSettings(response.settings);
}

export async function updateAdminPlatformSettings(params: Partial<PlatformSettings>) {
  const response = await encoreRequest<{ settings: EncorePlatformSettings }>(
    '/ops/admin/settings',
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return mapEncorePlatformSettings(response.settings);
}

export async function deleteAdminReview(reviewId: string) {
  await encoreRequest<{ deleted: true }>(
    `/admin/reviews/${encodeURIComponent(reviewId)}`,
    { method: 'DELETE' },
    { auth: true },
  );
}

export async function getAdminObservability(): Promise<AdminObservabilitySnapshot | null> {
  if (!isAdminObservabilityEnabled()) {
    return null;
  }

  const response = await encoreRequest<{ snapshot: AdminObservabilitySnapshot }>(
    '/ops/admin/observability',
    {},
    { auth: true },
  );
  return response.snapshot;
}
