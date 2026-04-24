import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { DEFAULT_ENCORE_API_URL } from '../src/lib/encore-client';
import {
  createContentCreditsCheckout,
  createSubscriptionCheckout,
  generateContentDraft,
  getCheckoutStatus,
  getContentEntitlements,
  listContentDrafts,
  updateContentDraft,
} from '../src/lib/billing-client';
import {
  listReferralLeaderboard,
  requestEmailVerification,
  requestPasswordReset,
  resetPasswordWithToken,
  signInWithPassword,
  signUpWithPassword,
  updateEncoreProfile,
  verifyEmailToken,
} from '../src/lib/identity-client';
import { getKycSubmissionAssets, getMyKycSubmission, listKycSubmissions, reviewKycSubmission, submitKyc } from '../src/lib/ops-client';
import { listMessages, sendMessage } from '../src/lib/messaging-client';
import { createListingReview, listListingReviews, listReferralRewards } from '../src/lib/platform-client';
import {
  workflowBilling,
  workflowBookings,
  workflowContentDrafts,
  workflowKyc,
  workflowListings,
  workflowMessages,
  workflowReferrals,
  workflowReviews,
  workflowUsers,
} from './fixtures/workflows';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

let fetchCalls: FetchCall[] = [];

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  fetchCalls = [];
  Object.defineProperty(globalThis, 'fetch', {
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, init });
      return handler(url, init);
    },
    configurable: true,
    writable: true,
  });
}

function requestBody(index: number) {
  return JSON.parse(String(fetchCalls[index]?.init?.body || '{}')) as Record<string, unknown>;
}

function encoreUser(overrides: Record<string, unknown> = {}) {
  return {
    ...workflowUsers.guest,
    isAdmin: false,
    ...overrides,
  };
}

function encoreReview(overrides: Record<string, unknown> = {}) {
  return {
    ...workflowReviews.approved,
    hostId: workflowUsers.host.id,
    cleanliness: 5,
    accuracy: 5,
    communication: 5,
    location: 5,
    value: 5,
    ...overrides,
  };
}

function encoreReferral(overrides: Record<string, unknown> = {}) {
  return {
    ...workflowReferrals.approved,
    trigger: 'signup',
    program: 'host',
    status: 'earned',
    ...overrides,
  };
}

afterEach(() => {
  fetchCalls = [];
});

test('auth and account lifecycle clients call the canonical identity endpoints', async () => {
  installFetch((url) => {
    if (url.endsWith('/auth/signup')) return createJsonResponse({ user: encoreUser({ id: 'signed-up-user' }) });
    if (url.endsWith('/auth/login')) return createJsonResponse({ user: encoreUser({ id: 'signed-in-user' }) });
    if (url.endsWith('/auth/request-email-verification')) return createJsonResponse({ ok: true });
    if (url.endsWith('/auth/verify-email')) return createJsonResponse({ ok: true });
    if (url.endsWith('/auth/request-password-reset')) return createJsonResponse({ ok: true });
    if (url.endsWith('/auth/reset-password')) return createJsonResponse({ ok: true });
    if (url.endsWith('/users/me')) return createJsonResponse({ user: encoreUser({ displayName: 'Updated Guest', role: 'host' }) });
    throw new Error(`Unhandled auth endpoint: ${url}`);
  });

  const signedUp = await signUpWithPassword({
    email: workflowUsers.guest.email,
    displayName: workflowUsers.guest.displayName,
    password: 'password123',
    referredByCode: workflowUsers.host.referralCode,
  });
  const signedIn = await signInWithPassword({ email: workflowUsers.guest.email, password: 'password123' });
  await requestEmailVerification();
  await verifyEmailToken('verify-token-1');
  await requestPasswordReset(workflowUsers.guest.email);
  await resetPasswordWithToken({ token: 'reset-token-1', password: 'new-password123' });
  const updated = await updateEncoreProfile({ displayName: 'Updated Guest', role: 'host' });

  assert.equal(signedUp.id, 'signed-up-user');
  assert.equal(signedIn.id, 'signed-in-user');
  assert.equal(updated.displayName, 'Updated Guest');
  assert.deepEqual(
    fetchCalls.map((call) => `${call.init?.method || 'GET'} ${call.url.replace(DEFAULT_ENCORE_API_URL, '')}`),
    [
      'POST /auth/signup',
      'POST /auth/login',
      'POST /auth/request-email-verification',
      'POST /auth/verify-email',
      'POST /auth/request-password-reset',
      'POST /auth/reset-password',
      'PUT /users/me',
    ],
  );
  assert.equal(requestBody(0).referredByCode, workflowUsers.host.referralCode);
  assert.equal(requestBody(3).token, 'verify-token-1');
  assert.equal(requestBody(5).token, 'reset-token-1');
});

