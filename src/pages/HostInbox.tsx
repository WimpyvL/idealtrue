import React from 'react';
import { Booking, Listing } from '../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { User, MessageSquare, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

export default function HostInbox({ 
  bookings, 
  listings,
  onChat
}: { 
  bookings: Booking[], 
  listings: Listing[],
  onChat: (b: Booking) => void
}) {
  const activeBookings = bookings.filter(b => ['pending', 'awaiting_guest_payment', 'payment_submitted', 'confirmed'].includes(b.status));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="text-on-surface-variant">Manage your conversations with guests for active and pending bookings.</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {activeBookings.map(booking => {
          const listing = listings.find(l => l.id === booking.listingId);
          const statusLabel = booking.status === 'awaiting_guest_payment'
            ? 'Awaiting Payment'
            : booking.status === 'payment_submitted'
              ? 'Proof Submitted'
              : booking.status === 'confirmed'
                ? 'Confirmed'
                : 'Pending Approval';
          return (
            <Card key={booking.id} className="p-6">
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={booking.status === 'confirmed' ? 'success' : 'warning'}>
                      {statusLabel}
                    </Badge>
                    <span className="text-sm text-on-surface-variant">
                      Booking #{booking.id.substring(0, 8)}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-xl">{listing?.title || 'Unknown Listing'}</h3>
                  
                  <div className="flex items-center gap-4 text-on-surface-variant text-sm">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Guest: {booking.guestUid.substring(0, 8)}...</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      <span>{format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <Button 
                    className="flex-1 md:flex-none bg-primary text-on-primary hover:bg-primary/90"
                    onClick={() => onChat(booking)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Open Chat
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {activeBookings.length === 0 && (
          <div className="text-center py-16 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
            <MessageSquare className="w-12 h-12 mx-auto text-outline-variant mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">No active conversations</h3>
            <p className="text-on-surface-variant">When you have active or pending bookings, you can message your guests here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
