import { formatDistanceStrict } from 'date-fns';

import type { Booking, InquiryDeclineReason, InquiryState, MessageSuggestionType } from '@/types';

type BookingStateSlice = Pick<
  Booking,
  'inquiryState' | 'paymentState' | 'paymentSubmittedAt' | 'paymentConfirmedAt' | 'declineReason' | 'declineReasonNote'
>;
type HostBookingSlice = BookingStateSlice & Pick<Booking, 'createdAt' | 'viewedAt' | 'respondedAt' | 'paymentUnlockedAt' | 'bookedAt' | 'expiresAt'>;
type BookingDeadlineSlice = BookingStateSlice & Pick<Booking, 'expiresAt'>;
type MessagingBookingSlice = BookingDeadlineSlice &
  Pick<Booking, 'checkIn' | 'checkOut' | 'paymentReference' | 'paymentInstructions'>;

export const inquiryDeclineReasonOptions: Array<{
  value: InquiryDeclineReason;
  label: string;
  description: string;
}> = [
  {
    value: 'DATES_UNAVAILABLE',
    label: 'Dates no longer available',
    description: 'Use when the nights are no longer open for this enquiry.',
  },
  {
    value: 'GUEST_COUNT_NOT_SUPPORTED',
    label: 'Guest count not supported',
    description: 'Use when the guest mix or occupancy does not fit the property.',
  },
  {
    value: 'BOOKING_REQUIREMENTS_NOT_MET',
    label: 'Booking requirements not met',
    description: 'Use when house rules or booking requirements were not met.',
  },
  {
    value: 'HOST_UNAVAILABLE',
    label: 'Host unavailable',
    description: 'Use when the host cannot support the stay even if dates looked open.',
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Use when another host-side reason applies. Add a short note.',
  },
];

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

export type MessagingParticipantRole = 'host' | 'guest';

export type MessagingQuickAction = {
  label: string;
  text: string;
  suggestionType?: MessageSuggestionType;
  priority: 'primary' | 'secondary';
};

export type MessagingProcessContext = {
  stageLabel: string;
  stageDescription: string;
  nextStepLabel: string;
  tone: 'neutral' | 'warning' | 'success' | 'closed';
  quickActions: MessagingQuickAction[];
};

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

export function getInquiryDeclineReasonLabel(reason: InquiryDeclineReason | null | undefined) {
  return inquiryDeclineReasonOptions.find((option) => option.value === reason)?.label ?? null;
}

export function getInquiryDeclineReasonDetail(booking: Pick<Booking, 'inquiryState' | 'declineReason' | 'declineReasonNote'>) {
  if (booking.inquiryState !== 'DECLINED') {
    return null;
  }

  const note = booking.declineReasonNote?.trim();
  if (note) {
    return note;
  }

  return getInquiryDeclineReasonLabel(booking.declineReason) ?? null;
}

function formatDeclineReasonSentence(detail: string | null) {
  if (!detail) {
    return 'This inquiry was declined';
  }

  const normalizedDetail = detail.trim().replace(/[.!\s]+$/, '');
  return `This inquiry was declined: ${normalizedDetail}.`;
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
      return formatDeclineReasonSentence(getInquiryDeclineReasonDetail(booking));
    case 'EXPIRED':
      return 'This inquiry expired';
    case 'BOOKED':
      return 'Confirmed stay';
    default:
      return state;
  }
}

export function getGuestPaymentStateText(booking: BookingStateSlice) {
  if (isBookedStay(booking)) {
    return 'Payment confirmed. Your stay is booked.';
  }

  if (isAwaitingHostPaymentConfirmation(booking)) {
    return 'Payment proof submitted. Host confirmation is still pending.';
  }

  if (canGuestPay(booking)) {
    return 'Payment unlocked. Submit payment proof before the approval window closes.';
  }

  if (booking.paymentState === 'FAILED') {
    return 'Payment failed. Retry with a new proof submission to keep the stay moving.';
  }

  return getInquiryResponseText(booking);
}

export function getMessagingProcessContext(
  booking: MessagingBookingSlice,
  role: MessagingParticipantRole,
): MessagingProcessContext {
  if (role === 'host') {
    return getHostMessagingProcessContext(booking);
  }

  return getGuestMessagingProcessContext(booking);
}

