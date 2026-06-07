import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Booking, BookingOpsSummary, Listing, UserProfile } from '../types';
import { 
  LayoutDashboard, 
  Calendar, 
  ArrowRight, 
  Plus, 
  Sparkles,
  MessageSquare,
  Building2,
  DollarSign,
  Activity,
  AlertTriangle,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import InquiryDeclineDialog from '@/components/InquiryDeclineDialog';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { formatRand } from '@/lib/currency';
import {
  getInquiryBadgeLabel,
  getInquiryDeclineReasonDetail,
  getInquiryDeadlineState,
  getInquiryDeadlineUrgency,
  groupHostInquiries,
  isBookedStay,
  isPendingHostDecision,
} from '@/lib/inquiry-state';
import { useHostBookingActions } from '@/hooks/use-host-booking-actions';
import { useBookingOpsSummaries } from '@/hooks/use-booking-ops-summaries';
import { cn } from '@/lib/utils';

function getMetricPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function getDashboardOpsDeadline(summary: BookingOpsSummary | undefined) {
  if (!summary?.activeDeadlineAt || summary.activeDeadlineKind === 'NONE') {
    return null;
  }

  return {
    deadlineAt: summary.activeDeadlineAt,
    deadlineKind: summary.activeDeadlineKind === 'HOST_RESPONSE' ? 'response_due' : 'payment_due',
  };
}

function HostMetricCard({
  title,
  value,
  icon: Icon,
  accentClassName,
  iconClassName,
  percentage,
  notificationCount = 0,
  formatValue = (input) => input.toLocaleString(),
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  accentClassName: string;
  iconClassName: string;
  percentage?: number;
  notificationCount?: number;
  formatValue?: (input: number) => string;
}) {
  return (
    <Card className={cn('relative min-w-0 overflow-hidden border-l-4 p-5', accentClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {title}
          </h3>
          <p className="mt-3 text-4xl font-bold tracking-tight text-on-surface">
            {formatValue(value)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notificationCount > 0 ? (
            <span
              aria-label={`${notificationCount} new items in ${title}`}
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 ring-4 ring-rose-500/15"
            />
          ) : null}
          <Icon className={cn('h-5 w-5 shrink-0', iconClassName)} />
        </div>
      </div>
      {typeof percentage === 'number' ? (
        <div className="mt-4">
          <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
            {percentage}%
          </span>
        </div>
      ) : null}
    </Card>
  );
}

export default function HostDashboard({ 
  profile,
  listings, 
  bookings, 
  onUpgrade,
  onChat,
  onBookingUpdated,
}: { 
  profile: UserProfile | null,
  listings: Listing[], 
  bookings: Booking[], 
  onUpgrade: () => void,
  onChat: (b: Booking) => void,
  onBookingUpdated: (booking: Booking) => void,
}) {
  const navigate = useNavigate();
  const bookingOpsSummaries = useBookingOpsSummaries(bookings);

  const {
    approveBooking,
    declineBooking,
    decliningBooking,
    isProcessingBookingId,
    setDecliningBooking,
  } = useHostBookingActions({
    onBookingUpdated,
    onChat,
    onAfterApprove: () => navigate('/host/enquiries'),
    onAfterDecline: () => navigate('/host/enquiries'),
  });

  const activeListings = listings.filter(l => l.status === 'active');
  const groupedBookings = useMemo(() => groupHostInquiries(bookings), [bookings]);
  const needsResponseBookings = groupedBookings.needsResponse;
  const awaitingGuestPaymentBookings = groupedBookings.awaitingGuestPayment;
  const bookedStayCount = bookings.filter(isBookedStay).length;
  const totalRevenue = bookings
    .filter(isBookedStay)
    .reduce((sum, b) => sum + b.totalPrice, 0);
  const approvedHoldWatchlist = useMemo(() => {
    return [...awaitingGuestPaymentBookings, ...groupedBookings.paymentReview]
      .map((booking) => {
        const urgency = getInquiryDeadlineUrgency(booking);
        const summary = bookingOpsSummaries[booking.id];
        const opsDeadline = getDashboardOpsDeadline(summary);

        return {
          booking,
          urgency,
          summary,
          sortDeadlineAt: opsDeadline?.deadlineAt ?? urgency?.deadlineAt ?? null,
        };
      })
      .sort((left, right) => {
        const leftDeadline = left.sortDeadlineAt ? new Date(left.sortDeadlineAt).getTime() : Number.POSITIVE_INFINITY;
        const rightDeadline = right.sortDeadlineAt ? new Date(right.sortDeadlineAt).getTime() : Number.POSITIVE_INFINITY;
        return leftDeadline - rightDeadline;
      });
  }, [awaitingGuestPaymentBookings, bookingOpsSummaries, groupedBookings.paymentReview]);
  const activeQueueCount = needsResponseBookings.length + awaitingGuestPaymentBookings.length + groupedBookings.paymentReview.length;
  const mostUrgentApprovedHold = approvedHoldWatchlist[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Subscription Banner */}
      {profile?.hostPlan === 'standard' && (
        <Card className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white p-8 relative overflow-hidden border-0 shadow-xl shadow-blue-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h2 className="text-2xl font-bold flex items-center gap-2 justify-center md:justify-start">
                <Sparkles className="w-6 h-6 text-amber-300" /> Level Up Your Reach
              </h2>
              <p className="max-w-md text-sm leading-6 text-blue-50/95">
                Standard gets you live. Professional and Premium add stronger promotion, multi-listing scale, and better support.
              </p>
            </div>
            <Button
              className="rounded-full px-8 bg-white text-blue-700 hover:bg-blue-50 border border-white/70 shadow-sm"
              onClick={onUpgrade}
            >
              View Plans <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Hospitality Management</h1>
          <p className="text-on-surface-variant">Manage your properties and guest interactions. <span className="text-amber-600 font-medium">Ideal Stay coordinates the booking flow, but accommodation payments are collected directly by you.</span></p>
        </header>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate('/host/onboarding')}>
            <BadgeCheck className="w-4 h-4 mr-2" /> Start Tutorial
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => navigate('/host/create-listing')}>
            <Plus className="w-4 h-4 mr-2" /> Add New Listing
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">New host tutorial</h2>
            <p className="max-w-3xl text-sm leading-6 text-on-surface-variant">
              Set up banking details, quick replies, listing basics, availability, and enquiry handling before the first serious guest message arrives.
            </p>
          </div>
          <Button variant="outline" className="shrink-0 rounded-full" onClick={() => navigate('/host/onboarding')}>
            Open tutorial <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HostMetricCard
          title="Total Bookings"
          value={bookings.length}
          icon={Calendar}
          accentClassName="border-l-blue-500"
          iconClassName="text-blue-500"
          percentage={getMetricPercentage(bookedStayCount, bookings.length)}
        />
        <HostMetricCard
          title="Needs Response"
          value={needsResponseBookings.length}
          icon={MessageSquare}
          accentClassName="border-l-amber-500"
          iconClassName="text-amber-500"
          percentage={getMetricPercentage(needsResponseBookings.length, activeQueueCount)}
          notificationCount={needsResponseBookings.length}
        />
        <HostMetricCard
          title="Active Listings"
          value={activeListings.length}
          icon={Building2}
          accentClassName="border-l-purple-500"
          iconClassName="text-purple-500"
          percentage={getMetricPercentage(activeListings.length, listings.length)}
        />
        <HostMetricCard
          title="Total Revenue"
          value={totalRevenue}
          icon={DollarSign}
          accentClassName="border-l-green-500"
          iconClassName="text-green-500"
          formatValue={formatRand}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Social Media CTA */}
        <Card className="lg:col-span-3 bg-surface-container-low border-none p-5 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Boost Your Visibility</h2>
              <p className="text-on-surface-variant max-w-xl">Build reusable social copy for your listings and keep promotion moving without staring at a blank caption box.</p>
            </div>
          </div>
          <Button size="lg" className="w-full rounded-full px-8 sm:w-auto shrink-0" onClick={() => navigate('/host/social')}>
            Open Content Studio <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>

        {/* Listings Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5" /> Active Listings Summary
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/host/listings')}>View All</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeListings.slice(0, 4).map(listing => (
              <Card key={listing.id} className="p-4 flex gap-4 items-start group hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/host/edit-listing/${listing.id}`)}>
                <img src={listing.images[0] || `https://picsum.photos/seed/${listing.id}/200/200`} className="w-20 h-20 rounded-xl object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate group-hover:text-primary transition-colors">{listing.title}</h3>
                  <p className="text-xs text-on-surface-variant mb-2 truncate">{listing.location}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{formatRand(listing.pricePerNight)}<span className="text-xs text-on-surface-variant font-normal">/night</span></span>
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  </div>
                </div>
              </Card>
            ))}
            {activeListings.length === 0 && (
              <div className="col-span-1 sm:col-span-2 text-center py-8 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
                <p className="text-on-surface-variant">No active listings to display.</p>
                <Button variant="link" onClick={() => navigate('/host/create-listing')}>Create one now</Button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity / Bookings */}
        <div className="space-y-6">
          <Card className="p-5 border border-outline-variant bg-surface-container-low">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Approved Hold Watchlist
                </h2>
                <p className="text-sm text-on-surface-variant">
                  The nearest approval deadlines across guest payment and payment confirmation.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/host/enquiries')}>Open Queue</Button>
            </div>
            <div className="mt-4 space-y-3">
              {approvedHoldWatchlist.slice(0, 4).map(({ booking, urgency, summary }) => {
                const listing = listings.find((item) => item.id === booking.listingId);
                const opsDeadline = getDashboardOpsDeadline(summary);
                const deadlineLabel = opsDeadline
                  ? opsDeadline.deadlineKind === 'response_due'
                    ? `Host response due ${formatDistanceToNowStrict(new Date(opsDeadline.deadlineAt), { addSuffix: true })}`
                    : `Payment due ${formatDistanceToNowStrict(new Date(opsDeadline.deadlineAt), { addSuffix: true })}`
                  : urgency
                    ? urgency.isExpired
                      ? 'Hold already expired'
                      : urgency.deadlineKind === 'confirmation_due'
                        ? `Confirm before ${formatDistanceToNowStrict(new Date(urgency.deadlineAt), { addSuffix: true })}`
                        : `Payment due ${formatDistanceToNowStrict(new Date(urgency.deadlineAt), { addSuffix: true })}`
                    : 'Awaiting the next workflow step';

                return (
                  <div key={booking.id} className="rounded-2xl border border-outline-variant bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{listing?.title || 'Unknown Listing'}</p>
                        <p className="text-xs text-on-surface-variant">
                          {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d')} • {getInquiryBadgeLabel(booking)}
                        </p>
                      </div>
                      <Badge variant={urgency?.tone === 'danger' ? 'danger' : urgency?.tone === 'warning' ? 'warning' : 'neutral'}>
                        {summary?.openDisputeCount ? `Disputes ${summary.openDisputeCount}` : urgency?.deadlineKind === 'confirmation_due' ? 'Confirm' : 'Hold'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-on-surface-variant">{deadlineLabel}</p>
                  </div>
                );
              })}
              {approvedHoldWatchlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant bg-background/60 p-4 text-sm text-on-surface-variant">
                  No approved holds are currently close enough to worry about. New approved enquiries will surface here automatically.
                </div>
              ) : null}
              {mostUrgentApprovedHold?.sortDeadlineAt ? (
                <div className="rounded-2xl border border-outline-variant bg-background/60 p-4 text-sm">
                  <span className="font-semibold">Nearest deadline:</span>{' '}
                  {mostUrgentApprovedHold.summary?.activeDeadlineKind === 'HOST_RESPONSE'
                    ? 'host response'
                    : 'guest payment'} closes{' '}
                  {formatDistanceToNowStrict(new Date(mostUrgentApprovedHold.sortDeadlineAt), { addSuffix: true })}.
                </div>
              ) : null}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5" /> Recent Activity
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/host/enquiries')}>View All</Button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {bookings.slice(0, 5).map(booking => {
              const listing = listings.find(l => l.id === booking.listingId);
              const bookingLabel = getInquiryBadgeLabel(booking);
              const deadlineState = getInquiryDeadlineState(booking);
              const deadlineCopy = deadlineState
                ? (() => {
                    const distance = formatDistanceToNowStrict(new Date(deadlineState.deadlineAt), { addSuffix: true });
                    switch (deadlineState.kind) {
                      case 'response_due':
                        return `Expires ${distance}`;
                      case 'payment_due':
                        return `Payment closes ${distance}`;
                      case 'confirmation_due':
                        return `Confirmation closes ${distance}`;
                      case 'expired':
                        return `Expired ${distance}`;
                      default:
                        return null;
                    }
                  })()
                : null;
              return (
                <Card key={booking.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={isBookedStay(booking) ? 'success' : isPendingHostDecision(booking) || booking.inquiryState === 'APPROVED' ? 'warning' : 'secondary'}>
                      {bookingLabel}
                    </Badge>
                    <span className="text-xs font-mono text-outline-variant">#{booking.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-sm font-bold mb-1 truncate">{listing?.title || 'Unknown Listing'}</p>
                  <p className="text-xs text-on-surface-variant mb-2">
                    Guest: {booking.guestId.slice(0, 8)}... • {booking.guests?.adults || 0} Adults, {booking.guests?.children || 0} Children
                  </p>
                  <p className="text-xs text-on-surface-variant bg-surface-container-lowest p-2 rounded">
                    {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}
                  </p>
                  {deadlineCopy ? (
                    <p className="mt-2 text-[11px] text-on-surface-variant">{deadlineCopy}</p>
                  ) : null}
                  <div className="mt-3 pt-3 border-t border-outline-variant flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{formatRand(booking.totalPrice)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onChat(booking)}>Message</Button>
                      {isPendingHostDecision(booking) ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void approveBooking(booking)}
                            disabled={isProcessingBookingId === booking.id}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setDecliningBooking(booking)}
                            disabled={isProcessingBookingId === booking.id}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      ) : booking.inquiryState === 'APPROVED' ? (
                        <div className="flex gap-2">
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            {deadlineState?.kind === 'confirmation_due' ? 'Waiting for payment confirmation' : 'Waiting for guest payment'}
                          </span>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => navigate('/host/enquiries')}>Details</Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            {bookings.length === 0 && <p className="text-center text-outline-variant py-10">No recent activity.</p>}
          </div>
        </div>
      </div>

      <InquiryDeclineDialog
        open={!!decliningBooking}
        bookingLabel={decliningBooking ? `the enquiry for ${listings.find((item) => item.id === decliningBooking.listingId)?.title || 'this stay'}` : 'this enquiry'}
        onClose={() => setDecliningBooking(null)}
        onConfirm={declineBooking}
      />

    </div>
  );
}
