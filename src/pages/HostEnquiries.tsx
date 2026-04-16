import React, { useEffect, useState } from 'react';
import { Booking, Listing } from '../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MessageSquare, CheckCircle2, XCircle, Clock, CalendarDays, User } from 'lucide-react';
import { format } from 'date-fns';
import { confirmPayment, markInquiryViewed, updateBookingStatus } from '@/lib/platform-client';
import { formatRand } from '@/lib/currency';
import { isAwaitingHostPaymentConfirmation, isPendingHostDecision } from '@/lib/inquiry-state';

export default function HostEnquiries({ 
  bookings,
  listings,
  onChat,
  onBookingUpdated,
}: { 
  bookings: Booking[], 
  listings: Listing[],
  onChat: (b: Booking) => void,
  onBookingUpdated: (booking: Booking) => void,
}) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [localBookings, setLocalBookings] = useState(bookings);
  console.log("[HostEnquiries] Raw bookings prop:", bookings);

  useEffect(() => {
    setLocalBookings(bookings);
  }, [bookings]);

  const pendingBookings = localBookings.filter(isPendingHostDecision);
  const paymentReviewBookings = localBookings.filter(isAwaitingHostPaymentConfirmation);
  console.log("[HostEnquiries] Enquiries after isPendingHostDecision filter:", pendingBookings);
  console.log("[HostEnquiries] Enquiries awaiting payment confirmation:", paymentReviewBookings);

  const handleBookingAction = async (booking: Booking, action: 'APPROVED' | 'DECLINED') => {
    setIsProcessing(booking.id);
    try {
      const updatedBooking = await updateBookingStatus(booking.id, action);
      onBookingUpdated(updatedBooking);
    } catch (error) {
      console.error('Error updating booking:', error);
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePaymentConfirmation = async (booking: Booking) => {
    setIsProcessing(booking.id);
    try {
      const updatedBooking = await confirmPayment(booking.id);
      onBookingUpdated(updatedBooking);
    } catch (error) {
      console.error('Error confirming payment:', error);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Enquiries & Requests</h1>
        <p className="text-on-surface-variant">Review and manage pending booking requests from guests.</p>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Pending Decisions</h2>
            <p className="text-sm text-on-surface-variant">Approve, decline, or message guests while requests are still open.</p>
          </div>
        {pendingBookings.map(booking => {
          const listing = listings.find(l => l.id === booking.listingId);
          return (
            <Card key={booking.id} className="p-6">
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending Approval
                    </Badge>
                    <span className="text-sm text-on-surface-variant">
                      Requested on {format(new Date(booking.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-xl">{listing?.title || 'Unknown Listing'}</h3>
                    <div className="flex items-center gap-4 mt-2 text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        <span>{format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{booking.guests?.adults || 0} Adults, {booking.guests?.children || 0} Children</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
                    <p className="text-sm font-medium text-on-surface-variant mb-1">Total Payout</p>
                    <p className="text-2xl font-bold text-primary">{formatRand(booking.totalPrice)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    className="flex-1 md:flex-none"
                    onClick={async () => {
                      if (booking.inquiryState === 'PENDING') {
                        const viewedBooking = await markInquiryViewed(booking.id);
                        onBookingUpdated(viewedBooking);
                      }
                      onChat(booking);
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Message
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 md:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => handleBookingAction(booking, 'DECLINED')}
                    disabled={isProcessing === booking.id}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Decline
                  </Button>
                    <Button 
                      className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleBookingAction(booking, 'APPROVED')}
                    disabled={isProcessing === booking.id}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {pendingBookings.length === 0 && (
          <div className="text-center py-16 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
            <Clock className="w-12 h-12 mx-auto text-outline-variant mb-4" />
            <h3 className="text-xl font-bold mb-2">You're all caught up!</h3>
            <p className="text-on-surface-variant">There are no pending booking requests at this time.</p>
          </div>
        )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Awaiting Payment Confirmation</h2>
            <p className="text-sm text-on-surface-variant">Review submitted proof before the stay is confirmed.</p>
          </div>

          {paymentReviewBookings.map((booking) => {
            const listing = listings.find((l) => l.id === booking.listingId);
            return (
              <Card key={`${booking.id}-payment-review`} className="p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Payment Proof Submitted
                      </Badge>
                      <span className="text-sm text-on-surface-variant">
                        Submitted {booking.paymentSubmittedAt ? format(new Date(booking.paymentSubmittedAt), 'MMM d, yyyy HH:mm') : 'recently'}
                      </span>
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
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                        <p className="text-sm font-medium text-on-surface-variant mb-1">Payment Reference</p>
                        <p className="text-base font-semibold text-on-surface">{booking.paymentReference || 'No reference supplied'}</p>
                      </div>
                      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                        <p className="text-sm font-medium text-on-surface-variant mb-1">Total Payout</p>
                        <p className="text-2xl font-bold text-primary">{formatRand(booking.totalPrice)}</p>
                      </div>
                    </div>

                    {booking.paymentProofUrl ? (
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
                    )}
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-auto">
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() => onChat(booking)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Message
                    </Button>
                    <Button
                      className="w-full lg:w-auto bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handlePaymentConfirmation(booking)}
                      disabled={isProcessing === booking.id || !booking.paymentProofUrl}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Payment
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {paymentReviewBookings.length === 0 && (
            <div className="text-center py-16 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
              <CheckCircle2 className="w-12 h-12 mx-auto text-outline-variant mb-4" />
              <h3 className="text-xl font-bold mb-2">No payments waiting on you</h3>
              <p className="text-on-surface-variant">Submitted proofs will show up here for final confirmation.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
