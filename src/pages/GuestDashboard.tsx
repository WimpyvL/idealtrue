import React from 'react';
import { Booking, Listing, UserProfile } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Shield } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { formatRand } from '@/lib/currency';
import {
  canGuestPay,
  getInquiryBadgeLabel,
  getInquiryDeadlineState,
  getGuestPaymentStateText,
  isAwaitingHostPaymentConfirmation,
  isBookedStay,
} from '@/lib/inquiry-state';

export default function GuestDashboard({ 
  profile, 
  bookings, 
  listings, 
  onReview, 
  onExplore,
  onChat,
  onSubmitPaymentProof
}: { 
  profile: UserProfile | null, 
  bookings: Booking[], 
  listings: Listing[], 
  onReview: (b: Booking) => void, 
  onExplore: () => void,
  onChat: (b: Booking) => void,
  onSubmitPaymentProof: (b: Booking) => Promise<void> | void
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">My Stays</h1>
          <p className="text-on-surface-variant">View and manage your upcoming and past trips.</p>
        </header>
        {profile?.role === 'guest' && (
          <Button 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary/5"
            onClick={() => navigate('/account')}
          >
            <Shield className="w-4 h-4 mr-2" />
            Become a Host
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookings.map(booking => {
          const listing = listings.find(l => l.id === booking.listingId);
          const statusLabel = getInquiryBadgeLabel(booking);
          const bookingReady = isBookedStay(booking);
          const paymentAwaitingReview = isAwaitingHostPaymentConfirmation(booking);
          const breakageDeposit = booking.breakageDeposit ?? 0;
          const fullGuestExposure = booking.totalPrice + breakageDeposit;
          const deadlineState = getInquiryDeadlineState(booking);
          const deadlineCopy = deadlineState
            ? (() => {
                const distance = formatDistanceToNowStrict(new Date(deadlineState.deadlineAt), { addSuffix: true });
                switch (deadlineState.kind) {
                  case 'response_due':
                    return `This enquiry auto-expires ${distance} if the host does not move it forward.`;
                  case 'payment_due':
                    return `Payment must complete ${distance} or the approval will expire.`;
                  case 'confirmation_due':
                    return `Host confirmation must land ${distance} or this approval will expire.`;
                  case 'expired':
                    return `This enquiry expired ${distance}. Any payment hold on the dates has been released.`;
                  default:
                    return null;
                }
              })()
            : null;
          return (
            <Card key={booking.id} className="p-0 overflow-hidden flex flex-col">
              <div className="aspect-video bg-surface-container relative">
                <img src={listing?.images[0] || `https://picsum.photos/seed/${booking.id}/800/600`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                <div className="absolute top-3 left-3">
                  <Badge variant={bookingReady ? 'success' : booking.inquiryState === 'DECLINED' || booking.inquiryState === 'EXPIRED' ? 'danger' : 'warning'}>{statusLabel}</Badge>
                </div>
              </div>
              <div className="p-5 flex-1 space-y-3">
                <h3 className="font-bold text-lg">{listing?.title || 'Unknown Listing'}</h3>
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <MapPin className="w-4 h-4" />
                  <span>{booking.guests?.adults || 0} Adults, {booking.guests?.children || 0} Children</span>
                </div>
                <div className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Stay value</p>
                      <p className="text-base font-semibold text-on-surface">{formatRand(booking.totalPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Breakage deposit</p>
                      <p className="text-base font-semibold text-on-surface">{formatRand(breakageDeposit)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Full guest exposure</p>
                      <p className="text-base font-semibold text-on-surface">{formatRand(fullGuestExposure)}</p>
                    </div>
                  </div>
                  <div className="space-y-1 border-t border-outline-variant pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Payment state</p>
                    <p className="text-sm text-on-surface">{getGuestPaymentStateText(booking)}</p>
                    {paymentAwaitingReview && booking.paymentReference && (
                      <p className="text-xs text-on-surface-variant">
                        Payment reference: <span className="font-medium text-on-surface">{booking.paymentReference}</span>
                      </p>
                    )}
                    {deadlineCopy && (
                      <p className="text-xs text-on-surface-variant">
                        {deadlineCopy}
                      </p>
                    )}
                  </div>
                </div>
                <div className="pt-1 border-t border-outline-variant flex justify-between items-center gap-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onChat(booking)}>Message</Button>
                    {canGuestPay(booking) && (
                      <Button size="sm" variant="secondary" onClick={() => onSubmitPaymentProof(booking)}>Submit Payment</Button>
                    )}
                    {bookingReady && (
                      <Button size="sm" variant="secondary" onClick={() => onReview(booking)}>Review</Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {bookings.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto">
              <MapPin className="w-8 h-8 text-outline-variant" />
            </div>
            <p className="text-on-surface-variant">You haven't booked any stays yet.</p>
            <Button variant="secondary" onClick={onExplore}>Explore Listings</Button>
          </div>
        )}
      </div>
    </div>
  );
}
