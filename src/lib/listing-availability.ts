import type { Listing } from '@/types';

function normalizeDateOnly(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return `${value}`.trim().slice(0, 10);
}

function collectBlockedNights(listing: Pick<Listing, 'blockedDates' | 'availabilityBlocks'>) {
  const blockedNights = new Set((listing.blockedDates ?? []).map((night) => normalizeDateOnly(night)));
  for (const block of listing.availabilityBlocks ?? []) {
    for (const night of block.nights ?? []) {
      blockedNights.add(normalizeDateOnly(night));
    }
  }
  return blockedNights;
}

export function isListingNightBlocked(listing: Pick<Listing, 'blockedDates' | 'availabilityBlocks'>, date: Date) {
  return collectBlockedNights(listing).has(normalizeDateOnly(date));
}

export function stayOverlapsListingAvailability(
  listing: Pick<Listing, 'blockedDates' | 'availabilityBlocks'>,
  checkIn?: Date | null,
  checkOut?: Date | null,
) {
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return false;
  }

  const blockedNights = collectBlockedNights(listing);
  if (blockedNights.size === 0) {
    return false;
  }

  for (let cursor = new Date(checkIn); cursor < checkOut; cursor.setDate(cursor.getDate() + 1)) {
    if (blockedNights.has(normalizeDateOnly(cursor))) {
      return true;
    }
  }

  return false;
}
