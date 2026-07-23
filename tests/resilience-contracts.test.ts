import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Author: ( |╲ ) Klaasvaakie

test("listing media commit and orphan cleanup serialize against the same intent row", () => {
  const source = readFileSync(new URL("../encore/catalog/api.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../encore/catalog/migrations/9_media_upload_intents.up.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE listing_media_upload_intents/);
  assert.match(source, /commitListingMediaUpload/);
  assert.match(source, /reconcileAbandonedListingMediaUploads/);
  assert.match(source, /UPDATE listing_media_upload_intents/);
  assert.match(source, /RETURNING id/);
});

test("availability migration normalizes conflicting rows before enforcing constraints", () => {
  const migration = readFileSync(
    new URL("../encore/catalog/migrations/10_availability_range_exclusion.up.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
  assert.match(migration, /DELETE FROM listing_availability_blocks\s+WHERE starts_on >= ends_on/);
  assert.match(migration, /overlapping_rows AS/);
  assert.doesNotMatch(migration, /\boverlaps\s+AS\s*\(/i);
  assert.match(migration, /DELETE FROM listing_availability_blocks target\s+USING overlapping_rows/);
  assert.match(migration, /ADD CONSTRAINT listing_availability_blocks_no_overlap/);
  assert.match(migration, /ADD CONSTRAINT listing_availability_blocks_valid_range/);
});

test("referral rewards normalize duplicates before enforcing integrity guards", () => {
  const source = readFileSync(new URL("../encore/referrals/api.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../encore/referrals/migrations/3_reward_integrity.up.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /DELETE FROM referral_rewards\s+WHERE referrer_id = referred_user_id/);
  assert.match(migration, /DELETE FROM referral_rewards victim\s+USING referral_rewards keeper/);
  assert.match(migration, /referral_rewards_no_self_referral/);
  assert.match(migration, /referral_rewards_positive_amount/);
  assert.match(migration, /referral_rewards_valid_trigger/);
  assert.match(migration, /referral_rewards_valid_program/);
  assert.match(migration, /referral_rewards_valid_status/);
  assert.match(migration, /CREATE UNIQUE INDEX referral_rewards_unique_workflow_idx/);
  assert.match(source, /assertManualRewardAllowed/);
  assert.match(source, /A user cannot refer themselves/);
  assert.match(source, /A matching referral reward already exists/);
  assert.match(source, /Referral reward not found/);
});

test("workflow hardening guards review deletes and planner retries", () => {
  const reviewsSource = readFileSync(new URL("../encore/reviews/api.ts", import.meta.url), "utf8");
  const plannerSource = readFileSync(new URL("../src/pages/HolidayPlanner.tsx", import.meta.url), "utf8");

  assert.match(reviewsSource, /DELETE FROM reviews\s+WHERE id = \$\{reviewId\}\s+RETURNING id/);
  assert.match(reviewsSource, /APIError\.notFound\("Review not found\."\)/);
  assert.match(plannerSource, /failedPrompt/);
  assert.match(plannerSource, /Retry last request/);
  assert.match(plannerSource, /RefreshCw/);
});

test("ops admin endpoints use typed API errors for missing state and deletes", () => {
  const source = readFileSync(new URL("../encore/ops/api.ts", import.meta.url), "utf8");

  assert.match(source, /APIError\.notFound\("KYC submission not found\."\)/);
  assert.doesNotMatch(source, /throw new Error\("KYC submission not found\."\)/);
  assert.match(source, /DELETE FROM notifications\s+WHERE id = \$\{notificationId\}\s+RETURNING id/);
  assert.match(source, /APIError\.notFound\("Notification not found\."\)/);
  assert.match(source, /APIError\.failedPrecondition\("Platform settings not initialized\."\)/);
  assert.doesNotMatch(source, /throw new Error\("Platform settings not initialized\."\)/);
});

test("payment dispute resolution migration keeps booking state aligned", () => {
  const migration = readFileSync(
    new URL("../encore/booking/migrations/5_payment_dispute_resolution_guards.up.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE OR REPLACE FUNCTION apply_payment_dispute_resolution/);
  assert.match(migration, /NEW\.event <> 'DISPUTE_RESOLVED'/);
  assert.match(migration, /dispute_resolution = 'PAYMENT_CONFIRMED'/);
  assert.match(migration, /payment_state = 'COMPLETED'/);
  assert.match(migration, /inquiry_state = 'BOOKED'/);
  assert.match(migration, /payment_confirmed_at = COALESCE\(payment_confirmed_at, NEW\.created_at\)/);
  assert.match(migration, /dispute_resolution = 'PAYMENT_REJECTED'/);
  assert.match(migration, /payment_state <> 'COMPLETED'/);
  assert.match(migration, /CREATE TRIGGER payment_dispute_resolution_guard/);
});

test("public messaging endpoint cannot spoof system messages", () => {
  const source = readFileSync(new URL("../encore/messaging/api.ts", import.meta.url), "utf8");

  assert.match(source, /if \(params\.isSystem\) \{/);
  assert.match(source, /System messages cannot be sent through the public messaging endpoint/);
  assert.match(source, /if \(!text && !attachmentRef\) \{/);
  assert.doesNotMatch(source, /!text && !attachmentRef && !params\.isSystem/);
  assert.match(source, /INSERT INTO messages[\s\S]*is_system[\s\S]*VALUES[\s\S]*\$\{false\}/);
  assert.match(source, /isSystem: false/);
});

test("kyc submissions and reviews enforce runtime state rules", () => {
  const source = readFileSync(new URL("../encore/ops/api.ts", import.meta.url), "utf8");

  assert.match(source, /const KYC_ID_TYPES = new Set\(\["id_card", "passport", "drivers_license"\]\)/);
  assert.match(source, /const KYC_REVIEW_STATUSES = new Set\(\["verified", "rejected"\]\)/);
  assert.match(source, /Unsupported KYC ID type/);
  assert.match(source, /KYC ID number must be between 4 and 80 characters/);
  assert.match(source, /KYC submission is already pending review/);
  assert.match(source, /Unsupported KYC review status/);
  assert.match(source, /Only pending KYC submissions can be reviewed/);
  assert.match(source, /KYC rejection reason must stay under 500 characters/);
  assert.match(source, /trimmedRejectionReason \|\| "Rejected during review\."/);
});
