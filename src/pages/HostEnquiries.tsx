import React, { useMemo, useState } from 'react';
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
import { toast } from 'sonner';

import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Booking, Listing } from '../types';
import { formatRand } from '@/lib/currency';
import {
  getInquiryBadgeLabel,
  getInquiryDeadlineState,
  groupHostInquiries,
  isAwaitingGuestPayment,
} from '@/lib/inquiry-state';
import { confirmPayment, markInquiryViewed, updateBookingStatus } from '@/lib/platform-client';

type SummaryCard = {
  title: string;
  value: number;
  helper: string;
  tone: 'warning' | 'secondary' | 'success';
  icon: React.ComponentType<{ className?: string }>;
};

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
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const groupedBookings = useMemo(() => groupHostInquiries(bookings), [bookings]);

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
  ];

  const handleBookingAction = async (booking: Booking, action: 'APPROVED' | 'DECLINED') => {
    setIsProcessing(booking.id);
    try {
      const updatedBooking = await updateBookingStatus(booking.id, action);
      onBookingUpdated(updatedBooking);
      toast[action === 'APPROVED' ? 'success' : 'info'](
        action === 'APPROVED'
          ? 'Inquiry approved. Payment is now unlocked for the guest.'
          : 'Inquiry declined.',
      );
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error(action === 'APPROVED' ? 'Failed to approve inquiry.' : 'Failed to decline inquiry.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePaymentConfirmation = async (booking: Booking) => {
    setIsProcessing(booking.id);
    try {
      const updatedBooking = await confirmPayment(booking.id);
      onBookingUpdated(updatedBooking);
      toast.success('Payment confirmed. The stay is now booked.');
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment.');
    } finally {
      setIsProcessing(null);
    }
  };

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
    const statusLabel = getInquiryBadgeLabel(booking);
    const deadlineState = getInquiryDeadlineState(booking);
    const deadlineCopy = deadlineState
      ? (() => {
          const distance = formatDistanceToNowStrict(new Date(deadlineState.deadlineAt), { addSuffix: true });
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
        })()
      : null;
    const totalExposure = booking.totalPrice + (booking.breakageDeposit ?? 0);
    const lastTouchAt =
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
                    : booking.inquiryState === 'DECLINED' || booking.inquiryState === 'EXPIRED'
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
              {options?.emphasizeAging && <Badge variant="warning">Action due</Badge>}
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
                {booking.respondedAt
                  ? `Responded ${formatDistanceToNowStrict(new Date(booking.respondedAt), { addSuffix: true })}.`
                  : booking.viewedAt
                    ? `Viewed ${formatDistanceToNowStrict(new Date(booking.viewedAt), { addSuffix: true })}.`
                    : 'No host action logged yet.'}
              </p>
              {deadlineCopy && <p>{deadlineCopy}</p>}
              {isAwaitingGuestPayment(booking) && (
                <p>Guest payment is unlocked, but proof has not been submitted yet.</p>
              )}
              {options?.showPaymentConfirm && (
                <p>
                  Payment reference: <span className="font-semibold text-on-surface">{booking.paymentReference || 'No reference supplied'}</span>
                </p>
              )}
            </div>

            {options?.showPaymentConfirm && (
              booking.paymentProofUrl ? (
                <a
                  href={booking.paymentProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open payment proof
                </a>
              ) : (
                <p className="text-sm text-red-600">Payment proof link unavailable. Confirmation should stay blocked until proof is accessible.</p>
              )
            )}
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto">
            <Button
              variant="outline"
              className="w-full lg:w-auto"
              onClick={async () => {
                try {
                  if (booking.inquiryState === 'PENDING') {
                    const viewedBooking = await markInquiryViewed(booking.id);
                    onBookingUpdated(viewedBooking);
                  }
                  onChat(booking);
                } catch (error) {
                  console.error('Error opening inquiry chat:', error);
                  toast.error('Failed to open the guest conversation.');
                }
              }}
              disabled={isProcessing === booking.id}
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Message
            </Button>

            {options?.showApproveDecline && (
              <>
                <Button
                  variant="outline"
                  className="w-full lg:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => handleBookingAction(booking, 'DECLINED')}
                  disabled={isProcessing === booking.id}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Decline
                </Button>
                <Button
                  className="w-full lg:w-auto bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleBookingAction(booking, 'APPROVED')}
                  disabled={isProcessing === booking.id}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                </Button>
              </>
            )}

            {options?.showPaymentConfirm && (
              <Button
                className="w-full lg:w-auto bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handlePaymentConfirmation(booking)}
                disabled={isProcessing === booking.id || !booking.paymentProofUrl}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <h2 className="text-xl font-bold tracking-tight">Closed Loop</h2>
            <p className="text-sm text-on-surface-variant">Declined and expired enquiries stay visible here for traceability instead of vanishing into the void.</p>
          </div>
          {groupedBookings.closed.slice(0, 8).map((booking) => renderBookingCard(booking))}
          {groupedBookings.closed.length === 0 &&
            renderEmptyState(Ban, 'No closed enquiries', 'Declined and expired enquiries will remain visible here for audit context.')}
        </section>
      </div>
    </div>
  );
}
