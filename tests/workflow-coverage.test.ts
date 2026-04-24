import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  fixedNow,
  workflowBilling,
  workflowBookings,
  workflowContentDrafts,
  workflowCoverageMatrix,
  workflowKyc,
  workflowListings,
  workflowMessages,
  workflowNotifications,
  workflowReferrals,
  workflowReviews,
  workflowUsers,
} from './fixtures/workflows';

const repoRoot = process.cwd();

const requiredWorkflows = [
  'Auth and account lifecycle',
  'Listing discovery and booking request',
  'Booking, enquiry, and payment lifecycle',
  'Host availability management',
  'Listing creation, editing, quota checks, media upload',
  'KYC submission and admin review',
  'Subscription checkout, voucher redemption, card save, greylisting, webhook completion',
  'Content Studio draft generation, scheduling, publish-state tracking, credit top-up',
  'Messaging and attachment upload',
  'Reviews',
  'Notifications',
  'Referrals and leaderboard',
  'Admin moderation and platform settings',
  'Trip planner and AI-assisted planning',
] as const;

test('workflow coverage registry includes every source-of-truth workflow exactly once', () => {
  const registered = workflowCoverageMatrix.map((workflow) => workflow.workflow);

  assert.deepEqual([...registered].sort(), [...requiredWorkflows].sort());
  assert.equal(new Set(registered).size, requiredWorkflows.length);
});

test('every workflow records the coverage dimensions required by the acceptance gate', () => {
  for (const workflow of workflowCoverageMatrix) {
    assert.ok(workflow.ownerArea.length > 0, `${workflow.workflow} is missing an owner area`);
    assert.ok(workflow.entryPoints.length > 0, `${workflow.workflow} is missing entry points`);
    assert.ok(workflow.backendServices.length > 0, `${workflow.workflow} is missing backend services`);
    assert.ok(workflow.expectedOutcome.length > 0, `${workflow.workflow} is missing an expected outcome`);
    assert.ok(workflow.happyPath.length > 0, `${workflow.workflow} is missing a happy path`);
    assert.ok(workflow.failurePath.length > 0, `${workflow.workflow} is missing a failure path`);
    assert.ok(workflow.roleRules.length > 0, `${workflow.workflow} is missing role rules`);
    assert.ok(Array.isArray(workflow.asyncEffects), `${workflow.workflow} async effects must be explicit`);
    assert.ok(Array.isArray(workflow.notificationEffects), `${workflow.workflow} notification effects must be explicit`);
    assert.ok(Array.isArray(workflow.externalBoundaries), `${workflow.workflow} external boundaries must be explicit`);
    assert.ok(workflow.fixtureKeys.length > 0, `${workflow.workflow} is missing deterministic fixture coverage`);
    assert.ok(workflow.currentCoverage.length > 0, `${workflow.workflow} is missing current coverage references`);
    assert.ok(workflow.requiredNextCoverage.length > 0, `${workflow.workflow} is missing next coverage references`);
  }
});

test('current workflow coverage references point at real test files', () => {
  const missing = workflowCoverageMatrix.flatMap((workflow) =>
    workflow.currentCoverage
      .filter((coveragePath) => coveragePath.startsWith('tests/'))
      .filter((coveragePath) => !existsSync(join(repoRoot, coveragePath)))
      .map((coveragePath) => `${workflow.workflow}: ${coveragePath}`),
  );

  assert.deepEqual(missing, []);
});

test('deterministic workflow fixtures cover required cross-role and state combinations', () => {
  assert.equal(fixedNow, '2026-04-24T08:00:00.000Z');

  assert.equal(workflowUsers.guest.role, 'guest');
  assert.equal(workflowUsers.host.role, 'host');
  assert.equal(workflowUsers.admin.role, 'admin');
  assert.equal(workflowUsers.suspended.accountStatus, 'suspended');
  assert.equal(workflowUsers.greylistedHost.kycStatus, 'verified');
  assert.equal(workflowUsers.kycPendingHost.kycStatus, 'pending');
  assert.equal(workflowUsers.kycRejectedHost.kycStatus, 'rejected');

  assert.equal(workflowListings.active.status, 'active');
  assert.equal(workflowListings.greylistedHost.hostId, workflowUsers.greylistedHost.id);
  assert.ok(workflowListings.blocked.availabilityBlocks.some((block) => block.source === 'MANUAL'));
  assert.ok(workflowListings.blocked.availabilityBlocks.some((block) => block.source === 'APPROVED_HOLD'));
  assert.ok(workflowListings.blocked.availabilityBlocks.some((block) => block.source === 'BOOKED'));

  assert.equal(workflowBookings.pending.inquiryState, 'PENDING');
  assert.equal(workflowBookings.approvedAwaitingPayment.paymentState, 'INITIATED');
  assert.equal(workflowBookings.proofSubmitted.paymentState, 'PROOF_SUBMITTED');
  assert.equal(workflowBookings.confirmed.inquiryState, 'CONFIRMED');
  assert.equal(workflowBookings.declined.declineReason, 'Dates no longer available.');
  assert.equal(workflowBookings.expired.inquiryState, 'EXPIRED');

  assert.equal(workflowBilling.voucherActive.status, 'active');
  assert.equal(workflowBilling.greylistedOverdue.status, 'greylisted');
  assert.equal(workflowBilling.checkoutPaid.status, 'paid');
  assert.equal(workflowBilling.checkoutFailed.status, 'failed');

  assert.equal(workflowKyc.pending.status, 'pending');
  assert.equal(workflowKyc.rejected.status, 'rejected');
  assert.ok(workflowKyc.rejected.rejectionReason);

  assert.equal(workflowNotifications.unreadBooking.readAt, null);
  assert.ok(workflowNotifications.readReferral.readAt);
  assert.ok(workflowNotifications.dismissedAdmin.dismissedAt);

  assert.equal(workflowReferrals.approved.status, 'approved');
  assert.equal(workflowReferrals.rejected.status, 'rejected');

  assert.equal(workflowMessages.guestMessage.receiverId, workflowUsers.host.id);
  assert.ok(workflowMessages.attachmentMessage.attachmentUrl);

  assert.equal(workflowReviews.pending.status, 'pending');
  assert.equal(workflowReviews.approved.status, 'approved');

  assert.equal(workflowContentDrafts.draft.status, 'draft');
  assert.equal(workflowContentDrafts.scheduled.status, 'scheduled');
});

test('workflow inventory document stays synchronized with the executable registry', () => {
  const docPath = join(repoRoot, 'docs', 'workflow-validation-matrix.md');
  assert.ok(existsSync(docPath), 'workflow validation matrix document is missing');

  const doc = readFileSync(docPath, 'utf8');
  for (const workflow of workflowCoverageMatrix) {
    assert.match(doc, new RegExp(workflow.workflow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${workflow.workflow} is missing from docs/workflow-validation-matrix.md`);
  }
});
