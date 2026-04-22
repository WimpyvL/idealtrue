import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeVoucherWindow,
  deriveBillingTimeline,
  generateVoucherPins,
  getHostBillingRestrictionMessage,
  isHostBillingRestricted,
} from '../encore/billing/host-billing.ts';

test('computeVoucherWindow gives hosts three months free with a seven-day reminder window', () => {
  const window = computeVoucherWindow('2026-04-20T08:00:00.000Z', 3, 7);

  assert.equal(window.currentPeriodStart, '2026-04-20T08:00:00.000Z');
  assert.equal(window.currentPeriodEnd, '2026-07-20T08:00:00.000Z');
  assert.equal(window.reminderWindowStartsAt, '2026-07-13T08:00:00.000Z');
});

test('deriveBillingTimeline keeps voucher hosts active during the reminder week and only greylist-eligible after expiry', () => {
  const timeline = deriveBillingTimeline({
    billingSource: 'voucher',
    billingStatus: 'active',
    currentPeriodEnd: '2026-07-20T08:00:00.000Z',
    reminderWindowStartsAt: '2026-07-13T08:00:00.000Z',
    cardOnFile: false,
    greylistedAt: null,
  }, '2026-07-18T09:00:00.000Z');

  assert.equal(timeline.inReminderWindow, true);
  assert.equal(timeline.greylistEligible, false);
  assert.equal(timeline.nextAction, 'add_card');
});

test('deriveBillingTimeline marks voucher hosts greylist-eligible once the reminder week has fully elapsed without a card', () => {
  const timeline = deriveBillingTimeline({
    billingSource: 'voucher',
    billingStatus: 'active',
    currentPeriodEnd: '2026-07-20T08:00:00.000Z',
    reminderWindowStartsAt: '2026-07-13T08:00:00.000Z',
    cardOnFile: false,
    greylistedAt: null,
  }, '2026-07-20T08:00:01.000Z');

  assert.equal(timeline.inReminderWindow, false);
  assert.equal(timeline.greylistEligible, true);
  assert.equal(timeline.nextAction, 'greylist');
});

test('generateVoucherPins produces the requested number of unique onboarding pins', () => {
  const pins = generateVoucherPins(100, { seed: 20260420, prefix: 'HOST' });

  assert.equal(pins.length, 100);
  assert.equal(new Set(pins).size, 100);
  assert.ok(pins.every((pin) => /^HOST-[A-Z0-9]{10}$/.test(pin)));
});

test('greylisted billing status is treated as an operational lock with explicit host-facing copy', () => {
  assert.equal(isHostBillingRestricted('greylisted'), true);
  assert.equal(isHostBillingRestricted('active'), false);
  assert.equal(
    getHostBillingRestrictionMessage('listings'),
    'Your host account is greylisted. Listing access is paused until billing is resolved.',
  );
  assert.equal(
    getHostBillingRestrictionMessage('bookings'),
    'Your host account is greylisted. Booking actions are paused until billing is resolved.',
  );
});
