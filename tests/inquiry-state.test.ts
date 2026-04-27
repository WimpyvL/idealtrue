import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getGuestInquiryDeadlineText,
  getGuestPaymentStateText,
  getHostInquiryDeadlineText,
  getInquiryDeadlineUrgency,
  getHostInquiryBucket,
  getHostInquirySortTimestamp,
  getInquiryDeadlineState,
  getMessagingProcessContext,
  groupHostInquiries,
  isAwaitingGuestPayment,
} from '../src/lib/inquiry-state.ts';

const baseBooking = {
  inquiryState: 'PENDING' as const,
  paymentState: 'UNPAID' as const,
  paymentSubmittedAt: null,
  paymentConfirmedAt: null,
  createdAt: '2026-04-16T08:00:00.000Z',
  viewedAt: null,
  respondedAt: null,
  paymentUnlockedAt: null,
  bookedAt: null,
  expiresAt: null,
};

test('host inquiry buckets separate decision, payment, confirmed, and closed queues', () => {
  assert.equal(getHostInquiryBucket(baseBooking), 'needs_response');

  assert.equal(
    getHostInquiryBucket({
      ...baseBooking,
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentUnlockedAt: '2026-04-16T09:00:00.000Z',
    }),
    'awaiting_guest_payment',
  );

  assert.equal(
    getHostInquiryBucket({
      ...baseBooking,
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: '2026-04-16T10:00:00.000Z',
    }),
    'payment_review',
  );

  assert.equal(
    getHostInquiryBucket({
      ...baseBooking,
      inquiryState: 'BOOKED',
      paymentState: 'COMPLETED',
      bookedAt: '2026-04-16T11:00:00.000Z',
    }),
    'confirmed',
  );

  assert.equal(
    getHostInquiryBucket({
      ...baseBooking,
      inquiryState: 'DECLINED',
    }),
    'closed',
  );
});

test('isAwaitingGuestPayment only matches approved enquiries without submitted proof', () => {
  assert.equal(
    isAwaitingGuestPayment({
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: null,
      paymentConfirmedAt: null,
    }),
    true,
  );

  assert.equal(
    isAwaitingGuestPayment({
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: '2026-04-16T10:00:00.000Z',
      paymentConfirmedAt: null,
    }),
    false,
  );
});

test('host inquiry sort timestamp follows the active workflow milestone', () => {
  assert.equal(
    getHostInquirySortTimestamp({
      ...baseBooking,
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentUnlockedAt: '2026-04-16T12:00:00.000Z',
    }),
    '2026-04-16T12:00:00.000Z',
  );

  assert.equal(
    getHostInquirySortTimestamp({
      ...baseBooking,
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: '2026-04-16T13:00:00.000Z',
    }),
    '2026-04-16T13:00:00.000Z',
  );
});

test('deadline state distinguishes response, payment, review, and expired enquiries', () => {
  assert.deepEqual(
    getInquiryDeadlineState({
      inquiryState: 'RESPONDED',
      paymentState: 'UNPAID',
      paymentSubmittedAt: null,
      expiresAt: '2026-04-22T10:00:00.000Z',
    }),
    { kind: 'response_due', deadlineAt: '2026-04-22T10:00:00.000Z' },
  );

  assert.deepEqual(
    getInquiryDeadlineState({
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: null,
      expiresAt: '2026-04-21T10:00:00.000Z',
    }),
    { kind: 'payment_due', deadlineAt: '2026-04-21T10:00:00.000Z' },
  );

  assert.deepEqual(
    getInquiryDeadlineState({
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
      expiresAt: '2026-04-21T10:00:00.000Z',
    }),
    { kind: 'confirmation_due', deadlineAt: '2026-04-21T10:00:00.000Z' },
  );

  assert.deepEqual(
    getInquiryDeadlineState({
      inquiryState: 'EXPIRED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: null,
      expiresAt: '2026-04-21T10:00:00.000Z',
    }),
    { kind: 'expired', deadlineAt: '2026-04-21T10:00:00.000Z' },
  );
});

