import { lazy, Suspense, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import HostLayout from '@/components/HostLayout';
import type { Booking, Listing, Referral, UserProfile } from '@/types';

const AccountPage = lazy(() => import('@/pages/AccountPage'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const CreateListing = lazy(() => import('@/pages/CreateListing'));
const ExploreView = lazy(() => import('@/pages/ExploreView'));
const GuestDashboard = lazy(() => import('@/pages/GuestDashboard'));
const HolidayPlanner = lazy(() => import('@/pages/HolidayPlanner'));
const HostAvailability = lazy(() => import('@/pages/HostAvailability'));
const HostDashboard = lazy(() => import('@/pages/HostDashboard'));
const HostEnquiries = lazy(() => import('@/pages/HostEnquiries'));
const HostInbox = lazy(() => import('@/pages/HostInbox'));
const HostListings = lazy(() => import('@/pages/HostListings'));
const HostReports = lazy(() => import('@/pages/HostReports'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const ReferralView = lazy(() => import('@/pages/ReferralView'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const SocialDashboard = lazy(() => import('@/pages/SocialDashboard'));

function RouteLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-outline-variant" />
    </div>
  );
}

function RequireAuthRoute({ profile, children }: { profile: UserProfile | null; children: ReactElement }) {
  if (!profile) {
    return <Navigate to="/signup" replace />;
  }

  return children;
}

type AppRoutesProps = {
  hostBookings: Booking[];
  isAdmin: boolean;
  listings: Listing[];
  myBookings: Booking[];
  myListings: Listing[];
  onBookingForPaymentProof: (booking: Booking) => void;
  onBookingToReview: (booking: Booking) => void;
  onListingRemoved: (listingId: string) => void;
  onListingSelected: (listing: Listing) => void;
  onListingUpdated: (listing: Listing) => void;
  onSelectedBookingForChat: (booking: Booking) => void;
  onSyncUpdatedBooking: (booking: Booking) => void;
  profile: UserProfile | null;
  referrals: Referral[];
};

export default function AppRoutes({
  hostBookings,
  isAdmin,
  listings,
  myBookings,
  myListings,
  onBookingForPaymentProof,
  onBookingToReview,
  onListingRemoved,
  onListingSelected,
  onListingUpdated,
  onSelectedBookingForChat,
  onSyncUpdatedBooking,
  profile,
  referrals,
}: AppRoutesProps) {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<ExploreView listings={listings} onBook={onListingSelected} />} />
        <Route
          path="/host"
          element={profile?.role === 'host' ? <HostLayout /> : <Navigate to="/" />}
        >
          <Route
            index
            element={
              <HostDashboard
                profile={profile}
                listings={myListings}
                bookings={hostBookings}
                onUpgrade={() => navigate('/pricing')}
                onChat={onSelectedBookingForChat}
                onBookingUpdated={onSyncUpdatedBooking}
              />
            }
          />
          <Route path="inbox" element={<HostInbox bookings={hostBookings} listings={myListings} onChat={onSelectedBookingForChat} />} />
          <Route path="enquiries" element={<HostEnquiries bookings={hostBookings} listings={myListings} onChat={onSelectedBookingForChat} onBookingUpdated={onSyncUpdatedBooking} />} />
          <Route path="listings" element={<HostListings listings={myListings} onListingUpdated={onListingUpdated} onListingRemoved={onListingRemoved} />} />
          <Route path="availability" element={<HostAvailability listings={myListings} bookings={hostBookings} onListingUpdated={onListingUpdated} />} />
          <Route path="reports" element={<HostReports bookings={hostBookings} listings={myListings} />} />
          <Route path="social" element={<SocialDashboard listings={myListings} />} />
          <Route path="referrals" element={<ReferralView profile={profile} referrals={referrals} />} />
          <Route path="create-listing" element={<CreateListing />} />
          <Route path="edit-listing/:id" element={<CreateListing />} />
          <Route path="*" element={<Navigate to="/host" />} />
        </Route>
        <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} />
        <Route path="/planner" element={<HolidayPlanner />} />
        <Route
          path="/guest"
          element={
            <RequireAuthRoute profile={profile}>
              <GuestDashboard
                profile={profile}
                bookings={myBookings}
                listings={listings}
                onReview={onBookingToReview}
                onExplore={() => navigate('/')}
                onChat={onSelectedBookingForChat}
                onSubmitPaymentProof={onBookingForPaymentProof}
              />
            </RequireAuthRoute>
          }
        />
        <Route path="/referral" element={<RequireAuthRoute profile={profile}><ReferralView profile={profile} referrals={referrals} /></RequireAuthRoute>} />
        <Route path="/account" element={<RequireAuthRoute profile={profile}><AccountPage /></RequireAuthRoute>} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pricing" element={<PricingPage onBack={() => navigate('/host')} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
