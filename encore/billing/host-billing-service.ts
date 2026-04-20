import { randomUUID } from "node:crypto";
import { APIError } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { billingDB } from "./db";
import {
  type HostBillingNextAction,
  type HostBillingSource,
  type HostBillingStatus,
  computeVoucherWindow,
  deriveBillingTimeline,
} from "./host-billing";
import { catalogDB } from "../catalog/db";
import { identityDB } from "../identity/db";
import type { HostPlan } from "../shared/domain";
import { createNotification } from "../ops/notifications";

type BillingAccountRow = {
  user_id: string;
  plan: HostPlan;
  billing_source: HostBillingSource;
  billing_status: HostBillingStatus;
  voucher_code: string | null;
  voucher_redeemed_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  reminder_window_starts_at: string | null;
  last_reminder_sent_at: string | null;
  reminder_count: number;
  card_on_file: boolean;
  cardholder_name: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
  greylisted_at: string | null;
  greylist_reason: string | null;
  created_at: string;
  updated_at: string;
};

type VoucherCodeRow = {
  id: string;
  code: string;
  campaign: string;
  duration_months: number;
  status: "available" | "redeemed";
  redeemed_by: string | null;
  redeemed_at: string | null;
  free_starts_at: string | null;
  free_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface HostBillingAccount {
  userId: string;
  plan: HostPlan;
  billingSource: HostBillingSource;
  billingStatus: HostBillingStatus;
  voucherCode: string | null;
  voucherRedeemedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  reminderWindowStartsAt: string | null;
  lastReminderSentAt: string | null;
  reminderCount: number;
  cardOnFile: boolean;
  cardholderName: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  cardLabel: string | null;
  greylistedAt: string | null;
  greylistReason: string | null;
  inReminderWindow: boolean;
  greylistEligible: boolean;
  nextAction: HostBillingNextAction;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBillingCardInput {
  cardholderName: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface AdminHostBillingAccount extends HostBillingAccount {
  activeListingCount: number;
  visibleListingCount: number;
}

function normalizeVoucherCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeCardholderName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeCardBrand(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 40);
}

function mapBillingAccount(row: BillingAccountRow): HostBillingAccount {
  const timeline = deriveBillingTimeline(
    {
      billingSource: row.billing_source,
      billingStatus: row.billing_status,
      currentPeriodEnd: row.current_period_end,
      reminderWindowStartsAt: row.reminder_window_starts_at,
      cardOnFile: row.card_on_file,
      greylistedAt: row.greylisted_at,
    },
    new Date().toISOString(),
  );

  return {
    userId: row.user_id,
    plan: row.plan,
    billingSource: row.billing_source,
    billingStatus: row.billing_status,
    voucherCode: row.voucher_code,
    voucherRedeemedAt: row.voucher_redeemed_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    reminderWindowStartsAt: row.reminder_window_starts_at,
    lastReminderSentAt: row.last_reminder_sent_at,
    reminderCount: row.reminder_count,
    cardOnFile: row.card_on_file,
    cardholderName: row.cardholder_name,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    cardExpiryMonth: row.card_expiry_month,
    cardExpiryYear: row.card_expiry_year,
    cardLabel:
      row.card_brand && row.card_last4
        ? `${row.card_brand} ending ${row.card_last4}`
        : row.card_last4
          ? `Card ending ${row.card_last4}`
          : null,
    greylistedAt: row.greylisted_at,
    greylistReason: row.greylist_reason,
    inReminderWindow: timeline.inReminderWindow,
    greylistEligible: timeline.greylistEligible,
    nextAction: timeline.nextAction,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function appendBillingEvent(params: {
  userId: string;
  eventType: string;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await billingDB.exec`
    INSERT INTO host_billing_events (id, user_id, event_type, actor_id, metadata, created_at)
    VALUES (
      ${randomUUID()},
      ${params.userId},
      ${params.eventType},
      ${params.actorId ?? null},
      ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb,
      ${new Date().toISOString()}
    )
  `;
}

export async function getHostBillingAccount(userId: string) {
  const existing = await billingDB.queryRow<BillingAccountRow>`
    SELECT *
    FROM host_billing_accounts
    WHERE user_id = ${userId}
  `;

  if (existing) {
    return mapBillingAccount(existing);
  }

  const user = await identityDB.queryRow<{ host_plan: HostPlan }>`
    SELECT host_plan
    FROM users
    WHERE id = ${userId}
  `;
  if (!user) {
    throw APIError.notFound("Host account not found.");
  }

  const now = new Date().toISOString();
  await billingDB.exec`
    INSERT INTO host_billing_accounts (
      user_id, plan, billing_source, billing_status, reminder_count, card_on_file, created_at, updated_at
    )
    VALUES (
      ${userId}, ${user.host_plan}, ${"none"}, ${"inactive"}, ${0}, ${false}, ${now}, ${now}
    )
    ON CONFLICT (user_id) DO NOTHING
  `;

  const created = await billingDB.queryRow<BillingAccountRow>`
    SELECT *
    FROM host_billing_accounts
    WHERE user_id = ${userId}
  `;
  if (!created) {
    throw APIError.internal("Failed to initialize host billing account.");
  }
  return mapBillingAccount(created);
}

export async function saveHostBillingCard(userId: string, input: SaveBillingCardInput) {
  const cardholderName = normalizeCardholderName(input.cardholderName);
  const brand = normalizeCardBrand(input.brand);
  const last4 = input.last4.trim();

  if (!cardholderName) {
    throw APIError.invalidArgument("Cardholder name is required.");
  }
  if (!brand) {
    throw APIError.invalidArgument("Card brand is required.");
  }
  if (!/^\d{4}$/.test(last4)) {
    throw APIError.invalidArgument("Last four digits must be exactly 4 numbers.");
  }
  if (!Number.isInteger(input.expiryMonth) || input.expiryMonth < 1 || input.expiryMonth > 12) {
    throw APIError.invalidArgument("Expiry month must be between 1 and 12.");
  }
  if (!Number.isInteger(input.expiryYear) || input.expiryYear < 2026) {
    throw APIError.invalidArgument("Expiry year is invalid.");
  }

  await getHostBillingAccount(userId);
  const now = new Date().toISOString();
  await billingDB.exec`
    UPDATE host_billing_accounts
    SET card_on_file = ${true},
        cardholder_name = ${cardholderName},
        card_brand = ${brand},
        card_last4 = ${last4},
        card_expiry_month = ${input.expiryMonth},
        card_expiry_year = ${input.expiryYear},
        updated_at = ${now}
    WHERE user_id = ${userId}
  `;

  await appendBillingEvent({
    userId,
    eventType: "card_added",
    actorId: userId,
    metadata: { brand, last4 },
  });

  return getHostBillingAccount(userId);
}

async function pauseHostListings(userId: string) {
  await catalogDB.exec`
    UPDATE listings
    SET status = ${"inactive"},
        updated_at = ${new Date().toISOString()}
    WHERE host_id = ${userId}
      AND status = ${"active"}
  `;
}

export async function setHostGreylist(params: {
  userId: string;
  greylisted: boolean;
  reason?: string | null;
  actorId?: string | null;
}) {
  const account = await getHostBillingAccount(params.userId);
  const now = new Date().toISOString();
  const nextStatus: HostBillingStatus = params.greylisted ? "greylisted" : account.billingSource === "none" ? "inactive" : "active";
  const nextReason = params.greylisted ? params.reason?.trim() || "Billing follow-up required." : null;

  await billingDB.exec`
    UPDATE host_billing_accounts
    SET billing_status = ${nextStatus},
        greylisted_at = ${params.greylisted ? now : null},
        greylist_reason = ${nextReason},
        updated_at = ${now}
    WHERE user_id = ${params.userId}
  `;

  if (params.greylisted) {
    await pauseHostListings(params.userId);
    await createNotification({
      title: "Host billing access restricted",
      message: "Your free billing period ended without a card on file. Your listings are paused until billing is resolved.",
      type: "warning",
      target: params.userId,
      actionPath: "/host",
    });
  }

  await appendBillingEvent({
    userId: params.userId,
    eventType: params.greylisted ? "greylisted" : "greylist_removed",
    actorId: params.actorId ?? null,
    metadata: { reason: nextReason },
  });

  return getHostBillingAccount(params.userId);
}

export async function redeemHostVoucher(userId: string, rawCode: string) {
  const code = normalizeVoucherCode(rawCode);
  if (!code) {
    throw APIError.invalidArgument("Voucher PIN is required.");
  }

  const tx = await billingDB.begin();

  try {
    const voucher = await tx.queryRow<VoucherCodeRow>`
      SELECT *
      FROM host_voucher_codes
      WHERE code = ${code}
      FOR UPDATE
    `;
    if (!voucher) {
      throw APIError.notFound("Voucher PIN was not found.");
    }
    if (voucher.status !== "available" || voucher.redeemed_by) {
      throw APIError.failedPrecondition("That voucher PIN has already been used.");
    }

    const now = new Date().toISOString();
    const window = computeVoucherWindow(now, voucher.duration_months, 7);

    await tx.exec`
      INSERT INTO host_billing_accounts (
        user_id,
        plan,
        billing_source,
        billing_status,
        voucher_code,
        voucher_redeemed_at,
        current_period_start,
        current_period_end,
        reminder_window_starts_at,
        reminder_count,
        card_on_file,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${"standard"},
        ${"voucher"},
        ${"active"},
        ${voucher.code},
        ${now},
        ${window.currentPeriodStart},
        ${window.currentPeriodEnd},
        ${window.reminderWindowStartsAt},
        ${0},
        ${false},
        ${now},
        ${now}
      )
      ON CONFLICT (user_id) DO UPDATE
      SET plan = EXCLUDED.plan,
          billing_source = EXCLUDED.billing_source,
          billing_status = EXCLUDED.billing_status,
          voucher_code = EXCLUDED.voucher_code,
          voucher_redeemed_at = EXCLUDED.voucher_redeemed_at,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          reminder_window_starts_at = EXCLUDED.reminder_window_starts_at,
          reminder_count = 0,
          greylisted_at = NULL,
          greylist_reason = NULL,
          updated_at = EXCLUDED.updated_at
    `;

    await tx.exec`
      UPDATE host_voucher_codes
      SET status = ${"redeemed"},
          redeemed_by = ${userId},
          redeemed_at = ${now},
          free_starts_at = ${window.currentPeriodStart},
          free_ends_at = ${window.currentPeriodEnd},
          updated_at = ${now}
      WHERE id = ${voucher.id}
    `;

    await identityDB.exec`
      UPDATE users
      SET host_plan = ${"standard"},
          updated_at = ${now}
      WHERE id = ${userId}
    `;

    await tx.exec`
      INSERT INTO host_billing_events (id, user_id, event_type, actor_id, metadata, created_at)
      VALUES (
        ${randomUUID()},
        ${userId},
        ${"voucher_redeemed"},
        ${userId},
        ${JSON.stringify({ code: voucher.code, campaign: voucher.campaign })}::jsonb,
        ${now}
      )
    `;

    await tx.commit();

    return getHostBillingAccount(userId);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function syncPaidBillingAccount(params: {
  userId: string;
  plan: HostPlan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}) {
  const now = new Date().toISOString();
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
      ${params.userId},
      ${params.plan},
      ${"paid"},
      ${"active"},
      ${params.currentPeriodStart},
      ${params.currentPeriodEnd},
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
        current_period_end = EXCLUDED.current_period_end,
        reminder_window_starts_at = NULL,
        voucher_code = NULL,
        voucher_redeemed_at = NULL,
        greylisted_at = NULL,
        greylist_reason = NULL,
        updated_at = EXCLUDED.updated_at
  `;

  await appendBillingEvent({
    userId: params.userId,
    eventType: "paid_subscription_started",
    actorId: params.userId,
    metadata: { plan: params.plan },
  });
}

export async function listAdminHostBillingAccounts() {
  const accounts = await billingDB.queryAll<BillingAccountRow>`
    SELECT *
    FROM host_billing_accounts
    ORDER BY updated_at DESC
  `;

  const listingCounts = await catalogDB.rawQueryAll<{ host_id: string; active_count: number; visible_count: number }>(
    `
      SELECT
        host_id,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
        COUNT(*) FILTER (WHERE status IN ('active', 'inactive'))::int AS visible_count
      FROM listings
      GROUP BY host_id
    `,
  );

  const countsByHost = new Map(
    listingCounts.map((row) => [row.host_id, { activeCount: row.active_count, visibleCount: row.visible_count }]),
  );

  return accounts.map((row): AdminHostBillingAccount => {
    const mapped = mapBillingAccount(row);
    const counts = countsByHost.get(row.user_id);
    return {
      ...mapped,
      activeListingCount: counts?.activeCount ?? 0,
      visibleListingCount: counts?.visibleCount ?? 0,
    };
  });
}

function sameUtcDay(leftIso: string | null, rightIso: string) {
  if (!leftIso) {
    return false;
  }
  return leftIso.slice(0, 10) === rightIso.slice(0, 10);
}

export async function processVoucherReminderCycle(nowIso = new Date().toISOString()) {
  const rows = await billingDB.queryAll<BillingAccountRow>`
    SELECT *
    FROM host_billing_accounts
    WHERE billing_source = ${"voucher"}
      AND billing_status <> ${"greylisted"}
  `;

  for (const row of rows) {
    const account = mapBillingAccount(row);

    if (account.inReminderWindow && !sameUtcDay(account.lastReminderSentAt, nowIso)) {
      await createNotification({
        title: "Add a billing card before your free host period ends",
        message: `Your free Standard host period ends on ${account.currentPeriodEnd?.slice(0, 10)}. Add a billing card to avoid interruption.`,
        type: "warning",
        target: account.userId,
        actionPath: "/host",
      });

      await billingDB.exec`
        UPDATE host_billing_accounts
        SET last_reminder_sent_at = ${nowIso},
            reminder_count = reminder_count + 1,
            updated_at = ${nowIso}
        WHERE user_id = ${account.userId}
      `;

      await appendBillingEvent({
        userId: account.userId,
        eventType: "voucher_reminder_sent",
        metadata: { reminderCount: account.reminderCount + 1 },
      });
      continue;
    }

    if (account.greylistEligible) {
      await setHostGreylist({
        userId: account.userId,
        greylisted: true,
        reason: "Voucher grace period ended without a billing card on file.",
      });
    }
  }
}

export const hostBillingReminderCron = new CronJob("host-billing-reminder-cycle", {
  every: "24h",
  endpoint: async () => {
    await processVoucherReminderCycle();
  },
});