test('groupHostInquiries keeps each workflow queue in the shared helper layer', () => {
  const grouped = groupHostInquiries([
    {
      ...baseBooking,
      id: 'needs-response',
    },
    {
      ...baseBooking,
      id: 'awaiting-payment',
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentUnlockedAt: '2026-04-16T09:00:00.000Z',
    },
    {
      ...baseBooking,
      id: 'payment-review',
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: '2026-04-16T10:00:00.000Z',
    },
    {
      ...baseBooking,
      id: 'confirmed',
      inquiryState: 'BOOKED',
      paymentState: 'COMPLETED',
      bookedAt: '2026-04-16T11:00:00.000Z',
      paymentConfirmedAt: '2026-04-16T11:00:00.000Z',
    },
  ]);

  assert.deepEqual(grouped.needsResponse.map((booking) => booking.id), ['needs-response']);
  assert.deepEqual(grouped.awaitingGuestPayment.map((booking) => booking.id), ['awaiting-payment']);
  assert.deepEqual(grouped.paymentReview.map((booking) => booking.id), ['payment-review']);
  assert.deepEqual(grouped.confirmed.map((booking) => booking.id), ['confirmed']);
  assert.deepEqual(grouped.closed, []);
});

test('deadline urgency escalates approved holds that are nearing expiry', () => {
  assert.deepEqual(
    getInquiryDeadlineUrgency(
      {
        inquiryState: 'APPROVED',
        paymentState: 'INITIATED',
        paymentSubmittedAt: null,
        paymentConfirmedAt: null,
        expiresAt: '2026-04-21T18:00:00.000Z',
      },
      new Date('2026-04-21T12:00:00.000Z'),
    ),
    {
      tone: 'danger',
      deadlineKind: 'payment_due',
      deadlineAt: '2026-04-21T18:00:00.000Z',
      msRemaining: 21600000,
      isExpired: false,
      within24Hours: true,
      within6Hours: true,
    },
  );

  assert.deepEqual(
    getInquiryDeadlineUrgency(
      {
        inquiryState: 'EXPIRED',
        paymentState: 'INITIATED',
        paymentSubmittedAt: null,
        paymentConfirmedAt: null,
        expiresAt: '2026-04-21T10:00:00.000Z',
      },
      new Date('2026-04-21T12:00:00.000Z'),
    ),
    {
      tone: 'danger',
      deadlineKind: 'expired',
      deadlineAt: '2026-04-21T10:00:00.000Z',
      msRemaining: -7200000,
      isExpired: true,
      within24Hours: false,
      within6Hours: false,
    },
  );
});

test('guest payment state copy stays explicit across payment workflow steps', () => {
  assert.equal(
    getGuestPaymentStateText({
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: null,
      paymentConfirmedAt: null,
    }),
    'Payment unlocked. Submit payment proof before the approval window closes.',
  );

  assert.equal(
    getGuestPaymentStateText({
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
      paymentConfirmedAt: null,
    }),
    'Payment proof submitted. Host confirmation is still pending.',
  );

  assert.equal(
    getGuestPaymentStateText({
      inquiryState: 'BOOKED',
      paymentState: 'COMPLETED',
      paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
      paymentConfirmedAt: '2026-04-20T16:00:00.000Z',
    }),
    'Payment confirmed. Your stay is booked.',
  );

  assert.equal(
    getGuestPaymentStateText({
      inquiryState: 'APPROVED',
      paymentState: 'FAILED',
      paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
      paymentConfirmedAt: null,
    }),
    'Payment failed. Retry with a new proof submission to keep the stay moving.',
  );

  assert.equal(
    getGuestPaymentStateText({
      inquiryState: 'DECLINED',
      paymentState: 'UNPAID',
      paymentSubmittedAt: null,
      paymentConfirmedAt: null,
      declineReason: 'HOST_UNAVAILABLE',
      declineReasonNote: 'The host cannot support these arrival dates.',
    }),
    'This inquiry was declined: The host cannot support these arrival dates.',
  );
});

