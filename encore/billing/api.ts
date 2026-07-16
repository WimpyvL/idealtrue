import { api, APIError } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { billingDB } from "./db";
import { generateListingDraftWithFallback } from "./gemini";
import { classifyYocoWebhookOutcome, resolveYocoWebhookCheckoutId } from "./webhook-classification";
import { buildBillingPaymentReturnUrl, buildBillingSuccessReturnUrl, buildPricingPaymentReturnUrl } from "./payment-return";
import { toMinorUnits } from "./pricing";
import { catalogDB } from "../catalog/db";
import { identityDB } from "../identity/db";
import {
  notifyCheckoutStatusChanged,
  notifyContentCreditsPurchased,
  notifySubscriptionActivated,
  notifySubscriptionDeactivated,
  notifySubscriptionGracePeriodStarted,
  notifySubscriptionRenewalDue,
} from "../ops/notifications";
import { requireAuth, requireRole } from "../shared/auth";
import { HOST_PLANS, HostPlan, SubscriptionPlan } from "../shared/domain";
import { platformEvents } from "../analytics/events";
import {
  createYocoCheckout,
  fetchYocoCheckout,
  fetchYocoOrder,
  getAppUrl,
  verifyYocoWebhookSignature,
  type YocoWebhookEvent,
} from "./yoco";
import { billingWebhookEvents } from "./webhook-events";
import { rewardSubscriptionReferralConversion } from "../referrals/api";
import {
  deactivatePaidBillingAccount,
  getHostBillingAccount,
  listAdminHostBillingAccounts,
  markHostBillingSetupComplete,
  redeemHostVoucher,
  setHostGreylist,
  syncPaidBillingAccount,
  type AdminHostBillingAccount,
  type HostBillingAccount,
} from "./host-billing-service";
import {
  getSocialTemplateDefinition,
  type ListingSnapshot,
  normalizeDraftOptions,
  type SocialPlatform,
  type SocialTemplateId,
  type SocialTone,
} from "./social-templates";
import {
  CONTENT_LIMITS,
  getContentCreditPrice,
  resolveContentDraftDebit,
} from "./content-entitlements";

type BillingInterval = "monthly" | "annual";
type ContentDraftStatus = "draft" | "scheduled" | "published";
type CheckoutType = "subscription" | "content_credits" | "host_billing_setup" | "managed_hosting";
type CheckoutStatus = "pending" | "paid" | "failed" | "cancelled";

interface CreateBillingPaymentParams {
  purpose: CheckoutType;
  plan?: HostPlan;
  billingInterval?: BillingInterval;
  credits?: number;
}

interface RedeemHostVoucherParams {
  code: string;
}

interface AdminSetHostGreylistParams {
  userId: string;
  greylisted: boolean;
  reason?: string | null;
}

interface GenerateContentDraftParams {
  listingId: string;
  platform: SocialPlatform;
  tone: SocialTone;
  templateId: SocialTemplateId;
  includePrice?: boolean;
  includeSpecialOffer?: boolean;
  customHeadline?: string;
}

interface UpdateContentDraftParams {
  draftId: string;
  content?: string;
  status?: ContentDraftStatus;
  scheduledFor?: string | null;
}

interface ContentEntitlements {
  plan: HostPlan;
  contentStudioEnabled: boolean;
  includedDraftsPerMonth: number;
  usedDraftsThisMonth: number;
  remainingIncludedDrafts: number;
  creditBalance: number;
  canSchedule: boolean;
}

