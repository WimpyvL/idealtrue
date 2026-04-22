import { createHash } from "node:crypto";

export type HostBillingSource = "none" | "voucher" | "paid";
export type HostBillingStatus = "inactive" | "active" | "greylisted";
export type HostBillingNextAction = "redeem_voucher" | "add_card" | "choose_plan" | "greylist" | "none";

export interface BillingTimelineInput {
  billingSource: HostBillingSource;
  billingStatus: HostBillingStatus;
  currentPeriodEnd: string | null;
  reminderWindowStartsAt: string | null;
  cardOnFile: boolean;
  greylistedAt: string | null;
}

export interface BillingTimeline {
  inReminderWindow: boolean;
  greylistEligible: boolean;
  nextAction: HostBillingNextAction;
}

export type HostBillingRestrictedArea = "hosting" | "listings" | "bookings";

function addMonthsIso(input: string, months: number) {
  const date = new Date(input);
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result.toISOString();
}

function subtractDaysIso(input: string, days: number) {
  const date = new Date(input);
  const result = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  return result.toISOString();
}

export function computeVoucherWindow(redeemedAt: string, durationMonths: number, reminderDays: number) {
  const currentPeriodEnd = addMonthsIso(redeemedAt, durationMonths);
  return {
    currentPeriodStart: redeemedAt,
    currentPeriodEnd,
    reminderWindowStartsAt: subtractDaysIso(currentPeriodEnd, reminderDays),
  };
}

export function deriveBillingTimeline(input: BillingTimelineInput, nowIso: string): BillingTimeline {
  const now = new Date(nowIso).getTime();
  const reminderStartsAt = input.reminderWindowStartsAt ? new Date(input.reminderWindowStartsAt).getTime() : null;
  const currentPeriodEnd = input.currentPeriodEnd ? new Date(input.currentPeriodEnd).getTime() : null;
  const inReminderWindow =
    input.billingSource === "voucher" &&
    reminderStartsAt != null &&
    currentPeriodEnd != null &&
    now >= reminderStartsAt &&
    now < currentPeriodEnd &&
    !input.cardOnFile &&
    !input.greylistedAt;
  const greylistEligible =
    input.billingSource === "voucher" &&
    currentPeriodEnd != null &&
    now >= currentPeriodEnd &&
    !input.cardOnFile &&
    !input.greylistedAt;

  let nextAction: HostBillingNextAction = "none";
  if (input.greylistedAt || input.billingStatus === "greylisted") {
    nextAction = "choose_plan";
  } else if (greylistEligible) {
    nextAction = "greylist";
  } else if (inReminderWindow) {
    nextAction = "add_card";
  } else if (input.billingSource === "none" || input.billingStatus === "inactive") {
    nextAction = "redeem_voucher";
  }

  return {
    inReminderWindow,
    greylistEligible,
    nextAction,
  };
}

export function isHostBillingRestricted(status: HostBillingStatus | null | undefined) {
  return status === "greylisted";
}

export function getHostBillingRestrictionMessage(area: HostBillingRestrictedArea = "hosting") {
  if (area === "listings") {
    return "Your host account is greylisted. Listing access is paused until billing is resolved.";
  }

  if (area === "bookings") {
    return "Your host account is greylisted. Booking actions are paused until billing is resolved.";
  }

  return "Your host account is greylisted until billing is resolved.";
}

function makeDeterministicChunk(seed: number, index: number, alphabet: string) {
  const hash = createHash("sha256")
    .update(`${seed}:${index}`)
    .digest("hex")
    .toUpperCase();

  let chunk = "";
  for (let offset = 0; chunk.length < 10; offset += 2) {
    const source = parseInt(hash.slice(offset, offset + 2), 16);
    chunk += alphabet[source % alphabet.length];
  }
  return chunk;
}

export function generateVoucherPins(count: number, options?: { seed?: number; prefix?: string }) {
  const prefix = options?.prefix?.trim().toUpperCase() || "VOUCHER";
  const seed = options?.seed ?? Date.now();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pins: string[] = [];

  for (let index = 0; index < count; index += 1) {
    pins.push(`${prefix}-${makeDeterministicChunk(seed, index + 1, alphabet)}`);
  }

  return pins;
}
