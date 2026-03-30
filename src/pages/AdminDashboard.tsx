import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  MessageSquare, 
  Home, 
  Star, 
  Share2, 
  Gift, 
  DollarSign, 
  Bell, 
  Settings, 
  LogOut,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  MoreHorizontal,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  MapPin,
  Trash2,
  Plus,
  Send,
  Download,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Listing, Booking, UserProfile, Referral, Review, Subscription, Notification, PlatformSettings } from '@/types';
import {
  type AdminCheckout,
  createAdminNotification,
  createAdminReferralReward,
  deleteAdminNotification,
  deleteAdminReferralReward,
  deleteAdminReview,
  deleteAdminUser,
  getAdminPlatformSettings,
  listAdminBookings,
  listAdminCheckouts,
  listAdminListings,
  listAdminNotifications,
  listAdminReferralRewards,
  listAdminReviews,
  listAdminSubscriptions,
  listAdminUsers,
  updateAdminPlatformSettings,
  updateAdminUser,
} from '@/lib/admin-client';
import { getKycSubmissionAssets, listKycSubmissions, reviewKycSubmission, type KycSubmission } from '@/lib/ops-client';
import { setUserKycStatus } from '@/lib/identity-client';
import { getClient } from '@/lib/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { formatRand } from '@/lib/currency';
import { format, subMonths } from 'date-fns';

type KycReviewState = KycSubmission & {
  user?: UserProfile | null;
  idImageUrl?: string;
  selfieImageUrl?: string;
};

