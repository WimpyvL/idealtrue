import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bookingOverlapsBlockedDates,
  computeBookingTotalPrice,
  getInquiryStatusTransitionError,
  getPaymentProofSubmissionError,
  getPaymentStateTransitionError,
} from '../encore/booking/workflow.ts';

test('computeBookingTotalPrice uses nightly pricing only for valid stays', () => {
  const total = computeBookingTotalPrice(
    1500,
    new Date('2026-04-10T00:00:00.000Z'),
    new Date('2026-04-13T00:00:00.000Z'),
  );

  assert.equal(total, 1500 * 3);
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
