import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeDiscountedNightlyRate,
  getListingNightlyRate,
  getListingOriginalNightlyRate,
} from '../src/lib/listing-pricing.ts';

test('listing pricing applies host discounts to the visible nightly rate', () => {
  assert.equal(computeDiscountedNightlyRate(1800, 10), 1620);
  assert.equal(getListingNightlyRate({ pricePerNight: 2200, discount: 5 }), 2090);
});

test('listing pricing exposes original rate only when a real discount exists', () => {
  assert.equal(getListingOriginalNightlyRate({ pricePerNight: 1800, discount: 10 }), 1800);
  assert.equal(getListingOriginalNightlyRate({ pricePerNight: 1800, discount: 0 }), null);
});
