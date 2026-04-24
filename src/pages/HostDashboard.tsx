import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Booking, HostBillingAccount, Listing, UserProfile } from '../types';
import { 
  LayoutDashboard, 
  Calendar, 
  ArrowRight, 
  Plus, 
  Sparkles,
  CreditCard,
  Crown,
  MessageSquare,
  Building2,
  DollarSign,
  Activity,
  TimerReset,
  CircleDollarSign,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import InquiryDeclineDialog from '@/components/InquiryDeclineDialog';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { updateBookingStatus } from '@/lib/platform-client';
import { getMyHostBillingAccount, saveHostBillingCard } from '@/lib/billing-client';
import { formatRand } from '@/lib/currency';
import { getHostBillingTimelinePresentation } from '@/lib/host-billing-ui';
import {
  getInquiryBadgeLabel,
  getInquiryDeclineReasonDetail,
  getInquiryDeadlineState,
  getInquiryDeadlineUrgency,
  groupHostInquiries,
  isBookedStay,
  isPendingHostDecision,
} from '@/lib/inquiry-state';
import { cn } from '@/lib/utils';

function getMetricPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
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
  const [localBookings, setLocalBookings] = useState(bookings);
  const [billingAccount, setBillingAccount] = useState<HostBillingAccount | null>(null);
  const [billingCardForm, setBillingCardForm] = useState({
    cardholderName: '',
    brand: 'Visa',
    last4: '',
    expiryMonth: '',
    expiryYear: '',
  });
  const [savingBillingCard, setSavingBillingCard] = useState(false);
  const [decliningBooking, setDecliningBooking] = useState<Booking | null>(null);

  useEffect(() => {
    setLocalBookings(bookings);
  }, [bookings]);

  useEffect(() => {
    let cancelled = false;

    async function loadBillingAccount() {
      if (profile?.role !== 'host') {
        return;
      }

      try {
        const account = await getMyHostBillingAccount();
        if (!cancelled) {
          setBillingAccount(account);
        }
      } catch (error) {
        console.error('Failed to load host billing account', error);
      }
    }

    void loadBillingAccount();
    return () => {
      cancelled = true;
    };
  }, [profile?.role]);

  const activeListings = listings.filter(l => l.status === 'active');
  const groupedBookings = useMemo(() => groupHostInquiries(localBookings), [localBookings]);
  const needsResponseBookings = groupedBookings.needsResponse;
  const awaitingGuestPaymentBookings = groupedBookings.awaitingGuestPayment;
  const paymentReviewBookings = groupedBookings.paymentReview;
  const bookedStayCount = localBookings.filter(isBookedStay).length;
  const totalRevenue = localBookings
    .filter(isBookedStay)
    .reduce((sum, b) => sum + b.totalPrice, 0);
  const isGreylisted = billingAccount?.billingStatus === 'greylisted';
  const isVoucherHost = billingAccount?.billingSource === 'voucher';
  const billingTimeline = getHostBillingTimelinePresentation(billingAccount);
  const billingTimelineBadgeVariant =
    billingTimeline.urgencyTone === 'danger'
      ? 'danger'
      : billingTimeline.urgencyTone === 'warning'
        ? 'warning'
        : billingTimeline.urgencyTone === 'success'
          ? 'success'
          : 'neutral';
  const approvedHoldWatchlist = useMemo(() => {
    return [...awaitingGuestPaymentBookings, ...paymentReviewBookings]
      .map((booking) => ({
        booking,
        urgency: getInquiryDeadlineUrgency(booking),
      }))
      .sort((left, right) => {
        const leftDeadline = left.urgency ? new Date(left.urgency.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
        const rightDeadline = right.urgency ? new Date(right.urgency.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
        return leftDeadline - rightDeadline;
      });
  }, [awaitingGuestPaymentBookings, paymentReviewBookings]);

  const guestPaymentUrgentCount = approvedHoldWatchlist.filter(
    ({ booking, urgency }) => groupedBookings.awaitingGuestPayment.some((item) => item.id === booking.id) && urgency?.within24Hours,
  ).length;
  const paymentReviewUrgentCount = approvedHoldWatchlist.filter(
    ({ booking, urgency }) => groupedBookings.paymentReview.some((item) => item.id === booking.id) && urgency?.within24Hours,
  ).length;
  const activeQueueCount = needsResponseBookings.length + awaitingGuestPaymentBookings.length + paymentReviewBookings.length;
  const mostUrgentApprovedHold = approvedHoldWatchlist[0] ?? null;

  async function handleDeclineBooking(payload: {
    declineReason: Booking['declineReason'];
    declineReasonNote?: string | null;
  }) {
    if (!decliningBooking || !payload.declineReason) {
      return;
    }

    try {
      const updatedBooking = await updateBookingStatus(decliningBooking.id, 'DECLINED', payload);
      setLocalBookings((current) => current.map((item) => item.id === decliningBooking.id ? updatedBooking : item));
      onBookingUpdated(updatedBooking);
      navigate('/host/enquiries');

      toast.info(
        getInquiryDeclineReasonDetail(updatedBooking)
          ? `Inquiry declined: ${getInquiryDeclineReasonDetail(updatedBooking)}.`
          : 'Inquiry declined.',
      );
      setDecliningBooking(null);
    } catch (error) {
      console.error('Failed to decline inquiry:', error);
      toast.error('Failed to decline inquiry.');
    }
  }

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

      <div className="flex justify-between items-end">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Hospitality Management</h1>
          <p className="text-on-surface-variant">Manage your properties and guest interactions. <span className="text-amber-600 font-medium">Ideal Stay coordinates the booking flow, but accommodation payments are collected directly by you.</span></p>
        </header>
        <Button onClick={() => navigate('/host/create-listing')}>
          <Plus className="w-4 h-4 mr-2" /> Add New Listing
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <Card className="p-6 flex flex-col gap-2 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium">Total Bookings</h3>
          </div>
          <p className="text-3xl font-bold">{localBookings.length}</p>
        </Card>
        <Card className="p-6 flex flex-col gap-2 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <h3 className="font-medium">Needs Response</h3>
          </div>
          <p className="text-3xl font-bold">{needsResponseBookings.length}</p>
          <p className="text-xs text-on-surface-variant">
            {needsResponseBookings.length > 0
              ? `${needsResponseBookings.length} ${needsResponseBookings.length === 1 ? 'guest is' : 'guests are'} still waiting on your decision.`
              : 'No live decision queue right now.'}
          </p>
        </Card>
        <Card className={`p-6 flex flex-col gap-2 border-l-4 ${awaitingGuestPaymentTone.border}`}>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <CircleDollarSign className={`w-5 h-5 ${awaitingGuestPaymentTone.icon}`} />
            <h3 className="font-medium">Awaiting Guest Payment</h3>
          </div>
          <p className="text-3xl font-bold">{awaitingGuestPaymentBookings.length}</p>
          <div className="flex items-center gap-2">
            <Badge variant={awaitingGuestPaymentTone.badge}>
              {guestPaymentUrgentCount > 0 ? 'Expiring Soon' : 'Approved Hold'}
            </Badge>
            <p className="text-xs text-on-surface-variant">
              {getApprovedHoldHelperText(
                awaitingGuestPaymentBookings,
                guestPaymentUrgentCount,
                'No approved holds are waiting on payment.',
                'Guest payment is still outstanding on these approved stays.',
                (count) => `${count} ${count === 1 ? 'hold expires' : 'holds expire'} within 24 hours.`,
              )}
            </p>
          </div>
        </Card>
        <Card className={`p-6 flex flex-col gap-2 border-l-4 ${paymentReviewTone.border}`}>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <TimerReset className={`w-5 h-5 ${paymentReviewTone.icon}`} />
            <h3 className="font-medium">Payment Confirmation</h3>
          </div>
          <p className="text-3xl font-bold">{paymentReviewBookings.length}</p>
          <div className="flex items-center gap-2">
            <Badge variant={paymentReviewTone.badge}>
              {paymentReviewUrgentCount > 0 ? 'Action Due' : 'Review Queue'}
            </Badge>
            <p className="text-xs text-on-surface-variant">
              {getApprovedHoldHelperText(
                paymentReviewBookings,
                paymentReviewUrgentCount,
                'No payment proofs are waiting on you.',
                'Proof has been submitted and still needs your confirmation.',
                (count) => `${count} ${count === 1 ? 'confirmation deadline closes' : 'confirmation deadlines close'} within 24 hours.`,
              )}
            </p>
          </div>
        </Card>
        <Card className="p-6 flex flex-col gap-2 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Building2 className="w-5 h-5 text-purple-500" />
            <h3 className="font-medium">Active Listings</h3>
          </div>
          <p className="text-3xl font-bold">{activeListings.length}</p>
        </Card>
        <Card className="p-6 flex flex-col gap-2 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h3 className="font-medium">Total Revenue</h3>
          </div>
          <p className="text-3xl font-bold">{formatRand(totalRevenue)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Social Media CTA */}
        <Card className="lg:col-span-3 bg-surface-container-low border-none p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Boost Your Visibility</h2>
              <p className="text-on-surface-variant max-w-xl">Build reusable social copy for your listings and keep promotion moving without staring at a blank caption box.</p>
            </div>
          </div>
          <Button size="lg" className="rounded-full px-8 shrink-0" onClick={() => navigate('/host/social')}>
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
              {approvedHoldWatchlist.slice(0, 4).map(({ booking, urgency }) => {
                const listing = listings.find((item) => item.id === booking.listingId);
                const deadlineLabel = urgency
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
                        {urgency?.deadlineKind === 'confirmation_due' ? 'Confirm' : 'Hold'}
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
              {mostUrgentApprovedHold?.urgency && !mostUrgentApprovedHold.urgency.isExpired ? (
                <div className="rounded-2xl border border-outline-variant bg-background/60 p-4 text-sm">
                  <span className="font-semibold">Nearest deadline:</span>{' '}
                  {mostUrgentApprovedHold.urgency.deadlineKind === 'confirmation_due'
                    ? 'payment confirmation'
                    : 'guest payment'} closes{' '}
                  {formatDistanceToNowStrict(new Date(mostUrgentApprovedHold.urgency.deadlineAt), { addSuffix: true })}.
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
            {localBookings.slice(0, 5).map(booking => {
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
                  <div className="mt-3 pt-3 border-t border-outline-variant flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{formatRand(booking.totalPrice)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onChat(booking)}>Message</Button>
                      {isPendingHostDecision(booking) ? (
                        <div className="flex gap-2">
                          <button 
                            onClick={async () => {
                              try {
                                const updatedBooking = await updateBookingStatus(booking.id, 'APPROVED');
                                setLocalBookings((current) => current.map((item) => item.id === booking.id ? updatedBooking : item));
                                onBookingUpdated(updatedBooking);
                                navigate('/host/enquiries');

                                toast.success('Inquiry approved. Payment is now unlocked for the guest.');
                              } catch (error) {
                                console.error('Failed to approve inquiry:', error);
                                toast.error('Failed to approve inquiry.');
                              }
                            }}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => setDecliningBooking(booking)}
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
            {localBookings.length === 0 && <p className="text-center text-outline-variant py-10">No recent activity.</p>}
          </div>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="mt-12 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5" /> Subscription Management
        </h2>
        <Card className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold">Current Plan: <span className="capitalize">{profile?.hostPlan || 'Standard'}</span></h3>
                {(billingAccount?.billingStatus || profile?.hostPlan) && (
                  <Badge variant={isGreylisted ? 'warning' : 'success'} className="flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {isGreylisted ? 'Greylisted' : 'Active'}
                  </Badge>
                )}
              </div>
              <p className="text-on-surface-variant text-sm max-w-md">
                {profile?.hostPlan === 'premium' 
                  ? 'You are on the highest tier. Enjoy all premium features including priority support and advanced analytics.'
                  : profile?.hostPlan === 'professional'
                  ? 'You have access to the content studio and advanced listing features. Upgrade to Premium for priority support.'
                  : profile?.hostPlan === 'standard'
                  ? 'You are on the entry host tier. One live listing, content studio access, 10 photos per listing, and no showcase video on Standard.'
                  : 'Your plan details are syncing.'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/pricing')}>
                View All Plans
              </Button>
              {profile?.hostPlan !== 'premium' && (
                <Button onClick={() => navigate('/pricing')}>
                  Upgrade Plan
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Billing Source</p>
              <p className="mt-2 text-lg font-bold capitalize">{billingAccount?.billingSource || 'none'}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {isVoucherHost ? 'Voucher-backed onboarding period.' : billingAccount?.billingSource === 'paid' ? 'Paid subscription cycle is active.' : 'No voucher or paid cycle is active yet.'}
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Countdown</p>
              <p className="mt-2 text-sm font-bold">
                {billingTimeline.countdownLabel}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">{billingTimeline.periodLabel}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Urgency</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={billingTimelineBadgeVariant}>{billingTimeline.urgencyLabel}</Badge>
                <span className="text-xs text-on-surface-variant">{billingTimeline.reminderLabel}</span>
              </div>
              <p className="mt-3 text-sm font-bold">{billingTimeline.actionLabel}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {billingAccount?.cardOnFile ? 'Billing follow-up is covered.' : 'Saving a billing card clears the voucher follow-up path.'}
              </p>
            </div>
          </div>

          {isVoucherHost ? (
            <div className="mt-6 rounded-3xl border border-outline-variant bg-surface-container-low p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Voucher Billing Timeline</p>
                  <h4 className="mt-2 text-xl font-bold">{billingTimeline.countdownLabel}</h4>
                  <p className="mt-1 text-sm text-on-surface-variant">{billingTimeline.periodLabel}</p>
                </div>
                <Badge variant={billingTimelineBadgeVariant} className="w-fit">
                  {billingTimeline.urgencyLabel}
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-outline-variant bg-background/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Countdown</p>
                  <p className="mt-2 text-base font-bold">{billingTimeline.countdownLabel}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">This is the next billing enforcement checkpoint for voucher hosting.</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-background/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Urgency</p>
                  <p className="mt-2 text-base font-bold">{billingTimeline.urgencyLabel}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{billingTimeline.reminderLabel}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-background/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Required Action</p>
                  <p className="mt-2 text-base font-bold">{billingTimeline.actionLabel}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {billingAccount?.cardOnFile ? 'No extra billing capture is needed right now.' : 'Use the billing card form below to stop the reminder path.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isGreylisted ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your host account is on the billing greylist. Public listings are paused until admin reviews the account.
            </div>
          ) : null}

          {!billingAccount?.cardOnFile ? (
            <form
              className="mt-6 grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 md:grid-cols-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setSavingBillingCard(true);
                try {
                  const nextAccount = await saveHostBillingCard({
                    cardholderName: billingCardForm.cardholderName,
                    brand: billingCardForm.brand,
                    last4: billingCardForm.last4,
                    expiryMonth: Number(billingCardForm.expiryMonth),
                    expiryYear: Number(billingCardForm.expiryYear),
                  });
                  setBillingAccount(nextAccount);
                  toast.success('Billing card saved. Reminder notifications will stop.');
                } catch (error) {
                  console.error('Failed to save billing card', error);
                  toast.error('Could not save the billing card details.');
                } finally {
                  setSavingBillingCard(false);
                }
              }}
            >
              <Input placeholder="Cardholder name" value={billingCardForm.cardholderName} onChange={(event) => setBillingCardForm((current) => ({ ...current, cardholderName: event.target.value }))} />
              <Input placeholder="Brand" value={billingCardForm.brand} onChange={(event) => setBillingCardForm((current) => ({ ...current, brand: event.target.value }))} />
              <Input placeholder="Last 4 digits" maxLength={4} value={billingCardForm.last4} onChange={(event) => setBillingCardForm((current) => ({ ...current, last4: event.target.value.replace(/\D/g, '') }))} />
              <Input placeholder="MM" maxLength={2} value={billingCardForm.expiryMonth} onChange={(event) => setBillingCardForm((current) => ({ ...current, expiryMonth: event.target.value.replace(/\D/g, '') }))} />
              <div className="flex gap-3">
                <Input placeholder="YYYY" maxLength={4} value={billingCardForm.expiryYear} onChange={(event) => setBillingCardForm((current) => ({ ...current, expiryYear: event.target.value.replace(/\D/g, '') }))} />
                <Button type="submit" disabled={savingBillingCard}>
                  {savingBillingCard ? 'Saving...' : 'Add Card'}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>

      <InquiryDeclineDialog
        open={!!decliningBooking}
        bookingLabel={decliningBooking ? `the enquiry for ${listings.find((item) => item.id === decliningBooking.listingId)?.title || 'this stay'}` : 'this enquiry'}
        onClose={() => setDecliningBooking(null)}
        onConfirm={handleDeclineBooking}
      />

    </div>
  );
}
