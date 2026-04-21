import type { Booking, InquiryState } from '@/types';

type BookingStateSlice = Pick<Booking, 'inquiryState' | 'paymentState' | 'paymentSubmittedAt' | 'paymentConfirmedAt'>;
type HostBookingSlice = BookingStateSlice & Pick<Booking, 'createdAt' | 'viewedAt' | 'respondedAt' | 'paymentUnlockedAt' | 'bookedAt' | 'expiresAt'>;
type BookingDeadlineSlice = BookingStateSlice & Pick<Booking, 'expiresAt'>;

export type HostInquiryBucket =
  | 'needs_response'
  | 'awaiting_guest_payment'
  | 'payment_review'
  | 'confirmed'
  | 'closed';

export type InquiryDeadlineState =
  | { kind: 'response_due' | 'payment_due' | 'confirmation_due' | 'expired'; deadlineAt: string }
  | null;

export type InquiryDeadlineUrgency =
  | {
      tone: 'neutral' | 'warning' | 'danger';
      deadlineKind: NonNullable<InquiryDeadlineState>['kind'];
      deadlineAt: string;
      msRemaining: number;
      isExpired: boolean;
      within24Hours: boolean;
      within6Hours: boolean;
    }
  | null;

export type HostInquiryGroups<TBooking extends HostBookingSlice> = {
  needsResponse: TBooking[];
  awaitingGuestPayment: TBooking[];
  paymentReview: TBooking[];
  confirmed: TBooking[];
  closed: TBooking[];
};

export function getInquiryDisplayState(booking: BookingStateSlice): InquiryState {
  if (booking.inquiryState === 'APPROVED' && booking.paymentState === 'COMPLETED') {
    return 'BOOKED';
  }

  return booking.inquiryState;
}

export function getInquiryBadgeLabel(booking: BookingStateSlice) {
  if (isAwaitingHostPaymentConfirmation(booking)) {
    return 'Payment Under Review';
  }

  const state = getInquiryDisplayState(booking);

  switch (state) {
    case 'PENDING':
      return 'Awaiting Host Response';
    case 'VIEWED':
      return 'Viewed';
    case 'RESPONDED':
      return 'Responded';
    case 'APPROVED':
      return 'Ready for Payment';
    case 'DECLINED':
      return 'Declined';
    case 'EXPIRED':
      return 'Expired';
    case 'BOOKED':
      return 'BOOKED';
    default:
      return state;
  }
}

export function getInquiryResponseText(booking: BookingStateSlice) {
  if (isAwaitingHostPaymentConfirmation(booking)) {
    return 'Payment proof submitted. Awaiting host confirmation';
  }

  const state = getInquiryDisplayState(booking);

  switch (state) {
    case 'PENDING':
      return 'Awaiting host response';
    case 'VIEWED':
      return 'Host has viewed your inquiry';
    case 'RESPONDED':
      return 'Host responded to your inquiry';
    case 'APPROVED':
      return 'Ready for payment';
    case 'DECLINED':
      return 'This inquiry was declined';
    case 'EXPIRED':
      return 'This inquiry expired';
    case 'BOOKED':
      return 'Confirmed stay';
    default:
      return state;
  }
}

export function canGuestPay(booking: BookingStateSlice) {
  return booking.inquiryState === 'APPROVED' && booking.paymentState === 'INITIATED' && !booking.paymentSubmittedAt;
}

export function canGuestViewStayDetails(booking: BookingStateSlice) {
  return booking.inquiryState === 'BOOKED' && booking.paymentState === 'COMPLETED';
}

export function isBookedStay(booking: BookingStateSlice) {
  return booking.inquiryState === 'BOOKED' && booking.paymentState === 'COMPLETED';
}

export function isAwaitingHostPaymentConfirmation(booking: BookingStateSlice) {
  return booking.inquiryState === 'APPROVED' && booking.paymentState === 'INITIATED' && !!booking.paymentSubmittedAt && !booking.paymentConfirmedAt;
}

export function isAwaitingGuestPayment(booking: BookingStateSlice) {
  return booking.inquiryState === 'APPROVED' && booking.paymentState === 'INITIATED' && !booking.paymentSubmittedAt;
}

