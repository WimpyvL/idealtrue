import React, { useMemo } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  CircleDollarSign,
  Clock,
  MessageSquare,
  TimerReset,
  User,
  XCircle,
} from 'lucide-react';

import InquiryDeclineDialog from '@/components/InquiryDeclineDialog';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Booking, BookingOpsSummary, Listing } from '../types';
import { formatRand } from '@/lib/currency';
import {
  getInquiryBadgeLabel,
  getInquiryDeclineReasonDetail,
  getHostInquiryDeadlineText,
  groupHostInquiries,
  isAwaitingGuestPayment,
  isPassedHostInquiry,
} from '@/lib/inquiry-state';
import { useHostBookingActions } from '@/hooks/use-host-booking-actions';
import { useBookingOpsSummaries } from '@/hooks/use-booking-ops-summaries';

type SummaryCard = {
  title: string;
  value: number;
  helper: string;
  tone: 'warning' | 'secondary' | 'success';
  icon: React.ComponentType<{ className?: string }>;
};

function formatOpsActor(actor: BookingOpsSummary['lastActor']) {
  switch (actor) {
    case 'admin':
      return 'Admin';
    case 'guest':
      return 'Guest';
    case 'host':
      return 'Host';
    case 'support':
      return 'Support';
    case 'system':
      return 'System';
    default:
      return 'Unknown';
  }
}

function getOpsDeadlineCopy(summary: BookingOpsSummary | undefined) {
  if (!summary?.activeDeadlineAt || summary.activeDeadlineKind === 'NONE') {
    return null;
  }

  const distance = formatDistanceToNowStrict(new Date(summary.activeDeadlineAt), { addSuffix: true });
  if (summary.activeDeadlineKind === 'HOST_RESPONSE') {
    return `Backend deadline: host response due ${distance}.`;
  }

  return `Backend deadline: guest payment due ${distance}.`;
}

