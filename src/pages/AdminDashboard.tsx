import React, { useState } from 'react';
import {
  Activity,
  Bell,
  ClipboardList,
  DollarSign,
  Gift,
  Home,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Share2,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Listing, Notification, UserProfile } from '@/types';
import {
  createAdminNotification,
  createAdminReferralReward,
  deleteAdminNotification,
  deleteAdminReferralReward,
  deleteAdminReview,
  deleteAdminUser,
  setAdminUserAccountStatus,
  updateAdminUser,
} from '@/lib/admin-client';
import { getKycSubmissionAssets, reviewKycSubmission, type KycSubmission } from '@/lib/ops-client';
import { setUserKycStatus } from '@/lib/identity-client';
import { deleteListing, saveListing } from '@/lib/platform-client';
import { cn } from '@/lib/utils';
import { toListingPayload } from '@/features/admin/dashboard-support';
import { getErrorMessage } from '@/lib/errors';
import {
  EnquiriesSection,
  FinancialsSection,
  KycSection,
  ListingsSection,
  NotificationsSection,
  OverviewSection,
  PendingListingsSection,
  ReferralsSection,
  ReviewsSection,
  RewardsSection,
  SettingsSection,
  UsersSection,
} from '@/features/admin/dashboard-sections';
import { useAdminDashboardData } from '@/features/admin/use-admin-dashboard-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type KycReviewState = KycSubmission & {
  user?: UserProfile | null;
  idImageUrl?: string;
  selfieImageUrl?: string;
};

type KycAssetFailureState = {
  idImage: boolean;
  selfieImage: boolean;
};

type ConfirmDelete = {
  type: 'user' | 'listing' | 'review' | 'referral' | 'notification';
  id: string;
};

