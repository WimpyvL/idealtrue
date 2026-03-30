import React, { useState, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import NotificationBell from './components/NotificationBell';
import { 
  Home, 
  LogOut, 
  Menu, 
  X,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import CreateListing from './pages/CreateListing';
import PricingPage from './pages/PricingPage';
import HostDashboard from './pages/HostDashboard';
import ExploreView from './pages/ExploreView';
import GuestDashboard from './pages/GuestDashboard';
import ReferralView from './pages/ReferralView';
import AccountPage from './pages/AccountPage';
import SignupPage from './pages/SignupPage';
import HolidayPlanner from './pages/HolidayPlanner';
import AdminDashboard from './pages/AdminDashboard';
import ListingDetail from './components/ListingDetail';
import ReviewForm from './components/ReviewForm';
import ChatModal from './components/ChatModal';
import HostLayout from './components/HostLayout';
import PaymentProofDialog from './components/PaymentProofDialog';
import { Button } from './components/ui/button';
import { 
  Listing, 
  Booking, 
  Referral
} from './types';

import { cn } from './lib/utils';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { useAuth } from './contexts/AuthContext';
import { createBooking, listHostListings, listMyBookings, listPublicListings, listReferralRewards, submitPaymentProof } from './lib/platform-client';

// handleFirestoreError moved to ./lib/firestore

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest p-6">
          <div className="max-w-md w-full bg-surface-container p-8 rounded-3xl border border-outline-variant shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-error-container text-on-error-container rounded-full flex items-center justify-center mx-auto">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Application Error</h2>
            <p className="text-on-surface-variant">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Main App ---

import SocialDashboard from './pages/SocialDashboard';
import HostListings from './pages/HostListings';
import HostAvailability from './pages/HostAvailability';
import HostEnquiries from './pages/HostEnquiries';
import HostReports from './pages/HostReports';
import HostInbox from './pages/HostInbox';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useNotifications();
  const { user, profile, loading, logout } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [hostBookings, setHostBookings] = useState<Booking[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedListingForDetail, setSelectedListingForDetail] = useState<Listing | null>(null);
  const [bookingToReview, setBookingToReview] = useState<Booking | null>(null);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState<Booking | null>(null);
  const [bookingForPaymentProof, setBookingForPaymentProof] = useState<Booking | null>(null);

  const syncUpdatedBooking = (updatedBooking: Booking) => {
    setMyBookings((current) => current.map((item) => item.id === updatedBooking.id ? updatedBooking : item));
    setHostBookings((current) => current.map((item) => item.id === updatedBooking.id ? updatedBooking : item));
  };

  const syncUpdatedListing = (updatedListing: Listing) => {
    setListings((current) => current.map((item) => item.id === updatedListing.id ? updatedListing : item));
    setMyListings((current) => current.map((item) => item.id === updatedListing.id ? updatedListing : item));
    if (selectedListingForDetail?.id === updatedListing.id) {
      setSelectedListingForDetail(updatedListing);
    }
  };

  const removeListing = (listingId: string) => {
    setListings((current) => current.filter((item) => item.id !== listingId));
    setMyListings((current) => current.filter((item) => item.id !== listingId));
    if (selectedListingForDetail?.id === listingId) {
      setSelectedListingForDetail(null);
    }
  };

  useEffect(() => {
    try {
      let cancelled = false;

      async function loadData() {
        const [publicListings, sessionBookings, rewardHistory] = await Promise.all([
          listPublicListings(),
          user ? listMyBookings() : Promise.resolve([]),
          user ? listReferralRewards() : Promise.resolve([]),
        ]);

        if (cancelled) return;

        setListings(publicListings);
        setReferrals(rewardHistory as Referral[]);

        if (!user) {
          setMyListings([]);
          setMyBookings([]);
          setHostBookings([]);
          return;
        }

        const [hostListings] = await Promise.all([
          listHostListings(user.uid),
        ]);

        if (cancelled) return;

        setMyListings(hostListings);
        setMyBookings(sessionBookings.filter((booking) => booking.guestUid === user.uid));
        setHostBookings(sessionBookings.filter((booking) => booking.hostUid === user.uid));
      }

      loadData().catch((error) => {
        console.error('Failed to load platform data:', error);
        toast.error('Failed to load the latest platform data.');
      });

      return () => {
        cancelled = true;
      };
    } catch (error) {
      console.error('Failed to initialize platform data:', error);
      return;
    }
  }, [user]);

  const isAdmin = useMemo(() => {
    return profile?.role === 'admin';
  }, [profile]);

  const isHostRoute = location.pathname.startsWith('/host');
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-outline-variant" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen font-sans text-on-surface", isHostRoute ? "bg-surface" : "bg-surface-container-low")}>
      <Toaster position="top-center" richColors />
        {/* Navigation */}
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

                {/* Desktop Nav */}
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
                      <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:flex">
                        <LogOut className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => navigate('/signup')}>Sign In</Button>
                      <Button onClick={() => navigate('/signup')}>Sign Up</Button>
                    </div>
                  )}
                  <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    {isMenuOpen ? <X /> : <Menu />}
                  </button>
                </div>
              </div>
            </div>
          </nav>
        )}

        {/* Mobile Menu */}
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
                    <Link to="/guest" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">My Stays</Link>
                    <Link to="/referral" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Rewards</Link>
                    <Link to="/account" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold">Account</Link>
                    <button onClick={logout} className="text-2xl font-bold text-red-500">Sign Out</button>
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

        {/* Main Content */}
        <main className={cn(!isHostRoute && !isAdminRoute ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" : "w-full h-screen")}>
          <Routes>
            <Route path="/" element={<ExploreView listings={listings} onBook={(l: Listing) => { setSelectedListingForDetail(l); }} />} />
            
            <Route path="/host" element={
              profile?.role === 'host' ? (
                <HostLayout />
              ) : (
                <Navigate to="/" />
              )
            }>
              <Route index element={<HostDashboard profile={profile} listings={myListings} bookings={hostBookings} onUpgrade={() => navigate('/pricing')} onChat={(b: Booking) => setSelectedBookingForChat(b)} onBookingUpdated={syncUpdatedBooking} />} />
              <Route path="inbox" element={<HostInbox bookings={hostBookings} listings={myListings} onChat={(b: Booking) => setSelectedBookingForChat(b)} />} />
              <Route path="enquiries" element={<HostEnquiries bookings={hostBookings} listings={myListings} onChat={(b: Booking) => setSelectedBookingForChat(b)} onBookingUpdated={syncUpdatedBooking} />} />
              <Route path="listings" element={<HostListings listings={myListings} onListingUpdated={syncUpdatedListing} onListingRemoved={removeListing} />} />
              <Route path="availability" element={<HostAvailability listings={myListings} bookings={hostBookings} onListingUpdated={syncUpdatedListing} />} />
              <Route path="reports" element={<HostReports bookings={hostBookings} listings={myListings} />} />
              <Route path="social" element={<SocialDashboard listings={myListings} />} />
              <Route path="referrals" element={<ReferralView profile={profile} referrals={referrals} />} />
              <Route path="create-listing" element={<CreateListing />} />
              <Route path="edit-listing/:id" element={<CreateListing />} />
              <Route path="*" element={<Navigate to="/host" />} />
            </Route>

            <Route path="/admin" element={
              isAdmin ? (
                <AdminDashboard />
              ) : (
                <Navigate to="/" />
              )
            } />
            <Route path="/planner" element={<HolidayPlanner />} />
            <Route path="/guest" element={<GuestDashboard profile={profile} bookings={myBookings} listings={listings} onReview={(b: Booking) => setBookingToReview(b)} onExplore={() => navigate('/')} onChat={(b: Booking) => setSelectedBookingForChat(b)} onSubmitPaymentProof={(b: Booking) => setBookingForPaymentProof(b)} />} />
            <Route path="/referral" element={<ReferralView profile={profile} referrals={referrals} />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/pricing" element={<PricingPage onBack={() => navigate('/host')} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <PaymentProofDialog
          booking={bookingForPaymentProof}
          listing={bookingForPaymentProof ? listings.find((listing) => listing.id === bookingForPaymentProof.listingId) ?? null : null}
          open={!!bookingForPaymentProof}
          onClose={() => setBookingForPaymentProof(null)}
          onSubmit={async ({ id, paymentReference, paymentProofUrl }) => {
            try {
              const updatedBooking = await submitPaymentProof({
                id,
                paymentReference,
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

        {/* Listing Detail Modal */}
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

                      setMyBookings((current) => [nextBooking, ...current]);
                      
                      socket?.emit('booking:request', {
                        hostUid: selectedListingForDetail.hostUid,
                        guestUid: user.uid,
                        listingId: selectedListingForDetail.id,
                        bookingId: nextBooking.id,
                        message: `New booking request for ${selectedListingForDetail.title}`
                      });
                      
                      toast.success("Booking request sent! The host will contact you shortly.");
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

        {/* Review Form Modal */}
        <AnimatePresence>
          {bookingToReview && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface-container-lowest rounded-3xl w-full max-w-xl overflow-hidden shadow-[0_10px_40px_rgba(18,28,42,0.06)]"
              >
                <ReviewForm 
                  booking={bookingToReview} 
                  onClose={() => setBookingToReview(null)} 
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Chat Modal */}
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
                  listing={listings.find(l => l.id === selectedBookingForChat.listingId) || myListings.find(l => l.id === selectedBookingForChat.listingId)!}
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
    <ErrorBoundary>
      <NotificationProvider user={user}>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  );
}