test('shared deadline copy stays operationally explicit for host and guest cards', () => {
  const now = new Date('2026-04-21T12:00:00.000Z');

  assert.equal(
    getHostInquiryDeadlineText(
      {
        inquiryState: 'APPROVED',
        paymentState: 'INITIATED',
        paymentSubmittedAt: null,
        paymentConfirmedAt: null,
        expiresAt: '2026-04-22T10:00:00.000Z',
      },
      now,
    ),
    'Payment window closes in 22 hours. The approval hold releases if payment is not completed in time.',
  );

  assert.equal(
    getGuestInquiryDeadlineText(
      {
        inquiryState: 'APPROVED',
        paymentState: 'INITIATED',
        paymentSubmittedAt: null,
        paymentConfirmedAt: null,
        expiresAt: '2026-04-22T10:00:00.000Z',
      },
      now,
    ),
    'Payment window closes in 22 hours. Submit proof before then or the approval hold releases.',
  );

  assert.equal(
    getGuestInquiryDeadlineText(
      {
        inquiryState: 'APPROVED',
        paymentState: 'INITIATED',
        paymentSubmittedAt: '2026-04-21T08:00:00.000Z',
        paymentConfirmedAt: null,
        expiresAt: '2026-04-21T18:00:00.000Z',
      },
      now,
    ),
    'Host confirmation is due in 6 hours. If the host does not confirm in time, the approval hold releases.',
  );

  assert.equal(
    getGuestInquiryDeadlineText(
      {
        inquiryState: 'EXPIRED',
        paymentState: 'INITIATED',
        paymentSubmittedAt: null,
        paymentConfirmedAt: null,
        expiresAt: '2026-04-21T10:00:00.000Z',
      },
      now,
    ),
    'Expired 2 hours ago. Any approval hold on these nights has already been released.',
  );
});

test('messaging process context gives host decision actions before approval', () => {
  const context = getMessagingProcessContext(
    {
      ...baseBooking,
      inquiryState: 'PENDING',
      paymentState: 'UNPAID',
      paymentReference: null,
      paymentInstructions: null,
    },
    'host',
  );

  assert.equal(context.stageLabel, 'Host decision needed');
  assert.equal(context.tone, 'warning');
  assert.equal(context.quickActions[0].label, 'Ask arrival detail');
  assert.equal(context.quickActions.some((action) => action.suggestionType === 'house_rules'), true);
});

test('messaging process context changes guest quick actions after approval', () => {
  const context = getMessagingProcessContext(
    {
      ...baseBooking,
      inquiryState: 'APPROVED',
      paymentState: 'INITIATED',
      paymentUnlockedAt: '2026-04-20T11:00:00.000Z',
      paymentReference: 'IDEAL-123',
      paymentInstructions: 'Pay the host account',
    },
    'guest',
  );

  assert.equal(context.stageLabel, 'Payment needed');
  assert.equal(context.nextStepLabel, 'Submit payment proof before the hold expires.');
  assert.deepEqual(
    context.quickActions.map((action) => action.label),
    ['Confirm payment details', 'Proof coming', 'Need help paying'],
  );
});

test('messaging process context moves confirmed stays into stay coordination', () => {
  const hostContext = getMessagingProcessContext(
    {
      ...baseBooking,
      inquiryState: 'BOOKED',
      paymentState: 'COMPLETED',
      paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
      paymentConfirmedAt: '2026-04-20T16:00:00.000Z',
      bookedAt: '2026-04-20T16:00:00.000Z',
      paymentReference: null,
      paymentInstructions: null,
    },
    'host',
  );
  const guestContext = getMessagingProcessContext(
    {
      ...baseBooking,
      inquiryState: 'BOOKED',
      paymentState: 'COMPLETED',
      paymentSubmittedAt: '2026-04-20T15:00:00.000Z',
      paymentConfirmedAt: '2026-04-20T16:00:00.000Z',
      bookedAt: '2026-04-20T16:00:00.000Z',
      paymentReference: null,
      paymentInstructions: null,
    },
    'guest',
  );

  assert.equal(hostContext.stageLabel, 'Stay confirmed');
  assert.equal(hostContext.quickActions[0].suggestionType, 'directions');
  assert.equal(guestContext.stageLabel, 'Stay confirmed');
  assert.equal(guestContext.quickActions[0].suggestionType, 'checkin');
});
