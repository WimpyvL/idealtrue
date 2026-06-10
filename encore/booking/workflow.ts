import type { InquiryState, PaymentState } from "../shared/domain";

const UNRESOLVED_INQUIRY_EXPIRY_HOURS = 48;
const APPROVED_INQUIRY_EXPIRY_HOURS = 24;

function normalizeDateOnly(value: string) {
  return value.slice(0, 10);
}

export function computeDiscountedNightlyRate(pricePerNight: number, discountPercent: number) {
  const nightlyRate = Math.max(0, Number(pricePerNight) || 0);
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));

  if (discount <= 0) {
    return Math.round(nightlyRate);
  }

  return Math.max(0, Math.round(nightlyRate * (1 - discount / 100)));
}

export function computeBookingTotalPrice(pricePerNight: number, checkIn: Date, checkOut: Date, discountPercent = 0) {
  const millisecondsPerNight = 1000 * 60 * 60 * 24;
  const nights = Math.floor((checkOut.getTime() - checkIn.getTime()) / millisecondsPerNight);
  if (nights <= 0) {
    throw new RangeError("Checkout must be after check-in.");
  }
  return computeDiscountedNightlyRate(pricePerNight, discountPercent) * nights;
}

export function bookingOverlapsBlockedDates(checkIn: Date, checkOut: Date, blockedDates: string[] | undefined) {
  const blocked = blockedDates ?? [];
  if (blocked.length === 0) return false;

  const checkInDay = normalizeDateOnly(checkIn.toISOString());
  const checkOutDay = normalizeDateOnly(checkOut.toISOString());
  return blocked.some((blockedDate) => blockedDate >= checkInDay && blockedDate < checkOutDay);
}

export function getInquiryStatusTransitionError(current: InquiryState, next: InquiryState, actor: "host" | "guest" | "system") {
  if (current === next) {
    return null;
  }

  if (current === "BOOKED") {
    return "Booked inquiries are immutable. Start a new inquiry version instead of mutating the confirmed one.";
  }

  if (current === "DECLINED" || current === "EXPIRED") {
    return "Closed inquiries cannot be changed again.";
  }

  if (actor === "guest" && next !== "BOOKED") {
    return "Guests cannot directly change inquiry status.";
  }

  if (actor === "host") {
    if (!["VIEWED", "RESPONDED", "APPROVED", "DECLINED"].includes(next)) {
      return "Hosts can only view, respond to, approve, or decline an inquiry.";
    }
    if ((next === "VIEWED" || next === "RESPONDED") && !["PENDING", "VIEWED"].includes(current)) {
      return "Only pending inquiries can move into the host-response flow.";
    }
    if ((next === "APPROVED" || next === "DECLINED") && !["PENDING", "VIEWED", "RESPONDED"].includes(current)) {
      return "Only unresolved inquiries can be approved or declined.";
    }
  }

  if (actor === "system") {
    if (next === "BOOKED" && current !== "APPROVED") {
      return "Only approved inquiries can be booked.";
    }
    if (next === "EXPIRED" && ["DECLINED", "BOOKED"].includes(current)) {
      return "Closed inquiries cannot expire again.";
    }
  }

  return null;
}

export function getPaymentStateTransitionError(inquiryState: InquiryState, current: PaymentState, next: PaymentState, actor: "host" | "guest" | "system") {
  if (current === next) {
    return null;
  }

  if (inquiryState !== "APPROVED" && next === "INITIATED") {
    return "Payment can only be unlocked after the host approves the inquiry.";
  }

  if (next === "COMPLETED" && inquiryState !== "APPROVED") {
    return "Payment can only complete against an approved inquiry.";
  }

  if (actor === "guest") {
    return "Guests cannot directly mark payments complete. They can only submit payment proof.";
  }

  if (actor === "host" && !["INITIATED", "COMPLETED"].includes(next)) {
    return "Hosts can only unlock payment or confirm a submitted payment.";
  }

  if (next === "COMPLETED" && current !== "INITIATED") {
    return "Payment must be initiated before it can complete.";
  }

  if (next === "FAILED" && current === "COMPLETED") {
    return "Completed payments cannot be failed retroactively.";
  }

  return null;
}

export function getPaymentProofSubmissionError(inquiryState: InquiryState, paymentState: PaymentState) {
  if (inquiryState !== "APPROVED" || paymentState !== "INITIATED") {
    return "Payment is only available after approval and while the payment flow is active.";
  }
  return null;
}

function addHours(referenceIso: string, hours: number) {
  const reference = new Date(referenceIso);
  if (Number.isNaN(reference.getTime())) {
    throw new RangeError(`Invalid inquiry reference timestamp: ${referenceIso}`);
  }

  reference.setUTCHours(reference.getUTCHours() + hours);
  return reference.toISOString();
}

export function computeInquiryExpiresAt(state: InquiryState, referenceIso: string) {
  if (["PENDING", "VIEWED", "RESPONDED"].includes(state)) {
    return addHours(referenceIso, UNRESOLVED_INQUIRY_EXPIRY_HOURS);
  }

  if (state === "APPROVED") {
    return addHours(referenceIso, APPROVED_INQUIRY_EXPIRY_HOURS);
  }

  return null;
}

export function shouldExpireInquiry(state: InquiryState, expiresAt: string | null | undefined, nowIso: string) {
  if (!expiresAt) {
    return false;
  }

  if (!["PENDING", "VIEWED", "RESPONDED", "APPROVED"].includes(state)) {
    return false;
  }

  const expiry = new Date(expiresAt);
  const now = new Date(nowIso);
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(now.getTime())) {
    return false;
  }

  return now.getTime() >= expiry.getTime();
}

function getInquiryStateLabel(state: InquiryState) {
  switch (state) {
    case "PENDING":
      return "Awaiting host response";
    case "VIEWED":
      return "Host has viewed the inquiry";
    case "RESPONDED":
      return "Host responded";
    case "APPROVED":
      return "Ready for payment";
    case "DECLINED":
      return "Inquiry declined";
    case "EXPIRED":
      return "Inquiry expired";
    case "BOOKED":
      return "Confirmed stay";
    default:
      return state;
  }
}