test('content studio clients cover entitlements, draft lifecycle, credit checkout, and checkout status', async () => {
  installFetch((url, init) => {
    if (url.endsWith('/billing/content/entitlements')) {
      return createJsonResponse({
        entitlements: {
          plan: 'professional',
          contentStudioEnabled: true,
          includedDraftsPerMonth: 10,
          usedDraftsThisMonth: 2,
          remainingIncludedDrafts: 8,
          creditBalance: 5,
          canSchedule: true,
        },
      });
    }
    if (url.endsWith('/billing/content/credits/checkout')) {
      return createJsonResponse({ checkoutId: workflowBilling.checkoutPaid.checkoutId, redirectUrl: 'https://pay.example/credits' });
    }
    if (url.endsWith('/billing/content/drafts/generate')) {
      return createJsonResponse({
        draft: workflowContentDrafts.draft,
        entitlements: {
          plan: 'professional',
          contentStudioEnabled: true,
          includedDraftsPerMonth: 10,
          usedDraftsThisMonth: 3,
          remainingIncludedDrafts: 7,
          creditBalance: 5,
          canSchedule: true,
        },
      });
    }
    if (url.endsWith('/billing/content/drafts') && (!init?.method || init.method === 'GET')) {
      return createJsonResponse({ drafts: [workflowContentDrafts.draft] });
    }
    if (url.endsWith(`/billing/content/drafts/${workflowContentDrafts.draft.id}`)) {
      return createJsonResponse({ draft: workflowContentDrafts.scheduled });
    }
    if (url.endsWith(`/billing/checkouts/${workflowBilling.checkoutPaid.checkoutId}`)) {
      return createJsonResponse({ status: workflowBilling.checkoutPaid.status, checkoutType: workflowBilling.checkoutPaid.checkoutType });
    }
    throw new Error(`Unhandled content endpoint: ${url}`);
  });

  const entitlements = await getContentEntitlements();
  const creditsCheckout = await createContentCreditsCheckout(10);
  const generated = await generateContentDraft(workflowListings.active as any, 'instagram' as any, 'warm' as any, 'stay_carousel' as any, {
    includePrice: true,
    includeSpecialOffer: false,
    customHeadline: 'Weekend special',
  });
  const drafts = await listContentDrafts();
  const scheduled = await updateContentDraft({
    draftId: workflowContentDrafts.draft.id,
    status: 'scheduled',
    scheduledFor: workflowContentDrafts.scheduled.scheduledFor,
  });
  const checkoutStatus = await getCheckoutStatus(workflowBilling.checkoutPaid.checkoutId);

  assert.equal(entitlements.contentStudioEnabled, true);
  assert.equal(creditsCheckout.checkoutId, workflowBilling.checkoutPaid.checkoutId);
  assert.equal(generated.draft.id, workflowContentDrafts.draft.id);
  assert.equal(drafts[0]?.id, workflowContentDrafts.draft.id);
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(checkoutStatus.status, 'paid');
  assert.equal(requestBody(1).credits, 10);
  assert.equal(requestBody(2).listingId, workflowListings.active.id);
  assert.equal(requestBody(4).status, 'scheduled');
});

test('messaging clients use booking-scoped message endpoints and preserve attachment URLs', async () => {
  installFetch((url) => {
    if (url.endsWith(`/messages/${workflowBookings.confirmed.id}`)) {
      return createJsonResponse({ messages: [workflowMessages.guestMessage, workflowMessages.attachmentMessage] });
    }
    if (url.endsWith('/messages')) {
      return createJsonResponse({ message: workflowMessages.attachmentMessage });
    }
    throw new Error(`Unhandled messaging endpoint: ${url}`);
  });

  const messages = await listMessages(workflowBookings.confirmed.id);
  const sent = await sendMessage({
    bookingId: workflowBookings.confirmed.id,
    receiverId: workflowUsers.guest.id,
    text: workflowMessages.attachmentMessage.text,
    attachmentUrl: workflowMessages.attachmentMessage.attachmentUrl,
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[1]?.attachmentUrl, workflowMessages.attachmentMessage.attachmentUrl);
  assert.equal(sent.attachmentUrl, workflowMessages.attachmentMessage.attachmentUrl);
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/messages/${workflowBookings.confirmed.id}`);
  assert.equal(fetchCalls[1]?.url, `${DEFAULT_ENCORE_API_URL}/messages`);
  assert.deepEqual(requestBody(1), {
    bookingId: workflowBookings.confirmed.id,
    receiverId: workflowUsers.guest.id,
    text: workflowMessages.attachmentMessage.text,
    attachmentUrl: workflowMessages.attachmentMessage.attachmentUrl,
  });
});

test('KYC clients cover self submission, admin review, listing, and secure asset preview endpoints', async () => {
  installFetch((url) => {
    if (url.endsWith('/ops/kyc/submissions') && fetchCalls.at(-1)?.init?.method === 'POST') {
      return createJsonResponse({ submission: workflowKyc.pending });
    }
    if (url.endsWith('/ops/kyc/submissions/me')) return createJsonResponse({ submission: workflowKyc.pending });
    if (url.endsWith('/ops/kyc/submissions') && (!fetchCalls.at(-1)?.init?.method || fetchCalls.at(-1)?.init?.method === 'GET')) {
      return createJsonResponse({ submissions: [workflowKyc.pending, workflowKyc.rejected] });
    }
    if (url.endsWith('/ops/kyc/submissions/review')) return createJsonResponse({ submission: workflowKyc.rejected });
    if (url.endsWith(`/ops/kyc/submissions/${workflowUsers.kycPendingHost.id}/assets`)) {
      return createJsonResponse({ assets: { idImageUrl: 'https://secure.example/id.jpg', selfieImageUrl: 'https://secure.example/selfie.jpg' } });
    }
    throw new Error(`Unhandled KYC endpoint: ${url}`);
  });

  const submitted = await submitKyc({
    idType: 'id_card',
    idNumber: workflowKyc.pending.idNumber,
    idImageKey: workflowKyc.pending.idImageKey,
    selfieImageKey: workflowKyc.pending.selfieImageKey,
  });
  const mine = await getMyKycSubmission();
  const submissions = await listKycSubmissions();
  const reviewed = await reviewKycSubmission({
    userId: workflowUsers.kycRejectedHost.id,
    status: 'rejected',
    rejectionReason: workflowKyc.rejected.rejectionReason,
  });
  const assets = await getKycSubmissionAssets(workflowUsers.kycPendingHost.id);

  assert.equal(submitted.status, 'pending');
  assert.equal(mine?.id, workflowKyc.pending.id);
  assert.equal(submissions.length, 2);
  assert.equal(reviewed.status, 'rejected');
  assert.equal(assets.selfieImageUrl, 'https://secure.example/selfie.jpg');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/ops/kyc/submissions`);
  assert.equal(fetchCalls[3]?.url, `${DEFAULT_ENCORE_API_URL}/ops/kyc/submissions/review`);
});

