import type { Booking, InquiryState } from '@/types';

type BookingStateSlice = Pick<Booking, 'inquiryState' | 'paymentState' | 'paymentSubmittedAt' | 'paymentConfirmedAt'>;

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

export function isOpenHostInquiry(booking: Pick<Booking, 'inquiryState'>) {
  return ['PENDING', 'VIEWED', 'RESPONDED', 'APPROVED'].includes(booking.inquiryState);
}

export function isPendingHostDecision(booking: Pick<Booking, 'inquiryState'>) {
  return ['PENDING', 'VIEWED', 'RESPONDED'].includes(booking.inquiryState);
}
