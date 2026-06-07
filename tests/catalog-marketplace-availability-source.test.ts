import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// (|/) Klaasvaakie
test('marketplace listing hydration refreshes booking blocks even when manual blocks already exist', () => {
  const source = readFileSync(new URL('../encore/catalog/api.ts', import.meta.url), 'utf8');
  const functionBody = source.slice(
    source.indexOf('async function ensureListingAvailabilityHydrated'),
    source.indexOf('async function listAvailabilityBlocksForListings'),
  );
  const bookingLookupIndex = functionBody.indexOf('FROM bookings');
  const oldEarlyReturnIndex = functionBody.indexOf('if (existingBlocks.length > 0) {\n      return existingBlocks;\n    }\n\n    const bookingRows');

  assert.ok(bookingLookupIndex > 0, 'hydration must read active booking rows');
  assert.equal(oldEarlyReturnIndex, -1, 'existing manual blocks must not short-circuit booking availability hydration');
  assert.match(
    functionBody,
    /replaceBookingAvailabilityBlocks\(row\.id, bookingEntries\)/,
    'hydration must refresh booking-owned availability blocks for marketplace reads',
  );
  assert.equal(functionBody.includes('.checkIn.slice('), false, 'booking timestamps can be Date objects and must not use string slicing');
  assert.equal(functionBody.includes('.checkOut.slice('), false, 'booking timestamps can be Date objects and must not use string slicing');
});
