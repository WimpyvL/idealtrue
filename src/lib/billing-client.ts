import { encoreRequest } from './encore-client';
import { z } from 'zod';
import type { Listing } from '@/types';
import type { Subscription } from '@/types';
import type { SocialPlatform, SocialTemplateId, SocialTone } from './social-content';
import type { HostBillingAccount } from '@/types';
import { mapEncoreSubscription, parseEncoreSubscription, type EncoreSubscription } from './domain-mappers';

export type HostPlan = 'standard' | 'professional' | 'premium';
export type BillingInterval = 'monthly' | 'annual';

export interface ContentEntitlements {
  plan: HostPlan;
  contentStudioEnabled: boolean;
  includedDraftsPerMonth: number;
  usedDraftsThisMonth: number;
  remainingIncludedDrafts: number;
  creditBalance: number;
  canSchedule: boolean;
}

export interface ContentDraft {
  id: string;
  userId: string;
  listingId: string;
  listingTitle: string;
  listingLocation: string;
  platform: SocialPlatform;
  tone: SocialTone;
  templateId: SocialTemplateId;
  templateName: string;
  status: 'draft' | 'scheduled' | 'published';
  content: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BillingPaymentPurpose = 'subscription' | 'content_credits' | 'host_billing_setup' | 'managed_hosting';

export interface BillingPayment {
  paymentId: string;
  provider: 'yoco';
  providerMode: 'live' | 'test';
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  redirectUrl: string;
  providerReference: string;
}

const billingPaymentSchema = z.object({
  paymentId: z.string().trim().min(1),
  provider: z.literal('yoco'),
  providerMode: z.enum(['live', 'test']),
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
  redirectUrl: z.string().trim().url(),
  providerReference: z.string().trim().min(1),
});

const billingPaymentStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
  purpose: z.enum(['subscription', 'content_credits', 'host_billing_setup', 'managed_hosting']),
  providerMode: z.enum(['live', 'test']),
});

const checkoutStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
  checkoutType: z.enum(['subscription', 'content_credits', 'host_billing_setup', 'managed_hosting']),
});

const billingReturnStatusSchema = z.enum(['success', 'cancelled', 'failed']);

export interface BillingReturnParams {
  billingStatus: 'success' | 'cancelled' | 'failed';
  paymentId: string | null;
  checkoutId: string | null;
}

function parseBillingClientResponse<T>(schema: z.ZodSchema<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(message);
  }
  return parsed.data;
}

// Author: (|/) Klaasvaakie
export function parseBillingReturnParams(searchParams: URLSearchParams): BillingReturnParams | null {
  const status = billingReturnStatusSchema.safeParse(searchParams.get('billing_status'));
  if (!status.success) {
    return null;
  }

  const paymentId = searchParams.get('payment_id')?.trim() || null;
  const checkoutId = searchParams.get('checkout_id')?.trim() || null;
  if (!paymentId && !checkoutId) {
    return null;
  }

  return {
    billingStatus: status.data,
    paymentId,
    checkoutId,
  };
}

export async function startBillingPayment(params:
  | { purpose: 'subscription'; plan: HostPlan; billingInterval: BillingInterval }
  | { purpose: 'content_credits'; credits: number }
  | { purpose: 'host_billing_setup' }
  | { purpose: 'managed_hosting' }
) {
  const response = await encoreRequest<unknown>(
    '/billing/payments',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return parseBillingClientResponse(billingPaymentSchema, response, 'Billing payment response was invalid.');
}

export async function getContentEntitlements() {
  const response = await encoreRequest<{ entitlements: ContentEntitlements }>(
    '/billing/content/entitlements',
    {},
    { auth: true },
  );
  return response.entitlements;
}

export async function generateContentDraft(
  listing: Listing,
  platform: SocialPlatform,
  tone: SocialTone,
  templateId: SocialTemplateId,
  options?: {
    includePrice?: boolean;
    includeSpecialOffer?: boolean;
    customHeadline?: string;
  },
) {
  const response = await encoreRequest<{ draft: ContentDraft; entitlements: ContentEntitlements }>(
    '/billing/content/drafts/generate',
    {
      method: 'POST',
      body: JSON.stringify({
        listingId: listing.id,
        platform,
        tone,
        templateId,
        includePrice: options?.includePrice ?? true,
        includeSpecialOffer: options?.includeSpecialOffer ?? false,
        customHeadline: options?.customHeadline ?? '',
      }),
    },
    { auth: true },
  );
  return response;
}

export async function listContentDrafts() {
  const response = await encoreRequest<{ drafts: ContentDraft[] }>(
    '/billing/content/drafts',
    {},
    { auth: true },
  );
  return response.drafts;
}

export async function updateContentDraft(params: {
  draftId: string;
  content?: string;
  status?: ContentDraft['status'];
  scheduledFor?: string | null;
}) {
  const response = await encoreRequest<{ draft: ContentDraft }>(
    `/billing/content/drafts/${encodeURIComponent(params.draftId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return response.draft;
}

export async function getCheckoutStatus(checkoutId: string) {
  const response = await encoreRequest<unknown>(
    `/billing/checkouts/${encodeURIComponent(checkoutId)}`,
    {},
    { auth: true },
  );
  return parseBillingClientResponse(checkoutStatusSchema, response, 'Billing checkout status response was invalid.');
}

export async function getBillingPaymentStatus(paymentId: string, billingStatus?: string | null) {
  const query = billingStatus ? `?billingStatus=${encodeURIComponent(billingStatus)}` : '';
  const response = await encoreRequest<unknown>(
    `/billing/payments/${encodeURIComponent(paymentId)}${query}`,
    {},
    { auth: true },
  );
  return parseBillingClientResponse(billingPaymentStatusSchema, response, 'Billing payment status response was invalid.');
}

export async function getMyHostBillingAccount() {
  const response = await encoreRequest<{ account: HostBillingAccount }>(
    '/billing/host/account',
    {},
    { auth: true },
  );
  return response.account;
}

// Author: (|╲) Klaasvaakie
export async function listMySubscriptions(): Promise<Subscription[]> {
  const response = await encoreRequest<{ subscriptions: EncoreSubscription[] }>(
    '/billing/subscriptions',
    {},
    { auth: true },
  );
  return response.subscriptions.map((subscription) => mapEncoreSubscription(parseEncoreSubscription(subscription)));
}

export async function createManagedHostingCheckout() {
  return startBillingPayment({ purpose: 'managed_hosting' });
}

export async function redeemHostVoucher(code: string) {
  const response = await encoreRequest<{ account: HostBillingAccount }>(
    '/billing/host/vouchers/redeem',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    },
    { auth: true },
  );
  return response.account;
}
