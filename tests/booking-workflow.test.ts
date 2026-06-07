import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bookingOverlapsBlockedDates,
  computeInquiryExpiresAt,
  computeBookingTotalPrice,
  computeDiscountedNightlyRate,
  getInquiryStatusTransitionError,
  getPaymentProofSubmissionError,
  getPaymentStateTransitionError,
  shouldExpireInquiry,
} from '../encore/booking/workflow.ts';

test('computeBookingTotalPrice uses nightly pricing only for valid stays', () => {
  const total = computeBookingTotalPrice(
    1500,
    new Date('2026-04-10T00:00:00.000Z'),
    new Date('2026-04-13T00:00:00.000Z'),
  );

  assert.equal(total, 1500 * 3);
});

test('computeBookingTotalPrice applies listing discounts to the server-owned total', () => {
  const total = computeBookingTotalPrice(
    1800,
    new Date('2026-04-10T00:00:00.000Z'),
    new Date('2026-04-13T00:00:00.000Z'),
    10,
  );

  assert.equal(total, 1620 * 3);
});

test('computeDiscountedNightlyRate clamps invalid discount inputs', () => {
  assert.equal(computeDiscountedNightlyRate(1000, -10), 1000);
  assert.equal(computeDiscountedNightlyRate(1000, 125), 0);
});

test('bookingOverlapsBlockedDates catches blocked nights inside the requested stay', () => {
  assert.equal(
    bookingOverlapsBlockedDates(
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-13T00:00:00.000Z'),
      ['2026-04-11', '2026-05-01'],
    ),
    true,
  );

  assert.equal(
    bookingOverlapsBlockedDates(
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-13T00:00:00.000Z'),
      ['2026-04-13'],
    ),
    false,
  );
});

test('workflow allows the intended inquiry and payment transitions', () => {
  assert.equal(getInquiryStatusTransitionError('PENDING', 'APPROVED', 'host'), null);
  assert.equal(getPaymentStateTransitionError('APPROVED', 'UNPAID', 'INITIATED', 'system'), null);
  assert.equal(getPaymentStateTransitionError('APPROVED', 'INITIATED', 'COMPLETED', 'host'), null);
  assert.equal(getInquiryStatusTransitionError('APPROVED', 'BOOKED', 'system'), null);
});

test('workflow rejects invalid transitions and direct guest completion', () => {
  assert.match(getInquiryStatusTransitionError('PENDING', 'BOOKED', 'host') || '', /Hosts can only view, respond to, approve, or decline/);
  assert.match(getPaymentStateTransitionError('APPROVED', 'INITIATED', 'COMPLETED', 'guest') || '', /Guests cannot directly mark payments complete/);
  assert.match(getInquiryStatusTransitionError('BOOKED', 'DECLINED', 'host') || '', /immutable/);
});

test('getPaymentProofSubmissionError only allows payment-step bookings', () => {
  assert.equal(getPaymentProofSubmissionError('APPROVED', 'INITIATED'), null);
  assert.match(getPaymentProofSubmissionError('PENDING', 'UNPAID') || '', /Payment is only available/);
  assert.match(getPaymentProofSubmissionError('APPROVED', 'COMPLETED') || '', /Payment is only available/);
});

test('workflow computes expiry deadlines for unresolved and approved enquiries', () => {
  assert.equal(
    computeInquiryExpiresAt('PENDING', '2026-04-20T10:00:00.000Z'),
    '2026-04-22T10:00:00.000Z',
  );
  assert.equal(
    computeInquiryExpiresAt('RESPONDED', '2026-04-20T10:00:00.000Z'),
    '2026-04-22T10:00:00.000Z',
  );
  assert.equal(
    computeInquiryExpiresAt('APPROVED', '2026-04-20T10:00:00.000Z'),
    '2026-04-21T10:00:00.000Z',
  );
  assert.equal(computeInquiryExpiresAt('BOOKED', '2026-04-20T10:00:00.000Z'), null);
});

test('workflow only expires enquiries once their deadline has actually passed', () => {
  assert.equal(
    shouldExpireInquiry('APPROVED', '2026-04-21T10:00:00.000Z', '2026-04-21T09:59:59.000Z'),
    false,
  );
  assert.equal(
    shouldExpireInquiry('APPROVED', '2026-04-21T10:00:00.000Z', '2026-04-21T10:00:00.000Z'),
    true,
  );
  assert.equal(
    shouldExpireInquiry('EXPIRED', '2026-04-21T10:00:00.000Z', '2026-04-22T10:00:00.000Z'),
    false,
  );
  assert.equal(
    shouldExpireInquiry('BOOKED', '2026-04-21T10:00:00.000Z', '2026-04-22T10:00:00.000Z'),
    false,
  );
});
