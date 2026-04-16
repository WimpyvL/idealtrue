import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlockedDatesFromAvailability,
  buildManualBlockedDates,
  buildSingleNightInterval,
  enumerateAvailabilityNights,
  findAvailabilityConflict,
} from '../encore/catalog/availability.ts';

test('enumerateAvailabilityNights returns stay nights and excludes checkout day', () => {
  assert.deepEqual(
    enumerateAvailabilityNights('2026-04-20', '2026-04-23'),
    ['2026-04-20', '2026-04-21', '2026-04-22'],
  );
});

test('buildSingleNightInterval converts a manual date into a one-night block', () => {
  assert.deepEqual(buildSingleNightInterval('2026-05-01'), {
    startsOn: '2026-05-01',
    endsOn: '2026-05-02',
    nights: ['2026-05-01'],
  });
});

test('blocked date builders dedupe nights and manual extraction ignores booking-driven blocks', () => {
  const blocks = [
    {
      nights: ['2026-06-01', '2026-06-02'],
      sourceType: 'MANUAL',
    },
    {
      nights: ['2026-06-02', '2026-06-03'],
      sourceType: 'BOOKED',
    },
    {
      nights: ['2026-06-04'],
      sourceType: 'APPROVED_HOLD',
    },
  ] as const;

  assert.deepEqual(buildBlockedDatesFromAvailability(blocks), [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
  ]);

  assert.deepEqual(buildManualBlockedDates(blocks), ['2026-06-01', '2026-06-02']);
});

test('findAvailabilityConflict detects overlaps and can exclude the current hold by source', () => {
  const blocks = [
    {
      id: 'manual-1',
      listingId: 'listing-1',
      sourceType: 'MANUAL',
      sourceId: '2026-07-10',
      startsOn: '2026-07-10',
      endsOn: '2026-07-11',
      nights: ['2026-07-10'],
      bookingId: null,
      createdAt: '2026-04-16T08:00:00.000Z',
      updatedAt: '2026-04-16T08:00:00.000Z',
    },
    {
      id: 'hold-1',
      listingId: 'listing-1',
      sourceType: 'APPROVED_HOLD',
      sourceId: 'booking-1',
      startsOn: '2026-07-12',
      endsOn: '2026-07-15',
      nights: ['2026-07-12', '2026-07-13', '2026-07-14'],
      bookingId: 'booking-1',
      createdAt: '2026-04-16T08:00:00.000Z',
      updatedAt: '2026-04-16T08:00:00.000Z',
    },
  ];

  const manualConflict = findAvailabilityConflict(['2026-07-10', '2026-07-11'], blocks);
  assert.equal(manualConflict?.block.sourceType, 'MANUAL');
  assert.deepEqual(manualConflict?.conflictingNights, ['2026-07-10']);

  const holdConflict = findAvailabilityConflict(['2026-07-13'], blocks);
  assert.equal(holdConflict?.block.sourceType, 'APPROVED_HOLD');

  const excluded = findAvailabilityConflict(['2026-07-13'], blocks, {
    excludeSourceType: 'APPROVED_HOLD',
    excludeSourceId: 'booking-1',
  });
  assert.equal(excluded, null);
});