function getHostMessagingProcessContext(booking: MessagingBookingSlice): MessagingProcessContext {
  if (isPendingHostDecision(booking)) {
    return {
      stageLabel: 'Host decision needed',
      stageDescription: 'The guest is waiting for you to move this enquiry forward.',
      nextStepLabel: 'Approve, decline, or ask one clear question before the response window closes.',
      tone: 'warning',
      quickActions: [
        {
          label: 'Ask arrival detail',
          text: 'Before I make a decision, can you confirm your expected arrival time and any special requirements for the stay?',
          priority: 'primary',
        },
        {
          label: 'Send House Rules',
          text: 'Here are the house rules for your stay. Please review them and let me know if you have any questions.',
          suggestionType: 'house_rules',
          priority: 'secondary',
        },
        {
          label: 'Dates look workable',
          text: 'Thanks for the enquiry. Your dates and guest count look workable from my side. I will update the enquiry shortly.',
          priority: 'secondary',
        },
      ],
    };
  }

  if (isAwaitingHostPaymentConfirmation(booking)) {
    return {
      stageLabel: 'Payment proof under review',
      stageDescription: 'The guest has submitted proof. The stay is not booked until you confirm payment.',
      nextStepLabel: 'Check the payment proof, then confirm payment from the enquiry workflow.',
      tone: 'warning',
      quickActions: [
        {
          label: 'Proof received',
          text: 'Thanks, I have received your payment proof and I am checking it now. I will confirm the booking once payment is verified.',
          priority: 'primary',
        },
        {
          label: 'Need clearer proof',
          text: 'I can see your payment proof, but I need a clearer copy or payment reference before I can confirm the booking.',
          priority: 'secondary',
        },
        {
          label: 'Payment Info',
          text: buildPaymentInstructionText(booking),
          suggestionType: 'payment_info',
          priority: 'secondary',
        },
      ],
    };
  }

  if (isAwaitingGuestPayment(booking)) {
    return {
      stageLabel: 'Waiting for guest payment',
      stageDescription: 'The dates are held, but the guest still needs to submit payment proof.',
      nextStepLabel: 'Keep the guest focused on the payment window and reference details.',
      tone: 'neutral',
      quickActions: [
        {
          label: 'Payment Info',
          text: buildPaymentInstructionText(booking),
          suggestionType: 'payment_info',
          priority: 'primary',
        },
        {
          label: 'Payment reminder',
          text: 'Your enquiry is approved and the dates are held. Please submit payment proof before the payment window closes so I can confirm the booking.',
          suggestionType: 'payment_info',
          priority: 'secondary',
        },
        {
          label: 'Offer help',
          text: 'Let me know if anything is unclear with the payment details or booking reference.',
          priority: 'secondary',
        },
      ],
    };
  }

  if (isBookedStay(booking)) {
    return {
      stageLabel: 'Stay confirmed',
      stageDescription: 'Payment is confirmed. Messaging should now support arrival, stay, and checkout coordination.',
      nextStepLabel: 'Share the practical arrival details and keep the guest prepared.',
      tone: 'success',
      quickActions: [
        {
          label: 'Send Directions',
          text: 'Here are the directions to the property. Looking forward to your arrival.',
          suggestionType: 'directions',
          priority: 'primary',
        },
        {
          label: 'Send House Rules',
          text: 'Here are the house rules for your stay. Please let me know if you have any questions before arrival.',
          suggestionType: 'house_rules',
          priority: 'secondary',
        },
        {
          label: 'Check-in note',
          text: 'Your stay is confirmed. Please send your expected arrival time when you have it, and I will make sure check-in is ready.',
          priority: 'secondary',
        },
      ],
    };
  }

  return {
    stageLabel: booking.inquiryState === 'EXPIRED' ? 'Enquiry expired' : 'Conversation closed',
    stageDescription: 'This enquiry is no longer active, so messages should only clarify what happened or offer a new path.',
    nextStepLabel: 'Avoid payment or arrival instructions unless a new enquiry is created.',
    tone: 'closed',
    quickActions: [
      {
        label: 'Offer new dates',
        text: 'This enquiry is no longer active. If you would like, send me new dates and I can help check availability.',
        priority: 'primary',
      },
      {
        label: 'Explain status',
        text: getInquiryResponseText(booking),
        priority: 'secondary',
      },
    ],
  };
}