export default function HostEnquiries({
  bookings,
  listings,
  onChat,
  onBookingUpdated,
}: {
  bookings: Booking[];
  listings: Listing[];
  onChat: (b: Booking) => void;
  onBookingUpdated: (booking: Booking) => void;
}) {
  const groupedBookings = useMemo(() => groupHostInquiries(bookings), [bookings]);
  const bookingOpsSummaries = useBookingOpsSummaries(bookings);
  const {
    approveBooking,
    confirmBookingPayment,
    declineBooking,
    decliningBooking,
    isProcessingBookingId,
    openInquiryChat,
    setDecliningBooking,
  } = useHostBookingActions({
    onBookingUpdated,
    onChat,
  });

  const summaryCards: SummaryCard[] = [
    {
      title: 'Needs Response',
      value: groupedBookings.needsResponse.length,
      helper: 'Fresh enquiries still waiting on your decision.',
      tone: 'warning',
      icon: Clock,
    },
    {
      title: 'Awaiting Guest Payment',
      value: groupedBookings.awaitingGuestPayment.length,
      helper: 'Approved stays where the guest has not submitted proof yet.',
      tone: 'secondary',
      icon: CircleDollarSign,
    },
    {
      title: 'Payment Review',
      value: groupedBookings.paymentReview.length,
      helper: 'Proof submitted. You still need to verify and confirm.',
      tone: 'warning',
      icon: TimerReset,
    },
    {
      title: 'Confirmed',
      value: groupedBookings.confirmed.length,
      helper: 'Booked stays with completed payment confirmation.',
      tone: 'success',
      icon: CircleCheckBig,
    },
    {
      title: 'Passed',
      value: groupedBookings.passed.length,
      helper: 'Expired or stale enquiries with no active hold or action.',
      tone: 'secondary',
      icon: Ban,
    },
  ];

  const renderEmptyState = (icon: React.ComponentType<{ className?: string }>, title: string, description: string) => {
    const Icon = icon;

    return (
      <div className="text-center py-16 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
        <Icon className="w-12 h-12 mx-auto text-outline-variant mb-4" />
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-on-surface-variant">{description}</p>
      </div>
    );
  };

  const renderBookingCard = (
    booking: Booking,
    options?: {
      showApproveDecline?: boolean;
      showPaymentConfirm?: boolean;
      emphasizeAging?: boolean;
    },
  ) => {
    const listing = listings.find((l) => l.id === booking.listingId);
    const opsSummary = bookingOpsSummaries[booking.id];
    const hasOpenPaymentDispute = (opsSummary?.openDisputeCount ?? 0) > 0;
    const isPassed = isPassedHostInquiry(booking);
    const statusLabel = getInquiryBadgeLabel(booking);
    const deadlineCopy = isPassed
      ? 'This enquiry has passed. Any approval hold should be released and active payment or confirmation actions are disabled.'
      : getOpsDeadlineCopy(opsSummary) ?? getHostInquiryDeadlineText(booking);
    const totalExposure = booking.totalPrice + (booking.breakageDeposit ?? 0);
    const lastTouchAt =
      opsSummary?.lastEventAt ??
      booking.paymentSubmittedAt ??
      booking.paymentUnlockedAt ??
      booking.respondedAt ??
      booking.viewedAt ??
      booking.createdAt;

    return (
      <Card key={booking.id} className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  options?.showPaymentConfirm
                    ? 'warning'
                    : booking.inquiryState === 'DECLINED' || isPassed
                      ? 'danger'
                      : booking.inquiryState === 'BOOKED'
                        ? 'success'
                        : 'secondary'
                }
                className="flex items-center gap-1"
              >
                <Clock className="w-3 h-3" /> {statusLabel}
              </Badge>
              <span className="text-sm text-on-surface-variant">
                Opened {formatDistanceToNowStrict(new Date(booking.createdAt), { addSuffix: true })}
              </span>
              <span className="text-sm text-on-surface-variant">
                Last movement {formatDistanceToNowStrict(new Date(lastTouchAt), { addSuffix: true })}
              </span>
              {isPassed ? <Badge variant="danger">Passed</Badge> : options?.emphasizeAging && <Badge variant="warning">Action due</Badge>}
            </div>

            <div>
              <h3 className="font-bold text-xl">{listing?.title || 'Unknown Listing'}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  <span>{format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{booking.guests?.adults || 0} Adults, {booking.guests?.children || 0} Children</span>
                </div>
                <span className="text-xs font-mono text-outline-variant">#{booking.id.slice(0, 8)}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                <p className="text-sm font-medium text-on-surface-variant mb-1">Stay value</p>
                <p className="text-xl font-bold text-primary">{formatRand(booking.totalPrice)}</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                <p className="text-sm font-medium text-on-surface-variant mb-1">Breakage deposit</p>
                <p className="text-base font-semibold text-on-surface">{formatRand(booking.breakageDeposit ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                <p className="text-sm font-medium text-on-surface-variant mb-1">Guest total due</p>
                <p className="text-base font-semibold text-on-surface">{formatRand(totalExposure)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant space-y-2">
              <p>
                {opsSummary
                  ? `Last actor: ${formatOpsActor(opsSummary.lastActor)}.`
                  : booking.respondedAt
                    ? `Responded ${formatDistanceToNowStrict(new Date(booking.respondedAt), { addSuffix: true })}.`
                    : booking.viewedAt
                      ? `Viewed ${formatDistanceToNowStrict(new Date(booking.viewedAt), { addSuffix: true })}.`
                      : 'No host action logged yet.'}
              </p>
              {deadlineCopy && <p>{deadlineCopy}</p>}
              {typeof opsSummary?.openDisputeCount === 'number' && opsSummary.openDisputeCount > 0 && (
                <p>
                  Open payment disputes:{' '}
                  <span className="font-medium text-on-surface">{opsSummary.openDisputeCount}</span>
                </p>
              )}
              {options?.showPaymentConfirm && hasOpenPaymentDispute && (
                <p className="text-red-600">Confirmation is paused until the open payment dispute is resolved.</p>
              )}
              {booking.inquiryState === 'DECLINED' && getInquiryDeclineReasonDetail(booking) && (
                <p>
                  Decline reason:{' '}
                  <span className="font-medium text-on-surface">{getInquiryDeclineReasonDetail(booking)}</span>
                </p>
              )}
              {isAwaitingGuestPayment(booking) && (
                <p>Guest payment is unlocked, but proof has not been submitted yet.</p>
              )}
              {isPassed && (
                <p className="font-medium text-red-600">
                  State deactivated. Do not approve, confirm payment, or treat these dates as held from this card.
                </p>
              )}
              {options?.showPaymentConfirm && (
                <p>
                  Payment reference: <span className="font-semibold text-on-surface">{booking.paymentReference || 'No reference supplied'}</span>
                </p>
              )}
            </div>

            {options?.showPaymentConfirm && (
              booking.paymentProofAccessible && booking.paymentProofAccessUrl ? (
                <a
                  href={booking.paymentProofAccessUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open private proof
                </a>
              ) : (
                <p className="text-sm text-red-600">Private payment proof is not accessible right now. Confirmation stays blocked until the stored asset can be opened.</p>
              )
            )}
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto">
            <Button
              variant="outline"
              className="w-full lg:w-auto"
              onClick={() => void openInquiryChat(booking)}
              disabled={isProcessingBookingId === booking.id}
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Message
            </Button>

            {options?.showApproveDecline && (
              <>
                <Button
                  variant="outline"
                  className="w-full lg:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => setDecliningBooking(booking)}
                  disabled={isProcessingBookingId === booking.id}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Decline
                </Button>
                <Button
                  className="w-full lg:w-auto bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => void approveBooking(booking)}
                  disabled={isProcessingBookingId === booking.id}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                </Button>
              </>
            )}

            {options?.showPaymentConfirm && (
              <Button
                className="w-full lg:w-auto bg-green-600 hover:bg-green-700 text-white"
                onClick={() => void confirmBookingPayment(booking)}
                disabled={isProcessingBookingId === booking.id || !booking.paymentProofAccessible || !booking.paymentProofAccessUrl || hasOpenPaymentDispute}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Payment
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Enquiries & Requests</h1>
        <p className="text-on-surface-variant">Run the full inquiry pipeline from first response through payment confirmation, without losing track of who is waiting on whom.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-on-surface-variant">{card.title}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                  <p className="text-xs text-on-surface-variant">{card.helper}</p>
                </div>
                <Badge variant={card.tone}>
                  <Icon className="w-3 h-3" />
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Needs Response</h2>
            <p className="text-sm text-on-surface-variant">This is the live decision queue. View, message, approve, or decline before enquiries rot.</p>
          </div>
          {groupedBookings.needsResponse.map((booking) =>
            renderBookingCard(booking, { showApproveDecline: true, emphasizeAging: true }),
          )}
          {groupedBookings.needsResponse.length === 0 &&
            renderEmptyState(Clock, 'Queue clear', 'No enquiries are currently waiting on a host decision.')}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Awaiting Guest Payment</h2>
            <p className="text-sm text-on-surface-variant">These enquiries are approved. The next move belongs to the guest unless you need to nudge them in chat.</p>
          </div>
          {groupedBookings.awaitingGuestPayment.map((booking) => renderBookingCard(booking))}
          {groupedBookings.awaitingGuestPayment.length === 0 &&
            renderEmptyState(CircleDollarSign, 'No guest payments pending', 'Approved enquiries will surface here until the guest submits proof.')}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Awaiting Payment Confirmation</h2>
            <p className="text-sm text-on-surface-variant">Proof is in. This queue should move quickly because confirmed payment is what turns intent into a real booking.</p>
          </div>
          {groupedBookings.paymentReview.map((booking) =>
            renderBookingCard(booking, { showPaymentConfirm: true, emphasizeAging: true }),
          )}
          {groupedBookings.paymentReview.length === 0 &&
            renderEmptyState(CheckCircle2, 'No payments waiting on you', 'Submitted proofs will show up here for final confirmation.')}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Confirmed Stays</h2>
            <p className="text-sm text-on-surface-variant">Recently confirmed bookings, so you can keep an eye on what actually converted.</p>
          </div>
          {groupedBookings.confirmed.slice(0, 6).map((booking) => renderBookingCard(booking))}
          {groupedBookings.confirmed.length === 0 &&
            renderEmptyState(CircleCheckBig, 'No confirmed stays yet', 'Once payment is confirmed, bookings will land here.')}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Passed</h2>
            <p className="text-sm text-on-surface-variant">Expired enquiries and stale deadline cards live here with active states disabled. If the backend has not refreshed yet, this view still treats them as inactive.</p>
          </div>
          {groupedBookings.passed.map((booking) => renderBookingCard(booking))}
          {groupedBookings.passed.length === 0 &&
            renderEmptyState(Ban, 'No passed enquiries', 'Expired or stale-deadline enquiries will move here instead of staying in active queues.')}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Closed Loop</h2>
            <p className="text-sm text-on-surface-variant">Declined enquiries stay visible here for traceability instead of vanishing into the void.</p>
          </div>
          {groupedBookings.closed.slice(0, 8).map((booking) => renderBookingCard(booking))}
          {groupedBookings.closed.length === 0 &&
            renderEmptyState(Ban, 'No closed enquiries', 'Declined enquiries will remain visible here for audit context.')}
        </section>
      </div>

      <InquiryDeclineDialog
        open={!!decliningBooking}
        bookingLabel={decliningBooking ? `the enquiry for ${listings.find((listing) => listing.id === decliningBooking.listingId)?.title || 'this stay'}` : 'this enquiry'}
        isSubmitting={!!decliningBooking && isProcessingBookingId === decliningBooking.id}
        onClose={() => setDecliningBooking(null)}
        onConfirm={declineBooking}
      />
    </div>
  );
}
