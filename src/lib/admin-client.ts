import { encoreRequest } from './encore-client';
import type { AccountStatus, AdminHostBillingAccount, Booking, Listing, Notification, PlatformSettings, Referral, Review, Subscription } from '@/types';
import { z } from 'zod';
import {
  mapEncoreBooking,
  mapEncoreListing,
  mapEncoreNotification,
  mapEncorePlatformSettings,
  mapEncoreReferralReward,
  mapEncoreReview,
  mapEncoreSubscription,
  mapEncoreUserToProfile,
  parseEncoreBooking,
  parseEncoreListing,
  parseEncoreNotification,
  parseEncorePlatformSettings,
  parseEncoreReferralReward,
  parseEncoreReview,
  parseEncoreSubscription,
  parseEncoreUser,
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
type EncoreHostManagementMode = EncoreUser['managementMode'];
type EncoreKycStatus = EncoreUser['kycStatus'];

export interface AdminCheckout {
  id: string;
  userId: string;
  checkoutType: 'subscription' | 'content_credits' | 'host_billing_setup' | 'managed_hosting';
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
  checkout_type: 'subscription' | 'content_credits' | 'host_billing_setup' | 'managed_hosting';
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

const adminCheckoutSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  checkout_type: z.enum(['subscription', 'content_credits', 'host_billing_setup', 'managed_hosting']),
  provider: z.string().min(1),
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
  currency: z.string().min(1),
  amount: z.number(),
  host_plan: z.enum(['standard', 'professional', 'premium']).nullable().optional(),
  billing_interval: z.enum(['monthly', 'annual']).nullable().optional(),
  credit_quantity: z.number().nullable().optional(),
  provider_checkout_id: z.string().nullable().optional(),
  provider_payment_id: z.string().nullable().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

function parseAdminCheckout(value: unknown): EncoreCheckout {
  const parsed = adminCheckoutSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Admin checkout response was invalid.');
  }
  return parsed.data;
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
  const env = import.meta.env as { DEV?: boolean; VITE_ENABLE_ADMIN_OBSERVABILITY?: string };
  return env.DEV || env.VITE_ENABLE_ADMIN_OBSERVABILITY === 'true';
}

function isEncoreEndpointNotFound(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  try {
    const parsed = JSON.parse(error.message) as { code?: string; message?: string };
    return parsed.code === 'not_found' && parsed.message === 'endpoint not found';
  } catch {
    return false;
  }
}

export async function listAdminUsers() {
  const response = await encoreRequest<{ users: EncoreUser[] }>('/admin/users', {}, { auth: true });
  return response.users.map((user) => mapEncoreUserToProfile(parseEncoreUser(user)));
}

export async function updateAdminUser(params: {
  userId: string;
  displayName?: string;
  role?: EncoreUserRole;
  hostPlan?: EncoreHostPlan;
  managementMode?: EncoreHostManagementMode;
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
  return mapEncoreUserToProfile(parseEncoreUser(response.user));
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
    user: mapEncoreUserToProfile(parseEncoreUser(response.user)),
    notification: response.notification ? mapEncoreNotification(parseEncoreNotification(response.notification)) : null,
  };
}

export async function listAdminListings(): Promise<Listing[]> {
  const response = await encoreRequest<{ listings: EncoreListing[] }>('/listings', {}, { auth: true });
  return response.listings.map((listing) => mapEncoreListing(parseEncoreListing(listing)));
}

export async function listAdminBookings(): Promise<Booking[]> {
  const response = await encoreRequest<{ bookings: EncoreBooking[] }>('/admin/bookings', {}, { auth: true });
  return response.bookings.map((booking) => mapEncoreBooking(parseEncoreBooking(booking)));
}

export async function listAdminReviews(): Promise<Review[]> {
  const response = await encoreRequest<{ reviews: EncoreReview[] }>('/admin/reviews', {}, { auth: true });
  return response.reviews.map((review) => mapEncoreReview(parseEncoreReview(review)));
}

export async function listAdminReferralRewards(): Promise<Referral[]> {
  const response = await encoreRequest<{ rewards: EncoreReferralReward[] }>('/admin/referrals', {}, { auth: true });
  return response.rewards.map((reward) => mapEncoreReferralReward(parseEncoreReferralReward(reward)));
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
  return mapEncoreReferralReward(parseEncoreReferralReward(response.reward));
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
  return response.subscriptions.map((subscription) => mapEncoreSubscription(parseEncoreSubscription(subscription)));
}

export async function cancelAdminSubscription(subscriptionId: string) {
  const response = await encoreRequest<{ subscription: EncoreSubscription }>(
    `/admin/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: 'POST' },
    { auth: true },
  );
  return mapEncoreSubscription(parseEncoreSubscription(response.subscription));
}

export async function upgradeAdminSubscription(params: {
  subscriptionId: string;
  plan: 'standard' | 'professional' | 'premium';
  billingInterval: 'monthly' | 'annual';
}) {
  const response = await encoreRequest<{
    payment: {
      paymentId: string;
      provider: 'yoco';
      providerMode: 'live' | 'test';
      status: 'pending' | 'paid' | 'failed' | 'cancelled';
      redirectUrl: string;
      providerReference: string;
    };
  }>(
    `/admin/subscriptions/${encodeURIComponent(params.subscriptionId)}/upgrade`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return response.payment;
}

export async function listAdminCheckouts(): Promise<AdminCheckout[]> {
  const response = await encoreRequest<{ checkouts: EncoreCheckout[] }>('/admin/checkouts', {}, { auth: true });
  return response.checkouts.map((checkout) => mapCheckout(parseAdminCheckout(checkout)));
}

export async function listAdminHostBillingAccounts(): Promise<AdminHostBillingAccount[]> {
  try {
    const response = await encoreRequest<{ accounts: AdminHostBillingAccount[] }>(
      '/admin/billing/host-accounts',
      {},
      { auth: true },
    );
    return response.accounts;
  } catch (error) {
    if (isEncoreEndpointNotFound(error)) {
      return [];
    }
    throw error;
  }
}

export async function setAdminHostGreylist(params: {
  userId: string;
  greylisted: boolean;
  reason?: string | null;
}) {
  try {
    const response = await encoreRequest<{ account: AdminHostBillingAccount }>(
      '/admin/billing/host-accounts/greylist',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      { auth: true },
    );
    return response.account;
  } catch (error) {
    if (isEncoreEndpointNotFound(error)) {
      throw new Error('The deployed Encore backend does not expose host billing admin endpoints yet.');
    }
    throw error;
  }
}

export async function listAdminNotifications(): Promise<Notification[]> {
  const response = await encoreRequest<{ notifications: EncoreNotification[] }>('/ops/admin/notifications', {}, { auth: true });
  return response.notifications.map((notification) => mapEncoreNotification(parseEncoreNotification(notification)));
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
  return mapEncoreNotification(parseEncoreNotification(response.notification));
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
  return mapEncorePlatformSettings(parseEncorePlatformSettings(response.settings));
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
  return mapEncorePlatformSettings(parseEncorePlatformSettings(response.settings));
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
