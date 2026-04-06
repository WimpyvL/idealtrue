import type { BookingStatus } from "../shared/domain";

export function normalizeDateOnly(value: string) {
  return value.slice(0, 10);
}

export function computeBookingTotalPrice(pricePerNight: number, checkIn: Date, checkOut: Date) {
  const millisecondsPerNight = 1000 * 60 * 60 * 24;
  const nights = Math.floor((checkOut.getTime() - checkIn.getTime()) / millisecondsPerNight);
  if (nights <= 0) {
    throw new RangeError("Checkout must be after check-in.");
  }
  return pricePerNight * nights;
}

export function bookingOverlapsBlockedDates(checkIn: Date, checkOut: Date, blockedDates: string[] | undefined) {
  const blocked = blockedDates ?? [];
  if (blocked.length === 0) return false;

  const checkInDay = normalizeDateOnly(checkIn.toISOString());
  const checkOutDay = normalizeDateOnly(checkOut.toISOString());
  return blocked.some((blockedDate) => blockedDate >= checkInDay && blockedDate < checkOutDay);
}

export function getBookingStatusTransitionError(current: BookingStatus, next: BookingStatus) {
  if (!["awaiting_guest_payment", "confirmed", "cancelled", "completed", "declined"].includes(next)) {
    return "Hosts can only move bookings through the payment and completion workflow.";
  }
  if (next === "awaiting_guest_payment" && current !== "pending") {
    return "Payment can only be requested for pending bookings.";
  }
  if (next === "confirmed" && !["awaiting_guest_payment", "payment_submitted"].includes(current)) {
    return "Bookings can only be confirmed after the payment step has started.";
  }
  if (next === "completed" && current !== "confirmed") {
    return "Only confirmed bookings can be completed.";
  }
  if (["cancelled", "declined"].includes(next) && ["completed", "cancelled", "declined"].includes(current)) {
    return "Closed bookings cannot be changed again.";
  }
  return null;
}

export function getPaymentProofSubmissionError(status: BookingStatus) {
  if (!["awaiting_guest_payment", "payment_submitted"].includes(status)) {
    return "Payment proof can only be submitted after the host requests payment.";
  }
  return null;
}