export function getInquiryDeadlineState(booking: BookingDeadlineSlice): InquiryDeadlineState {
  if (!booking.expiresAt) {
    return null;
  }

  if (booking.inquiryState === 'EXPIRED') {
    return { kind: 'expired', deadlineAt: booking.expiresAt };
  }

  if (isPendingHostDecision(booking)) {
    return { kind: 'response_due', deadlineAt: booking.expiresAt };
  }

  if (booking.inquiryState === 'APPROVED' && booking.paymentState === 'INITIATED') {
    return {
      kind: booking.paymentSubmittedAt ? 'confirmation_due' : 'payment_due',
      deadlineAt: booking.expiresAt,
    };
  }

  return null;
}

export function getInquiryDeadlineUrgency(
  booking: BookingDeadlineSlice,
  now: Date = new Date(),
): InquiryDeadlineUrgency {
  const deadlineState = getInquiryDeadlineState(booking);
  if (!deadlineState) {
    return null;
  }

  const msRemaining = new Date(deadlineState.deadlineAt).getTime() - now.getTime();
  const isExpired = deadlineState.kind === 'expired' || msRemaining <= 0;
  const within6Hours = !isExpired && msRemaining <= 6 * 60 * 60 * 1000;
  const within24Hours = !isExpired && msRemaining <= 24 * 60 * 60 * 1000;

  return {
    tone: isExpired ? 'danger' : within6Hours ? 'danger' : within24Hours ? 'warning' : 'neutral',
    deadlineKind: deadlineState.kind,
    deadlineAt: deadlineState.deadlineAt,
    msRemaining,
    isExpired,
    within24Hours,
    within6Hours,
  };
}

export function groupHostInquiries<TBooking extends HostBookingSlice>(
  bookings: readonly TBooking[],
): HostInquiryGroups<TBooking> {
  const sorted = [...bookings].sort(
    (left, right) =>
      new Date(getHostInquirySortTimestamp(right)).getTime() -
      new Date(getHostInquirySortTimestamp(left)).getTime(),
  );

  return {
    needsResponse: sorted.filter((booking) => getHostInquiryBucket(booking) === 'needs_response'),
    awaitingGuestPayment: sorted.filter((booking) => getHostInquiryBucket(booking) === 'awaiting_guest_payment'),
    paymentReview: sorted.filter((booking) => getHostInquiryBucket(booking) === 'payment_review'),
    confirmed: sorted.filter((booking) => getHostInquiryBucket(booking) === 'confirmed'),
    closed: sorted.filter((booking) => getHostInquiryBucket(booking) === 'closed'),
  };
}

export function getHostInquiryBucket(booking: HostBookingSlice): HostInquiryBucket {
  if (isAwaitingHostPaymentConfirmation(booking)) {
    return 'payment_review';
  }

  if (isBookedStay(booking)) {
    return 'confirmed';
  }

  if (isPendingHostDecision(booking)) {
    return 'needs_response';
  }

  if (isAwaitingGuestPayment(booking) || booking.inquiryState === 'APPROVED') {
    return 'awaiting_guest_payment';
  }

  return 'closed';
}

export function getHostInquirySortTimestamp(booking: HostBookingSlice) {
  switch (getHostInquiryBucket(booking)) {
    case 'payment_review':
      return booking.paymentSubmittedAt ?? booking.paymentUnlockedAt ?? booking.createdAt;
    case 'awaiting_guest_payment':
      return booking.paymentUnlockedAt ?? booking.respondedAt ?? booking.createdAt;
    case 'confirmed':
      return booking.paymentConfirmedAt ?? booking.bookedAt ?? booking.createdAt;
    case 'closed':
      return booking.expiresAt ?? booking.respondedAt ?? booking.viewedAt ?? booking.createdAt;
    case 'needs_response':
    default:
      return booking.respondedAt ?? booking.viewedAt ?? booking.createdAt;
  }
}

export function isOpenHostInquiry(booking: Pick<Booking, 'inquiryState'>) {
  return ['PENDING', 'VIEWED', 'RESPONDED', 'APPROVED'].includes(booking.inquiryState);
}

export function isPendingHostDecision(booking: Pick<Booking, 'inquiryState'>) {
  return ['PENDING', 'VIEWED', 'RESPONDED'].includes(booking.inquiryState);
}