function toListingPayload(listing: Listing, status = listing.status) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    area: listing.area,
    province: listing.province,
    category: listing.category,
    type: listing.type,
    pricePerNight: listing.pricePerNight,
    discount: listing.discount,
    amenities: listing.amenities,
    facilities: listing.facilities,
    other_facility: listing.other_facility,
    restaurant_offers: listing.restaurant_offers,
    images: listing.images,
    video_url: listing.video_url,
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    is_self_catering: listing.is_self_catering,
    has_restaurant: listing.has_restaurant,
    is_occupied: listing.is_occupied,
    coordinates: listing.coordinates || null,
    blockedDates: listing.blockedDates || [],
    status,
  };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeListings: 0,
    totalEnquiries: 0,
    pendingReviews: 0
  });
  const [recentEnquiries, setRecentEnquiries] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [topListings, setTopListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [allCheckouts, setAllCheckouts] = useState<AdminCheckout[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualReferrerEmail, setManualReferrerEmail] = useState('');
  const [manualRefereeEmail, setManualRefereeEmail] = useState('');
  const [referralFilter, setReferralFilter] = useState<'all' | 'pending' | 'confirmed' | 'rewarded'>('all');
  const [referralTab, setReferralTab] = useState<'guest' | 'host'>('guest');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [kycSubmissions, setKycSubmissions] = useState<KycSubmission[]>([]);
  const [viewingKYCSubmission, setViewingKYCSubmission] = useState<KycReviewState | null>(null);
  const [kycAssetsLoading, setKycAssetsLoading] = useState(false);
  const [rejectingKycSubmission, setRejectingKycSubmission] = useState<KycReviewState | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState('Documents were unclear or incomplete.');
  const [isRejectingKyc, setIsRejectingKyc] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listAdminUsers(),
      listAdminListings(),
      listAdminBookings(),
      listAdminReviews(),
      listAdminReferralRewards(),
      listAdminSubscriptions(),
      listAdminCheckouts(),
      listAdminNotifications(),
      getAdminPlatformSettings(),
    ]).then(([users, listings, bookings, reviews, referrals, subscriptions, checkouts, notifications, settings]) => {
      if (cancelled) return;

      setAllUsers(users);
      setAllListings(listings);
      setAllBookings(bookings);
      setAllReviews(reviews);
      setAllReferrals(referrals);
      setAllSubscriptions(subscriptions);
      setAllCheckouts(checkouts);
      setAllNotifications(notifications);
      setPlatformSettings(settings);
      setRecentEnquiries([...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
      setTopListings([...listings].filter((listing) => listing.status === 'active').slice(0, 5));
      setStats({
        totalUsers: users.length,
        activeListings: listings.filter((listing) => listing.status === 'active').length,
        totalEnquiries: bookings.length,
        pendingReviews: reviews.filter((review) => review.status === 'pending').length,
      });
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to load admin core data', error);
      toast({ title: 'Admin data failed', description: 'Could not load admin dashboard data.', variant: 'destructive' });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    listKycSubmissions()
      .then(setKycSubmissions)
      .catch((error) => {
        console.error('Failed to load KYC submissions', error);
        toast({ title: 'KYC load failed', description: 'Could not load KYC submissions.', variant: 'destructive' });
      });
  }, [profile?.role, toast]);

  const handleUpdateUserRole = async (uid: string, newRole: string) => {
    console.log('Updating user role:', { uid, newRole });
    try {
      const updatedUser = await updateAdminUser({ userId: uid, role: newRole as UserProfile['role'] });
      setAllUsers((current) => current.map((user) => user.uid === uid ? updatedUser : user));
      toast({ title: "Role Updated", description: "User role updated successfully." });
    } catch (err) {
      console.error('Error updating user role:', err);
      toast({ title: 'Role update failed', description: 'Could not update the user role.', variant: 'destructive' });
    }
  };

  const handleUpdateListingStatus = async (id: string, newStatus: string) => {
    console.log('Updating listing status:', { id, newStatus });
    try {
      const listing = allListings.find((item) => item.id === id);
      if (!listing) return;
      await getClient.hospitality.saveListing(toListingPayload(listing, newStatus as Listing['status']));
      setAllListings((current) => current.map((item) => item.id === id ? { ...item, status: newStatus as Listing['status'] } : item));
      setTopListings((current) => current.map((item) => item.id === id ? { ...item, status: newStatus as Listing['status'] } : item).filter((item) => item.status === 'active').slice(0, 5));
      setStats((current) => ({
        ...current,
        activeListings: allListings.map((item) => item.id === id ? { ...item, status: newStatus as Listing['status'] } : item).filter((item) => item.status === 'active').length,
      }));
      toast({ title: "Status Updated", description: `Listing status updated to ${newStatus}.` });
    } catch (err) {
      console.error('Error updating listing status:', err);
      toast({ title: 'Listing update failed', description: 'Could not update the listing status.', variant: 'destructive' });
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'listing' | 'review' | 'referral' | 'notification', id: string } | null>(null);

  const handleDeleteUser = async (uid: string) => {
    console.log('Deleting user:', uid);
    try {
      await deleteAdminUser(uid);
      setAllUsers((current) => current.filter((user) => user.uid !== uid));
      setStats((current) => ({
        ...current,
        totalUsers: current.totalUsers - 1,
      }));
      toast({
        title: "User Deleted",
        description: "User has been removed from the system.",
      });
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      toast({ title: 'User delete failed', description: 'Could not remove the user.', variant: 'destructive' });
    }
  };

  const handleDeleteListing = async (id: string) => {
    console.log('Deleting listing:', id);
    try {
      const listing = allListings.find((item) => item.id === id);
      if (!listing) return;
      await getClient.hospitality.saveListing(toListingPayload(listing, 'archived'));
      setAllListings((current) => current.filter((item) => item.id !== id));
      setTopListings((current) => current.filter((item) => item.id !== id));
      setStats((current) => ({
        ...current,
        activeListings: allListings.filter((item) => item.id !== id && item.status === 'active').length,
      }));
      toast({ title: "Listing Deleted", description: "Listing has been removed." });
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting listing:', err);
      toast({ title: 'Listing delete failed', description: 'Could not archive the listing.', variant: 'destructive' });
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      await deleteAdminReview(id);
      setAllReviews((current) => current.filter((review) => review.id !== id));
      setStats((current) => ({
        ...current,
        pendingReviews: allReviews.filter((review) => review.id !== id && review.status === 'pending').length,
      }));
      toast({ title: "Review Deleted", description: "Review has been removed." });
    } catch (err) {
      toast({ title: 'Review delete failed', description: 'Could not delete the review.', variant: 'destructive' });
    }
  };

  const handleDeleteReferral = async (id: string) => {
    try {
      await deleteAdminReferralReward(id);
      setAllReferrals((current) => current.filter((referral) => referral.id !== id));
      toast({ title: "Referral Deleted", description: "Referral record has been removed." });
    } catch (err) {
      toast({ title: 'Referral delete failed', description: 'Could not remove the referral.', variant: 'destructive' });
    }
  };

  const handleSendNotification = async (title: string, message: string, type: Notification['type'], target: Notification['target']) => {
    try {
      const notification = await createAdminNotification({
        title,
        message,
        type,
        target,
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({
        title: "Notification Sent",
        description: `Message sent to ${target} successfully.`,
      });
    } catch (err) {
      toast({ title: 'Notification failed', description: 'Could not send the notification.', variant: 'destructive' });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteAdminNotification(id);
      setAllNotifications((current) => current.filter((notification) => notification.id !== id));
      toast({ title: "Notification Deleted", description: "Notification has been removed." });
    } catch (err) {
      toast({ title: 'Notification delete failed', description: 'Could not remove the notification.', variant: 'destructive' });
    }
  };

  const handleUpdateSettings = async (settings: Partial<PlatformSettings>) => {
    try {
      const updatedSettings = await updateAdminPlatformSettings(settings);
      setPlatformSettings(updatedSettings);
      toast({
        title: "Settings Updated",
        description: "Platform configuration has been saved.",
      });
    } catch (err) {
      toast({ title: 'Settings update failed', description: 'Could not save platform settings.', variant: 'destructive' });
    }
  };

  const handleUpdateUser = async (user: UserProfile) => {
    try {
      const updatedUser = await updateAdminUser({
        userId: user.uid,
        displayName: user.displayName,
        role: user.role,
        hostPlan: user.host_plan,
        kycStatus: user.kycStatus,
        balance: user.balance,
        tier: user.tier,
      });
      setAllUsers((current) => current.map((item) => item.uid === user.uid ? updatedUser : item));
      const notification = await createAdminNotification({
        title: 'Profile Updated',
        message: 'Your profile has been updated by an administrator.',
        type: 'info',
        target: user.uid,
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: "User Updated", description: "User profile updated and notification sent." });
      setEditingUser(null);
    } catch (err) {
      toast({ title: 'User update failed', description: 'Could not update the user.', variant: 'destructive' });
    }
  };

  const handleUpdateListing = async (listing: Listing) => {
    try {
      await getClient.hospitality.saveListing(toListingPayload(listing));
      setAllListings((current) => current.map((item) => item.id === listing.id ? listing : item));
      const notification = await createAdminNotification({
        title: 'Listing Updated',
        message: `Your listing "${listing.title}" has been updated by an administrator.`,
        type: 'info',
        target: listing.hostUid,
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: "Listing Updated", description: "Listing updated and notification sent." });
      setEditingListing(null);
    } catch (err) {
      toast({ title: 'Listing update failed', description: 'Could not update the listing.', variant: 'destructive' });
    }
  };

  const handleApproveKYC = async (uid: string) => {
    try {
      await reviewKycSubmission({ userId: uid, status: 'verified' });
      await setUserKycStatus({ userId: uid, kycStatus: 'verified' });
      const notification = await createAdminNotification({
        title: 'Verification Approved',
        message: 'Your identity verification has been approved. You can now start listing properties.',
        type: 'success',
        target: uid,
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: "Verification Approved", description: "User has been verified." });
      setViewingKYCSubmission(null);
      setKycSubmissions((current) => current.filter((submission) => submission.userId !== uid));
    } catch (err) {
      console.error('Failed to approve KYC submission', err);
      toast({ title: 'Approval failed', description: 'Could not approve this KYC submission.', variant: 'destructive' });
    }
  };

  const openRejectKycDialog = (submission: KycReviewState) => {
    setRejectingKycSubmission(submission);
    setKycRejectionReason(submission.rejectionReason || 'Documents were unclear or incomplete.');
  };

  const handleRejectKYC = async () => {
    if (!rejectingKycSubmission) return;

    setIsRejectingKyc(true);
    try {
      await reviewKycSubmission({
        userId: rejectingKycSubmission.userId,
        status: 'rejected',
        rejectionReason: kycRejectionReason.trim() || 'Rejected during review.',
      });
      await setUserKycStatus({ userId: rejectingKycSubmission.userId, kycStatus: 'rejected' });
      const notification = await createAdminNotification({
        title: 'Verification Rejected',
        message: 'Your identity verification was rejected. Please re-submit clearer documents.',
        type: 'error',
        target: rejectingKycSubmission.userId,
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: "Verification Rejected", description: "User verification has been rejected." });
      setViewingKYCSubmission(null);
      setRejectingKycSubmission(null);
      setKycSubmissions((current) => current.filter((submission) => submission.userId !== rejectingKycSubmission.userId));
    } catch (err) {
      console.error('Failed to reject KYC submission', err);
      toast({ title: 'Rejection failed', description: 'Could not reject this KYC submission.', variant: 'destructive' });
    } finally {
      setIsRejectingKyc(false);
    }
  };

  const handleReviewKYC = async (submission: KycSubmission) => {
    const user = allUsers.find((candidate) => candidate.uid === submission.userId) || null;
    setViewingKYCSubmission({ ...submission, user });
    setKycAssetsLoading(true);

    try {
      const assets = await getKycSubmissionAssets(submission.userId);
      setViewingKYCSubmission((current) => current && current.userId === submission.userId
        ? { ...current, ...assets, user }
        : current);
    } catch (error) {
      console.error('Failed to load KYC asset previews', error);
      toast({ title: 'Preview load failed', description: 'Could not load secure KYC previews.', variant: 'destructive' });
    } finally {
      setKycAssetsLoading(false);
    }
  };

  const handleCreateManualReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReferrerEmail || !manualRefereeEmail) return;

    try {
      const referrer = allUsers.find(u => u.email.toLowerCase() === manualReferrerEmail.toLowerCase());
      const referee = allUsers.find(u => u.email.toLowerCase() === manualRefereeEmail.toLowerCase());

      if (!referrer || !referee) {
        toast({
          title: "Error",
          description: "One or both emails do not exist in the system profiles.",
        });
        return;
      }

      const referral = await createAdminReferralReward({
        referrerId: referrer.uid,
        referredUserId: referee.uid,
        amount: platformSettings?.referralRewardAmount || 50,
        trigger: 'signup',
        status: 'pending',
      });
      setAllReferrals((current) => [referral, ...current]);

      toast({
        title: "Success",
        description: "Manual referral created successfully.",
      });
      setManualReferrerEmail('');
      setManualRefereeEmail('');
    } catch (err) {
      toast({ title: 'Referral failed', description: 'Could not create the referral.', variant: 'destructive' });
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, section: 'MAIN MENU' },
    { id: 'pending', label: 'Pending Listings', icon: ClipboardList, section: 'MAIN MENU' },
    { id: 'kyc', label: 'KYC Verification', icon: ShieldCheck, section: 'MAIN MENU' },
    { id: 'users', label: 'Users', icon: Users, section: 'MAIN MENU' },
    { id: 'enquiries', label: 'Enquiries', icon: MessageSquare, section: 'MAIN MENU' },
    { id: 'listings', label: 'Listings', icon: Home, section: 'MAIN MENU' },
    { id: 'reviews', label: 'Reviews', icon: Star, section: 'MAIN MENU' },
    { id: 'referrals', label: 'Referrals', icon: Share2, section: 'MAIN MENU' },
    { id: 'rewards', label: 'Rewards', icon: Gift, section: 'MANAGEMENT' },
    { id: 'financials', label: 'Financials', icon: DollarSign, section: 'MANAGEMENT' },
    { id: 'notifications', label: 'Notifications', icon: Bell, section: 'MANAGEMENT' },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'MANAGEMENT' },
  ];

  const renderOverview = () => {
    const platformGrowthData = Array.from({ length: 6 }).map((_, index) => {
      const month = subMonths(new Date(), 5 - index);
      const monthKey = format(month, 'yyyy-MM');
      return {
        name: format(month, 'MM'),
        value: allBookings.filter((booking) => format(new Date(booking.createdAt), 'yyyy-MM') === monthKey).length,
      };
    });

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Dashboard Overview</h1>
          <p className="text-[#5e6064]">Welcome back, Admin. Here's what's happening today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Users" 
            value={stats.totalUsers} 
            icon={Users} 
            iconBg="bg-blue-50" 
            iconColor="text-blue-600" 
          />
          <StatCard 
            title="Active Listings" 
            value={stats.activeListings} 
            icon={Home} 
            iconBg="bg-green-50" 
            iconColor="text-green-600" 
          />
          <StatCard 
            title="Total Enquiries" 
            value={stats.totalEnquiries} 
            icon={MessageSquare} 
            iconBg="bg-purple-50" 
            iconColor="text-purple-600" 
          />
          <StatCard 
            title="Pending Reviews" 
            value={stats.pendingReviews} 
            icon={Star} 
            iconBg="bg-yellow-50" 
            iconColor="text-yellow-600" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2 p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Platform Growth</h2>
              <select className="text-xs font-bold bg-slate-100 rounded-md px-2 py-1 border-none">
                <option>Last 6 Months</option>
                <option>Last Year</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {platformGrowthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === platformGrowthData.length - 1 ? '#0f172a' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Instrumentation Status */}
          <Card className="p-8 bg-[#0f172a] text-white space-y-8">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Operational Coverage</h2>
              <p className="text-slate-400 text-xs">What the admin surface can actually trust right now.</p>
            </div>
             
            <div className="space-y-6">
              <div className="space-y-2 rounded-2xl border border-slate-800 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live signals</p>
                <p className="text-2xl font-bold">{allNotifications.length}</p>
                <p className="text-sm text-slate-300">Stored admin notifications</p>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-800 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Manual review queue</p>
                <p className="text-2xl font-bold">{kycSubmissions.length}</p>
                <p className="text-sm text-slate-300">KYC submissions waiting on human review</p>
              </div>
              <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Missing instrumentation</p>
                <p className="text-sm text-amber-100">
                  Uptime, latency, database load, and error-rate metrics are not wired into this repo yet. Treat infra health as unknown until observability is connected.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-medium text-slate-300">Operational telemetry still needs real observability wiring.</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Recent Enquiries</h2>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveMenu('enquiries')}>View All</Button>
            </div>
            <div className="space-y-4">
              {recentEnquiries.map((enquiry) => {
                const listing = allListings.find(l => l.id === enquiry.listingId);
                return (
                  <div key={enquiry.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <MessageSquare className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{listing?.title || 'Property Enquiry'}</p>
                        <p className="text-xs text-slate-500">{new Date(enquiry.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant={enquiry.status === 'confirmed' ? 'success' : 'warning'} className="text-[10px] uppercase">
                      {enquiry.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Top Performing</h2>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveMenu('listings')}>View All</Button>
            </div>
            <div className="space-y-4">
              {topListings.map((listing) => (
                <div key={listing.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <img src={listing.images[0]} className="w-12 h-12 rounded-xl object-cover" alt="" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{listing.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-bold text-slate-600">{listing.rating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{formatRand(listing.pricePerNight)}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Per Night</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    const filteredUsers = allUsers.filter(u => 
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">User Management</h1>
            <p className="text-[#5e6064]">Manage platform users and their roles.</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search users..." 
              className="pl-10 h-10 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">KYC Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stats</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={user.photoURL} className="w-10 h-10 rounded-full border border-slate-100" alt="" referrerPolicy="no-referrer" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className="text-xs font-bold bg-slate-100 rounded-md px-2 py-1 border-none focus:ring-2 focus:ring-primary"
                        value={user.role}
                        onChange={(e) => handleUpdateUserRole(user.uid, e.target.value)}
                      >
                        <option value="guest">Guest</option>
                        <option value="host">Host</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        variant={
                          user.kycStatus === 'verified' ? 'success' : 
                          user.kycStatus === 'pending' ? 'warning' : 
                          user.kycStatus === 'rejected' ? 'danger' : 
                          'neutral'
                        } 
                        className="text-[10px] uppercase"
                      >
                        {user.kycStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <p><span className="text-slate-400">Referrals:</span> {user.referralCount}</p>
                    <p><span className="text-slate-400">Balance:</span> {formatRand(user.balance)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {user.kycStatus === 'pending' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-8 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => {
                            const submission = kycSubmissions.find((item) => item.userId === user.uid);
                            if (submission) {
                              handleReviewKYC(submission);
                            }
                          }}
                        >
                          Review KYC
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-blue-500" 
                        onClick={() => {
                          console.log('Edit user clicked:', user.uid);
                          setEditingUser(user);
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-red-500" 
                        onClick={() => {
                          console.log('Delete user clicked:', user.uid);
                          setConfirmDelete({ type: 'user', id: user.uid });
                        }}
                      >
                        Delete
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => {
                          console.log('View profile clicked for user:', user.uid);
                          navigate(`/account?uid=${user.uid}`);
                        }}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderListings = () => {
    const filteredListings = allListings.filter(l => 
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Listing Management</h1>
            <p className="text-[#5e6064]">Monitor and moderate all property listings.</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search listings..." 
              className="pl-10 h-10 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Host</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredListings.map((listing) => {
                  const host = allUsers.find(u => u.uid === listing.hostUid);
                  return (
                    <tr key={listing.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={listing.images[0]} className="w-12 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{listing.title}</p>
                            <p className="text-xs text-slate-500">{listing.location}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{host?.displayName || 'Unknown Host'}</p>
                        <p className="text-[10px] text-slate-400">{listing.hostUid.slice(0, 8)}...</p>
                      </td>
                      <td className="px-6 py-4">
                          <p className="text-sm font-bold">{formatRand(listing.pricePerNight)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={listing.status === 'active' ? 'success' : 'neutral'} className="text-[10px] uppercase">
                          {listing.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-8 text-blue-500"
                            onClick={() => {
                              console.log('Edit listing clicked:', listing.id);
                              setEditingListing(listing);
                            }}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-8"
                            onClick={() => {
                              const newStatus = listing.status === 'active' ? 'inactive' : 'active';
                              console.log('Toggle listing status clicked:', { id: listing.id, newStatus });
                              handleUpdateListingStatus(listing.id, newStatus);
                            }}
                          >
                            {listing.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              console.log('Delete listing clicked:', listing.id);
                              setConfirmDelete({ type: 'listing', id: listing.id });
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderEnquiries = () => {
    const filteredBookings = allBookings.filter(b => {
      const listing = allListings.find(l => l.id === b.listingId);
      const guest = allUsers.find(u => u.uid === b.guestUid);
      return (
        listing?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Enquiry Management</h1>
            <p className="text-[#5e6064]">Monitor all booking requests and transactions.</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search enquiries..." 
              className="pl-10 h-10 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Booking ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Guest</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((booking) => {
                  const listing = allListings.find(l => l.id === booking.listingId);
                  const guest = allUsers.find(u => u.uid === booking.guestUid);
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono text-slate-400">#{booking.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{listing?.title || 'Deleted Property'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{guest?.displayName || 'Unknown Guest'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">
                          {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                    <p className="text-sm font-bold">{formatRand(booking.totalPrice)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={
                          booking.status === 'confirmed' ? "success" :
                          booking.status === 'pending' ? "warning" :
                          "neutral"
                        } className="text-[10px] uppercase">
                          {booking.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderPendingListings = () => {
    const pendingListings = allListings.filter(l => l.status === 'inactive');

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Pending Listings</h1>
          <p className="text-[#5e6064]">Review and approve new property listings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingListings.map(listing => {
            const host = allUsers.find(u => u.uid === listing.hostUid);
            return (
              <Card key={listing.id} className="overflow-hidden flex flex-col group">
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src={listing.images[0]} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    alt="" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="warning" className="text-[10px] uppercase">Inactive</Badge>
                  </div>
                </div>
                <div className="p-5 flex-1 space-y-4">
                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-1">{listing.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {listing.location}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <img src={host?.photoURL} className="w-8 h-8 rounded-full border border-white" alt="" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-xs font-bold">{host?.displayName}</p>
                      <p className="text-[10px] text-slate-400">Host</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      className="flex-1 h-9 text-xs"
                      onClick={() => handleUpdateListingStatus(listing.id, 'active')}
                    >
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 h-9 text-xs"
                      onClick={() => handleDeleteListing(listing.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {pendingListings.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto opacity-20" />
              <p className="text-slate-400 italic">No pending listings to review.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReferrals = () => {
    const filteredReferrals = allReferrals.filter(ref => {
      const referrer = allUsers.find(u => u.uid === ref.referrerUid);
      const referred = allUsers.find(u => u.uid === ref.referredUid);
      
      const matchesSearch = 
        referrer?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referred?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referrer?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referred?.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = referralTab === 'guest' ? ref.type === 'signup' : ref.type === 'booking';
      const matchesFilter = referralFilter === 'all' || ref.status === referralFilter;

      return matchesSearch && matchesTab && matchesFilter;
    });

    const counts = {
      all: allReferrals.filter(r => (referralTab === 'guest' ? r.type === 'signup' : r.type === 'booking')).length,
      pending: allReferrals.filter(r => (referralTab === 'guest' ? r.type === 'signup' : r.type === 'booking') && r.status === 'pending').length,
      confirmed: allReferrals.filter(r => (referralTab === 'guest' ? r.type === 'signup' : r.type === 'booking') && r.status === 'confirmed').length,
      rewarded: allReferrals.filter(r => (referralTab === 'guest' ? r.type === 'signup' : r.type === 'booking') && r.status === 'rewarded').length,
    };

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Referral Management</h1>
            <p className="text-[#5e6064]">Track and manage user referrals.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search referrals..." 
                className="pl-10 h-10 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 w-fit rounded-xl">
          <button 
            onClick={() => setReferralTab('guest')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-all",
              referralTab === 'guest' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Guest Referrals
          </button>
          <button 
            onClick={() => setReferralTab('host')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-all",
              referralTab === 'host' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Host Referrals
          </button>
        </div>

        <div className="flex items-center gap-3">
          {(['all', 'pending', 'confirmed', 'rewarded'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setReferralFilter(filter)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                referralFilter === filter 
                  ? "bg-[#1a1c23] text-white" 
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
              )}
            >
              <span className="capitalize">{filter}</span>
              {filter !== 'all' && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  referralFilter === filter ? "bg-white/20" : "bg-slate-100"
                )}>
                  {counts[filter]}
                </span>
              )}
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="w-12 px-6 py-4">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Referrer</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Referee</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReferrals.map((ref) => {
                  const referrer = allUsers.find(u => u.uid === ref.referrerUid);
                  const referred = allUsers.find(u => u.uid === ref.referredUid);
                  return (
                    <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded border-slate-300" />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{referrer?.displayName || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">{referrer?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">{referred?.displayName || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">{referred?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant={
                            ref.status === 'rewarded' ? 'success' : 
                            ref.status === 'confirmed' ? 'secondary' : 
                            'warning'
                          } 
                          className="text-[10px] uppercase font-bold"
                        >
                          {ref.status || 'pending'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">{new Date(ref.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 h-8"
                          onClick={() => setConfirmDelete({ type: 'referral', id: ref.id })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredReferrals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                      No referrals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <p className="text-xs text-slate-500">
              Showing {filteredReferrals.length > 0 ? 1 : 0} to {filteredReferrals.length} of {filteredReferrals.length} referrals
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1" disabled>
                <ChevronLeft className="w-3 h-3" /> Previous
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1" disabled>
                Next <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Create Manual Referral</h2>
          <form onSubmit={handleCreateManualReferral} className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Referrer Email</label>
              <Input 
                placeholder="referrer@example.com" 
                value={manualReferrerEmail}
                onChange={(e) => setManualReferrerEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Referee Email</label>
              <Input 
                placeholder="referee@example.com" 
                value={manualRefereeEmail}
                onChange={(e) => setManualRefereeEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="h-10 px-6 gap-2">
              <Plus className="w-4 h-4" /> Create Referral
            </Button>
          </form>
          <p className="text-xs text-slate-400 italic">Both emails must exist in the system profiles.</p>
        </Card>
      </div>
    );
  };

  const renderRewards = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Reward Tiers</h1>
          <p className="text-[#5e6064]">Configure referral tiers and reward multipliers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { tier: 'Bronze', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: '🥉', referrals: '0-5', multiplier: '1.0x' },
            { tier: 'Silver', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: '🥈', referrals: '6-15', multiplier: '1.2x' },
            { tier: 'Gold', color: 'bg-yellow-50 text-yellow-600 border-yellow-100', icon: '🥇', referrals: '16+', multiplier: '1.5x' },
          ].map((item) => (
            <Card key={item.tier} className={cn("p-8 border-2 space-y-6", item.color)}>
              <div className="text-4xl">{item.icon}</div>
              <div>
                <h3 className="text-2xl font-bold">{item.tier} Tier</h3>
                <p className="text-sm opacity-80">Referral Requirement: {item.referrals}</p>
              </div>
              <div className="pt-4 border-t border-current border-opacity-10">
                <p className="text-xs font-bold uppercase tracking-wider mb-1">Reward Multiplier</p>
                <p className="text-3xl font-black">{item.multiplier}</p>
              </div>
              <Button variant="outline" className="w-full bg-white bg-opacity-50 hover:bg-opacity-100 border-current border-opacity-20">
                Edit Rules
              </Button>
            </Card>
          ))}
        </div>

        <Card className="p-8 space-y-6">
          <h2 className="text-xl font-bold">Tier Distribution</h2>
          <div className="space-y-4">
            {['Bronze', 'Silver', 'Gold'].map(tier => {
              const count = allUsers.filter(u => u.tier?.toLowerCase() === tier.toLowerCase()).length;
              const percentage = allUsers.length > 0 ? (count / allUsers.length) * 100 : 0;
              return (
                <div key={tier} className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{tier}</span>
                    <span>{count} users ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000",
                        tier === 'Bronze' && "bg-orange-500",
                        tier === 'Silver' && "bg-slate-400",
                        tier === 'Gold' && "bg-yellow-500",
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };

  const renderReviews = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Review Management</h1>
          <p className="text-[#5e6064]">Moderate property reviews and guest feedback.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allReviews.map(review => {
            const listing = allListings.find(l => l.id === review.listingId);
            const guest = allUsers.find(u => u.uid === review.guestUid);
            const avgRating = (review.cleanliness + review.accuracy + review.communication + review.location + review.value) / 5;
            
            return (
              <Card key={review.id} className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <img src={guest?.photoURL} className="w-10 h-10 rounded-full border border-slate-100" alt="" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-bold">{guest?.displayName}</p>
                      <p className="text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-bold text-yellow-700">{avgRating.toFixed(1)}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Property</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{listing?.title || 'Deleted Property'}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-sm text-slate-600 italic leading-relaxed">"{review.comment}"</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 text-xs h-8"
                    onClick={() => setConfirmDelete({ type: 'review', id: review.id })}
                  >
                    Delete Review
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFinancials = () => {
    const totalRevenue = allSubscriptions.reduce((acc, curr) => acc + curr.amount, 0);
    const paidCheckouts = allCheckouts.filter((checkout) => checkout.status === 'paid');
    const pendingCheckouts = allCheckouts.filter((checkout) => checkout.status === 'pending');

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Financial Management</h1>
          <p className="text-[#5e6064]">Track subscription revenue, credit top-ups, and the actual payment flow behind them.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-slate-900 text-white">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Revenue</p>
            <h3 className="text-3xl font-bold">R{totalRevenue.toLocaleString()}</h3>
            <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +15% from last month
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Active Subscriptions</p>
            <h3 className="text-3xl font-bold">{allSubscriptions.filter(s => s.status === 'active').length}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Avg. Subscription</p>
            <h3 className="text-3xl font-bold">R{allSubscriptions.length > 0 ? (totalRevenue / allSubscriptions.length).toFixed(2) : '0.00'}</h3>
          </Card>
          <Card className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Pending Checkouts</p>
            <h3 className="text-3xl font-bold">{pendingCheckouts.length}</h3>
            <p className="text-[10px] text-slate-500 mt-2">Paid: {paidCheckouts.length}</p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Host</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allSubscriptions.map((sub) => {
                  const host = allUsers.find(u => u.uid === sub.hostUid);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={host?.photoURL} className="w-8 h-8 rounded-full" alt="" referrerPolicy="no-referrer" />
                          <p className="text-sm font-bold">{host?.displayName || 'Unknown'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">{sub.plan}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold">R{sub.amount}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={sub.status === 'active' ? 'success' : 'neutral'} className="text-[10px] uppercase">
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">{new Date(sub.endDate).toLocaleDateString()}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Yoco Checkout Activity</h2>
              <p className="text-sm text-slate-500">Ops can inspect every platform payment attempt from one place.</p>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase font-bold">
              {allCheckouts.length} total
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Commercial Detail</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider Ref</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allCheckouts.map((checkout) => {
                  const user = allUsers.find((candidate) => candidate.uid === checkout.user_id);
                  const detail = checkout.checkout_type === 'subscription'
                    ? `${checkout.host_plan || 'unknown'} • ${checkout.billing_interval || 'n/a'}`
                    : `${checkout.credit_quantity || 0} credits`;

                  return (
                    <tr key={checkout.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">{user?.displayName || 'Unknown user'}</p>
                          <p className="text-xs text-slate-500">{user?.email || checkout.user_id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {checkout.checkout_type === 'subscription' ? 'Subscription' : 'Credits'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">{detail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">R{checkout.amount}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            checkout.status === 'paid'
                              ? 'success'
                              : checkout.status === 'failed' || checkout.status === 'cancelled'
                                ? 'danger'
                                : 'neutral'
                          }
                          className="text-[10px] uppercase"
                        >
                          {checkout.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="max-w-[180px] truncate text-xs text-slate-500">
                          {checkout.provider_payment_id || checkout.provider_checkout_id || 'Pending provider ref'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">{new Date(checkout.created_at).toLocaleString()}</p>
                      </td>
                    </tr>
                  );
                })}
                {allCheckouts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                      No checkouts yet. As soon as a Yoco checkout is created it will show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderNotifications = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Platform Notifications</h1>
          <p className="text-[#5e6064]">Send announcements and alerts to platform users.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="p-6 h-fit space-y-6 lg:col-span-1">
            <h2 className="text-lg font-bold">Send New Notification</h2>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleSendNotification(
                formData.get('title') as string,
                formData.get('message') as string,
                formData.get('type') as Notification['type'],
                formData.get('target') as Notification['target']
              );
              (e.target as HTMLFormElement).reset();
            }}>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                <Input name="title" placeholder="Announcement Title" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Message</label>
                <textarea 
                  name="message" 
                  className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Type your message here..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                  <select name="type" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Target</label>
                  <select name="target" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm">
                    <option value="all">All Users</option>
                    <option value="hosts">Hosts Only</option>
                    <option value="guests">Guests Only</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full gap-2">
                <Send className="w-4 h-4" /> Send Notification
              </Button>
            </form>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold">Sent History</h2>
            <div className="space-y-4">
              {allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(notif => (
                <Card key={notif.id} className="p-4 flex items-start gap-4 group">
                  <div className={cn(
                    "p-2 rounded-xl",
                    notif.type === 'info' && "bg-blue-50 text-blue-600",
                    notif.type === 'warning' && "bg-yellow-50 text-yellow-600",
                    notif.type === 'success' && "bg-green-50 text-green-600",
                    notif.type === 'error' && "bg-red-50 text-red-600",
                  )}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-sm truncate">{notif.title}</h3>
                      <span className="text-[10px] text-slate-400">{new Date(notif.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="neutral" className="text-[9px] uppercase">{notif.target}</Badge>
                      <Badge variant="neutral" className="text-[9px] uppercase">{notif.type}</Badge>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 text-red-500 h-8"
                    onClick={() => setConfirmDelete({ type: 'notification', id: notif.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
              {allNotifications.length === 0 && (
                <div className="py-20 text-center text-slate-400 italic">No notifications sent yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Platform Settings</h1>
          <p className="text-[#5e6064]">Configure global parameters and business rules.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-8 space-y-8">
            <div className="flex items-center gap-3 text-slate-900">
              <TrendingUp className="w-6 h-6" />
              <h2 className="text-xl font-bold">Referral & Rewards</h2>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Platform Name</label>
                <Input 
                  defaultValue={platformSettings?.platformName || 'My Platform'}
                  onBlur={(e) => handleUpdateSettings({ platformName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Support Email</label>
                <Input 
                  type="email"
                  defaultValue={platformSettings?.supportEmail || 'support@example.com'}
                  onBlur={(e) => handleUpdateSettings({ supportEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Referral Reward Amount (R)</label>
                <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                  <Input 
                    type="number" 
                    className="pl-8"
                    defaultValue={platformSettings?.referralRewardAmount || 50}
                    onBlur={(e) => handleUpdateSettings({ referralRewardAmount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Min. Withdrawal Amount (R)</label>
                <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                  <Input 
                    type="number" 
                    className="pl-8"
                    defaultValue={platformSettings?.minWithdrawalAmount || 100}
                    onBlur={(e) => handleUpdateSettings({ minWithdrawalAmount: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 space-y-8">
            <div className="flex items-center gap-3 text-slate-900">
              <Activity className="w-6 h-6" />
              <h2 className="text-xl font-bold">Platform Rules & Status</h2>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Cancellation Policy (Days before check-in)</label>
                <Input 
                  type="number" 
                  defaultValue={platformSettings?.cancellationPolicyDays || 7}
                  onBlur={(e) => handleUpdateSettings({ cancellationPolicyDays: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Max Guests per Listing</label>
                <Input 
                  type="number" 
                  defaultValue={platformSettings?.maxGuestsPerListing || 10}
                  onBlur={(e) => handleUpdateSettings({ maxGuestsPerListing: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">Enable Reviews</label>
                <input 
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300"
                  defaultChecked={platformSettings?.enableReviews ?? true}
                  onChange={(e) => handleUpdateSettings({ enableReviews: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">Enable Referrals</label>
                <input 
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300"
                  defaultChecked={platformSettings?.enableReferrals ?? true}
                  onChange={(e) => handleUpdateSettings({ enableReferrals: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">Maintenance Mode</label>
                <input 
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300"
                  defaultChecked={platformSettings?.maintenanceMode ?? false}
                  onChange={(e) => handleUpdateSettings({ maintenanceMode: e.target.checked })}
                />
              </div>
            </div>
            
            <div className="pt-8 border-t border-slate-100 space-y-6">
              <h2 className="text-xl font-bold text-slate-900">Business Rules</h2>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Platform Commission (%)</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                  <Input 
                    type="number" 
                    className="pr-8"
                    defaultValue={platformSettings?.commissionRate || 15}
                    onBlur={(e) => handleUpdateSettings({ commissionRate: Number(e.target.value) })}
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">Percentage taken from each booking transaction.</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-blue-900">Last Updated</p>
                    <p className="text-[10px] text-blue-700">
                      {platformSettings?.updatedAt ? new Date(platformSettings.updatedAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderKYC = () => {
    const pendingKYC = kycSubmissions.filter((submission) => submission.status === 'pending');

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">KYC Verification</h1>
            <p className="text-[#5e6064]">Review and approve host identity verifications.</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID Number</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingKYC.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      No pending verification requests.
                    </td>
                  </tr>
                ) : (
                  pendingKYC.map((submission) => {
                    const user = allUsers.find((candidate) => candidate.uid === submission.userId);
                    return (
                    <tr key={submission.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={user?.photoURL || 'https://placehold.co/80x80?text=User'} className="w-10 h-10 rounded-full border border-slate-100 object-cover" alt="" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{user?.displayName || submission.userId}</p>
                            <p className="text-xs text-slate-500">{user?.email || 'Unknown user'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="neutral" className="capitalize">
                          {submission.idType.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{submission.idNumber}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-8 flex items-center gap-1"
                            onClick={() => handleReviewKYC(submission)}
                          >
                            <Eye className="w-3 h-3" /> Review
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="text-xs h-8 bg-green-600 hover:bg-green-700"
                            onClick={() => handleApproveKYC(submission.userId)}
                          >
                            Approve
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="text-xs h-8"
                            onClick={() => openRejectKycDialog({ ...submission })}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* KYC Review Dialog */}
        <Dialog open={!!viewingKYCSubmission} onOpenChange={() => setViewingKYCSubmission(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Review Verification: {viewingKYCSubmission?.user?.displayName || viewingKYCSubmission?.userId}</DialogTitle>
            </DialogHeader>
            {viewingKYCSubmission && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">ID Document ({viewingKYCSubmission.idType.replace('_', ' ')})</p>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200">
                      {kycAssetsLoading ? (
                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50">Loading secure preview...</div>
                      ) : viewingKYCSubmission.idImageUrl ? (
                        <img 
                          src={viewingKYCSubmission.idImageUrl} 
                          className="w-full h-full object-cover cursor-zoom-in" 
                          alt="ID Document" 
                          onClick={() => window.open(viewingKYCSubmission.idImageUrl, '_blank')}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50">Preview unavailable</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Selfie Verification</p>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200">
                      {kycAssetsLoading ? (
                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50">Loading secure preview...</div>
                      ) : viewingKYCSubmission.selfieImageUrl ? (
                        <img 
                          src={viewingKYCSubmission.selfieImageUrl} 
                          className="w-full h-full object-cover cursor-zoom-in" 
                          alt="Selfie" 
                          onClick={() => window.open(viewingKYCSubmission.selfieImageUrl, '_blank')}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50">Preview unavailable</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Full Name</span>
                    <span className="font-bold">{viewingKYCSubmission.user?.displayName || 'Unknown user'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">ID Number</span>
                    <span className="font-bold">{viewingKYCSubmission.idNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Email</span>
                    <span className="font-bold">{viewingKYCSubmission.user?.email || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setViewingKYCSubmission(null)}>Close</Button>
                    <Button variant="destructive" onClick={() => openRejectKycDialog(viewingKYCSubmission!)}>Reject</Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveKYC(viewingKYCSubmission!.userId)}>Approve Verification</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!rejectingKycSubmission} onOpenChange={() => !isRejectingKyc && setRejectingKycSubmission(null)}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Reject Verification</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-on-surface-variant">
                Give the host a concrete reason so they know exactly what to fix before resubmitting.
              </p>
              <Textarea
                value={kycRejectionReason}
                onChange={(event) => setKycRejectionReason(event.target.value)}
                placeholder="Explain what was missing, blurred, or inconsistent."
                className="min-h-[140px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectingKycSubmission(null)} disabled={isRejectingKyc}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRejectKYC} disabled={isRejectingKyc}>
                {isRejectingKyc ? 'Rejecting...' : 'Reject Verification'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.displayName}</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Display Name</label>
                  <Input 
                    value={editingUser.displayName} 
                    onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                  <Input 
                    value={editingUser.email} 
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    >
                      <option value="guest">Guest</option>
                      <option value="host">Host</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">KYC Status</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={editingUser.kycStatus}
                      onChange={(e) => setEditingUser({ ...editingUser, kycStatus: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Balance (R)</label>
                  <Input 
                    type="number"
                    value={editingUser.balance} 
                    onChange={(e) => setEditingUser({ ...editingUser, balance: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={() => handleUpdateUser(editingUser!)}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Listing Dialog */}
        <Dialog open={!!editingListing} onOpenChange={() => setEditingListing(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Listing: {editingListing?.title}</DialogTitle>
            </DialogHeader>
            {editingListing && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                  <Input 
                    value={editingListing.title} 
                    onChange={(e) => setEditingListing({ ...editingListing, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Location</label>
                  <Input 
                    value={editingListing.location} 
                    onChange={(e) => setEditingListing({ ...editingListing, location: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Price per Night (R)</label>
                    <Input 
                      type="number"
                      value={editingListing.pricePerNight} 
                      onChange={(e) => setEditingListing({ ...editingListing, pricePerNight: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={editingListing.status}
                      onChange={(e) => setEditingListing({ ...editingListing, status: e.target.value as any })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                  <textarea 
                    className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm"
                    value={editingListing.description}
                    onChange={(e) => setEditingListing({ ...editingListing, description: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingListing(null)}>Cancel</Button>
              <Button onClick={() => handleUpdateListing(editingListing!)}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-slate-500">
                Are you sure you want to delete this {confirmDelete?.type}? This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirmDelete?.type === 'user') handleDeleteUser(confirmDelete.id);
                  if (confirmDelete?.type === 'listing') handleDeleteListing(confirmDelete.id);
                  if (confirmDelete?.type === 'review') handleDeleteReview(confirmDelete.id);
                  if (confirmDelete?.type === 'referral') handleDeleteReferral(confirmDelete.id);
                  if (confirmDelete?.type === 'notification') handleDeleteNotification(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#fcfcfc] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-100 flex flex-col bg-white z-20">
        <div className="p-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0f172a] rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a]">AdminPanel</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8">
          {['MAIN MENU', 'MANAGEMENT'].map(section => (
            <div key={section} className="space-y-2">
              <h3 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{section}</h3>
              <div className="space-y-1">
                {menuItems.filter(item => item.section === section).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveMenu(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                      activeMenu === item.id 
                        ? "bg-[#1a1c23] text-white shadow-lg shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", activeMenu === item.id ? "text-white" : "text-slate-400")} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Admin User Profile at Bottom */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-10 h-10 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-bold text-xs">
              WI
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500 capitalize">{activeMenu}</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-slate-200 mx-2" />
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs font-bold text-slate-500 hover:text-red-500"
              onClick={() => navigate('/')}
            >
              Exit Admin
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {activeMenu === 'overview' && renderOverview()}
            {activeMenu === 'kyc' && renderKYC()}
            {activeMenu === 'users' && renderUsers()}
            {activeMenu === 'listings' && renderListings()}
            {activeMenu === 'enquiries' && renderEnquiries()}
            {activeMenu === 'pending' && renderPendingListings()}
            {activeMenu === 'referrals' && renderReferrals()}
            {activeMenu === 'rewards' && renderRewards()}
            {activeMenu === 'reviews' && renderReviews()}
            {activeMenu === 'financials' && renderFinancials()}
            {activeMenu === 'notifications' && renderNotifications()}
            {activeMenu === 'settings' && renderSettings()}
            
            {!['overview', 'kyc', 'users', 'listings', 'enquiries', 'pending', 'referrals', 'rewards', 'reviews', 'financials', 'notifications', 'settings'].includes(activeMenu) && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 space-y-4">
                <Activity className="w-12 h-12 opacity-20" />
                <p className="text-lg font-medium italic">The {activeMenu} section is under development.</p>
                <Button variant="outline" onClick={() => setActiveMenu('overview')}>Back to Overview</Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function StatCard({ title, value, trend, isUp, icon: Icon, iconBg, iconColor }: any) {
  return (
    <Card className="p-6 space-y-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</h3>
        </div>
        <div className={cn("p-2.5 rounded-xl", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md",
          isUp ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
        )}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
        <span className="text-[10px] text-slate-400">vs last month</span>
      </div>
    </Card>
  );
}

function HealthMetric({ label, value, max = 100, color }: any) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-slate-400">{label}</span>
        <span className="text-white">{value}{max === 100 ? '%' : 'ms'}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000", color)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
