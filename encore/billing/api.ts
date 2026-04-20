import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { billingDB } from "./db";
import { generateListingDraftWithFallback } from "./gemini";
import { classifyYocoWebhookOutcome } from "./webhook-classification";
import { toMinorUnits } from "./pricing";
import { catalogDB } from "../catalog/db";
import { identityDB } from "../identity/db";
import {
  notifyCheckoutStatusChanged,
  notifyContentCreditsPurchased,
  notifySubscriptionActivated,
} from "../ops/notifications";
import { requireAuth, requireRole } from "../shared/auth";
import { HOST_PLANS, HostPlan, SubscriptionPlan } from "../shared/domain";
import { platformEvents } from "../analytics/events";
import { createYocoCheckout, getAppUrl, verifyYocoWebhookSignature, type YocoWebhookEvent } from "./yoco";
import { rewardSubscriptionReferralConversion } from "../referrals/api";
import {
  getHostBillingAccount,
  listAdminHostBillingAccounts,
  redeemHostVoucher,
  saveHostBillingCard,
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

type BillingInterval = "monthly" | "annual";
type ContentDraftStatus = "draft" | "scheduled" | "published";
type CheckoutType = "subscription" | "content_credits";
type CheckoutStatus = "pending" | "paid" | "failed" | "cancelled";

interface SubscriptionCheckoutParams {
  plan: HostPlan;
  billingInterval: BillingInterval;
}

interface PurchaseCreditsParams {
  credits: number;
}

interface RedeemHostVoucherParams {
  code: string;
}

interface SaveBillingCardParams {
  cardholderName: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
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
  status: "active" | "expired" | "cancelled";
  amount: number;
  billing_interval: BillingInterval;
  starts_at: string;
  ends_at: string;
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

type WebhookEventRow = {
  id: string;
};

type StoredWebhookEventRow = {
  event_type: string;
  payload_json: string;
};

type QueryExecutor = Pick<typeof billingDB, "queryRow" | "queryAll" | "exec">;

const CONTENT_DRAFT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const CONTENT_DRAFT_RATE_LIMIT_MAX = 5;
const contentDraftRateLimitStore = new Map<string, number[]>();

const CONTENT_LIMITS: Record<HostPlan, { includedDraftsPerMonth: number; canSchedule: boolean; contentStudioEnabled: boolean }> = {
  standard: { includedDraftsPerMonth: 20, canSchedule: false, contentStudioEnabled: true },
  professional: { includedDraftsPerMonth: 60, canSchedule: true, contentStudioEnabled: true },
  premium: { includedDraftsPerMonth: 120, canSchedule: true, contentStudioEnabled: true },
};

function getCreditPrice(credits: number) {
  if (![10, 25, 50].includes(credits)) {
    throw APIError.invalidArgument("Unsupported credit top-up size.");
  }
  return credits * 12;
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

function buildBillingUrls(kind: CheckoutType, id: string) {
  const base = getAppUrl();
  const root = kind === "subscription" ? "/pricing" : "/host/social";
  return {
    successUrl: `${base}${root}?billing_status=success&checkout_id=${encodeURIComponent(id)}`,
    cancelUrl: `${base}${root}?billing_status=cancelled&checkout_id=${encodeURIComponent(id)}`,
    failureUrl: `${base}${root}?billing_status=failed&checkout_id=${encodeURIComponent(id)}`,
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
  if (!entitlements.contentStudioEnabled) {
    throw APIError.permissionDenied("Your current plan does not include the content studio.");
  }

  if (entitlements.remainingIncludedDrafts > 0) {
    return;
  }

  if (entitlements.creditBalance < 1) {
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

async function createCheckoutSessionRow(params: {
  userId: string;
  checkoutType: CheckoutType;
  amount: number;
  hostPlan?: HostPlan;
  billingInterval?: BillingInterval;
  creditQuantity?: number;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
}) {
  const now = new Date().toISOString();
  const checkoutId = randomUUID();

  await billingDB.exec`
    INSERT INTO billing_checkout_sessions (
      id, user_id, checkout_type, status, currency, amount, host_plan, billing_interval,
      credit_quantity, success_url, cancel_url, failure_url, metadata, created_at, updated_at
    )
    VALUES (
      ${checkoutId}, ${params.userId}, ${params.checkoutType}, ${"pending"}, ${"ZAR"}, ${params.amount},
      ${params.hostPlan ?? null}, ${params.billingInterval ?? null}, ${params.creditQuantity ?? null},
      ${params.successUrl}, ${params.cancelUrl}, ${params.failureUrl},
      ${JSON.stringify({ checkoutId, checkoutType: params.checkoutType })}, ${now}, ${now}
    )
  `;

  return checkoutId;
}

async function storeProviderCheckout(params: {
  checkoutId: string;
  providerCheckoutId: string;
  providerMode?: string;
  redirectUrl: string;
}) {
  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE billing_checkout_sessions
    SET provider_checkout_id = ${params.providerCheckoutId},
        provider_mode = ${params.providerMode ?? null},
        redirect_url = ${params.redirectUrl},
        updated_at = ${now}
    WHERE id = ${params.checkoutId}
  `;
}

async function activatePlanFromCheckout(session: CheckoutSessionRow) {
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

  if (!existingSubscription) {
    await billingDB.exec`
      UPDATE subscriptions
      SET status = ${"cancelled"}
      WHERE user_id = ${session.user_id}
        AND status = ${"active"}
    `;

    await billingDB.exec`
      INSERT INTO subscriptions (
        id, user_id, checkout_session_id, plan, status, amount, billing_interval, starts_at, ends_at, created_at
      )
      VALUES (
        ${subscriptionId}, ${session.user_id}, ${session.id}, ${session.host_plan}, ${"active"}, ${session.amount},
        ${session.billing_interval}, ${now.toISOString()}, ${endsAt.toISOString()}, ${now.toISOString()}
      )
    `;
  }

  await identityDB.exec`
    UPDATE users
    SET host_plan = ${session.host_plan},
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

async function creditWalletFromCheckout(session: CheckoutSessionRow) {
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

  if (session.checkout_type === "subscription") {
    await activatePlanFromCheckout(session);
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
  } else {
    await creditWalletFromCheckout(session);
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

function resolveProviderCheckoutId(event: YocoWebhookEvent) {
  return event.payload?.id ?? event.id ?? null;
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

async function findSuccessfulWebhookForCheckout(session: CheckoutSessionRow): Promise<YocoWebhookEvent | null> {
  const matchingEvents = await billingDB.queryAll<StoredWebhookEventRow>`
    SELECT event_type, payload::text AS payload_json
    FROM billing_webhook_events
    WHERE provider = ${"yoco"}
      AND (
        payload #>> '{payload,metadata,checkoutId}' = ${session.id}
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

async function reconcilePendingCheckout(session: CheckoutSessionRow) {
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

export const listPlans = api<void, { plans: SubscriptionPlan[] }>(
  { expose: true, method: "GET", path: "/billing/plans" },
  async () => ({ plans: HOST_PLANS }),
);

export const createSubscriptionCheckout = api<SubscriptionCheckoutParams, { checkoutId: string; redirectUrl: string }>(
  { expose: true, method: "POST", path: "/billing/subscriptions/checkout", auth: true },
  async ({ plan, billingInterval }) => {
    const auth = requireRole("host", "admin");

    const amount = getPlanAmount(plan, billingInterval);
    const urls = buildBillingUrls("subscription", randomUUID());
    const checkoutId = await createCheckoutSessionRow({
      userId: auth.userID,
      checkoutType: "subscription",
      amount,
      hostPlan: plan,
      billingInterval,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      failureUrl: urls.failureUrl,
    });

    const yoco = await createYocoCheckout({
      amount: toMinorUnits(amount),
      currency: "ZAR",
      successUrl: urls.successUrl.replace(/checkout_id=[^&]*/, `checkout_id=${encodeURIComponent(checkoutId)}`),
      cancelUrl: urls.cancelUrl.replace(/checkout_id=[^&]*/, `checkout_id=${encodeURIComponent(checkoutId)}`),
      failureUrl: urls.failureUrl.replace(/checkout_id=[^&]*/, `checkout_id=${encodeURIComponent(checkoutId)}`),
      metadata: {
        checkoutId,
        checkoutType: "subscription",
        userId: auth.userID,
        plan,
        billingInterval,
      },
    });

    await storeProviderCheckout({
      checkoutId,
      providerCheckoutId: yoco.id,
      providerMode: yoco.mode,
      redirectUrl: yoco.redirectUrl,
    });

    return { checkoutId, redirectUrl: yoco.redirectUrl };
  },
);

export const upgradePlan = createSubscriptionCheckout;

export const listMySubscriptions = api<void, { subscriptions: SubscriptionRow[] }>(
  { expose: true, method: "GET", path: "/billing/subscriptions", auth: true },
  async () => {
    const auth = requireAuth();
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

export const listAdminCheckouts = api<void, { checkouts: CheckoutSessionRow[] }>(
  { expose: true, method: "GET", path: "/admin/checkouts", auth: true },
  async () => {
    requireRole("admin", "support");
    const checkouts = await billingDB.queryAll<CheckoutSessionRow>`
      SELECT *
      FROM billing_checkout_sessions
      ORDER BY created_at DESC
    `;
    return { checkouts };
  },
);

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

export const saveBillingCard = api<SaveBillingCardParams, { account: HostBillingAccount }>(
  { expose: true, method: "POST", path: "/billing/host/card", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin");
    return { account: await saveHostBillingCard(auth.userID, params) };
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

export const createContentCreditsCheckout = api<PurchaseCreditsParams, { checkoutId: string; redirectUrl: string }>(
  { expose: true, method: "POST", path: "/billing/content/credits/checkout", auth: true },
  async ({ credits }) => {
    const auth = requireRole("host", "admin");
    if (!Number.isInteger(credits) || credits <= 0) {
      throw APIError.invalidArgument("Credits must be a positive integer.");
    }

    const amount = getCreditPrice(credits);
    const urls = buildBillingUrls("content_credits", randomUUID());
    const checkoutId = await createCheckoutSessionRow({
      userId: auth.userID,
      checkoutType: "content_credits",
      amount,
      creditQuantity: credits,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      failureUrl: urls.failureUrl,
    });

    const yoco = await createYocoCheckout({
      amount: toMinorUnits(amount),
      currency: "ZAR",
      successUrl: urls.successUrl.replace(/checkout_id=[^&]*/, `checkout_id=${encodeURIComponent(checkoutId)}`),
      cancelUrl: urls.cancelUrl.replace(/checkout_id=[^&]*/, `checkout_id=${encodeURIComponent(checkoutId)}`),
      failureUrl: urls.failureUrl.replace(/checkout_id=[^&]*/, `checkout_id=${encodeURIComponent(checkoutId)}`),
      metadata: {
        checkoutId,
        checkoutType: "content_credits",
        userId: auth.userID,
        credits: String(credits),
      },
    });

    await storeProviderCheckout({
      checkoutId,
      providerCheckoutId: yoco.id,
      providerMode: yoco.mode,
      redirectUrl: yoco.redirectUrl,
    });

    return { checkoutId, redirectUrl: yoco.redirectUrl };
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
    if (previewEntitlements.remainingIncludedDrafts < 1 && previewEntitlements.creditBalance < 1) {
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
      const eventId = event.id || `${parseEventType(event)}:${resolveProviderCheckoutId(event) || randomUUID()}`;
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

      const session = await findCheckoutForWebhook(event);
      if (!session) {
        resp.statusCode = 202;
        resp.setHeader("Content-Type", "application/json");
        resp.end(JSON.stringify({ ok: true, ignored: true }));
        return;
      }

      const providerPaymentId = event.payload?.paymentId ?? null;
      const outcome = classifyYocoWebhookOutcome(eventType, event.payload?.status);

      if (outcome === "paid") {
        await fulfilSuccessfulCheckout(session, providerPaymentId);
      } else if (outcome === "failed") {
        await markCheckoutStatus(session, "failed");
      } else if (outcome === "cancelled") {
        await markCheckoutStatus(session, "cancelled");
      }

      await billingDB.exec`
        UPDATE billing_webhook_events
        SET processed_at = ${new Date().toISOString()}
        WHERE id = ${eventId}
      `;

      resp.statusCode = 200;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({ ok: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed.";
      resp.statusCode = error instanceof APIError ? 400 : 500;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({ error: message }));
    }
  },
);
