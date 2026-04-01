import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bookingOverlapsBlockedDates,
  CLEANING_FEE,
  computeBookingTotalPrice,
  getBookingStatusTransitionError,
  getPaymentProofSubmissionError,
} from '../encore/booking/workflow.ts';

test('computeBookingTotalPrice includes the cleaning fee for valid stays', () => {
  const total = computeBookingTotalPrice(
    1500,
    new Date('2026-04-10T00:00:00.000Z'),
    new Date('2026-04-13T00:00:00.000Z'),
  );

  assert.equal(total, 1500 * 3 + CLEANING_FEE);
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

test('getBookingStatusTransitionError allows the intended payment workflow', () => {
  assert.equal(getBookingStatusTransitionError('pending', 'awaiting_guest_payment'), null);
  assert.equal(getBookingStatusTransitionError('payment_submitted', 'confirmed'), null);
  assert.equal(getBookingStatusTransitionError('confirmed', 'completed'), null);
});

test('getBookingStatusTransitionError rejects invalid host transitions', () => {
  assert.match(getBookingStatusTransitionError('pending', 'confirmed') || '', /confirmed after the payment step/);
  assert.match(getBookingStatusTransitionError('completed', 'cancelled') || '', /Closed bookings/);
});

test('getPaymentProofSubmissionError only allows payment-step bookings', () => {
  assert.equal(getPaymentProofSubmissionError('awaiting_guest_payment'), null);
  assert.equal(getPaymentProofSubmissionError('payment_submitted'), null);
  assert.match(getPaymentProofSubmissionError('pending') || '', /Payment proof can only be submitted/);
});
