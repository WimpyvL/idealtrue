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

test("messaging backend enforces party access, receiver, and attachment guards", () => {
  const source = readFileSync(new URL("../encore/messaging/api.ts", import.meta.url), "utf8");

  assert.match(source, /async function requireBookingParticipant\(bookingId: string, userId: string\)/);
  assert.match(source, /const booking = await getBookingById\(bookingId\)/);
  assert.match(source, /booking\.guestId !== userId && booking\.hostId !== userId/);
  assert.match(source, /You are not part of this booking conversation/);
  assert.match(source, /await requireBookingParticipant\(bookingId, auth\.userID\)/);
  assert.match(source, /await requireBookingParticipant\(params\.bookingId, auth\.userID\)/);
  assert.match(source, /const expectedReceiverId = booking\.guestId === auth\.userID \? booking\.hostId : booking\.guestId/);
  assert.match(source, /Messages can only be sent to the other booking participant/);
  assert.match(source, /async function assertAttachmentBelongsToSender/);
  assert.match(source, /attachmentRef\.startsWith\(`\$\{bookingId\}\/\$\{userId\}\/`\)/);
  assert.match(source, /Attachment does not belong to this booking conversation/);
  assert.match(source, /Attachment upload is missing or incomplete\. Upload the file again/);
  assert.match(source, /ALLOWED_ATTACHMENT_CONTENT_TYPES/);
  assert.match(source, /Unsupported attachment content type/);
  assert.match(source, /Attachment must be between 1 byte and 10MB/);
  assert.match(source, /recordHostInquiryResponseFromMessage\(params\.bookingId, auth\.userID\)/);
  assert.match(source, /notifyMessageReceived/);
});

test("reviews backend enforces eligibility, duplicate, and moderation guards", () => {
  const source = readFileSync(new URL("../encore/reviews/api.ts", import.meta.url), "utf8");

  assert.match(source, /const booking = await getBookingById\(params\.bookingId\)/);
  assert.match(source, /Only the guest on the booking can leave a review/);
  assert.match(source, /Review does not match the booking/);
  assert.match(source, /Reviews can only be submitted after the stay is confirmed and paid/);
  assert.match(source, /Review scores must be integers between 1 and 5/);
  assert.match(source, /Review comment cannot be empty/);
  assert.match(source, /Review comment is too long/);
  assert.match(source, /A review has already been submitted for this booking/);
  assert.match(source, /ON CONFLICT \(booking_id\) DO NOTHING/);
  assert.match(source, /type: "review\.submitted"/);
  assert.match(source, /requireRole\("admin", "support"\)/);
  assert.match(source, /Invalid review status/);
  assert.match(source, /DELETE FROM reviews[\s\S]*RETURNING id/);
});

test("referrals backend enforces self-referral, duplicate, and conversion guards", () => {
  const source = readFileSync(new URL("../encore/referrals/api.ts", import.meta.url), "utf8");

  assert.match(source, /const REFERRAL_TRIGGERS = new Set/);
  assert.match(source, /const REFERRAL_PROGRAMS = new Set/);
  assert.match(source, /const REFERRAL_STATUSES = new Set/);
  assert.match(source, /Reward amount must be positive/);
  assert.match(source, /A user cannot refer themselves/);
  assert.match(source, /A matching referral reward already exists/);
  assert.match(source, /COALESCE\(source_subscription_id, ''\) = \$\{params\.sourceSubscriptionId \?\? ""\}/);
  assert.match(source, /SELECT \*[\s\S]*FOR UPDATE/);
  assert.match(source, /if \(duplicate\) \{[\s\S]*return mapReward\(duplicate\)/);
  assert.match(source, /await creditReferrer\(identityTx, lockedReferrer\)/);
  assert.match(source, /notifyReferralRewardEarned/);
  assert.match(source, /DELETE FROM referral_rewards[\s\S]*RETURNING id/);
});

test("KYC assets, history, and identity status endpoints keep admin boundaries explicit", () => {
  const opsSource = readFileSync(new URL("../encore/ops/api.ts", import.meta.url), "utf8");
  const identitySource = readFileSync(new URL("../encore/identity/api.ts", import.meta.url), "utf8");

  assert.match(opsSource, /assertKycUploadBelongsToUser/);
  assert.match(opsSource, /KYC upload does not belong to this account/);
  assert.match(opsSource, /KYC image upload is missing or incomplete\. Upload the image again/);
  assert.match(opsSource, /getMyKycSubmissionHistory/);
  assert.match(opsSource, /getKycSubmissionHistory/);
  assert.match(opsSource, /requireRole\("admin", "support"\)/);
  assert.match(opsSource, /getKycSubmissionAssets/);
  assert.match(opsSource, /kycDocumentsBucket\.signedDownloadUrl\(existing\.id_image_key, \{ ttl: 900 \}\)/);
  assert.match(opsSource, /kycDocumentsBucket\.signedDownloadUrl\(existing\.selfie_image_key, \{ ttl: 900 \}\)/);
  assert.match(identitySource, /setUserKycStatus/);
  assert.match(identitySource, /path: "\/admin\/users\/kyc-status"/);
  assert.match(identitySource, /SET kyc_status = \$\{params\.kycStatus\}/);
});

test("admin destructive actions and platform settings retain validation guards", () => {
  const identitySource = readFileSync(new URL("../encore/identity/api.ts", import.meta.url), "utf8");
  const opsSource = readFileSync(new URL("../encore/ops/api.ts", import.meta.url), "utf8");

  assert.match(identitySource, /You cannot delete your own account while you are signed in/);
  assert.match(identitySource, /getUserDeleteDependencyCounts/);
  assert.match(identitySource, /getUserDeleteBlockers/);
  assert.match(identitySource, /This user cannot be permanently deleted because the account still has/);
  assert.match(identitySource, /await pauseUserListings\(userId\)/);
  assert.match(identitySource, /DELETE FROM auth_tokens WHERE user_id = \$\{userId\}/);
  assert.match(identitySource, /DELETE FROM kyc_submissions WHERE user_id = \$\{userId\}/);
  assert.match(identitySource, /await removeUserMedia\(existing, kycSubmission\)/);
  assert.match(identitySource, /type: "user\.deleted"/);
  assert.match(opsSource, /function validatePlatformSettings\(settings: PlatformSettingsRecord\)/);
  assert.match(opsSource, /Referral reward amount must be zero or positive/);
  assert.match(opsSource, /Minimum withdrawal amount must be positive/);
  assert.match(opsSource, /Platform name cannot be empty/);
  assert.match(opsSource, /Support email must be valid/);
  assert.match(opsSource, /Cancellation policy days must be a whole number of zero or more/);
  assert.match(opsSource, /Maximum guests per listing must be at least one/);
  assert.match(opsSource, /validatePlatformSettings\(updated\)/);
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
