import type { AvailabilityBlockSource, ListingAvailabilityBlockRecord } from "../shared/domain";

export interface AvailabilityBlockInput {
  id: string;
  listingId: string;
  sourceType: AvailabilityBlockSource;
  sourceId: string;
  startsOn: string;
  endsOn: string;
  nights: string[];
  bookingId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityConflictMatch {
  block: AvailabilityBlockInput;
  conflictingNights: string[];
}

function toUtcDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`Invalid availability date: ${value}`);
  }
  return parsed;
}

export function normalizeAvailabilityDateKey(value: string) {
  const normalized = `${value}`.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new RangeError(`Invalid availability date key: ${value}`);
  }
  const parsed = toUtcDateOnly(normalized);
  return parsed.toISOString().slice(0, 10);
}

export function enumerateAvailabilityNights(startInclusive: string, endExclusive: string) {
  const start = toUtcDateOnly(normalizeAvailabilityDateKey(startInclusive));
  const end = toUtcDateOnly(normalizeAvailabilityDateKey(endExclusive));

  if (end <= start) {
    throw new RangeError("Availability end date must be after the start date.");
  }

  const nights: string[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

export function buildSingleNightInterval(dateKey: string) {
  const normalized = normalizeAvailabilityDateKey(dateKey);
  const start = toUtcDateOnly(normalized);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startsOn: normalized,
    endsOn: end.toISOString().slice(0, 10),
    nights: [normalized],
  };
}

export function buildBlockedDatesFromAvailability(blocks: Pick<AvailabilityBlockInput, "nights">[]) {
  return Array.from(new Set(blocks.flatMap((block) => block.nights.map(normalizeAvailabilityDateKey)))).sort();
}

export function buildManualBlockedDates(blocks: Pick<AvailabilityBlockInput, "sourceType" | "nights">[]) {
  return buildBlockedDatesFromAvailability(blocks.filter((block) => block.sourceType === "MANUAL"));
}

export function findAvailabilityConflict(
  requestedNights: string[],
  blocks: AvailabilityBlockInput[],
  options?: {
    excludeSourceType?: AvailabilityBlockSource;
    excludeSourceId?: string;
  },
): AvailabilityConflictMatch | null {
  const normalizedRequested = Array.from(new Set(requestedNights.map(normalizeAvailabilityDateKey)));

  for (const block of blocks) {
    if (
      options?.excludeSourceType &&
      options?.excludeSourceId &&
      block.sourceType === options.excludeSourceType &&
      block.sourceId === options.excludeSourceId
    ) {
      continue;
    }

    const conflictingNights = normalizedRequested.filter((night) => block.nights.includes(night));
    if (conflictingNights.length > 0) {
      return { block, conflictingNights };
    }
  }

  return null;
}

export function toAvailabilityBlockRecord(block: AvailabilityBlockInput): ListingAvailabilityBlockRecord {
  return {
    id: block.id,
    listingId: block.listingId,
    sourceType: block.sourceType,
    sourceId: block.sourceId,
    startsOn: block.startsOn,
    endsOn: block.endsOn,
    nights: block.nights.map(normalizeAvailabilityDateKey),
    bookingId: block.bookingId ?? null,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
}
