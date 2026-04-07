import { lazy, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import AppNavigation from './components/AppNavigation';
import AppRoutes from './components/AppRoutes';
import ListingDetail from './components/ListingDetail';
import PaymentProofDialog from './components/PaymentProofDialog';
import ReviewForm from './components/ReviewForm';
import { NotificationProvider } from './context/NotificationContext';
import { useAuth } from './contexts/AuthContext';
import { useAppShellState } from './hooks/use-app-shell-state';
import { usePlatformData } from './hooks/use-platform-data';
import { createBooking, submitPaymentProof } from './lib/platform-client';
import { cn } from './lib/utils';

const ChatModal = lazy(() => import('./components/ChatModal'));

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, logout } = useAuth();
  const {
    listings,
    myListings,
    myBookings,
    hostBookings,
    referrals,
    syncUpdatedBooking,
    syncUpdatedListing,
    removeListing,
  } = usePlatformData(user);
  const {
    isMenuOpen,
    setIsMenuOpen,
    selectedListingForDetail,
    setSelectedListingForDetail,
    bookingToReview,
    setBookingToReview,
    selectedBookingForChat,
    setSelectedBookingForChat,
    bookingForPaymentProof,
    setBookingForPaymentProof,
  } = useAppShellState();

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile]);
  const isAdminAccount = useMemo(() => !!profile?.isAdmin, [profile]);
  const isHostRoute = location.pathname.startsWith('/host');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const selectedListingIdFromUrl = useMemo(() => {
    if (location.pathname !== '/') return null;
    return new URLSearchParams(location.search).get('listingId');
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!selectedListingIdFromUrl) {
      return;
    }

    if (selectedListingForDetail?.id === selectedListingIdFromUrl) {
      return;
    }

    const listingFromUrl = listings.find((listing) => listing.id === selectedListingIdFromUrl);
    if (listingFromUrl) {
      setSelectedListingForDetail(listingFromUrl);
    }
  }, [listings, selectedListingForDetail?.id, selectedListingIdFromUrl, setSelectedListingForDetail]);

  const handleListingUpdated = (updatedListing: typeof listings[number]) => {
    syncUpdatedListing(updatedListing);
    if (selectedListingForDetail?.id === updatedListing.id) {
      setSelectedListingForDetail(updatedListing);
    }
  };

  const handleListingRemoved = (listingId: string) => {
    removeListing(listingId);
    if (selectedListingForDetail?.id === listingId) {
      handleListingDetailClose();
    }
  };

  const handleListingSelected = (listing: typeof listings[number]) => {
    setSelectedListingForDetail(listing);
    if (location.pathname === '/') {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('listingId', listing.id);
      navigate({ pathname: '/', search: `?${searchParams.toString()}` }, { replace: true });
    }
  };

  const handleListingDetailClose = () => {
    setSelectedListingForDetail(null);
    if (location.pathname === '/' && selectedListingIdFromUrl) {
      const searchParams = new URLSearchParams(location.search);
      searchParams.delete('listingId');
      navigate({ pathname: '/', search: searchParams.toString() ? `?${searchParams.toString()}` : '' }, { replace: true });
    }
  };

  const handleLogout = () => {
    void logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-outline-variant" />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen font-sans text-on-surface', isHostRoute ? 'bg-surface' : 'bg-surface-container-low')}>
      <Toaster position="top-center" richColors />
      <AppNavigation
        isAdmin={isAdmin}
        isAdminAccount={isAdminAccount}
        isHostRoute={isHostRoute}
        isAdminRoute={isAdminRoute}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((current) => !current)}
        onCloseMenu={() => setIsMenuOpen(false)}
        onLogout={handleLogout}
        profile={profile}
        user={user}
      />

      <main className={cn(!isHostRoute && !isAdminRoute ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' : 'w-full h-screen')}>
        <AppRoutes
          hostBookings={hostBookings}
          isAdmin={isAdmin}
          listings={listings}
          myBookings={myBookings}
          myListings={myListings}
          onBookingForPaymentProof={setBookingForPaymentProof}
          onBookingToReview={setBookingToReview}
          onListingRemoved={handleListingRemoved}
          onListingSelected={handleListingSelected}
          onListingUpdated={handleListingUpdated}
          onSelectedBookingForChat={setSelectedBookingForChat}
          onSyncUpdatedBooking={syncUpdatedBooking}
          profile={profile}
          referrals={referrals}
        />
      </main>

      <PaymentProofDialog
        booking={bookingForPaymentProof}
        listing={bookingForPaymentProof ? listings.find((listing) => listing.id === bookingForPaymentProof.listingId) ?? null : null}
        open={!!bookingForPaymentProof}
        onClose={() => setBookingForPaymentProof(null)}
        onSubmit={async ({ id, paymentReference, paymentProof, paymentProofUrl }) => {
          try {
            const updatedBooking = await submitPaymentProof({
              id,
              paymentReference,
              paymentProof,
              paymentProofUrl,
            });
            syncUpdatedBooking(updatedBooking);
            toast.success('Payment proof submitted. The host can now confirm receipt.');
          } catch (error) {
            console.error('Failed to submit payment proof:', error);
            toast.error('Failed to submit payment proof.');
            throw error;
          }
        }}
      />

      <AnimatePresence>
        {selectedListingForDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface-container-lowest rounded-3xl w-full max-w-4xl my-8 overflow-hidden shadow-[0_10px_40px_rgba(18,28,42,0.06)] relative"
            >
              <ListingDetail
                listing={selectedListingForDetail}
                onClose={handleListingDetailClose}
                currentUserId={user?.id}
                onBook={async (bookingData) => {
                  if (!user) {
                    navigate('/signup');
                    return;
                  }

                  try {
                    const nextBooking = await createBooking({
                      listingId: selectedListingForDetail.id,
                      hostId: selectedListingForDetail.hostId,
                      checkIn: bookingData.checkIn.toISOString(),
                      checkOut: bookingData.checkOut.toISOString(),
                      totalPrice: bookingData.totalPrice,
                      adults: bookingData.adults,
                      children: bookingData.children,
                    });

                    syncUpdatedBooking(nextBooking);
                    toast.success('Booking request sent! The host will contact you shortly.');
                    handleListingDetailClose();
                  } catch (error) {
                    console.error('Failed to create booking:', error);
                    toast.error('Booking request failed. Please try again.');
                  }
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingToReview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-lowest rounded-3xl w-full max-w-xl overflow-hidden shadow-[0_10px_40px_rgba(18,28,42,0.06)]"
            >
              <ReviewForm booking={bookingToReview} onClose={() => setBookingToReview(null)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBookingForChat && user && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl"
            >
              <ChatModal
                booking={selectedBookingForChat}
                listing={listings.find((listing) => listing.id === selectedBookingForChat.listingId) || myListings.find((listing) => listing.id === selectedBookingForChat.listingId)!}
                currentUserId={user.id}
                onClose={() => setSelectedBookingForChat(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <NotificationProvider user={user}>
      <AppContent />
    </NotificationProvider>
  );
}