test('review and referral clients map workflow contracts without mutating statuses', async () => {
  installFetch((url) => {
    if (url.endsWith(`/reviews/${workflowListings.active.id}`)) return createJsonResponse({ reviews: [encoreReview()] });
    if (url.endsWith('/reviews')) return createJsonResponse({ review: encoreReview({ status: 'pending' }) });
    if (url.endsWith('/referrals/rewards')) return createJsonResponse({ rewards: [encoreReferral(), encoreReferral({ id: 'referral-rejected', status: 'rejected' })] });
    if (url.endsWith('/users/leaderboard/referrals')) {
      return createJsonResponse({
        users: [
          {
            id: workflowUsers.host.id,
            displayName: workflowUsers.host.displayName,
            photoUrl: '',
            tier: workflowUsers.host.tier,
            referralCount: workflowUsers.host.referralCount,
          },
        ],
      });
    }
    throw new Error(`Unhandled review/referral endpoint: ${url}`);
  });

  const reviews = await listListingReviews(workflowListings.active.id);
  const createdReview = await createListingReview({
    listingId: workflowListings.active.id,
    bookingId: workflowBookings.confirmed.id,
    hostId: workflowUsers.host.id,
    cleanliness: 5,
    accuracy: 5,
    communication: 5,
    location: 5,
    value: 5,
    comment: workflowReviews.pending.comment,
  });
  const rewards = await listReferralRewards();
  const leaderboard = await listReferralLeaderboard();

  assert.equal(reviews[0]?.status, 'approved');
  assert.equal(createdReview.status, 'pending');
  assert.equal(rewards[0]?.status, 'rewarded');
  assert.equal(rewards[1]?.status, 'rejected');
  assert.equal(leaderboard[0]?.id, workflowUsers.host.id);
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/reviews/${workflowListings.active.id}`);
  assert.equal(fetchCalls[1]?.url, `${DEFAULT_ENCORE_API_URL}/reviews`);
  assert.equal(requestBody(1).bookingId, workflowBookings.confirmed.id);
});

test('subscription checkout client posts plan interval and reads checkout status explicitly', async () => {
  installFetch((url) => {
    if (url.endsWith('/billing/subscriptions/checkout')) {
      return createJsonResponse({ checkoutId: 'checkout-subscription-1', redirectUrl: 'https://pay.example/subscription' });
    }
    if (url.endsWith('/billing/checkouts/checkout-subscription-1')) {
      return createJsonResponse({ status: 'pending', checkoutType: 'subscription' });
    }
    throw new Error(`Unhandled subscription endpoint: ${url}`);
  });

  const checkout = await createSubscriptionCheckout('professional', 'monthly');
  const status = await getCheckoutStatus(checkout.checkoutId);

  assert.equal(checkout.redirectUrl, 'https://pay.example/subscription');
  assert.equal(status.checkoutType, 'subscription');
  assert.equal(fetchCalls[0]?.url, `${DEFAULT_ENCORE_API_URL}/billing/subscriptions/checkout`);
  assert.deepEqual(requestBody(0), { plan: 'professional', billingInterval: 'monthly' });
});

