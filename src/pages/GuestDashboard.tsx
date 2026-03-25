import React from 'react';
import { Booking, Listing, UserProfile } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function GuestDashboard({ 
  profile, 
  bookings, 
  listings, 
  onReview, 
  onExplore,
  onChat
}: { 
  profile: UserProfile | null, 
  bookings: Booking[], 
  listings: Listing[], 
  onReview: (b: Booking) => void, 
  onExplore: () => void,
  onChat: (b: Booking) => void
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
          return (
            <Card key={booking.id} className="p-0 overflow-hidden flex flex-col">
              <div className="aspect-video bg-surface-container relative">
                <img src={listing?.images[0] || `https://picsum.photos/seed/${booking.id}/800/600`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                <div className="absolute top-3 left-3">
                  <Badge variant={booking.status === 'confirmed' ? 'success' : 'warning'}>{booking.status}</Badge>
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
                <div className="pt-4 border-t border-outline-variant flex justify-between items-center gap-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">${booking.totalPrice}</span>
                    <span className="text-[10px] text-outline-variant">Payment handled by host</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onChat(booking)}>Message</Button>
                    {booking.status === 'confirmed' && (
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
