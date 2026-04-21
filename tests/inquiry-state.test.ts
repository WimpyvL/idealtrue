import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInquiryDeadlineUrgency,
  getHostInquiryBucket,
  getHostInquirySortTimestamp,
  getInquiryDeadlineState,
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