interface ContentDraftRecord {
  id: string;
  userId: string;
  listingId: string;
  listingTitle: string;
  listingLocation: string;
  platform: SocialPlatform;
  tone: SocialTone;
  templateId: SocialTemplateId;
  templateName: string;
  status: ContentDraftStatus;
  content: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

type SubscriptionRow = {
  id: string;
  user_id: string;
  checkout_session_id: string | null;
  plan: HostPlan;
  status: "active" | "grace_period" | "expired" | "cancelled";
  amount: number;
  billing_interval: BillingInterval;
  starts_at: string;
  ends_at: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  pending_plan: HostPlan | null;
  pending_billing_interval: BillingInterval | null;
  pending_change_effective_at: string | null;
  grace_ends_at: string | null;
  renewal_due_notified_at: string | null;
  grace_started_notified_at: string | null;
  deactivated_notified_at: string | null;
  created_at: string;
};

type UserPlanRow = {
  id: string;
  role: "guest" | "host" | "admin" | "support";
  host_plan: HostPlan;
};

type WalletRow = {
  user_id: string;
  balance: number;
  updated_at: string;
};

type DraftRow = {
  id: string;
  user_id: string;
  listing_id: string;
  listing_title: string;
  listing_location: string;
  platform: SocialPlatform;
  tone: SocialTone;
  template_id: SocialTemplateId;
  template_name: string;
  status: ContentDraftStatus;
  content: string;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type CatalogListingRow = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  location: string;
  area: string | null;
  province: string | null;
  price_per_night: number;
  discount_percent: number;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  facilities: string[];
  type: string;
};

type CheckoutSessionRow = {
  id: string;
  user_id: string;
  checkout_type: CheckoutType;
  provider: string;
  status: CheckoutStatus;
  currency: string;
  amount: number;
  host_plan: HostPlan | null;
  billing_interval: BillingInterval | null;
  credit_quantity: number | null;
  provider_checkout_id: string | null;
  provider_payment_id: string | null;
  provider_mode: string | null;
  redirect_url: string | null;
  success_url: string | null;
  cancel_url: string | null;
  failure_url: string | null;
  metadata: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentIntentRow = {
  id: string;
  user_id: string;
  purpose: CheckoutType;
  provider: string;
  provider_mode: "live" | "test";
  status: CheckoutStatus;
  currency: string;
  amount: number;
  host_plan: HostPlan | null;
  billing_interval: BillingInterval | null;
  credit_quantity: number | null;
  provider_payment_link_id: string | null;
  provider_checkout_id: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  redirect_url: string | null;
  customer_reference: string;
  customer_description: string | null;
  metadata: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type FulfillableBillingSession = {
  id: string;
  user_id: string;
  type: CheckoutType;
  status: CheckoutStatus;
  amount: number;
  host_plan: HostPlan | null;
  billing_interval: BillingInterval | null;
  credit_quantity: number | null;
};

type WebhookEventRow = {
  id: string;
};

type StoredBillingWebhookEventRow = {
  id: string;
  event_type: string;
  payload_json: string;
  processed_at: string | null;
};

type AdminSubscriptionUpgradePayment = {
  paymentId: string;
  provider: "yoco";
  providerMode: "live" | "test";
  status: CheckoutStatus;
  redirectUrl: string;
  providerReference: string;
};

type SubscriptionChangeResponse = {
  payment?: AdminSubscriptionUpgradePayment;
  subscription?: SubscriptionRow;
  changeType: "upgrade" | "downgrade";
  effectiveAt?: string | null;
  proratedAmount?: number | null;
};

type StoredWebhookEventRow = {
  event_type: string;
  payload_json: string;
};

type QueryExecutor = Pick<typeof billingDB, "queryRow" | "queryAll" | "exec">;

const CONTENT_DRAFT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const CONTENT_DRAFT_RATE_LIMIT_MAX = 5;
const HOST_BILLING_SETUP_AMOUNT = 2;
const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;
const SUBSCRIPTION_RENEWAL_NOTICE_DAYS = 7;
const contentDraftRateLimitStore = new Map<string, number[]>();

function getCreditPrice(credits: number) {
  const amount = getContentCreditPrice(credits);
  if (amount === null) {
    throw APIError.invalidArgument("Unsupported credit top-up size.");
  }
  return amount;
}

function getSubscriptionDefinition(plan: HostPlan) {
  const definition = HOST_PLANS.find((item) => item.id === plan);
  if (!definition) {
    throw APIError.invalidArgument("Unknown subscription plan.");
  }
  return definition;
}

function getPlanAmount(plan: HostPlan, billingInterval: BillingInterval) {
  const definition = getSubscriptionDefinition(plan);
  return billingInterval === "monthly" ? definition.monthlyAmount : definition.annualAmount;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function compareSubscriptionPlans(subscription: SubscriptionRow, targetPlan: HostPlan, targetInterval: BillingInterval) {
  const currentAmount = getPlanAmount(subscription.plan, subscription.billing_interval);
  const targetAmount = getPlanAmount(targetPlan, targetInterval);
  if (targetAmount > currentAmount) {
    return "upgrade" as const;
  }
  if (targetAmount < currentAmount) {
    return "downgrade" as const;
  }
  return "same" as const;
}

function calculateProratedUpgradeAmount(subscription: SubscriptionRow, targetPlan: HostPlan, targetInterval: BillingInterval, now = new Date()) {
  const currentAmount = getPlanAmount(subscription.plan, subscription.billing_interval);
  const targetAmount = getPlanAmount(targetPlan, targetInterval);
  const planDifference = targetAmount - currentAmount;
  if (planDifference <= 0) {
    return 0;
  }

  const startsAt = new Date(subscription.starts_at).getTime();
  const endsAt = new Date(subscription.ends_at).getTime();
  const totalMs = Math.max(1, endsAt - startsAt);
  const remainingMs = Math.max(0, endsAt - now.getTime());
  const remainingRatio = clampRatio(remainingMs / totalMs);
  const upgradeAmount = Math.ceil(remainingRatio * planDifference);
  return Math.max(0, upgradeAmount);
}

function buildBillingUrls(kind: CheckoutType, id: string) {
  const base = getAppUrl();
  const root =
    kind === "subscription"
      ? "/pricing"
      : kind === "content_credits"
        ? "/host/social"
        : "/account";
  const searchParams = new URLSearchParams({
    billing_status: "success",
    checkout_id: id,
  });
  if (kind === "host_billing_setup") {
    searchParams.set("billing_context", "host_card_setup");
  }

  const successUrl = `${base}${root}?${searchParams.toString()}`;
  searchParams.set("billing_status", "cancelled");
  const cancelUrl = `${base}${root}?${searchParams.toString()}`;
  searchParams.set("billing_status", "failed");
  const failureUrl = `${base}${root}?${searchParams.toString()}`;

  return {
    successUrl,
    cancelUrl,
    failureUrl,
  };
}

async function getOwnedListingSnapshot(listingId: string, userId: string): Promise<ListingSnapshot> {
  const listing = await catalogDB.queryRow<CatalogListingRow>`
    SELECT
      id,
      host_id,
      title,
      description,
      location,
      area,
      province,
      price_per_night,
      discount_percent,
      adults,
      children,
      bedrooms,
      bathrooms,
      amenities,
      facilities,
      type
    FROM listings
    WHERE id = ${listingId}
  `;

  if (!listing) {
    throw APIError.notFound("Listing not found.");
  }
  if (listing.host_id !== userId) {
    throw APIError.permissionDenied("You can only generate content for your own listings.");
  }

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    area: listing.area ?? "",
    province: listing.province ?? "",
    pricePerNight: listing.price_per_night,
    discountPercent: listing.discount_percent,
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: Number(listing.bathrooms),
    amenities: listing.amenities ?? [],
    facilities: listing.facilities ?? [],
    type: listing.type,
    bookingUrl: `${getAppUrl()}/?listingId=${encodeURIComponent(listing.id)}`,
  };
}

function mapDraft(row: DraftRow): ContentDraftRecord {
  return {
    id: row.id,
    userId: row.user_id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingLocation: row.listing_location,
    platform: row.platform,
    tone: row.tone,
    templateId: row.template_id,
    templateName: row.template_name,
    status: row.status,
    content: row.content,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function enforceContentDraftBurstLimit(userId: string, now = Date.now()) {
  const history = contentDraftRateLimitStore.get(userId) ?? [];
  const active = history.filter((timestamp) => now - timestamp < CONTENT_DRAFT_RATE_LIMIT_WINDOW_MS);

  if (active.length >= CONTENT_DRAFT_RATE_LIMIT_MAX) {
    throw APIError.resourceExhausted("Too many content draft generations. Wait a few minutes and try again.");
  }

  active.push(now);
  contentDraftRateLimitStore.set(userId, active);
}

async function getCurrentUserPlan(userId: string) {
  const user = await identityDB.queryRow<UserPlanRow>`
    SELECT id, role, host_plan
    FROM users
    WHERE id = ${userId}
  `;
  if (!user) {
    throw APIError.notFound("User not found.");
  }
  return user;
}

async function ensureWallet(db: QueryExecutor, userId: string) {
  const wallet = await db.queryRow<WalletRow>`
    SELECT user_id, balance, updated_at
    FROM content_credit_wallets
    WHERE user_id = ${userId}
  `;

  if (wallet) {
    return wallet;
  }

  const now = new Date().toISOString();
  await db.exec`
    INSERT INTO content_credit_wallets (user_id, balance, updated_at)
    VALUES (${userId}, 0, ${now})
    ON CONFLICT (user_id) DO NOTHING
  `;

  return {
    user_id: userId,
    balance: 0,
    updated_at: now,
  };
}

async function getContentEntitlementsForUserWithExecutor(userId: string, executor: QueryExecutor): Promise<ContentEntitlements> {
  const user = await getCurrentUserPlan(userId);
  const wallet = await ensureWallet(executor, userId);
  const limits = CONTENT_LIMITS[user.host_plan];
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const usage = await executor.queryRow<{ count: number }>`
    SELECT COUNT(*)::int AS count
    FROM content_drafts
    WHERE user_id = ${userId}
      AND created_at >= ${monthStart.toISOString()}
  `;

  const usedDraftsThisMonth = usage?.count ?? 0;

  return {
    plan: user.host_plan,
    contentStudioEnabled: limits.contentStudioEnabled,
    includedDraftsPerMonth: limits.includedDraftsPerMonth,
    usedDraftsThisMonth,
    remainingIncludedDrafts: Math.max(limits.includedDraftsPerMonth - usedDraftsThisMonth, 0),
    creditBalance: wallet.balance,
    canSchedule: limits.canSchedule,
  };
}

async function getContentEntitlementsForUser(userId: string): Promise<ContentEntitlements> {
  return getContentEntitlementsForUserWithExecutor(userId, billingDB);
}

async function debitOneContentUse(db: QueryExecutor, userId: string, entitlements: ContentEntitlements, referenceId: string) {
  const decision = resolveContentDraftDebit(entitlements);

  if (!decision.allowed && decision.reason === "studio_disabled") {
    throw APIError.permissionDenied("Your current plan does not include the content studio.");
  }

  if (decision.allowed && decision.source === "included") {
    return;
  }

  if (!decision.allowed) {
    throw APIError.permissionDenied("You have used your included content drafts. Buy more credits or upgrade your plan.");
  }

  const now = new Date().toISOString();
  await ensureWallet(db, userId);

  const wallet = await db.queryRow<WalletRow>`
    SELECT user_id, balance, updated_at
    FROM content_credit_wallets
    WHERE user_id = ${userId}
    FOR UPDATE
  `;

  if (!wallet || wallet.balance < 1) {
    throw APIError.permissionDenied("You have used your included content drafts. Buy more credits or upgrade your plan.");
  }

  await db.exec`
    UPDATE content_credit_wallets
    SET balance = balance - 1,
        updated_at = ${now}
    WHERE user_id = ${userId}
  `;

  await db.exec`
    INSERT INTO content_credit_ledger (id, user_id, delta, reason, reference_id, created_at)
    VALUES (${randomUUID()}, ${userId}, -1, ${"content_generation"}, ${referenceId}, ${now})
  `;
}

function toFulfillableCheckoutSession(session: CheckoutSessionRow): FulfillableBillingSession {
  return {
    id: session.id,
    user_id: session.user_id,
    type: session.checkout_type,
    status: session.status,
    amount: session.amount,
    host_plan: session.host_plan,
    billing_interval: session.billing_interval,
    credit_quantity: session.credit_quantity,
  };
}

function redirectRaw(resp: ServerResponse, location: string) {
  resp.statusCode = 303;
  resp.setHeader("Location", location);
  resp.end();
}

function toFulfillablePaymentIntent(intent: PaymentIntentRow): FulfillableBillingSession {
  return {
    id: intent.id,
    user_id: intent.user_id,
    type: intent.purpose,
    status: intent.status,
    amount: intent.amount,
    host_plan: intent.host_plan,
    billing_interval: intent.billing_interval,
    credit_quantity: intent.credit_quantity,
  };
}

async function createPaymentIntentRow(params: {
  userId: string;
  purpose: CheckoutType;
  amount: number;
  hostPlan?: HostPlan | null;
  billingInterval?: BillingInterval | null;
  creditQuantity?: number | null;
  sourceSubscriptionId?: string | null;
}) {
  const now = new Date().toISOString();
  const intentId = randomUUID();
  const reference =
    params.purpose === "subscription"
      ? `Ideal Stay ${params.hostPlan} subscription ${intentId}`
      : params.purpose === "content_credits"
        ? `Ideal Stay ${params.creditQuantity} content credits ${intentId}`
        : params.purpose === "managed_hosting"
          ? `Ideal Stay managed hosting ${intentId}`
          : `Ideal Stay host billing setup ${intentId}`;
  const description =
    params.purpose === "subscription"
      ? `Ideal Stay ${params.hostPlan} ${params.billingInterval} host plan for user ${params.userId}.`
      : params.purpose === "content_credits"
        ? `Ideal Stay content credit top-up for user ${params.userId}.`
        : params.purpose === "managed_hosting"
          ? `Ideal Stay managed hosting package for user ${params.userId}.`
          : `Ideal Stay host billing setup verification for user ${params.userId}.`;

  await billingDB.exec`
    INSERT INTO billing_payment_intents (
      id, user_id, purpose, status, currency, amount, host_plan, billing_interval,
      credit_quantity, customer_reference, customer_description, metadata, created_at, updated_at
    )
    VALUES (
      ${intentId}, ${params.userId}, ${params.purpose}, ${"pending"}, ${"ZAR"}, ${params.amount},
      ${params.hostPlan ?? null}, ${params.billingInterval ?? null}, ${params.creditQuantity ?? null},
      ${reference.slice(0, 100)}, ${description.slice(0, 255)},
      ${JSON.stringify({
        paymentIntentId: intentId,
        purpose: params.purpose,
        ...(params.sourceSubscriptionId ? { sourceSubscriptionId: params.sourceSubscriptionId } : {}),
      })}, ${now}, ${now}
    )
  `;

  return {
    intentId,
    customerReference: reference.slice(0, 100),
    customerDescription: description.slice(0, 255),
  };
}

async function storeProviderPaymentIntent(params: {
  intentId: string;
  providerCheckoutId: string;
  redirectUrl: string;
  status: CheckoutStatus;
  providerMode: "live" | "test";
}) {
  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE billing_payment_intents
    SET provider_checkout_id = ${params.providerCheckoutId},
        provider_mode = ${params.providerMode},
        redirect_url = ${params.redirectUrl},
        status = ${params.status},
        updated_at = ${now}
    WHERE id = ${params.intentId}
  `;
}

async function storeProviderOrderId(intentId: string, providerOrderId: string | null) {
  if (!providerOrderId) {
    return;
  }

  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE billing_payment_intents
    SET provider_order_id = ${providerOrderId},
        updated_at = ${now}
    WHERE id = ${intentId}
      AND provider_order_id IS NULL
  `;
}

function mapYocoOrderStatus(status?: string | null): CheckoutStatus {
  const normalized = status?.trim().toLowerCase();
  if (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "successful" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "approved" ||
    normalized === "paid" ||
    normalized === "captured" ||
    normalized === "settled"
  ) {
    return "paid";
  }
  if (normalized === "failed") return "failed";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
}

// Author: (|╲) Klaasvaakie
function mapYocoCheckoutStatus(status?: string | null): CheckoutStatus {
  const normalized = status?.trim().toLowerCase();
  if (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "successful" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "approved" ||
    normalized === "paid" ||
    normalized === "captured" ||
    normalized === "settled"
  ) {
    return "paid";
  }
  if (normalized === "failed") {
    return "failed";
  }
  if (normalized === "cancelled") {
    return "cancelled";
  }
  return "pending";
}

async function createBillingPaymentIntent(params: {
  userId: string;
  purpose: CheckoutType;
  amount: number;
  hostPlan?: HostPlan | null;
  billingInterval?: BillingInterval | null;
  creditQuantity?: number | null;
  sourceSubscriptionId?: string | null;
}) {
  // (|/) Klaasvaakie - all new Yoco payments enter through this one standard intent path.
  const intent = await createPaymentIntentRow(params);
  const urls = buildBillingUrls(params.purpose, intent.intentId);
  const yoco = await createYocoCheckout({
    amount: toMinorUnits(params.amount),
    currency: "ZAR",
    successUrl: buildBillingPaymentReturnUrl(getAppUrl(), intent.intentId, "success"),
    cancelUrl: urls.cancelUrl.replace(/checkout_id=[^&]*/, `payment_id=${encodeURIComponent(intent.intentId)}`),
    failureUrl: urls.failureUrl.replace(/checkout_id=[^&]*/, `payment_id=${encodeURIComponent(intent.intentId)}`),
    idempotencyKey: intent.intentId,
    metadata: {
      paymentIntentId: intent.intentId,
      purpose: params.purpose,
      userId: params.userId,
      ...(params.hostPlan ? { plan: params.hostPlan } : {}),
      ...(params.billingInterval ? { billingInterval: params.billingInterval } : {}),
      ...(params.creditQuantity ? { credits: String(params.creditQuantity) } : {}),
      ...(params.sourceSubscriptionId ? { sourceSubscriptionId: params.sourceSubscriptionId } : {}),
    },
  });

  await storeProviderPaymentIntent({
    intentId: intent.intentId,
    providerCheckoutId: yoco.id,
    redirectUrl: yoco.redirectUrl,
    status: "pending",
    providerMode: yoco.processingMode ?? (yoco.mode === "test" ? "test" : "live"),
  });

  return {
    paymentId: intent.intentId,
    provider: "yoco" as const,
    providerMode: yoco.processingMode ?? (yoco.mode === "test" ? "test" : "live"),
    status: "pending" as const,
    redirectUrl: yoco.redirectUrl,
    providerReference: yoco.id,
  };
}

async function activatePlanFromBillingSession(session: FulfillableBillingSession) {
  if (!session.host_plan || !session.billing_interval) {
    throw APIError.internal("Subscription checkout is missing plan metadata.");
  }

  const now = new Date();
  const endsAt = new Date(now);
  if (session.billing_interval === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }

  const existingSubscription = await billingDB.queryRow<{ id: string }>`
    SELECT id
    FROM subscriptions
    WHERE checkout_session_id = ${session.id}
    LIMIT 1
  `;

  const subscriptionId = existingSubscription?.id ?? randomUUID();

  await billingDB.exec`
    UPDATE subscriptions
    SET status = ${"cancelled"}
    WHERE user_id = ${session.user_id}
      AND status = ${"active"}
      AND checkout_session_id <> ${session.id}
  `;

  if (existingSubscription) {
    await billingDB.exec`
      UPDATE subscriptions
      SET plan = ${session.host_plan},
          status = ${"active"},
          amount = ${session.amount},
          billing_interval = ${session.billing_interval},
          starts_at = ${now.toISOString()},
          ends_at = ${endsAt.toISOString()},
          cancel_at_period_end = ${false},
          cancelled_at = ${null},
          pending_plan = ${null},
          pending_billing_interval = ${null},
          pending_change_effective_at = ${null},
          grace_ends_at = ${null},
          renewal_due_notified_at = ${null},
          grace_started_notified_at = ${null},
          deactivated_notified_at = ${null}
      WHERE id = ${subscriptionId}
    `;
  } else {

    await billingDB.exec`
      INSERT INTO subscriptions (
        id, user_id, checkout_session_id, plan, status, amount, billing_interval, starts_at, ends_at, cancel_at_period_end, cancelled_at,
        pending_plan, pending_billing_interval, pending_change_effective_at, grace_ends_at,
        renewal_due_notified_at, grace_started_notified_at, deactivated_notified_at, created_at
      )
      VALUES (
        ${subscriptionId}, ${session.user_id}, ${session.id}, ${session.host_plan}, ${"active"}, ${session.amount},
        ${session.billing_interval}, ${now.toISOString()}, ${endsAt.toISOString()}, ${false}, ${null},
        ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${now.toISOString()}
      )
    `;
  }

  await identityDB.exec`
    UPDATE users
    SET host_plan = ${session.host_plan},
        management_mode = ${"self_service"},
        updated_at = ${now.toISOString()}
    WHERE id = ${session.user_id}
  `;

  await syncPaidBillingAccount({
    userId: session.user_id,
    plan: session.host_plan,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: endsAt.toISOString(),
  });

  if (!existingSubscription) {
    await platformEvents.publish({
      type: "subscription.changed",
      aggregateId: subscriptionId,
      actorId: session.user_id,
      occurredAt: now.toISOString(),
      payload: JSON.stringify({ plan: session.host_plan }),
    });
  }

  await rewardSubscriptionReferralConversion({
    referredUserId: session.user_id,
    sourceSubscriptionId: subscriptionId,
  });
}

async function creditWalletFromBillingSession(session: FulfillableBillingSession) {
  const credits = session.credit_quantity;
  if (!credits || credits <= 0) {
    throw APIError.internal("Credit checkout is missing quantity metadata.");
  }

  const now = new Date().toISOString();
  const tx = await billingDB.begin();

  try {
    const existingCredit = await tx.queryRow<{ id: string }>`
      SELECT id
      FROM content_credit_ledger
      WHERE reference_id = ${session.id}
        AND reason = ${"credit_purchase"}
      LIMIT 1
    `;

    if (existingCredit) {
      await tx.rollback();
      return;
    }

    await ensureWallet(tx, session.user_id);

    const wallet = await tx.queryRow<WalletRow>`
      SELECT user_id, balance, updated_at
      FROM content_credit_wallets
      WHERE user_id = ${session.user_id}
      FOR UPDATE
    `;

    if (!wallet) {
      throw APIError.internal("Content credit wallet could not be initialized.");
    }

    const nextBalance = wallet.balance + credits;

    await tx.exec`
      UPDATE content_credit_wallets
      SET balance = ${nextBalance},
          updated_at = ${now}
      WHERE user_id = ${session.user_id}
    `;

    await tx.exec`
      INSERT INTO content_credit_ledger (id, user_id, delta, reason, reference_id, created_at)
      VALUES (${randomUUID()}, ${session.user_id}, ${credits}, ${"credit_purchase"}, ${session.id}, ${now})
    `;

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function activateManagedHostingFromPaymentIntent(intent: PaymentIntentRow) {
  const now = new Date().toISOString();

  await activatePlanFromBillingSession({
    id: intent.id,
    user_id: intent.user_id,
    type: "subscription",
    status: intent.status,
    amount: intent.amount,
    host_plan: "premium",
    billing_interval: "monthly",
    credit_quantity: null,
  });

  await identityDB.exec`
    UPDATE users
    SET host_plan = ${"premium"},
        management_mode = ${"managed"},
        updated_at = ${now}
    WHERE id = ${intent.user_id}
      AND role = ${"host"}
  `;

  await billingDB.exec`
    INSERT INTO host_billing_accounts (
      user_id,
      plan,
      billing_source,
      billing_status,
      current_period_start,
      current_period_end,
      reminder_count,
      card_on_file,
      created_at,
      updated_at
    )
    VALUES (
      ${intent.user_id},
      ${"premium"},
      ${"paid"},
      ${"active"},
      ${now},
      ${null},
      ${0},
      ${true},
      ${now},
      ${now}
    )
    ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        billing_source = EXCLUDED.billing_source,
        billing_status = EXCLUDED.billing_status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = NULL,
        reminder_window_starts_at = NULL,
        voucher_code = NULL,
        voucher_redeemed_at = NULL,
        greylisted_at = NULL,
        greylist_reason = NULL,
        card_on_file = EXCLUDED.card_on_file,
        updated_at = EXCLUDED.updated_at
  `;

  await platformEvents.publish({
    type: "managed_hosting.paid",
    aggregateId: intent.id,
    actorId: intent.user_id,
    occurredAt: now,
    payload: JSON.stringify({ purpose: intent.purpose, amount: intent.amount }),
  });
}

async function markCheckoutPaid(session: CheckoutSessionRow, providerPaymentId?: string | null) {
  const now = new Date().toISOString();

  await billingDB.exec`
    UPDATE billing_checkout_sessions
    SET status = ${"paid"},
        provider_payment_id = ${providerPaymentId ?? null},
        paid_at = ${now},
        updated_at = ${now}
    WHERE id = ${session.id}
  `;
}

async function fulfilSuccessfulCheckout(session: CheckoutSessionRow, providerPaymentId?: string | null) {
  if (session.status === "paid") {
    return;
  }

  const billingSession = toFulfillableCheckoutSession(session);
  if (session.checkout_type === "subscription") {
    await activatePlanFromBillingSession(billingSession);
    if (session.host_plan && session.billing_interval) {
      try {
        await notifySubscriptionActivated({
          userId: session.user_id,
          plan: session.host_plan,
          billingInterval: session.billing_interval,
        });
      } catch (error) {
        console.error("Failed to notify subscription activation:", error);
      }
    }
  } else if (session.checkout_type === "content_credits") {
    await creditWalletFromBillingSession(billingSession);
    if (session.credit_quantity) {
      try {
        await notifyContentCreditsPurchased({
          userId: session.user_id,
          credits: session.credit_quantity,
        });
      } catch (error) {
        console.error("Failed to notify content credit purchase:", error);
      }
    }
  } else {
    await markHostBillingSetupComplete({
      userId: session.user_id,
      provider: "yoco",
      checkoutId: session.id,
      providerPaymentId,
    });
  }

  await markCheckoutPaid(session, providerPaymentId);
}

async function markCheckoutStatus(session: CheckoutSessionRow, status: "failed" | "cancelled") {
  if (session.status !== "pending") {
    return;
  }

  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE billing_checkout_sessions
    SET status = ${status},
        updated_at = ${now}
    WHERE id = ${session.id}
      AND status = ${"pending"}
  `;

  try {
    await notifyCheckoutStatusChanged({
      userId: session.user_id,
      checkoutType: session.checkout_type,
      status,
      hostPlan: session.host_plan,
      creditQuantity: session.credit_quantity,
    });
  } catch (error) {
    console.error("Failed to notify checkout status change:", error);
  }
}

async function markPaymentIntentPaid(intent: PaymentIntentRow, providerPaymentId?: string | null) {
  const now = new Date().toISOString();

  await billingDB.exec`
    UPDATE billing_payment_intents
    SET status = ${"paid"},
        provider_payment_id = ${providerPaymentId ?? null},
        paid_at = ${now},
        updated_at = ${now}
    WHERE id = ${intent.id}
  `;
}

async function markPaymentIntentStatus(intent: PaymentIntentRow, status: "failed" | "cancelled") {
  if (intent.status !== "pending") {
    return;
  }

  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE billing_payment_intents
    SET status = ${status},
        updated_at = ${now}
    WHERE id = ${intent.id}
      AND status = ${"pending"}
  `;

  try {
    await notifyCheckoutStatusChanged({
      userId: intent.user_id,
      checkoutType: intent.purpose,
      status,
      hostPlan: intent.host_plan,
      creditQuantity: intent.credit_quantity,
    });
  } catch (error) {
    console.error("Failed to notify payment intent status change:", error);
  }
}

async function fulfilSuccessfulPaymentIntent(intent: PaymentIntentRow, providerPaymentId?: string | null) {
  if (intent.status === "paid") {
    return;
  }

  const billingSession = toFulfillablePaymentIntent(intent);
  if (intent.purpose === "subscription") {
    await activatePlanFromBillingSession(billingSession);
    if (intent.host_plan && intent.billing_interval) {
      try {
        await notifySubscriptionActivated({
          userId: intent.user_id,
          plan: intent.host_plan,
          billingInterval: intent.billing_interval,
        });
      } catch (error) {
        console.error("Failed to notify subscription activation:", error);
      }
    }
  } else if (intent.purpose === "content_credits") {
    await creditWalletFromBillingSession(billingSession);
    if (intent.credit_quantity) {
      try {
        await notifyContentCreditsPurchased({
          userId: intent.user_id,
          credits: intent.credit_quantity,
        });
      } catch (error) {
        console.error("Failed to notify content credit purchase:", error);
      }
    }
  } else if (intent.purpose === "host_billing_setup") {
    await markHostBillingSetupComplete({
      userId: intent.user_id,
      provider: "yoco",
      checkoutId: intent.id,
      providerPaymentId,
    });
  } else if (intent.purpose === "managed_hosting") {
    await activateManagedHostingFromPaymentIntent(intent);
  }

  await markPaymentIntentPaid(intent, providerPaymentId);
}

async function readRawBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseEventType(event: YocoWebhookEvent) {
  return event.type ?? "unknown";
}

function resolveProviderMetadata(event: YocoWebhookEvent) {
  return event.payload?.metadata ?? {};
}

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveProviderCheckoutId(event: YocoWebhookEvent) {
  return resolveYocoWebhookCheckoutId(event);
}

function resolveProviderOrderId(event: YocoWebhookEvent) {
  const payload = event.payload as (YocoWebhookEvent["payload"] & Record<string, unknown>) | undefined;
  const directOrderId = payload?.order_id ?? payload?.orderId;
  if (typeof directOrderId === "string") {
    return directOrderId;
  }

  const nestedOrder = payload?.order;
  if (nestedOrder && typeof nestedOrder === "object") {
    const nestedOrderId = (nestedOrder as Record<string, unknown>).id ?? (nestedOrder as Record<string, unknown>).order_id;
    if (typeof nestedOrderId === "string") {
      return nestedOrderId;
    }
  }

  return null;
}

async function findCheckoutForWebhook(event: YocoWebhookEvent) {
  const metadata = resolveProviderMetadata(event);
  const checkoutId = typeof metadata.checkoutId === "string" ? metadata.checkoutId : null;
  const providerCheckoutId = resolveProviderCheckoutId(event);

  if (checkoutId) {
    const byId = await billingDB.queryRow<CheckoutSessionRow>`
      SELECT *
      FROM billing_checkout_sessions
      WHERE id = ${checkoutId}
    `;
    if (byId) {
      return byId;
    }
  }

  if (providerCheckoutId) {
    const byProviderId = await billingDB.queryRow<CheckoutSessionRow>`
      SELECT *
      FROM billing_checkout_sessions
      WHERE provider_checkout_id = ${providerCheckoutId}
    `;
    if (byProviderId) {
      return byProviderId;
    }
  }

  return null;
}

async function getCheckoutSessionById(checkoutId: string) {
  return billingDB.queryRow<CheckoutSessionRow>`
    SELECT *
    FROM billing_checkout_sessions
    WHERE id = ${checkoutId}
  `;
}

async function getPaymentIntentById(paymentId: string) {
  return billingDB.queryRow<PaymentIntentRow>`
    SELECT *
    FROM billing_payment_intents
    WHERE id = ${paymentId}
  `;
}

async function findPaymentIntentForWebhook(event: YocoWebhookEvent) {
  const metadata = resolveProviderMetadata(event);
  const paymentIntentId = readMetadataString(metadata, "paymentIntentId");
  const providerCheckoutId = resolveProviderCheckoutId(event);
  const orderId = resolveProviderOrderId(event);
  if (paymentIntentId) {
    const byId = await billingDB.queryRow<PaymentIntentRow>`
      SELECT *
      FROM billing_payment_intents
      WHERE id = ${paymentIntentId}
    `;
    if (byId) {
      return byId;
    }
  }

  if (providerCheckoutId) {
    const byCheckoutId = await billingDB.queryRow<PaymentIntentRow>`
      SELECT *
      FROM billing_payment_intents
      WHERE provider_checkout_id = ${providerCheckoutId}
    `;
    if (byCheckoutId) {
      return byCheckoutId;
    }
  }

  if (orderId) {
    const byOrderId = await billingDB.queryRow<PaymentIntentRow>`
      SELECT *
      FROM billing_payment_intents
      WHERE provider_order_id = ${orderId}
    `;
    if (byOrderId) {
      return byOrderId;
    }
  }

  return null;
}

function isFulfilmentSafeWebhookOutcome(outcome: ReturnType<typeof classifyYocoWebhookOutcome>) {
  return outcome === "paid" || outcome === "failed" || outcome === "cancelled";
}

function assertWebhookIntentOwnership(intent: PaymentIntentRow, event: YocoWebhookEvent) {
  const metadata = resolveProviderMetadata(event);
  const userId = readMetadataString(metadata, "userId");

  if (userId && userId !== intent.user_id) {
    // (|╲) Klaasvaakie - webhook callbacks must never be allowed to reassign a paid subscription to the wrong user.
    throw APIError.permissionDenied("Webhook metadata did not match the payment owner.");
  }
}

async function cancelSubscriptionById(subscriptionId: string) {
  const subscription = await billingDB.queryRow<SubscriptionRow>`
    SELECT *
    FROM subscriptions
    WHERE id = ${subscriptionId}
  `;

  if (!subscription) {
    throw APIError.notFound("Subscription not found.");
  }
  if (subscription.status !== "active") {
    throw APIError.failedPrecondition("Only active subscriptions can be cancelled.");
  }
  if (subscription.cancel_at_period_end) {
    throw APIError.failedPrecondition("Subscription is already scheduled to cancel at period end.");
  }

  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE subscriptions
    SET cancel_at_period_end = ${true},
        cancelled_at = ${now}
    WHERE id = ${subscriptionId}
  `;

  await platformEvents.publish({
    type: "subscription.cancelled",
    aggregateId: subscriptionId,
    actorId: subscription.user_id,
    occurredAt: now,
    payload: JSON.stringify({ plan: subscription.plan, cancelAtPeriodEnd: true, endsAt: subscription.ends_at }),
  });

  const updated = await billingDB.queryRow<SubscriptionRow>`
    SELECT *
    FROM subscriptions
    WHERE id = ${subscriptionId}
  `;
  if (!updated) {
    throw APIError.internal("Cancelled subscription could not be reloaded.");
  }
  return updated;
}

async function scheduleSubscriptionDowngrade(subscription: SubscriptionRow, plan: HostPlan, billingInterval: BillingInterval) {
  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE subscriptions
    SET pending_plan = ${plan},
        pending_billing_interval = ${billingInterval},
        pending_change_effective_at = ${subscription.ends_at}
    WHERE id = ${subscription.id}
  `;

  await platformEvents.publish({
    type: "subscription.changed",
    aggregateId: subscription.id,
    actorId: subscription.user_id,
    occurredAt: now,
    payload: JSON.stringify({
      plan,
      billingInterval,
      pendingChangeEffectiveAt: subscription.ends_at,
      changeType: "downgrade",
    }),
  });

  const updated = await billingDB.queryRow<SubscriptionRow>`
    SELECT *
    FROM subscriptions
    WHERE id = ${subscription.id}
  `;
  if (!updated) {
    throw APIError.internal("Scheduled subscription downgrade could not be reloaded.");
  }
  return updated;
}

async function expireEndedSubscriptions(nowIso = new Date().toISOString()) {
  const dueActiveRows = await billingDB.queryAll<SubscriptionRow>`
    SELECT *
    FROM subscriptions
    WHERE status = ${"active"}
      AND ends_at <= ${nowIso}
    ORDER BY ends_at ASC
  `;

  for (const subscription of dueActiveRows) {
    if (subscription.cancel_at_period_end) {
      await billingDB.exec`
        UPDATE subscriptions
        SET status = ${"cancelled"}
        WHERE id = ${subscription.id}
      `;
    } else if (subscription.pending_plan && subscription.pending_billing_interval) {
      const nextStartsAt = new Date(subscription.ends_at);
      const nextEndsAt = new Date(nextStartsAt);
      if (subscription.pending_billing_interval === "monthly") {
        nextEndsAt.setMonth(nextEndsAt.getMonth() + 1);
      } else {
        nextEndsAt.setFullYear(nextEndsAt.getFullYear() + 1);
      }

      await billingDB.exec`
        UPDATE subscriptions
        SET plan = ${subscription.pending_plan},
            billing_interval = ${subscription.pending_billing_interval},
            amount = ${getPlanAmount(subscription.pending_plan, subscription.pending_billing_interval)},
            starts_at = ${nextStartsAt.toISOString()},
            ends_at = ${nextEndsAt.toISOString()},
            pending_plan = ${null},
            pending_billing_interval = ${null},
            pending_change_effective_at = ${null},
            renewal_due_notified_at = ${null},
            grace_started_notified_at = ${null},
            deactivated_notified_at = ${null}
        WHERE id = ${subscription.id}
      `;
      await identityDB.exec`
        UPDATE users
        SET host_plan = ${subscription.pending_plan},
            management_mode = ${"self_service"},
            updated_at = ${nowIso}
        WHERE id = ${subscription.user_id}
      `;
      await syncPaidBillingAccount({
        userId: subscription.user_id,
        plan: subscription.pending_plan,
        currentPeriodStart: nextStartsAt.toISOString(),
        currentPeriodEnd: nextEndsAt.toISOString(),
      });
      continue;
    } else {
      const graceEndsAt = addDays(new Date(subscription.ends_at), SUBSCRIPTION_GRACE_PERIOD_DAYS);
      await billingDB.exec`
        UPDATE subscriptions
        SET status = ${"grace_period"},
            grace_ends_at = ${graceEndsAt.toISOString()},
            grace_started_notified_at = COALESCE(grace_started_notified_at, ${nowIso})
        WHERE id = ${subscription.id}
      `;

      try {
        await notifySubscriptionGracePeriodStarted({
          userId: subscription.user_id,
          plan: subscription.plan,
          graceEndsAt: graceEndsAt.toISOString(),
        });
      } catch (error) {
        console.error("Failed to notify subscription grace period:", error);
      }
      continue;
    }

    const stillActive = await billingDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM subscriptions
      WHERE user_id = ${subscription.user_id}
        AND status = ${"active"}
        AND ends_at > ${nowIso}
    `;

    if (!stillActive || stillActive.count === 0) {
      await identityDB.exec`
        UPDATE users
        SET host_plan = ${"standard"},
            management_mode = ${"self_service"},
            updated_at = ${nowIso}
        WHERE id = ${subscription.user_id}
          AND (host_plan <> ${"standard"} OR management_mode <> ${"self_service"})
      `;
      await deactivatePaidBillingAccount({ userId: subscription.user_id, preserveCardOnFile: true });
    }
  }

  const graceRows = await billingDB.queryAll<SubscriptionRow>`
    SELECT *
    FROM subscriptions
    WHERE status = ${"grace_period"}
      AND grace_ends_at <= ${nowIso}
    ORDER BY grace_ends_at ASC
  `;

  for (const subscription of graceRows) {
    await billingDB.exec`
      UPDATE subscriptions
      SET status = ${"expired"},
          deactivated_notified_at = COALESCE(deactivated_notified_at, ${nowIso})
      WHERE id = ${subscription.id}
    `;

    const stillActive = await billingDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM subscriptions
      WHERE user_id = ${subscription.user_id}
        AND status = ${"active"}
        AND ends_at > ${nowIso}
    `;

    if (!stillActive || stillActive.count === 0) {
      await identityDB.exec`
        UPDATE users
        SET host_plan = ${"standard"},
            management_mode = ${"self_service"},
            updated_at = ${nowIso}
        WHERE id = ${subscription.user_id}
          AND (host_plan <> ${"standard"} OR management_mode <> ${"self_service"})
      `;
      await deactivatePaidBillingAccount({ userId: subscription.user_id, preserveCardOnFile: true });
      try {
        await notifySubscriptionDeactivated({ userId: subscription.user_id, plan: subscription.plan });
      } catch (error) {
        console.error("Failed to notify subscription deactivation:", error);
      }
    }
  }
}

async function notifySubscriptionsDueSoon(nowIso = new Date().toISOString()) {
  const noticeWindowEnd = addDays(new Date(nowIso), SUBSCRIPTION_RENEWAL_NOTICE_DAYS).toISOString();
  const rows = await billingDB.queryAll<SubscriptionRow>`
    SELECT *
    FROM subscriptions
    WHERE status = ${"active"}
      AND cancel_at_period_end = ${false}
      AND ends_at > ${nowIso}
      AND ends_at <= ${noticeWindowEnd}
      AND renewal_due_notified_at IS NULL
    ORDER BY ends_at ASC
  `;

  for (const subscription of rows) {
    try {
      await notifySubscriptionRenewalDue({
        userId: subscription.user_id,
        plan: subscription.plan,
        endsAt: subscription.ends_at,
      });
      await billingDB.exec`
        UPDATE subscriptions
        SET renewal_due_notified_at = ${nowIso}
        WHERE id = ${subscription.id}
      `;
    } catch (error) {
      console.error(`Failed to notify subscription renewal due for ${subscription.id}:`, error);
    }
  }
}

// Author: ( |╲ ) Klaasvaakie
async function withBillingFulfilmentLock<T>(resourceType: "payment" | "checkout", resourceId: string, work: () => Promise<T>) {
  const tx = await billingDB.begin();
  try {
    await tx.rawQueryRow<{ locked: null }>(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
      `yoco:${resourceType}:${resourceId}`,
    );
    const result = await work();
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function reconcilePendingPaymentIntentUnlocked(intent: PaymentIntentRow, billingStatus?: string | null) {
  if (intent.status !== "pending") {
    return intent;
  }

  try {
    const successfulWebhook = await findSuccessfulWebhookForPaymentIntent(intent);
    if (successfulWebhook) {
      await fulfilSuccessfulPaymentIntent(intent, successfulWebhook.payload?.paymentId ?? successfulWebhook.payload?.id ?? null);
      return (await getPaymentIntentById(intent.id)) ?? intent;
    }
  } catch (error) {
    console.error(`Stored Yoco webhook lookup failed for billing payment intent ${intent.id}:`, error);
  }

  const normalizedBillingStatus = billingStatus?.trim().toLowerCase();
  if (intent.provider_mode === "test" && normalizedBillingStatus === "success") {
    await fulfilSuccessfulPaymentIntent(intent, intent.provider_payment_id ?? intent.provider_checkout_id ?? null);
    return (await getPaymentIntentById(intent.id)) ?? intent;
  }

  if (intent.provider_checkout_id) {
    try {
      const checkout = await fetchYocoCheckout(intent.provider_checkout_id);
      const checkoutStatus = mapYocoCheckoutStatus(checkout.status);
      const providerPaymentId = checkout.paymentId ?? checkout.payment_id ?? null;
      const providerOrderId = checkout.orderId ?? checkout.order_id ?? null;

      await storeProviderOrderId(intent.id, providerOrderId);

      if (checkoutStatus === "paid") {
        await fulfilSuccessfulPaymentIntent(intent, providerPaymentId ?? intent.provider_checkout_id);
        return (await getPaymentIntentById(intent.id)) ?? intent;
      }
      if (checkoutStatus === "failed") {
        await markPaymentIntentStatus(intent, "failed");
        return (await getPaymentIntentById(intent.id)) ?? intent;
      }
      if (checkoutStatus === "cancelled") {
        await markPaymentIntentStatus(intent, "cancelled");
        return (await getPaymentIntentById(intent.id)) ?? intent;
      }
    } catch (error) {
      console.error(`Yoco checkout lookup failed for billing payment intent ${intent.id}:`, error);
    }
  }

  if (!intent.provider_order_id) {
    return intent;
  }

  try {
    const order = await fetchYocoOrder(intent.provider_order_id);
    const status = mapYocoOrderStatus(order.status);
    const providerPaymentId =
      order.payments?.find((payment) => payment.status?.trim().toLowerCase() === "approved")?.id ??
      order.payments?.[0]?.id ??
      null;
    if (status === "paid") {
      await fulfilSuccessfulPaymentIntent(intent, providerPaymentId);
      return (await getPaymentIntentById(intent.id)) ?? intent;
    }
    if (status === "cancelled") {
      await markPaymentIntentStatus(intent, "cancelled");
      return (await getPaymentIntentById(intent.id)) ?? intent;
    }
  } catch (error) {
    console.error(`Yoco order lookup failed for billing payment intent ${intent.id}:`, error);
  }

  return intent;
}

async function reconcilePendingPaymentIntent(intent: PaymentIntentRow, billingStatus?: string | null) {
  return withBillingFulfilmentLock("payment", intent.id, async () => {
    const current = (await getPaymentIntentById(intent.id)) ?? intent;
    return reconcilePendingPaymentIntentUnlocked(current, billingStatus);
  });
}

async function reconcilePendingPaymentIntentsFromProvider(limit = 50) {
  const pendingIntents = await billingDB.queryAll<PaymentIntentRow>`
    SELECT *
    FROM billing_payment_intents
    WHERE status = ${"pending"}
      AND provider = ${"yoco"}
      AND provider_checkout_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  let paid = 0;
  let failed = 0;
  let cancelled = 0;
  let pending = 0;

  for (const intent of pendingIntents) {
    try {
      const resolved = await reconcilePendingPaymentIntent(intent);
      if (resolved.status === "paid") {
        paid += 1;
      } else if (resolved.status === "failed") {
        failed += 1;
      } else if (resolved.status === "cancelled") {
        cancelled += 1;
      } else {
        pending += 1;
      }
    } catch (error) {
      pending += 1;
      console.error(`Failed to reconcile billing payment intent ${intent.id}:`, error);
    }
  }

  return {
    checked: pendingIntents.length,
    paid,
    failed,
    cancelled,
    pending,
  };
}

async function findSuccessfulWebhookForPaymentIntent(intent: PaymentIntentRow): Promise<YocoWebhookEvent | null> {
  const matchingEvents = await billingDB.queryAll<StoredWebhookEventRow>`
    SELECT event_type, payload::text AS payload_json
    FROM billing_webhook_events
    WHERE provider = ${"yoco"}
      AND (
        payload #>> '{payload,metadata,paymentIntentId}' = ${intent.id}
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,metadata,checkoutId}' = ${intent.provider_checkout_id ?? null})
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkoutId}' = ${intent.provider_checkout_id ?? null})
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout_id}' = ${intent.provider_checkout_id ?? null})
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout,id}' = ${intent.provider_checkout_id ?? null})
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout,checkoutId}' = ${intent.provider_checkout_id ?? null})
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout,checkout_id}' = ${intent.provider_checkout_id ?? null})
        OR (${intent.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,id}' = ${intent.provider_checkout_id ?? null})
      )
    ORDER BY received_at DESC
    LIMIT 20
  `;

  for (const row of matchingEvents) {
    const payload = JSON.parse(row.payload_json) as YocoWebhookEvent;
    const eventType = row.event_type || payload.type;
    if (classifyYocoWebhookOutcome(eventType, payload.payload?.status) === "paid") {
      return payload;
    }
  }

  return null;
}

async function findSuccessfulWebhookForCheckout(session: CheckoutSessionRow): Promise<YocoWebhookEvent | null> {
  const matchingEvents = await billingDB.queryAll<StoredWebhookEventRow>`
    SELECT event_type, payload::text AS payload_json
    FROM billing_webhook_events
    WHERE provider = ${"yoco"}
      AND (
        payload #>> '{payload,metadata,checkoutId}' = ${session.id}
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,metadata,checkoutId}' = ${session.provider_checkout_id ?? null})
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkoutId}' = ${session.provider_checkout_id ?? null})
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout_id}' = ${session.provider_checkout_id ?? null})
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout,id}' = ${session.provider_checkout_id ?? null})
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout,checkoutId}' = ${session.provider_checkout_id ?? null})
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,checkout,checkout_id}' = ${session.provider_checkout_id ?? null})
        OR (${session.provider_checkout_id ?? null} IS NOT NULL AND payload #>> '{payload,id}' = ${session.provider_checkout_id ?? null})
      )
    ORDER BY received_at DESC
    LIMIT 20
  `;

  for (const row of matchingEvents) {
    const payload = JSON.parse(row.payload_json) as YocoWebhookEvent;
    const eventType = row.event_type || payload.type;
    if (classifyYocoWebhookOutcome(eventType, payload.payload?.status) === "paid") {
      return payload;
    }
  }

  return null;
}

async function reconcilePendingCheckoutUnlocked(session: CheckoutSessionRow) {
  if (session.status !== "pending") {
    return session;
  }

  const successfulWebhook = await findSuccessfulWebhookForCheckout(session);
  if (!successfulWebhook) {
    return session;
  }

  await fulfilSuccessfulCheckout(session, successfulWebhook.payload?.paymentId ?? null);
  return (await getCheckoutSessionById(session.id)) ?? session;
}

async function reconcilePendingCheckout(session: CheckoutSessionRow) {
  return withBillingFulfilmentLock("checkout", session.id, async () => {
    const current = (await getCheckoutSessionById(session.id)) ?? session;
    return reconcilePendingCheckoutUnlocked(current);
  });
}

export const listPlans = api<void, { plans: SubscriptionPlan[] }>(
  { expose: true, method: "GET", path: "/billing/plans" },
  async () => ({ plans: HOST_PLANS }),
);

export const createBillingPayment = api<CreateBillingPaymentParams, { paymentId: string; provider: "yoco"; providerMode: "live" | "test"; status: CheckoutStatus; redirectUrl: string; providerReference: string }>(
  { expose: true, method: "POST", path: "/billing/payments", auth: true },
  async ({ purpose, plan, billingInterval, credits }) => {
    const auth = requireRole("host", "admin");

    if (purpose === "subscription") {
      if (!plan || !billingInterval) {
        throw APIError.invalidArgument("Subscription payments require plan and billingInterval.");
      }
      const amount = getPlanAmount(plan, billingInterval);
      return createBillingPaymentIntent({
        userId: auth.userID,
        purpose,
        amount,
        hostPlan: plan,
        billingInterval,
      });
    }

    if (purpose === "host_billing_setup") {
      const account = await getHostBillingAccount(auth.userID);
      if (account.cardOnFile) {
        throw APIError.failedPrecondition("A provider-backed billing card is already on file.");
      }
      return createBillingPaymentIntent({
        userId: auth.userID,
        purpose,
        amount: HOST_BILLING_SETUP_AMOUNT,
        hostPlan: account.plan,
      });
    }

    if (purpose === "managed_hosting") {
      return createBillingPaymentIntent({
        userId: auth.userID,
        purpose,
        amount: 650,
      });
    }

    if (purpose === "content_credits") {
      if (!Number.isInteger(credits) || !credits || credits <= 0) {
        throw APIError.invalidArgument("Content credit payments require a positive credits value.");
      }
      const amount = getCreditPrice(credits);
      return createBillingPaymentIntent({
        userId: auth.userID,
        purpose,
        amount,
        creditQuantity: credits,
      });
    }

    throw APIError.invalidArgument("Unsupported billing payment purpose.");
  },
);

export const listMySubscriptions = api<void, { subscriptions: SubscriptionRow[] }>(
  { expose: true, method: "GET", path: "/billing/subscriptions", auth: true },
  async () => {
    const auth = requireAuth();
    await expireEndedSubscriptions();
    const subscriptions = await billingDB.queryAll<SubscriptionRow>`
      SELECT *
      FROM subscriptions
      WHERE user_id = ${auth.userID}
      ORDER BY created_at DESC
    `;
    return { subscriptions };
  },
);

export const listAdminSubscriptions = api<void, { subscriptions: SubscriptionRow[] }>(
  { expose: true, method: "GET", path: "/admin/subscriptions", auth: true },
  async () => {
    requireRole("admin", "support");
    const subscriptions = await billingDB.queryAll<SubscriptionRow>`
      SELECT *
      FROM subscriptions
      ORDER BY created_at DESC
    `;
    return { subscriptions };
  },
);

export const cancelMySubscription = api<{ subscriptionId: string }, { subscription: SubscriptionRow }>(
  { expose: true, method: "POST", path: "/billing/subscriptions/:subscriptionId/cancel", auth: true },
  async ({ subscriptionId }) => {
    const auth = requireRole("host", "admin");
    const subscription = await billingDB.queryRow<SubscriptionRow>`
      SELECT *
      FROM subscriptions
      WHERE id = ${subscriptionId}
    `;
    if (!subscription) {
      throw APIError.notFound("Subscription not found.");
    }
    if (subscription.user_id !== auth.userID) {
      throw APIError.permissionDenied("You can only cancel your own subscription.");
    }
    return { subscription: await cancelSubscriptionById(subscriptionId) };
  },
);

export const changeMySubscription = api<{ subscriptionId: string; plan: HostPlan; billingInterval: BillingInterval }, SubscriptionChangeResponse>(
  { expose: true, method: "POST", path: "/billing/subscriptions/:subscriptionId/change", auth: true },
  async ({ subscriptionId, plan, billingInterval }) => {
    const auth = requireRole("host", "admin");
    const subscription = await billingDB.queryRow<SubscriptionRow>`
      SELECT *
      FROM subscriptions
      WHERE id = ${subscriptionId}
    `;

    if (!subscription) {
      throw APIError.notFound("Subscription not found.");
    }
    if (subscription.user_id !== auth.userID) {
      throw APIError.permissionDenied("You can only change your own subscription.");
    }
    if (subscription.status !== "active") {
      throw APIError.failedPrecondition("Only active subscriptions can be changed.");
    }
    if (subscription.plan === plan && subscription.billing_interval === billingInterval) {
      throw APIError.failedPrecondition("Your subscription is already on that plan.");
    }

    const changeDirection = compareSubscriptionPlans(subscription, plan, billingInterval);
    if (changeDirection === "same") {
      throw APIError.failedPrecondition("Your subscription is already on an equivalent plan.");
    }

    if (changeDirection === "downgrade") {
      const scheduled = await scheduleSubscriptionDowngrade(subscription, plan, billingInterval);
      return { subscription: scheduled, changeType: "downgrade", effectiveAt: scheduled.pending_change_effective_at };
    }

    const proratedAmount = calculateProratedUpgradeAmount(subscription, plan, billingInterval);
    if (proratedAmount <= 0) {
      const scheduled = await scheduleSubscriptionDowngrade(subscription, plan, billingInterval);
      return { subscription: scheduled, changeType: "downgrade", effectiveAt: scheduled.pending_change_effective_at, proratedAmount };
    }

    const payment = await createBillingPaymentIntent({
      userId: subscription.user_id,
      purpose: "subscription",
      amount: proratedAmount,
      hostPlan: plan,
      billingInterval,
      sourceSubscriptionId: subscriptionId,
    });

    return { payment, changeType: "upgrade", proratedAmount };
  },
);

export const cancelAdminSubscription = api<{ subscriptionId: string }, { subscription: SubscriptionRow }>(
  { expose: true, method: "POST", path: "/admin/subscriptions/:subscriptionId/cancel", auth: true },
  async ({ subscriptionId }) => {
    requireRole("admin", "support");
    return { subscription: await cancelSubscriptionById(subscriptionId) };
  },
);

export const upgradeAdminSubscription = api<{ subscriptionId: string; plan: HostPlan; billingInterval: BillingInterval }, { payment: AdminSubscriptionUpgradePayment }>(
  { expose: true, method: "POST", path: "/admin/subscriptions/:subscriptionId/upgrade", auth: true },
  async ({ subscriptionId, plan, billingInterval }) => {
    requireRole("admin", "support");
    const subscription = await billingDB.queryRow<SubscriptionRow>`
      SELECT *
      FROM subscriptions
      WHERE id = ${subscriptionId}
    `;

    if (!subscription) {
      throw APIError.notFound("Subscription not found.");
    }
    if (subscription.status !== "active") {
      throw APIError.failedPrecondition("Only active subscriptions can be upgraded.");
    }

    const amount = getPlanAmount(plan, billingInterval);
    const payment = await createBillingPaymentIntent({
      userId: subscription.user_id,
      purpose: "subscription",
      amount,
      hostPlan: plan,
      billingInterval,
      sourceSubscriptionId: subscriptionId,
    });

    return { payment };
  },
);

export const listAdminCheckouts = api<void, { checkouts: CheckoutSessionRow[] }>(
  { expose: true, method: "GET", path: "/admin/checkouts", auth: true },
  async () => {
    requireRole("admin", "support");
    const checkouts = await billingDB.queryAll<CheckoutSessionRow>`
      SELECT
        id,
        user_id,
        checkout_type,
        provider,
        status,
        currency,
        amount,
        host_plan,
        billing_interval,
        credit_quantity,
        provider_checkout_id,
        provider_payment_id,
        provider_mode,
        redirect_url,
        success_url,
        cancel_url,
        failure_url,
        metadata,
        paid_at,
        created_at,
        updated_at
      FROM billing_checkout_sessions
      UNION ALL
      SELECT
        id,
        user_id,
        purpose AS checkout_type,
        provider,
        status,
        currency,
        amount,
        host_plan,
        billing_interval,
        credit_quantity,
        provider_checkout_id,
        provider_payment_id,
        provider_mode,
        redirect_url,
        NULL AS success_url,
        NULL AS cancel_url,
        NULL AS failure_url,
        metadata,
        paid_at,
        created_at,
        updated_at
      FROM billing_payment_intents
      ORDER BY created_at DESC
    `;
    return { checkouts };
  },
);

export const runSubscriptionExpiryCycle = api(
  {},
  async () => {
    await expireEndedSubscriptions();
    await notifySubscriptionsDueSoon();
  },
);

export const subscriptionExpiryCron = new CronJob("subscription-expiry-cycle", {
  every: "24h",
  endpoint: runSubscriptionExpiryCycle,
});

export const subscriptionNotificationCron = new CronJob("subscription-notification-cycle", {
  every: "24h",
  endpoint: runSubscriptionExpiryCycle,
});

export const reconcilePendingBillingPayments = api<void, { checked: number; paid: number; failed: number; cancelled: number; pending: number }>(
  { expose: true, method: "POST", path: "/admin/billing/payments/reconcile", auth: true },
  async () => {
    requireRole("admin", "support");
    return reconcilePendingPaymentIntentsFromProvider();
  },
);

export const runPendingBillingPaymentReconciliation = api<void, { checked: number; paid: number; failed: number; cancelled: number; pending: number }>(
  {},
  async () => reconcilePendingPaymentIntentsFromProvider(),
);

export const pendingBillingPaymentReconciliationCron = new CronJob("pending-billing-payment-reconciliation", {
  every: "5m",
  endpoint: runPendingBillingPaymentReconciliation,
});

export const getMyHostBillingAccount = api<void, { account: HostBillingAccount }>(
  { expose: true, method: "GET", path: "/billing/host/account", auth: true },
  async () => {
    const auth = requireRole("host", "admin");
    return { account: await getHostBillingAccount(auth.userID) };
  },
);

export const redeemVoucher = api<RedeemHostVoucherParams, { account: HostBillingAccount }>(
  { expose: true, method: "POST", path: "/billing/host/vouchers/redeem", auth: true },
  async ({ code }) => {
    const auth = requireRole("host", "admin");
    return { account: await redeemHostVoucher(auth.userID, code) };
  },
);

export const listAdminHostBilling = api<void, { accounts: AdminHostBillingAccount[] }>(
  { expose: true, method: "GET", path: "/admin/billing/host-accounts", auth: true },
  async () => {
    requireRole("admin", "support");
    return { accounts: await listAdminHostBillingAccounts() };
  },
);

export const adminSetHostGreylist = api<AdminSetHostGreylistParams, { account: HostBillingAccount }>(
  { expose: true, method: "POST", path: "/admin/billing/host-accounts/greylist", auth: true },
  async ({ userId, greylisted, reason }) => {
    const auth = requireRole("admin", "support");
    return {
      account: await setHostGreylist({
        userId,
        greylisted,
        reason,
        actorId: auth.userID,
      }),
    };
  },
);

export const getMyContentEntitlements = api<void, { entitlements: ContentEntitlements }>(
  { expose: true, method: "GET", path: "/billing/content/entitlements", auth: true },
  async () => {
    const auth = requireRole("host", "admin");
    return { entitlements: await getContentEntitlementsForUser(auth.userID) };
  },
);

export const getCheckoutStatus = api<{ checkoutId: string }, { status: CheckoutStatus; checkoutType: CheckoutType }>(
  { expose: true, method: "GET", path: "/billing/checkouts/:checkoutId", auth: true },
  async ({ checkoutId }) => {
    const auth = requireAuth();
    const checkout = await getCheckoutSessionById(checkoutId);

    if (!checkout) {
      throw APIError.notFound("Checkout session not found.");
    }
    if (checkout.user_id !== auth.userID && auth.role !== "admin" && auth.role !== "support") {
      throw APIError.permissionDenied("You do not have access to this checkout.");
    }

    const resolvedCheckout = await reconcilePendingCheckout(checkout);
    return { status: resolvedCheckout.status, checkoutType: resolvedCheckout.checkout_type };
  },
);

export const getBillingPaymentStatus = api<{ paymentId: string; billingStatus?: string }, { status: CheckoutStatus; purpose: CheckoutType; providerMode: "live" | "test" }>(
  { expose: true, method: "GET", path: "/billing/payments/:paymentId", auth: true },
  async ({ paymentId, billingStatus }) => {
    const auth = requireAuth();
    const intent = await getPaymentIntentById(paymentId);

    if (!intent) {
      throw APIError.notFound("Payment intent not found.");
    }
    if (intent.user_id !== auth.userID && auth.role !== "admin" && auth.role !== "support") {
      throw APIError.permissionDenied("You do not have access to this payment.");
    }

    let resolvedIntent: PaymentIntentRow;
    try {
      resolvedIntent = await reconcilePendingPaymentIntent(intent, billingStatus);
    } catch (error) {
      console.error(`Billing payment status reconciliation failed for ${paymentId}:`, error);
      resolvedIntent = (await getPaymentIntentById(paymentId)) ?? intent;
    }

    return {
      status: resolvedIntent.status,
      purpose: resolvedIntent.purpose,
      providerMode: resolvedIntent.provider_mode,
    };
  },
);

export const billingPaymentReturn = api.raw(
  { expose: true, method: "GET", path: "/billing/payments/:paymentId/return" },
  async (req: IncomingMessage, resp: ServerResponse) => {
    const url = new URL(req.url ?? "/", getAppUrl());
    const match = url.pathname.match(/\/billing\/payments\/([^/]+)\/return$/);
    const paymentId = match ? decodeURIComponent(match[1]) : "";
    const billingStatus = url.searchParams.get("billingStatus") ?? "failed";
    const safeStatus = billingStatus === "success" || billingStatus === "cancelled" || billingStatus === "failed"
      ? billingStatus
      : "failed";

    try {
      let redirectUrl = buildPricingPaymentReturnUrl(getAppUrl(), paymentId, safeStatus);
      if (paymentId) {
        const intent = await getPaymentIntentById(paymentId);
        if (intent) {
          await reconcilePendingPaymentIntent(intent, safeStatus);
          redirectUrl = buildBillingSuccessReturnUrl(getAppUrl(), paymentId, safeStatus, intent.purpose);
        }
      }
      redirectRaw(resp, redirectUrl);
      return;
    } catch (error) {
      console.error("Failed to reconcile billing payment return:", error);
    }

    redirectRaw(resp, buildPricingPaymentReturnUrl(getAppUrl(), paymentId, safeStatus));
  },
);

export const generateContentDraft = api<GenerateContentDraftParams, { draft: ContentDraftRecord; entitlements: ContentEntitlements }>(
  { expose: true, method: "POST", path: "/billing/content/drafts/generate", auth: true },
  async ({ listingId, platform, tone, templateId, includePrice, includeSpecialOffer, customHeadline }) => {
    const auth = requireRole("host", "admin");
    enforceContentDraftBurstLimit(auth.userID);
    const draftId = randomUUID();
    const listing = await getOwnedListingSnapshot(listingId, auth.userID);
    const draftOptions = normalizeDraftOptions({ includePrice, includeSpecialOffer, customHeadline });
    const template = getSocialTemplateDefinition(templateId);
    const previewEntitlements = await getContentEntitlementsForUser(auth.userID);
    if (!previewEntitlements.contentStudioEnabled) {
      throw APIError.permissionDenied("Your current plan does not include the content studio.");
    }
    const previewDebit = resolveContentDraftDebit(previewEntitlements);
    if (!previewDebit.allowed) {
      throw APIError.permissionDenied("You have used your included content drafts. Buy more credits or upgrade your plan.");
    }

    const content = await generateListingDraftWithFallback(listing, platform, tone, templateId, draftOptions);
    const tx = await billingDB.begin();

    try {
      const entitlements = await getContentEntitlementsForUserWithExecutor(auth.userID, tx);
      await debitOneContentUse(tx, auth.userID, entitlements, draftId);

      const now = new Date().toISOString();

      await tx.exec`
        INSERT INTO content_drafts (
          id, user_id, listing_id, listing_title, listing_location, platform, tone, template_id, template_name, status, content, created_at, updated_at
        )
        VALUES (
          ${draftId}, ${auth.userID}, ${listing.id}, ${listing.title}, ${listing.location}, ${platform}, ${tone}, ${template.id}, ${template.name}, ${"draft"}, ${content}, ${now}, ${now}
        )
      `;

      await tx.commit();

      const refreshed = await getContentEntitlementsForUser(auth.userID);

      return {
        draft: {
          id: draftId,
          userId: auth.userID,
          listingId: listing.id,
          listingTitle: listing.title,
          listingLocation: listing.location,
          platform,
          tone,
          templateId: template.id,
          templateName: template.name,
          status: "draft",
          content,
          scheduledFor: null,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        entitlements: refreshed,
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
);

export const listMyContentDrafts = api<void, { drafts: ContentDraftRecord[] }>(
  { expose: true, method: "GET", path: "/billing/content/drafts", auth: true },
  async () => {
    const auth = requireRole("host", "admin");
    const drafts = await billingDB.queryAll<DraftRow>`
      SELECT *
      FROM content_drafts
      WHERE user_id = ${auth.userID}
      ORDER BY created_at DESC
    `;
    return { drafts: drafts.map(mapDraft) };
  },
);

export const updateContentDraft = api<UpdateContentDraftParams, { draft: ContentDraftRecord }>(
  { expose: true, method: "PUT", path: "/billing/content/drafts/:draftId", auth: true },
  async ({ draftId, content, status, scheduledFor }) => {
    const auth = requireRole("host", "admin");
    const existing = await billingDB.queryRow<DraftRow>`
      SELECT *
      FROM content_drafts
      WHERE id = ${draftId}
    `;

    if (!existing) {
      throw APIError.notFound("Content draft not found.");
    }
    if (existing.user_id !== auth.userID) {
      throw APIError.permissionDenied("You cannot update another host's draft.");
    }

    const entitlements = await getContentEntitlementsForUser(auth.userID);
    const nextStatus = status ?? existing.status;
    if (nextStatus === "scheduled" && !entitlements.canSchedule) {
      throw APIError.permissionDenied("Your current plan does not include scheduled distribution.");
    }

    const now = new Date().toISOString();
    const nextScheduledFor = nextStatus === "scheduled" ? scheduledFor ?? existing.scheduled_for : null;
    const nextPublishedAt = nextStatus === "published" ? now : existing.published_at;

    await billingDB.exec`
      UPDATE content_drafts
      SET content = ${content ?? existing.content},
          status = ${nextStatus},
          scheduled_for = ${nextScheduledFor},
          published_at = ${nextPublishedAt},
          updated_at = ${now}
      WHERE id = ${draftId}
    `;

    return {
      draft: {
        ...mapDraft(existing),
        content: content ?? existing.content,
        status: nextStatus,
        scheduledFor: nextScheduledFor,
        publishedAt: nextPublishedAt,
        updatedAt: now,
      },
    };
  },
);

export const yocoWebhook = api.raw(
  { expose: true, method: "POST", path: "/billing/webhooks/yoco", bodyLimit: 1024 * 1024, sensitive: true },
  async (req: IncomingMessage, resp: ServerResponse) => {
    try {
      const rawBody = await readRawBody(req);
      const signatureHeader = req.headers["webhook-signature"];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      const webhookIdHeader = req.headers["webhook-id"];
      const webhookTimestampHeader = req.headers["webhook-timestamp"];
      const webhookId = Array.isArray(webhookIdHeader) ? webhookIdHeader[0] : webhookIdHeader;
      const webhookTimestamp = Array.isArray(webhookTimestampHeader) ? webhookTimestampHeader[0] : webhookTimestampHeader;
      verifyYocoWebhookSignature({
        rawBody,
        signature,
        webhookId,
        webhookTimestamp,
      });

      const event = JSON.parse(rawBody) as YocoWebhookEvent;
      const eventId = event.id || `${parseEventType(event)}:${resolveProviderOrderId(event) || resolveProviderCheckoutId(event) || randomUUID()}`;
      const eventType = parseEventType(event);

      const alreadyProcessed = await billingDB.queryRow<WebhookEventRow>`
        SELECT id
        FROM billing_webhook_events
        WHERE id = ${eventId}
      `;

      if (alreadyProcessed) {
        resp.statusCode = 200;
        resp.setHeader("Content-Type", "application/json");
        resp.end(JSON.stringify({ ok: true, duplicate: true }));
        return;
      }

      await billingDB.exec`
        INSERT INTO billing_webhook_events (id, provider, event_type, signature, payload)
        VALUES (${eventId}, ${"yoco"}, ${eventType}, ${signature ?? null}, ${rawBody}::jsonb)
      `;
      await billingWebhookEvents.publish({ eventId });

      resp.statusCode = 200;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({ ok: true, accepted: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed.";
      resp.statusCode = error instanceof APIError ? 400 : 500;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({ error: message }));
    }
  },
);

export async function processStoredYocoWebhookEvent(eventId: string) {
  const stored = await billingDB.queryRow<StoredBillingWebhookEventRow>`
    SELECT id, event_type, payload::text AS payload_json, processed_at
    FROM billing_webhook_events
    WHERE id = ${eventId}
  `;

  if (!stored || stored.processed_at) {
    return;
  }

  const event = JSON.parse(stored.payload_json) as YocoWebhookEvent;
  const eventType = stored.event_type || parseEventType(event);
  const outcome = classifyYocoWebhookOutcome(eventType, event.payload?.status);

  if (!isFulfilmentSafeWebhookOutcome(outcome)) {
    await billingDB.exec`
      UPDATE billing_webhook_events
      SET processed_at = ${new Date().toISOString()}
      WHERE id = ${eventId}
    `;
    return;
  }

  const paymentIntent = await findPaymentIntentForWebhook(event);
  const session = paymentIntent ? null : await findCheckoutForWebhook(event);

  if (!paymentIntent && !session) {
    await billingDB.exec`
      UPDATE billing_webhook_events
      SET processed_at = ${new Date().toISOString()}
      WHERE id = ${eventId}
    `;
    return;
  }

  const providerPaymentId = event.payload?.paymentId ?? event.payload?.id ?? null;
  const providerOrderId = resolveProviderOrderId(event);

  if (paymentIntent) {
    assertWebhookIntentOwnership(paymentIntent, event);
    await storeProviderOrderId(paymentIntent.id, providerOrderId);
  }

  if (paymentIntent) {
    await withBillingFulfilmentLock("payment", paymentIntent.id, async () => {
      const current = (await getPaymentIntentById(paymentIntent.id)) ?? paymentIntent;
      if (outcome === "paid") {
        await fulfilSuccessfulPaymentIntent(current, providerPaymentId);
      } else if (outcome === "failed") {
        await markPaymentIntentStatus(current, "failed");
      } else if (outcome === "cancelled") {
        await markPaymentIntentStatus(current, "cancelled");
      }
    });
  } else if (session) {
    await withBillingFulfilmentLock("checkout", session.id, async () => {
      const current = (await getCheckoutSessionById(session.id)) ?? session;
      if (outcome === "paid") {
        await fulfilSuccessfulCheckout(current, providerPaymentId);
      } else if (outcome === "failed") {
        await markCheckoutStatus(current, "failed");
      } else if (outcome === "cancelled") {
        await markCheckoutStatus(current, "cancelled");
      }
    });
  }

  await billingDB.exec`
    UPDATE billing_webhook_events
    SET processed_at = ${new Date().toISOString()}
    WHERE id = ${eventId}
  `;
}
