type BookingAuthIntentInput = {
  listingId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
};

export type BookingIntent = {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
};

const BOOKING_INTENT_KEYS = ['checkIn', 'checkOut', 'adults', 'children'];

function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGuestCount(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) && count >= 0 ? count : fallback;
}

function buildBookingReturnPath({ listingId, checkIn, checkOut, adults, children }: BookingAuthIntentInput) {
  const searchParams = new URLSearchParams();
  searchParams.set('listingId', listingId);
  searchParams.set('checkIn', toDateParam(checkIn));
  searchParams.set('checkOut', toDateParam(checkOut));
  searchParams.set('adults', String(adults));
  searchParams.set('children', String(children));

  return `/?${searchParams.toString()}`;
}

export function buildBookingAuthPath(input: BookingAuthIntentInput) {
  return buildAuthPathWithReturn(buildBookingReturnPath(input), 'booking');
}

export function buildAuthPathWithReturn(returnTo: string, intent?: string) {
  const searchParams = new URLSearchParams();
  if (intent) {
    searchParams.set('intent', intent);
  }
  searchParams.set('returnTo', returnTo);

  return `/signup?${searchParams.toString()}`;
}

export function buildPlannerReturnPath(query?: string | null) {
  const normalizedQuery = `${query || ''}`.trim();
  if (!normalizedQuery) {
    return '/planner';
  }

  const searchParams = new URLSearchParams();
  searchParams.set('q', normalizedQuery);
  return `/planner?${searchParams.toString()}`;
}

export function buildPlannerAuthPath(query?: string | null) {
  return buildAuthPathWithReturn(buildPlannerReturnPath(query), 'planner');
}

export function parseBookingIntent(search: string): BookingIntent | null {
  const searchParams = new URLSearchParams(search);
  const checkIn = parseDateParam(searchParams.get('checkIn'));
  const checkOut = parseDateParam(searchParams.get('checkOut'));

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return null;
  }

  return {
    checkIn,
    checkOut,
    adults: Math.max(1, parseGuestCount(searchParams.get('adults'), 1)),
    children: parseGuestCount(searchParams.get('children'), 0),
  };
}

export function clearBookingIntentParams(search: string) {
  const searchParams = new URLSearchParams(search);
  BOOKING_INTENT_KEYS.forEach((key) => searchParams.delete(key));
  return searchParams;
}

export function getSafeAuthReturnPath(returnTo: string | null) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return null;
  }

  return returnTo;
}