function getGuestMessagingProcessContext(booking: MessagingBookingSlice): MessagingProcessContext {
  if (isPendingHostDecision(booking)) {
    return {
      stageLabel: 'Waiting for host response',
      stageDescription: 'The host still needs to approve, decline, or respond to this enquiry.',
      nextStepLabel: 'Send only useful context that helps the host decide.',
      tone: 'neutral',
      quickActions: [
        {
          label: 'Share arrival time',
          text: 'My expected arrival time is flexible. Let me know what works best for the property.',
          priority: 'primary',
        },
        {
          label: 'Ask for update',
          text: 'Just checking whether you need any other details from me before deciding on this enquiry.',
          priority: 'secondary',
        },
        {
          label: 'Confirm guest count',
          text: 'Confirming the guest count on my side is correct for this enquiry.',
          priority: 'secondary',
        },
      ],
    };
  }

  if (isAwaitingGuestPayment(booking)) {
    return {
      stageLabel: 'Payment needed',
      stageDescription: 'The host approved the enquiry and the dates are held until the payment window closes.',
      nextStepLabel: 'Submit payment proof before the hold expires.',
      tone: 'warning',
      quickActions: [
        {
          label: 'Confirm payment details',
          text: 'Thanks, I am ready to pay. Please confirm the payment details and reference before I submit proof.',
          suggestionType: 'payment_info',
          priority: 'primary',
        },
        {
          label: 'Proof coming',
          text: 'I am arranging payment now and will upload proof shortly.',
          priority: 'secondary',
        },
        {
          label: 'Need help paying',
          text: 'I need help with the payment instructions before I can submit proof.',
          suggestionType: 'payment_info',
          priority: 'secondary',
        },
      ],
    };
  }

  if (isAwaitingHostPaymentConfirmation(booking)) {
    return {
      stageLabel: 'Host confirming payment',
      stageDescription: 'Your proof is submitted. The host still needs to verify it before the stay becomes booked.',
      nextStepLabel: 'Keep the host focused on the submitted proof and reference.',
      tone: 'neutral',
      quickActions: [
        {
          label: 'Reference sent',
          text: booking.paymentReference
            ? `I submitted payment proof with reference ${booking.paymentReference}. Please let me know if you need anything else.`
            : 'I submitted payment proof. Please let me know if you need anything else to confirm the booking.',
          priority: 'primary',
        },
        {
          label: 'Ask confirmation ETA',
          text: 'Could you let me know when you expect to confirm the payment?',
          priority: 'secondary',
        },
      ],
    };
  }

  if (isBookedStay(booking)) {
    return {
      stageLabel: 'Stay confirmed',
      stageDescription: 'The booking is confirmed. Messaging should now coordinate check-in, stay support, and checkout.',
      nextStepLabel: 'Use practical stay updates, not enquiry/payment questions.',
      tone: 'success',
      quickActions: [
        {
          label: 'Confirm Check-in',
          text: 'I have successfully checked in. Everything looks good.',
          suggestionType: 'checkin',
          priority: 'primary',
        },
        {
          label: 'Ask directions',
          text: 'Please send the directions and check-in instructions when you can.',
          suggestionType: 'directions',
          priority: 'secondary',
        },
        {
          label: 'Confirm Checkout',
          text: 'I have checked out. Thank you for the stay.',
          suggestionType: 'checkout',
          priority: 'secondary',
        },
      ],
    };
  }

  return {
    stageLabel: booking.inquiryState === 'EXPIRED' ? 'Enquiry expired' : 'Conversation closed',
    stageDescription: getInquiryResponseText(booking),
    nextStepLabel: 'Create a new enquiry if you still want to stay at this property.',
    tone: 'closed',
    quickActions: [
      {
        label: 'Ask about new dates',
        text: 'This enquiry is no longer active. Are there alternative dates available for a new enquiry?',
        priority: 'primary',
      },
      {
        label: 'Ask what happened',
        text: 'Can you clarify why this enquiry is no longer active?',
        priority: 'secondary',
      },
    ],
  };
}

function buildPaymentInstructionText(booking: Pick<Booking, 'paymentInstructions' | 'paymentReference'>) {
  const instructions = booking.paymentInstructions?.trim();
  const reference = booking.paymentReference?.trim();

  if (instructions && reference) {
    return `Please use these payment details: ${instructions} Use reference ${reference}, then submit proof so I can confirm the booking.`;
  }

  if (instructions) {
    return `Please use these payment details: ${instructions} Then submit proof so I can confirm the booking.`;
  }

  if (reference) {
    return `Please use payment reference ${reference}, then submit proof so I can confirm the booking.`;
  }

  return 'Please use the payment details attached to this enquiry, then submit proof so I can confirm the booking.';
}

export function getHostInquiryDeadlineText(booking: BookingDeadlineSlice, now: Date = new Date()) {
  const deadlineState = getInquiryDeadlineState(booking);
  if (!deadlineState) {
    return null;
  }

  const distance = formatDistanceStrict(new Date(deadlineState.deadlineAt), now, {
    addSuffix: true,
  });

  switch (deadlineState.kind) {
    case 'response_due':
      return `Auto-expires ${distance} if this enquiry stays unresolved.`;
    case 'payment_due':
      return `Payment window closes ${distance}. The approval hold releases if payment is not completed in time.`;
    case 'confirmation_due':
      return `Approval window closes ${distance}. Confirm the payment before the hold is released.`;
    case 'expired':
      return `Expired ${distance}. Any approval hold on these nights has already been released.`;
    default:
      return null;
  }
}

export function getGuestInquiryDeadlineText(booking: BookingDeadlineSlice, now: Date = new Date()) {
  const deadlineState = getInquiryDeadlineState(booking);
  if (!deadlineState) {
    return null;
  }

  const distance = formatDistanceStrict(new Date(deadlineState.deadlineAt), now, {
    addSuffix: true,
  });

  switch (deadlineState.kind) {
    case 'response_due':
      return `Host response expires ${distance}. If the host does not move this enquiry forward, the dates release automatically.`;
    case 'payment_due':
      return `Payment window closes ${distance}. Submit proof before then or the approval hold releases.`;
    case 'confirmation_due':
      return `Host confirmation is due ${distance}. If the host does not confirm in time, the approval hold releases.`;
    case 'expired':
      return `Expired ${distance}. Any approval hold on these nights has already been released.`;
    default:
      return null;
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
