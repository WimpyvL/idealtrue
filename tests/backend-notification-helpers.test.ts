import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBookingRequestedNotification,
  buildCheckoutStatusChangedNotification,
  buildContentCreditsPurchasedNotification,
  buildInquiryStatusChangedNotification,
  buildKycReviewedNotification,
  buildListingReviewedNotification,
  buildMessageReceivedNotification,
  buildPaymentProofSubmittedNotification,
  buildReferralRewardEarnedNotification,
  buildSubscriptionActivatedNotification,
} from '../encore/ops/notification-builders.ts';

test('booking notification builders target the right inbox paths', () => {
  assert.deepEqual(
    buildBookingRequestedNotification({
      hostId: 'host-1',
      listingTitle: 'Sea Point Stay',
      bookingId: 'booking-1',
    }),
    {
      title: 'New booking request',
      message: 'A guest requested a booking for Sea Point Stay.',
      type: 'info',
      target: 'host-1',
      actionPath: '/host/enquiries',
    },
  );

  assert.deepEqual(
    buildPaymentProofSubmittedNotification({
      hostId: 'host-1',
      listingTitle: 'Sea Point Stay',
    }),
    {
      title: 'Payment proof submitted',
      message: 'A guest submitted payment proof for Sea Point Stay.',
      type: 'info',
      target: 'host-1',
      actionPath: '/host/enquiries',
    },
  );
});

test('booking status builder distinguishes success and warning states', () => {
  assert.deepEqual(
    buildInquiryStatusChangedNotification({
      guestId: 'guest-1',
      inquiryState: 'BOOKED',
      listingTitle: 'Sea Point Stay',
    }),
    {
      title: 'Inquiry updated',
      message: 'Your stay at Sea Point Stay is confirmed.',
      type: 'success',
      target: 'guest-1',
      actionPath: '/guest',
    },
  );

  assert.deepEqual(
    buildInquiryStatusChangedNotification({
      guestId: 'guest-1',
      inquiryState: 'DECLINED',
      listingTitle: 'Sea Point Stay',
    }),
    {
      title: 'Inquiry updated',
      message: 'Your inquiry for Sea Point Stay was declined.',
      type: 'warning',
      target: 'guest-1',
      actionPath: '/guest',
    },
  );
});

test('message and referral notification builders stay audience-specific', () => {
  assert.deepEqual(
    buildMessageReceivedNotification({
      receiverId: 'user-2',
      listingTitle: 'Sea Point Stay',
      actionPath: '/host/inbox',
    }),
    {
      title: 'New message',
      message: 'You have a new message about Sea Point Stay.',
      type: 'info',
      target: 'user-2',
      actionPath: '/host/inbox',
    },
  );

  assert.deepEqual(
    buildReferralRewardEarnedNotification({
      referrerId: 'user-3',
      amount: 175,
    }),
    {
      title: 'Referral reward earned',
      message: 'You earned a referral reward of R175.',
      type: 'success',
      target: 'user-3',
      actionPath: '/referral',
    },
  );
});

test('review and billing notification builders produce actionable messages', () => {
  assert.deepEqual(
    buildKycReviewedNotification({
      userId: 'user-1',
      status: 'rejected',
      rejectionReason: 'Document photo is unreadable.',
    }),
    {
      title: 'KYC needs attention',
      message: 'Your identity verification was rejected: Document photo is unreadable.',
      type: 'warning',
      target: 'user-1',
      actionPath: '/account',
    },
  );

  assert.deepEqual(
    buildListingReviewedNotification({
      hostId: 'host-1',
      listingTitle: 'Forest Cabin',
      status: 'active',
    }),
    {
      title: 'Listing approved',
      message: 'Forest Cabin is now live.',
      type: 'success',
      target: 'host-1',
      actionPath: '/host/listings',
    },
  );

  assert.deepEqual(
    buildSubscriptionActivatedNotification({
      userId: 'host-1',
      plan: 'premium',
      billingInterval: 'monthly',
    }),
    {
      title: 'Subscription activated',
      message: 'Your premium monthly plan is now active.',
      type: 'success',
      target: 'host-1',
      actionPath: '/pricing',
    },
  );

  assert.deepEqual(
    buildContentCreditsPurchasedNotification({
      userId: 'host-1',
      credits: 25,
    }),
    {
      title: 'Content credits added',
      message: '25 content credits were added to your balance.',
      type: 'success',
      target: 'host-1',
      actionPath: '/host/social',
    },
  );

  assert.deepEqual(
    buildCheckoutStatusChangedNotification({
      userId: 'host-1',
      checkoutType: 'subscription',
      status: 'failed',
      hostPlan: 'professional',
    }),
    {
      title: 'Payment failed',
      message: 'Your professional plan subscription payment did not complete. Try again when you\'re ready.',
      type: 'error',
      target: 'host-1',
      actionPath: '/pricing',
    },
  );
});
