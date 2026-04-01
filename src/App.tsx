import { lazy, Suspense, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Home, LogOut, Loader2, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import ListingDetail from './components/ListingDetail';
import NotificationBell from './components/NotificationBell';
import PaymentProofDialog from './components/PaymentProofDialog';
import ReviewForm from './components/ReviewForm';
import HostLayout from './components/HostLayout';
import { Button } from './components/ui/button';
import { NotificationProvider } from './context/NotificationContext';
import { useAuth } from './contexts/AuthContext';
import { usePlatformData } from './hooks/use-platform-data';
import { createBooking, submitPaymentProof } from './lib/platform-client';
import { cn } from './lib/utils';
import type { Booking, Listing } from './types';

const AccountPage = lazy(() => import('./pages/AccountPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CreateListing = lazy(() => import('./pages/CreateListing'));
const ExploreView = lazy(() => import('./pages/ExploreView'));
const GuestDashboard = lazy(() => import('./pages/GuestDashboard'));
const HolidayPlanner = lazy(() => import('./pages/HolidayPlanner'));
const HostAvailability = lazy(() => import('./pages/HostAvailability'));
const HostDashboard = lazy(() => import('./pages/HostDashboard'));
const HostEnquiries = lazy(() => import('./pages/HostEnquiries'));
const HostInbox = lazy(() => import('./pages/HostInbox'));
const HostListings = lazy(() => import('./pages/HostListings'));
const HostReports = lazy(() => import('./pages/HostReports'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ReferralView = lazy(() => import('./pages/ReferralView'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const SocialDashboard = lazy(() => import('./pages/SocialDashboard'));
const ChatModal = lazy(() => import('./components/ChatModal'));

function RouteLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-outline-variant" />
    </div>
  );
}

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedListingForDetail, setSelectedListingForDetail] = useState<Listing | null>(null);
  const [bookingToReview, setBookingToReview] = useState<Booking | null>(null);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState<Booking | null>(null);
  const [bookingForPaymentProof, setBookingForPaymentProof] = useState<Booking | null>(null);

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile]);
  const isAdminAccount = useMemo(() => !!profile?.isAdmin, [profile]);
  const isHostRoute = location.pathname.startsWith('/host');
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleListingUpdated = (updatedListing: Listing) => {
    syncUpdatedListing(updatedListing);
    if (selectedListingForDetail?.id === updatedListing.id) {
      setSelectedListingForDetail(updatedListing);
    }
  };

  const handleListingRemoved = (listingId: string) => {
    removeListing(listingId);
    if (selectedListingForDetail?.id === listingId) {
      setSelectedListingForDetail(null);
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
      {!isHostRoute && !isAdminRoute && (
        <nav className="sticky top-0 z-50 bg-surface-variant/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-container rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">Ideal Stay</span>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <Link to="/" className={cn('text-sm font-medium', location.pathname === '/' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface')}>Explore</Link>
                {user && (
                  <>
                    {profile?.role === 'host' && (
                      <Link to="/host" className={cn('text-sm font-medium', location.pathname.startsWith('/host') ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface')}>Host Dashboard</Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin" className={cn('text-sm font-medium', location.pathname.startsWith('/admin') ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface')}>Admin Panel</Link>
                    )}
                    {isAdminAccount && !isAdmin && (
                      <Link to="/account" className="text-sm font-medium text-primary hover:text-primary/80">Return to Admin</Link>
                    )}
                    <Link to="/guest" className={cn('text-sm font-medium', location.pathname === '/guest' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface')}>My Stays</Link>
                    <Link to="/referral" className={cn('text-sm font-medium', location.pathname === '/referral' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface')}>Rewards</Link>
                    <Link to="/account" className={cn('text-sm font-medium', location.pathname === '/account' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface')}>Account</Link>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-3">
                    <NotificationBell />
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-semibold leading-none">{profile?.displayName}</p>
                      <p className="text-xs text-on-surface-variant capitalize">{profile?.role}</p>
                    </div>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        className="w-8 h-8 rounded-full border border-outline-variant cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        alt="Profile"
                        onClick={() => navigate('/account')}
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => navigate('/account')}
                        aria-label="Open account"
                      >
                        {profile?.displayName?.slice(0, 1)?.toUpperCase() || user.email.slice(0, 1).toUpperCase()}
                      </button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate('/signup')}>Sign In</Button>
                    <Button onClick={() => navigate('/signup')}>Sign Up</Button>
                  </div>
                )}
                <button className="md:hidden" onClick={() => setIsMenuOpen((current) => !current)}>
                  {isMenuOpen ? <X /> : <Menu />}
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      <AnimatePresence>
        {!isHostRoute && isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-surface pt-20 px-4 md:hidden"
          >
            <div className="flex flex-col gap-6 text-center">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Explore</Link>
              {user ? (
                <>
                  {profile?.role === 'host' && (
                    <Link to="/host" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Host Dashboard</Link>
                  )}
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Admin Panel</Link>
                  )}
                  {isAdminAccount && !isAdmin && (
                    <Link to="/account" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold text-primary">Return to Admin</Link>
                  )}
                  <Link to="/guest" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">My Stays</Link>
                  <Link to="/referral" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Rewards</Link>
                  <Link to="/account" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Account</Link>
                  <button onClick={handleLogout} className="text-2xl font-bold text-red-500">Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setIsMenuOpen(false); navigate('/signup'); }} className="text-2xl font-bold">Sign In</button>
                  <button onClick={() => { setIsMenuOpen(false); navigate('/signup'); }} className="text-2xl font-bold text-primary">Sign Up</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn(!isHostRoute && !isAdminRoute ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' : 'w-full h-screen')}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<ExploreView listings={listings} onBook={(listing: Listing) => setSelectedListingForDetail(listing)} />} />
            <Route
              path="/host"
              element={profile?.role === 'host' ? <HostLayout /> : <Navigate to="/" />}
            >
              <Route index element={<HostDashboard profile={profile} listings={myListings} bookings={hostBookings} onUpgrade={() => navigate('/pricing')} onChat={(booking: Booking) => setSelectedBookingForChat(booking)} onBookingUpdated={syncUpdatedBooking} />} />
              <Route path="inbox" element={<HostInbox bookings={hostBookings} listings={myListings} onChat={(booking: Booking) => setSelectedBookingForChat(booking)} />} />
              <Route path="enquiries" element={<HostEnquiries bookings={hostBookings} listings={myListings} onChat={(booking: Booking) => setSelectedBookingForChat(booking)} onBookingUpdated={syncUpdatedBooking} />} />
              <Route path="listings" element={<HostListings listings={myListings} onListingUpdated={handleListingUpdated} onListingRemoved={handleListingRemoved} />} />
              <Route path="availability" element={<HostAvailability listings={myListings} bookings={hostBookings} onListingUpdated={handleListingUpdated} />} />
              <Route path="reports" element={<HostReports bookings={hostBookings} listings={myListings} />} />
              <Route path="social" element={<SocialDashboard listings={myListings} />} />
              <Route path="referrals" element={<ReferralView profile={profile} referrals={referrals} />} />
              <Route path="create-listing" element={<CreateListing />} />
              <Route path="edit-listing/:id" element={<CreateListing />} />
              <Route path="*" element={<Navigate to="/host" />} />
            </Route>
            <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/planner" element={<HolidayPlanner />} />
            <Route path="/guest" element={<GuestDashboard profile={profile} bookings={myBookings} listings={listings} onReview={(booking: Booking) => setBookingToReview(booking)} onExplore={() => navigate('/')} onChat={(booking: Booking) => setSelectedBookingForChat(booking)} onSubmitPaymentProof={(booking: Booking) => setBookingForPaymentProof(booking)} />} />
            <Route path="/referral" element={<ReferralView profile={profile} referrals={referrals} />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/pricing" element={<PricingPage onBack={() => navigate('/host')} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
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
                onClose={() => setSelectedListingForDetail(null)}
                currentUserUid={user?.uid}
                onBook={async (bookingData) => {
                  if (!user) {
                    navigate('/signup');
                    return;
                  }

                  try {
                    const nextBooking = await createBooking({
                      listingId: selectedListingForDetail.id,
                      hostId: selectedListingForDetail.hostUid,
                      checkIn: bookingData.checkIn.toISOString(),
                      checkOut: bookingData.checkOut.toISOString(),
                      totalPrice: bookingData.totalPrice,
                      adults: bookingData.adults,
                      children: bookingData.children,
                    });

                    syncUpdatedBooking(nextBooking);
                    toast.success('Booking request sent! The host will contact you shortly.');
                    setSelectedListingForDetail(null);
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
                currentUserUid={user.uid}
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
