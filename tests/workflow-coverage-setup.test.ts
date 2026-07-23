import assert from "node:assert/strict";
import test from "node:test";
import { defaultWorkflowRouteMocks } from "./e2e/fixtures/workflow-routes";
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
} from "./fixtures/workflows";

const expectedWorkflowRows = [
  "Auth and account lifecycle",
  "Listing discovery and booking request",
  "Booking, enquiry, and payment lifecycle",
  "Host availability management",
  "Listing creation, editing, quota checks, media upload",
  "KYC submission and admin review",
  "Subscription checkout, voucher redemption, card save, greylisting, webhook completion",
  "Content Studio draft generation, scheduling, publish-state tracking, credit top-up",
  "Messaging and attachment upload",
  "Reviews",
  "Notifications",
  "Referrals and leaderboard",
  "Admin moderation and platform settings",
  "Trip planner and AI-assisted planning",
  "Legal documentation and public policy pages",
];

const fixtureCollections = {
  workflowUsers,
  workflowListings,
  workflowBookings,
  workflowBilling,
  workflowKyc,
  workflowNotifications,
  workflowReferrals,
  workflowMessages,
  workflowReviews,
  workflowContentDrafts,
};

test("workflow coverage matrix tracks every production workflow", () => {
  const workflowNames = workflowCoverageMatrix.map((row) => row.workflow);

  assert.deepEqual(workflowNames, expectedWorkflowRows);

  for (const row of workflowCoverageMatrix) {
    assert.ok(row.ownerArea.length > 0, `${row.workflow} needs an owner area`);
    assert.ok(row.entryPoints.length > 0, `${row.workflow} needs frontend entry points`);
    assert.ok(row.backendServices.length > 0, `${row.workflow} needs backend/service boundaries`);
    assert.ok(row.expectedOutcome.length > 20, `${row.workflow} needs an expected outcome`);
    assert.ok(row.happyPath.length > 10, `${row.workflow} needs happy-path coverage notes`);
    assert.ok(row.failurePath.length > 10, `${row.workflow} needs rejection coverage notes`);
    assert.ok(row.roleRules.length > 10, `${row.workflow} needs role/permission rules`);
    assert.ok(row.fixtureKeys.length > 0, `${row.workflow} needs fixture keys`);
    assert.ok(row.currentCoverage.length > 0, `${row.workflow} needs current coverage references`);
    assert.ok(row.requiredNextCoverage.length > 0, `${row.workflow} needs next coverage references`);
  }
});

test("canonical workflow fixtures exist for the remaining risky states", () => {
  assert.equal(fixedNow, "2026-04-24T08:00:00.000Z");

  assert.ok(workflowUsers.guest);
  assert.ok(workflowUsers.host);
  assert.ok(workflowUsers.admin);
  assert.ok(workflowUsers.suspended);
  assert.ok(workflowUsers.greylistedHost);
  assert.ok(workflowUsers.kycPendingHost);
  assert.ok(workflowUsers.kycRejectedHost);

  assert.ok(workflowListings.active);
  assert.ok(workflowListings.greylistedHost);
  assert.ok(workflowListings.blocked);

  assert.ok(workflowBookings.pending);
  assert.ok(workflowBookings.approvedAwaitingPayment);
  assert.ok(workflowBookings.proofSubmitted);
  assert.ok(workflowBookings.confirmed);
  assert.ok(workflowBookings.declined);
  assert.ok(workflowBookings.expired);

  assert.ok(workflowBilling.voucherActive);
  assert.ok(workflowBilling.greylistedOverdue);
  assert.ok(workflowBilling.checkoutPaid);
  assert.ok(workflowBilling.checkoutFailed);
  assert.ok(workflowBilling.hostCardSetupPaid);

  assert.ok(workflowKyc.pending);
  assert.ok(workflowKyc.rejected);
  assert.ok(workflowNotifications.unreadBooking);
  assert.ok(workflowNotifications.readReferral);
  assert.ok(workflowNotifications.dismissedAdmin);
  assert.ok(workflowReferrals.approved);
  assert.ok(workflowReferrals.rejected);
  assert.ok(workflowMessages.guestMessage);
  assert.ok(workflowMessages.attachmentMessage);
  assert.ok(workflowReviews.pending);
  assert.ok(workflowReviews.approved);
  assert.ok(workflowContentDrafts.draft);
  assert.ok(workflowContentDrafts.scheduled);
});

test("workflow fixtures use stable IDs and timestamps", () => {
  const allFixtureValues = Object.values(fixtureCollections).flatMap((collection) => Object.values(collection));

  assert.ok(allFixtureValues.length >= 25);

  for (const value of allFixtureValues) {
    if (typeof value !== "object" || value === null) {
      continue;
    }

    const record = value as Record<string, unknown>;
    if ("id" in record) {
      assert.equal(typeof record.id, "string");
      assert.ok((record.id as string).length > 3);
      assert.doesNotMatch(record.id as string, /Math|Date|random/i);
    }

    for (const [key, field] of Object.entries(record)) {
      if (key.endsWith("At") && typeof field === "string") {
        assert.match(field, /^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
      }
    }
  }
});

test("Playwright workflow mocks cover the open e2e gaps", () => {
  const expectedExampleUrls = [
    "https://example.test/api/encore/auth/session",
    "https://example.test/api/encore/listings?status=active",
    "https://example.test/api/encore/host/listings/quota",
    "https://example.test/api/encore/bookings/me",
    "https://example.test/api/encore/messages/booking-1",
    "https://example.test/api/encore/messages",
    "https://example.test/api/encore/ops/kyc/submissions/me",
    "https://example.test/api/encore/ops/my-notifications",
    "https://example.test/api/encore/reviews/listing-1",
    "https://example.test/api/encore/referrals/rewards",
    "https://example.test/api/encore/billing/host/account",
    "https://example.test/api/encore/billing/content/drafts",
  ];

  for (const url of expectedExampleUrls) {
    const hasMock = defaultWorkflowRouteMocks.some((mock) =>
      typeof mock.url === "string" ? url.includes(mock.url) : mock.url.test(url),
    );
    assert.ok(hasMock, `Route mock is missing for ${url}`);
  }

  assert.ok(defaultWorkflowRouteMocks.every((mock) => mock.json !== undefined));
});