type AccountStatusAction = {
  user: UserProfile;
  nextStatus: UserProfile['accountStatus'];
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState('overview');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [viewingKYCSubmission, setViewingKYCSubmission] = useState<KycReviewState | null>(null);
  const [kycAssetsLoading, setKycAssetsLoading] = useState(false);
  const [kycAssetFailures, setKycAssetFailures] = useState<KycAssetFailureState>({ idImage: false, selfieImage: false });
  const [rejectingKycSubmission, setRejectingKycSubmission] = useState<KycReviewState | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState('Documents were unclear or incomplete.');
  const [isRejectingKyc, setIsRejectingKyc] = useState(false);
  const [rejectingListing, setRejectingListing] = useState<Listing | null>(null);
  const [listingRejectionReason, setListingRejectionReason] = useState('Photos or listing details were incomplete.');
  const [isRejectingListing, setIsRejectingListing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(null);
  const [accountStatusAction, setAccountStatusAction] = useState<AccountStatusAction | null>(null);
  const [accountStatusReason, setAccountStatusReason] = useState('');
  const [isUpdatingAccountStatus, setIsUpdatingAccountStatus] = useState(false);

  const {
    stats,
    setStats,
    recentEnquiries,
    allBookings,
    topListings,
    setTopListings,
    allListings,
    setAllListings,
    allUsers,
    setAllUsers,
    allReferrals,
    setAllReferrals,
    allReviews,
    setAllReviews,
    allSubscriptions,
    allCheckouts,
    allNotifications,
    setAllNotifications,
    platformSettings,
    observability,
    kycSubmissions,
    setKycSubmissions,
    handleApproveKyc: handleApproveKYC,
    handleUpdateListingStatus,
    handleUpdateSettings,
    handleUpdateUserRole,
  } = useAdminDashboardData({
    notify: toast,
    profileId: profile?.id,
    profileRole: profile?.role,
  });

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteAdminUser(userId);
      setAllUsers((current) => current.filter((user) => user.id !== userId));
      setStats((current) => ({ ...current, totalUsers: current.totalUsers - 1 }));
      toast({ title: 'User Deleted', description: 'User has been permanently removed from the system.' });
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'User delete failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const openAccountStatusDialog = (user: UserProfile, nextStatus: UserProfile['accountStatus']) => {
    setAccountStatusAction({ user, nextStatus });
    setAccountStatusReason(
      nextStatus === 'active'
        ? ''
        : user.accountStatusReason || (nextStatus === 'suspended' ? 'Policy or compliance review is still open.' : 'This account has been deactivated by an administrator.'),
    );
  };

  const handleUpdateAccountStatus = async () => {
    if (!accountStatusAction) return;

    setIsUpdatingAccountStatus(true);
    try {
      const result = await setAdminUserAccountStatus({
        userId: accountStatusAction.user.id,
        accountStatus: accountStatusAction.nextStatus,
        reason: accountStatusAction.nextStatus === 'active' ? null : accountStatusReason,
      });

      setAllUsers((current) =>
        current.map((user) => (user.id === result.user.id ? result.user : user)),
      );
      if (result.notification) {
        setAllNotifications((current) => [result.notification, ...current]);
      }
      toast({
        title: accountStatusAction.nextStatus === 'active' ? 'Account Reactivated' : 'Account Updated',
        description:
          accountStatusAction.nextStatus === 'active'
            ? 'The user can access the platform again.'
            : `The account is now ${accountStatusAction.nextStatus}.`,
      });
      setAccountStatusAction(null);
      setAccountStatusReason('');
    } catch (error) {
      console.error('Error updating account status:', error);
      toast({
        title: 'Account status update failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingAccountStatus(false);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    try {
      const listingToDelete = allListings.find((item) => item.id === listingId) ?? null;
      await deleteListing(listingId);
      setAllListings((current) => current.filter((item) => item.id !== listingId));
      setTopListings((current) => current.filter((item) => item.id !== listingId));
      setStats((current) => ({
        ...current,
        activeListings:
          listingToDelete?.status === 'active' && current.activeListings > 0
            ? current.activeListings - 1
            : current.activeListings,
      }));
      toast({ title: 'Listing Deleted', description: 'Listing has been permanently removed.' });
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: 'Listing delete failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const openRejectListingDialog = (listing: Listing) => {
    setRejectingListing(listing);
    setListingRejectionReason(listing.rejectionReason || 'Photos or listing details were incomplete.');
  };

  const handleRejectListing = async () => {
    if (!rejectingListing) return;

    setIsRejectingListing(true);
    const rejectionReason = listingRejectionReason.trim() || 'Rejected during admin review.';

    try {
      await saveListing(toListingPayload(rejectingListing, 'rejected', rejectionReason));
      const notification = await createAdminNotification({
        title: 'Listing Rejected',
        message: `Your listing "${rejectingListing.title}" was rejected. Reason: ${rejectionReason}`,
        type: 'error',
        target: rejectingListing.hostId,
        actionPath: '/host/listings',
      });

      setAllNotifications((current) => [notification, ...current]);
      setAllListings((current) =>
        current.map((listing) =>
          listing.id === rejectingListing.id
            ? { ...listing, status: 'rejected', rejectionReason, updatedAt: new Date().toISOString() }
            : listing,
        ),
      );
      setTopListings((current) => current.filter((listing) => listing.id !== rejectingListing.id));
      toast({ title: 'Listing Rejected', description: 'The host has been given the rejection reason.' });
      setRejectingListing(null);
    } catch (error) {
      console.error('Error rejecting listing:', error);
      toast({ title: 'Listing rejection failed', description: 'Could not reject the listing.', variant: 'destructive' });
    } finally {
      setIsRejectingListing(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteAdminReview(reviewId);
      setAllReviews((current) => current.filter((review) => review.id !== reviewId));
      setStats((current) => ({
        ...current,
        pendingReviews: allReviews.filter((review) => review.id !== reviewId && review.status === 'pending').length,
      }));
      toast({ title: 'Review Deleted', description: 'Review has been removed.' });
    } catch (error) {
      toast({ title: 'Review delete failed', description: 'Could not delete the review.', variant: 'destructive' });
    }
  };

  const handleDeleteReferral = async (referralId: string) => {
    try {
      await deleteAdminReferralReward(referralId);
      setAllReferrals((current) => current.filter((referral) => referral.id !== referralId));
      toast({ title: 'Referral Deleted', description: 'Referral record has been removed.' });
    } catch (error) {
      toast({ title: 'Referral delete failed', description: 'Could not remove the referral.', variant: 'destructive' });
    }
  };

  const handleSendNotification = async (
    title: string,
    message: string,
    type: Notification['type'],
    target: Notification['target'],
    actionPath?: string | null,
  ) => {
    try {
      const notification = await createAdminNotification({
        title,
        message,
        type,
        target,
        actionPath: actionPath?.trim() || null,
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: 'Notification Sent', description: `Message sent to ${target} successfully.` });
    } catch (error) {
      toast({ title: 'Notification failed', description: 'Could not send the notification.', variant: 'destructive' });
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteAdminNotification(notificationId);
      setAllNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      toast({ title: 'Notification Deleted', description: 'Notification has been removed.' });
    } catch (error) {
      toast({ title: 'Notification delete failed', description: 'Could not remove the notification.', variant: 'destructive' });
    }
  };

  const handleUpdateUser = async (user: UserProfile) => {
    try {
      const updatedUser = await updateAdminUser({
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        hostPlan: user.hostPlan,
        kycStatus: user.kycStatus,
        balance: user.balance,
        tier: user.tier,
      });
      setAllUsers((current) => current.map((item) => item.id === user.id ? updatedUser : item));
      const notification = await createAdminNotification({
        title: 'Profile Updated',
        message: 'Your profile has been updated by an administrator.',
        type: 'info',
        target: user.id,
        actionPath: '/account',
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: 'User Updated', description: 'User profile updated and notification sent.' });
      setEditingUser(null);
    } catch (error) {
      toast({ title: 'User update failed', description: 'Could not update the user.', variant: 'destructive' });
    }
  };

  const handleUpdateListing = async (listing: Listing) => {
    try {
      await saveListing(toListingPayload(listing));
      setAllListings((current) => current.map((item) => item.id === listing.id ? listing : item));
      const notification = await createAdminNotification({
        title: 'Listing Updated',
        message: `Your listing "${listing.title}" has been updated by an administrator.`,
        type: 'info',
        target: listing.hostId,
        actionPath: '/host/listings',
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: 'Listing Updated', description: 'Listing updated and notification sent.' });
      setEditingListing(null);
    } catch (error) {
      toast({ title: 'Listing update failed', description: 'Could not update the listing.', variant: 'destructive' });
    }
  };

  const openRejectKycDialog = (submission: KycSubmission) => {
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
        actionPath: '/account',
      });
      setAllNotifications((current) => [notification, ...current]);
      toast({ title: 'Verification Rejected', description: 'User verification has been rejected.' });
      setViewingKYCSubmission(null);
      setRejectingKycSubmission(null);
      setKycSubmissions((current) =>
        current.map((submission) =>
          submission.userId === rejectingKycSubmission.userId
            ? {
                ...submission,
                status: 'rejected',
                rejectionReason: kycRejectionReason,
                reviewedAt: new Date().toISOString(),
                reviewerId: profile?.id ?? submission.reviewerId ?? null,
              }
            : submission,
        ),
      );
    } catch (error) {
      console.error('Failed to reject KYC submission', error);
      toast({ title: 'Rejection failed', description: 'Could not reject this KYC submission.', variant: 'destructive' });
    } finally {
      setIsRejectingKyc(false);
    }
  };

  const handleReviewKYC = async (submission: KycSubmission) => {
    const user = allUsers.find((candidate) => candidate.id === submission.userId) || null;
    setViewingKYCSubmission({ ...submission, user });
    setKycAssetsLoading(true);
    setKycAssetFailures({ idImage: false, selfieImage: false });

    try {
      const assets = await getKycSubmissionAssets(submission.userId);
      setViewingKYCSubmission((current) => current && current.userId === submission.userId ? { ...current, ...assets, user } : current);
    } catch (error) {
      console.error('Failed to load KYC asset previews', error);
      toast({ title: 'Preview load failed', description: 'Could not load secure KYC previews.', variant: 'destructive' });
    } finally {
      setKycAssetsLoading(false);
    }
  };

  const handleCreateManualReferral = async ({
    referrerEmail,
    refereeEmail,
    program,
  }: {
    referrerEmail: string;
    refereeEmail: string;
    program: 'guest' | 'host';
  }) => {
    if (!referrerEmail || !refereeEmail) return;

    try {
      const referrer = allUsers.find((user) => user.email.toLowerCase() === referrerEmail.toLowerCase());
      const referee = allUsers.find((user) => user.email.toLowerCase() === refereeEmail.toLowerCase());

      if (!referrer || !referee) {
        toast({ title: 'Error', description: 'One or both emails do not exist in the system profiles.' });
        return;
      }

      const referral = await createAdminReferralReward({
        referrerId: referrer.id,
        referredUserId: referee.id,
        amount: platformSettings?.referralRewardAmount || 50,
        trigger: 'signup',
        program,
      });
      setAllReferrals((current) => [referral, ...current]);
      toast({ title: 'Success', description: 'Manual referral created successfully.' });
    } catch (error) {
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
  ] as const;

  const renderActiveSection = () => {
    switch (activeMenu) {
      case 'overview':
        return <OverviewSection allBookings={allBookings} allListings={allListings} observability={observability} recentEnquiries={recentEnquiries} setActiveMenu={setActiveMenu} stats={stats} topListings={topListings} />;
      case 'pending':
        return <PendingListingsSection allListings={allListings} allUsers={allUsers} openRejectListingDialog={openRejectListingDialog} handleUpdateListingStatus={handleUpdateListingStatus} />;
      case 'kyc':
        return <KycSection allUsers={allUsers} handleApproveKYC={handleApproveKYC} handleReviewKYC={handleReviewKYC} kycSubmissions={kycSubmissions} openRejectKycDialog={openRejectKycDialog} />;
      case 'users':
        return <UsersSection allUsers={allUsers} handleReviewKYC={handleReviewKYC} handleUpdateUserRole={handleUpdateUserRole} kycSubmissions={kycSubmissions} navigate={navigate} openAccountStatusDialog={openAccountStatusDialog} setConfirmDelete={setConfirmDelete} setEditingUser={setEditingUser} />;
      case 'enquiries':
        return <EnquiriesSection allBookings={allBookings} allListings={allListings} allUsers={allUsers} />;
      case 'listings':
        return <ListingsSection allListings={allListings} allUsers={allUsers} handleUpdateListingStatus={handleUpdateListingStatus} setConfirmDelete={setConfirmDelete} setEditingListing={setEditingListing} />;
      case 'reviews':
        return <ReviewsSection allListings={allListings} allReviews={allReviews} allUsers={allUsers} setConfirmDelete={setConfirmDelete} />;
      case 'referrals':
        return <ReferralsSection allReferrals={allReferrals} allUsers={allUsers} handleCreateManualReferral={handleCreateManualReferral} setConfirmDelete={setConfirmDelete} />;
      case 'rewards':
        return <RewardsSection allUsers={allUsers} />;
      case 'financials':
        return <FinancialsSection allCheckouts={allCheckouts} allSubscriptions={allSubscriptions} allUsers={allUsers} />;
      case 'notifications':
        return <NotificationsSection allNotifications={allNotifications} handleSendNotification={handleSendNotification} setConfirmDelete={setConfirmDelete} />;
      case 'settings':
        return <SettingsSection handleUpdateSettings={handleUpdateSettings} platformSettings={platformSettings} />;
      default:
        return (
          <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 text-slate-400">
            <Activity className="h-12 w-12 opacity-20" />
            <p className="text-lg font-medium italic">The {activeMenu} section is under development.</p>
            <Button variant="outline" onClick={() => setActiveMenu('overview')}>Back to Overview</Button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fcfcfc]">
      <aside className="z-20 flex w-64 flex-col border-r border-slate-100 bg-white">
        <div className="flex items-center gap-2 p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f172a]">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0f172a]">AdminPanel</span>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-4 py-4">
          {['MAIN MENU', 'MANAGEMENT'].map((section) => (
            <div key={section} className="space-y-2">
              <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{section}</h3>
              <div className="space-y-1">
                {menuItems.filter((item) => item.section === section).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveMenu(item.id)}
                    className={cn(
                      'w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all flex items-center gap-3',
                      activeMenu === item.id ? 'bg-[#1a1c23] text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                    )}
                  >
                    <item.icon className={cn('h-4 w-4', activeMenu === item.id ? 'text-white' : 'text-slate-400')} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f172a] text-xs font-bold text-white">WI</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">Admin User</p>
              <p className="truncate text-[10px] text-slate-500">{profile?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-8">
          <span className="text-sm font-medium capitalize text-slate-500">{activeMenu}</span>
          <div className="flex items-center gap-6">
            <button className="p-2 text-slate-400 transition-colors hover:text-slate-900"><Bell className="h-5 w-5" /></button>
            <button className="p-2 text-slate-400 transition-colors hover:text-slate-900"><Share2 className="h-5 w-5" /></button>
            <div className="mx-2 h-4 w-px bg-slate-200" />
            <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-500 hover:text-red-500" onClick={() => navigate('/')}>
              Exit Admin
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-7xl">{renderActiveSection()}</div>
        </div>
      </main>

      <Dialog open={!!viewingKYCSubmission} onOpenChange={() => {
        setViewingKYCSubmission(null);
        setKycAssetFailures({ idImage: false, selfieImage: false });
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Review Verification: {viewingKYCSubmission?.user?.displayName || viewingKYCSubmission?.userId}</DialogTitle>
          </DialogHeader>
          {viewingKYCSubmission ? (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-500">ID Document ({viewingKYCSubmission.idType.replace('_', ' ')})</p>
                  <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200">
                    {kycAssetsLoading ? (
                      <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-500">Loading secure preview...</div>
                    ) : viewingKYCSubmission.idImageUrl && !kycAssetFailures.idImage ? (
                      <img
                        src={viewingKYCSubmission.idImageUrl}
                        className="h-full w-full cursor-zoom-in object-cover"
                        alt="ID Document"
                        referrerPolicy="no-referrer"
                        onError={() => setKycAssetFailures((current) => ({ ...current, idImage: true }))}
                        onClick={() => window.open(viewingKYCSubmission.idImageUrl, '_blank', 'noopener,noreferrer')}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-500">Preview unavailable</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-500">Selfie Verification</p>
                  <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200">
                    {kycAssetsLoading ? (
                      <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-500">Loading secure preview...</div>
                    ) : viewingKYCSubmission.selfieImageUrl && !kycAssetFailures.selfieImage ? (
                      <img
                        src={viewingKYCSubmission.selfieImageUrl}
                        className="h-full w-full cursor-zoom-in object-cover"
                        alt="Selfie"
                        referrerPolicy="no-referrer"
                        onError={() => setKycAssetFailures((current) => ({ ...current, selfieImage: true }))}
                        onClick={() => window.open(viewingKYCSubmission.selfieImageUrl, '_blank', 'noopener,noreferrer')}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-500">Preview unavailable</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Full Name</span><span className="font-bold">{viewingKYCSubmission.user?.displayName || 'Unknown user'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">ID Number</span><span className="font-bold">{viewingKYCSubmission.idNumber}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Email</span><span className="font-bold">{viewingKYCSubmission.user?.email || 'Unknown'}</span></div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setViewingKYCSubmission(null)}>Close</Button>
            <Button variant="destructive" onClick={() => openRejectKycDialog(viewingKYCSubmission!)}>Reject</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveKYC(viewingKYCSubmission!.userId)}>Approve Verification</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectingKycSubmission} onOpenChange={() => !isRejectingKyc && setRejectingKycSubmission(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Reject Verification</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-on-surface-variant">Give the host a concrete reason so they know exactly what to fix before resubmitting.</p>
            <Textarea value={kycRejectionReason} onChange={(event) => setKycRejectionReason(event.target.value)} placeholder="Explain what was missing, blurred, or inconsistent." className="min-h-[140px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingKycSubmission(null)} disabled={isRejectingKyc}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectKYC} disabled={isRejectingKyc}>{isRejectingKyc ? 'Rejecting...' : 'Reject Verification'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectingListing} onOpenChange={() => !isRejectingListing && setRejectingListing(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Reject Listing</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-on-surface-variant">Give the host a direct reason so they know what to fix before resubmitting this listing.</p>
            <Textarea
              value={listingRejectionReason}
              onChange={(event) => setListingRejectionReason(event.target.value)}
              placeholder="Explain what is missing, misleading, low quality, or non-compliant."
              className="min-h-[140px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingListing(null)} disabled={isRejectingListing}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectListing} disabled={isRejectingListing}>
              {isRejectingListing ? 'Rejecting...' : 'Reject Listing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit User: {editingUser?.displayName}</DialogTitle></DialogHeader>
          {editingUser ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Display Name</label>
                <Input value={editingUser.displayName} onChange={(event) => setEditingUser({ ...editingUser, displayName: event.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Email</label>
                <Input value={editingUser.email} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Role</label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingUser.role} onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value as UserProfile['role'] })}>
                    <option value="guest">Guest</option>
                    <option value="host">Host</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">KYC Status</label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingUser.kycStatus} onChange={(event) => setEditingUser({ ...editingUser, kycStatus: event.target.value as UserProfile['kycStatus'] })}>
                    <option value="none">None</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Balance (R)</label>
                <Input type="number" value={editingUser.balance} onChange={(event) => setEditingUser({ ...editingUser, balance: Number(event.target.value) })} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={() => handleUpdateUser(editingUser!)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accountStatusAction} onOpenChange={() => !isUpdatingAccountStatus && setAccountStatusAction(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {accountStatusAction?.nextStatus === 'active'
                ? 'Reactivate Account'
                : accountStatusAction?.nextStatus === 'suspended'
                  ? 'Suspend Account'
                  : 'Deactivate Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-on-surface-variant">
              {accountStatusAction?.nextStatus === 'active'
                ? `Restore access for ${accountStatusAction.user.displayName}.`
                : `Tell ${accountStatusAction?.user.displayName} exactly why access is being removed.`}
            </p>
            {accountStatusAction?.nextStatus === 'active' ? null : (
              <Textarea
                value={accountStatusReason}
                onChange={(event) => setAccountStatusReason(event.target.value)}
                placeholder="Explain the policy, fraud, abuse, or compliance reason."
                className="min-h-[140px]"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountStatusAction(null)} disabled={isUpdatingAccountStatus}>
              Cancel
            </Button>
            <Button
              variant={accountStatusAction?.nextStatus === 'active' ? 'default' : 'destructive'}
              onClick={handleUpdateAccountStatus}
              disabled={isUpdatingAccountStatus}
            >
              {isUpdatingAccountStatus
                ? 'Saving...'
                : accountStatusAction?.nextStatus === 'active'
                  ? 'Reactivate'
                  : accountStatusAction?.nextStatus === 'suspended'
                    ? 'Suspend'
                    : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingListing} onOpenChange={() => setEditingListing(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Listing: {editingListing?.title}</DialogTitle></DialogHeader>
          {editingListing ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Title</label>
                <Input value={editingListing.title} onChange={(event) => setEditingListing({ ...editingListing, title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Location</label>
                <Input value={editingListing.location} onChange={(event) => setEditingListing({ ...editingListing, location: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Price per Night (R)</label>
                  <Input type="number" value={editingListing.pricePerNight} onChange={(event) => setEditingListing({ ...editingListing, pricePerNight: Number(event.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Status</label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingListing.status} onChange={(event) => setEditingListing({ ...editingListing, status: event.target.value as Listing['status'] })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Description</label>
                <textarea className="min-h-[100px] w-full rounded-md border border-input bg-background p-3 text-sm" value={editingListing.description} onChange={(event) => setEditingListing({ ...editingListing, description: event.target.value })} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingListing(null)}>Cancel</Button>
            <Button onClick={() => handleUpdateListing(editingListing!)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-500">
              {confirmDelete?.type === 'user'
                ? 'Are you sure you want to permanently delete this user? This only works when the account has no listings, bookings, billing history, reviews, or referral records.'
                : `Are you sure you want to delete this ${confirmDelete?.type}? This action cannot be undone.`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (confirmDelete?.type === 'user') void handleDeleteUser(confirmDelete.id);
              if (confirmDelete?.type === 'listing') void handleDeleteListing(confirmDelete.id);
              if (confirmDelete?.type === 'review') void handleDeleteReview(confirmDelete.id);
              if (confirmDelete?.type === 'referral') void handleDeleteReferral(confirmDelete.id);
              if (confirmDelete?.type === 'notification') void handleDeleteNotification(confirmDelete.id);
              setConfirmDelete(null);
            }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
