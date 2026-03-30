import React, { useState } from 'react';
import { Booking, Listing } from '../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MessageSquare, CheckCircle2, XCircle, Clock, CalendarDays, User } from 'lucide-react';
import { format } from 'date-fns';
import { useNotifications } from '../context/NotificationContext';
import { updateBookingStatus } from '@/lib/platform-client';
import { formatRand } from '@/lib/currency';

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
  const { socket } = useNotifications();
  
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  const handleBookingAction = async (booking: Booking, action: 'awaiting_guest_payment' | 'cancelled') => {
    setIsProcessing(booking.id);
    try {
      const updatedBooking = await updateBookingStatus(booking.id, action);
      onBookingUpdated(updatedBooking);
      
      const listing = listings.find(l => l.id === booking.listingId);
      
      // Emit notification to guest
      socket?.emit('booking:update', {
        guestUid: booking.guestUid,
        hostUid: booking.hostUid,
        listingId: booking.listingId,
        bookingId: booking.id,
        status: action,
        message: action === 'awaiting_guest_payment'
          ? `Your booking for ${listing?.title || 'your stay'} is approved. Please complete payment using the host instructions on-platform.`
          : `Your booking for ${listing?.title || 'your stay'} has been cancelled.`
      });

    } catch (error) {
      console.error('Error updating booking:', error);
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

      <div className="grid grid-cols-1 gap-4">
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
                    onClick={() => onChat(booking)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Message
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 md:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => handleBookingAction(booking, 'cancelled')}
                    disabled={isProcessing === booking.id}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Decline
                  </Button>
                    <Button 
                      className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleBookingAction(booking, 'awaiting_guest_payment')}
                    disabled={isProcessing === booking.id}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Request Payment
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
      </div>
    </div>
  );
}
