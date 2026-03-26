import { encoreRequest } from './encore-client';
import type { Listing } from '@/types';

export type HostPlan = 'free' | 'standard' | 'professional' | 'premium';
export type BillingInterval = 'monthly' | 'annual';
export type SocialPlatform = 'instagram' | 'facebook' | 'twitter' | 'linkedin';
export type SocialTone = 'professional' | 'friendly' | 'adventurous' | 'luxurious' | 'urgent';

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
  status: 'draft' | 'scheduled' | 'published';
  content: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createSubscriptionCheckout(plan: HostPlan, billingInterval: BillingInterval) {
  return encoreRequest<{ checkoutId: string; redirectUrl: string }>(
    '/billing/subscriptions/checkout',
    {
      method: 'POST',
      body: JSON.stringify({ plan, billingInterval }),
    },
    { auth: true },
  );
}

export async function downgradeHostPlanToFree() {
  return encoreRequest<{ downgraded: true }>(
    '/billing/subscriptions/free',
    {
      method: 'POST',
    },
    { auth: true },
  );
}

export async function getContentEntitlements() {
  const response = await encoreRequest<{ entitlements: ContentEntitlements }>(
    '/billing/content/entitlements',
    {},
    { auth: true },
  );
  return response.entitlements;
}

export async function createContentCreditsCheckout(credits: number) {
  return encoreRequest<{ checkoutId: string; redirectUrl: string }>(
    '/billing/content/credits/checkout',
    {
      method: 'POST',
      body: JSON.stringify({ credits }),
    },
    { auth: true },
  );
}

export async function generateContentDraft(listing: Listing, platform: SocialPlatform, tone: SocialTone) {
  const response = await encoreRequest<{ draft: ContentDraft; entitlements: ContentEntitlements }>(
    '/billing/content/drafts/generate',
    {
      method: 'POST',
      body: JSON.stringify({
        listingId: listing.id,
        platform,
        tone,
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
  return encoreRequest<{ status: 'pending' | 'paid' | 'failed' | 'cancelled'; checkoutType: 'subscription' | 'content_credits' }>(
    `/billing/checkouts/${encodeURIComponent(checkoutId)}`,
    {},
    { auth: true },
  );
}
