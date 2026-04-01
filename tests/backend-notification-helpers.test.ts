import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBookingRequestedNotification,
  buildBookingStatusChangedNotification,
  buildMessageReceivedNotification,
  buildPaymentProofSubmittedNotification,
  buildReferralRewardEarnedNotification,
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
    buildBookingStatusChangedNotification({
      guestId: 'guest-1',
      status: 'confirmed',
      listingTitle: 'Sea Point Stay',
    }),
    {
      title: 'Booking updated',
      message: 'Your booking for Sea Point Stay is confirmed.',
      type: 'success',
      target: 'guest-1',
      actionPath: '/guest',
    },
  );

  assert.deepEqual(
    buildBookingStatusChangedNotification({
      guestId: 'guest-1',
      status: 'declined',
      listingTitle: 'Sea Point Stay',
    }),
    {
      title: 'Booking updated',
      message: 'Your booking for Sea Point Stay was declined.',
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
    }),
    {
      title: 'New message',
      message: 'You have a new message about Sea Point Stay.',
      type: 'info',
      target: 'user-2',
      actionPath: null,
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
