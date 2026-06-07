import type { AvailabilityBlockSource, ListingAvailabilityBlockRecord } from "../shared/domain";

const LISTING_AVAILABILITY_TIME_ZONE = "Africa/Johannesburg";
const LISTING_AVAILABILITY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: LISTING_AVAILABILITY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface AvailabilityBlockInput {
  id: string;
  listingId: string;
  sourceType: AvailabilityBlockSource;
  sourceId: string;
  startsOn: string;
  endsOn: string;
  nights: string[];
  note?: string | null;
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

export function bookingTimestampToAvailabilityDateKey(value: Date | string) {
  if (value instanceof Date) {
    const parts = LISTING_AVAILABILITY_DATE_FORMATTER.formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return normalizeAvailabilityDateKey(`${year}-${month}-${day}`);
  }

  const trimmed = `${value}`.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed.slice(0, 10)) && !trimmed.includes("T")) {
    return normalizeAvailabilityDateKey(trimmed);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return normalizeAvailabilityDateKey(trimmed);
  }

  return bookingTimestampToAvailabilityDateKey(parsed);
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

export function buildIntervalsFromDateKeys(dateKeys: string[]) {
  const normalized = Array.from(new Set((dateKeys ?? []).map(normalizeAvailabilityDateKey))).sort();
  if (normalized.length === 0) {
    return [];
  }

  const intervals: Array<{ startsOn: string; endsOn: string; nights: string[] }> = [];
  let currentNights = [normalized[0]!];

  for (let index = 1; index < normalized.length; index += 1) {
    const nextDateKey = normalized[index]!;
    const previousDateKey = currentNights[currentNights.length - 1]!;
    const previousDate = toUtcDateOnly(previousDateKey);
    previousDate.setUTCDate(previousDate.getUTCDate() + 1);
    const expectedNext = previousDate.toISOString().slice(0, 10);

    if (nextDateKey === expectedNext) {
      currentNights.push(nextDateKey);
      continue;
    }

    intervals.push({
      startsOn: currentNights[0]!,
      endsOn: expectedNext,
      nights: [...currentNights],
    });
    currentNights = [nextDateKey];
  }

  const lastNight = currentNights[currentNights.length - 1]!;
  const lastNightDate = toUtcDateOnly(lastNight);
  lastNightDate.setUTCDate(lastNightDate.getUTCDate() + 1);
  intervals.push({
    startsOn: currentNights[0]!,
    endsOn: lastNightDate.toISOString().slice(0, 10),
    nights: [...currentNights],
  });

  return intervals;
}

export function buildBlockedDatesFromAvailability(blocks: Pick<AvailabilityBlockInput, "nights">[]) {
  return Array.from(new Set(blocks.flatMap((block) => block.nights.map(normalizeAvailabilityDateKey)))).sort();
}

export function mergeLegacyBlockedDatesWithBookingNights(
  blockedDates: string[] | undefined,
  bookingStays: Array<{ checkIn: Date | string; checkOut: Date | string }>,
) {
  const normalizedBlockedDates = (blockedDates ?? []).map(normalizeAvailabilityDateKey);
  const bookingNights = bookingStays.flatMap((stay) =>
    enumerateAvailabilityNights(
      bookingTimestampToAvailabilityDateKey(stay.checkIn),
      bookingTimestampToAvailabilityDateKey(stay.checkOut),
    ),
  );

  return Array.from(new Set([...normalizedBlockedDates, ...bookingNights])).sort();
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
    note: block.note ?? null,
    bookingId: block.bookingId ?? null,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
}
