import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Listing, Booking, UserProfile } from '../types';
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
  Activity
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { updateBookingStatus } from '@/lib/platform-client';
import { formatRand } from '@/lib/currency';
import { getInquiryBadgeLabel, isBookedStay, isPendingHostDecision } from '@/lib/inquiry-state';

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

  useEffect(() => {
    setLocalBookings(bookings);
  }, [bookings]);

  const activeListings = listings.filter(l => l.status === 'active');
  const allHostInquiries = localBookings.filter(isPendingHostDecision);
  console.log("[HostDashboard] Total hostBookings received:", localBookings.length);
  console.log("[HostDashboard] Host inquiries after filtering:", allHostInquiries);

  const pendingBookings = allHostInquiries
    .filter((b) => b.inquiryState === "PENDING")
    .slice(0, 3);
  const totalRevenue = localBookings
    .filter(isBookedStay)
    .reduce((sum, b) => sum + b.totalPrice, 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <h3 className="font-medium">Pending Enquiries</h3>
          </div>
          <p className="text-3xl font-bold">{pendingBookings.length}</p>
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
                            onClick={async () => {
                              try {
                                const updatedBooking = await updateBookingStatus(booking.id, 'DECLINED');
                                setLocalBookings((current) => current.map((item) => item.id === booking.id ? updatedBooking : item));
                                onBookingUpdated(updatedBooking);

                                toast.info('Inquiry declined.');
                              } catch (error) {
                                console.error('Failed to decline inquiry:', error);
                                toast.error('Failed to decline inquiry.');
                              }
                            }}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      ) : booking.inquiryState === 'APPROVED' ? (
                        <div className="flex gap-2">
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            Waiting for guest payment
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
                {profile?.hostPlan && (
                  <Badge variant="success" className="flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Active
                  </Badge>
                )}
              </div>
              <p className="text-on-surface-variant text-sm max-w-md">
                {profile?.hostPlan === 'premium' 
                  ? 'You are on the highest tier. Enjoy all premium features including priority support and advanced analytics.'
                  : profile?.hostPlan === 'professional'
                  ? 'You have access to the content studio and advanced listing features. Upgrade to Premium for priority support.'
                  : profile?.hostPlan === 'standard'
                  ? 'You are on the entry paid tier. One live listing, content studio access, and a clean path to upgrade when you need more reach.'
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
        </Card>
      </div>

    </div>
  );
}
