import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminHostBillingAccount,
  Booking,
  Listing,
  Notification,
  PlatformSettings,
  Referral,
  Review,
  Subscription,
  UserProfile,
} from '@/types';
import {
  type AdminCheckout,
  type AdminObservabilitySnapshot,
  createAdminNotification,
  getAdminObservability,
  getAdminPlatformSettings,
  listAdminHostBillingAccounts,
  listAdminBookings,
  listAdminCheckouts,
  listAdminListings,
  listAdminNotifications,
  listAdminReferralRewards,
  listAdminReviews,
  listAdminSubscriptions,
  listAdminUsers,
  setAdminHostGreylist,
  updateAdminPlatformSettings,
  updateAdminUser,
} from '@/lib/admin-client';
import { setUserKycStatus } from '@/lib/identity-client';
import { type KycSubmission, listKycSubmissions, reviewKycSubmission } from '@/lib/ops-client';
import { saveListing } from '@/lib/platform-client';
import { toListingPayload } from '@/features/admin/dashboard-support';

type Notify = (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;

type UseAdminDashboardDataOptions = {
  notify: Notify;
  profileId?: string | null;
  profileRole?: UserProfile['role'];
};

export function useAdminDashboardData({ notify, profileId, profileRole }: UseAdminDashboardDataOptions) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeListings: 0,
    totalEnquiries: 0,
    pendingReviews: 0,
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
  const [allHostBillingAccounts, setAllHostBillingAccounts] = useState<AdminHostBillingAccount[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [observability, setObservability] = useState<AdminObservabilitySnapshot | null>(null);
  const [kycSubmissions, setKycSubmissions] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCoreData = useCallback(async () => {
    setLoading(true);

    try {
      const results = await Promise.allSettled([
        listAdminUsers(),
        listAdminListings(),
        listAdminBookings(),
        listAdminReviews(),
        listAdminReferralRewards(),
        listAdminSubscriptions(),
        listAdminCheckouts(),
        listAdminHostBillingAccounts(),
        listAdminNotifications(),
        getAdminPlatformSettings(),
      ]);

      const [
        usersResult,
        listingsResult,
        bookingsResult,
        reviewsResult,
        referralsResult,
        subscriptionsResult,
        checkoutsResult,
        hostBillingAccountsResult,
        notificationsResult,
        settingsResult,
      ] = results;

      const getValue = <T,>(result: PromiseSettledResult<T>, fallback: T) =>
        result.status === 'fulfilled' ? result.value : fallback;

      const users = getValue(usersResult, []);
      const listings = getValue(listingsResult, []);
      const bookings = getValue(bookingsResult, []);
      const reviews = getValue(reviewsResult, []);
      const referrals = getValue(referralsResult, []);
      const subscriptions = getValue(subscriptionsResult, []);
      const checkouts = getValue(checkoutsResult, []);
      const hostBillingAccounts = getValue(hostBillingAccountsResult, []);
      const notifications = getValue(notificationsResult, []);
      const settings = getValue(settingsResult, null);

      const criticalFailures = [
        usersResult,
        listingsResult,
        bookingsResult,
        reviewsResult,
        referralsResult,
        subscriptionsResult,
        checkoutsResult,
        notificationsResult,
        settingsResult,
      ].filter((result) => result.status === 'rejected');

      setAllUsers(users);
      setAllListings(listings);
      setAllBookings(bookings);
      setAllReviews(reviews);
      setAllReferrals(referrals);
      setAllSubscriptions(subscriptions);
      setAllCheckouts(checkouts);
      setAllHostBillingAccounts(hostBillingAccounts);
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

      if (criticalFailures.length > 0) {
        console.error('Admin dashboard loaded with partial failures', criticalFailures);
        notify({
          title: 'Admin data partially loaded',
          description: 'Some admin services did not respond, but the dashboard recovered with the data that is available.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load admin core data', error);
      notify({ title: 'Admin data failed', description: 'Could not load admin dashboard data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const refreshObservability = useCallback(async () => {
    try {
      const snapshot = await getAdminObservability();
      setObservability(snapshot);
    } catch (error) {
      console.error('Failed to load admin observability snapshot', error);
    }
  }, []);

  const refreshKycSubmissions = useCallback(async () => {
    if (profileRole !== 'admin') {
      return;
    }

    try {
      const submissions = await listKycSubmissions();
      setKycSubmissions(submissions);
    } catch (error) {
      console.error('Failed to load KYC submissions', error);
      notify({ title: 'KYC load failed', description: 'Could not load KYC submissions.', variant: 'destructive' });
    }
  }, [notify, profileRole]);

  useEffect(() => {
    void refreshCoreData();
  }, [refreshCoreData]);

  useEffect(() => {
    void refreshObservability();
  }, [refreshObservability]);

  useEffect(() => {
    void refreshKycSubmissions();
  }, [refreshKycSubmissions]);

  const pendingKycCount = useMemo(
    () => kycSubmissions.filter((submission) => submission.status === 'pending').length,
    [kycSubmissions],
  );

  const handleUpdateUserRole = useCallback(async (userId: string, newRole: UserProfile['role']) => {
    try {
      const updatedUser = await updateAdminUser({ userId, role: newRole });
      setAllUsers((current) => current.map((user) => user.id === userId ? updatedUser : user));
      notify({ title: 'Role Updated', description: 'User role updated successfully.' });
    } catch (error) {
      console.error('Error updating user role:', error);
      notify({ title: 'Role update failed', description: 'Could not update the user role.', variant: 'destructive' });
    }
  }, [notify]);

  const handleUpdateListingStatus = useCallback(async (listingId: string, newStatus: Listing['status']) => {
    try {
      const listing = allListings.find((item) => item.id === listingId);
      if (!listing) {
        return;
      }

      await saveListing(toListingPayload(listing, newStatus));

      setAllListings((current) => {
        const next = current.map((item) => item.id === listingId ? { ...item, status: newStatus } : item);
        setTopListings(next.filter((item) => item.status === 'active').slice(0, 5));
        setStats((existing) => ({
          ...existing,
          activeListings: next.filter((item) => item.status === 'active').length,
        }));
        return next;
      });

      notify({ title: 'Status Updated', description: `Listing status updated to ${newStatus}.` });
    } catch (error) {
      console.error('Error updating listing status:', error);
      notify({ title: 'Listing update failed', description: 'Could not update the listing status.', variant: 'destructive' });
    }
  }, [allListings, notify]);

  const handleApproveKyc = useCallback(async (userId: string) => {
    try {
      await reviewKycSubmission({ userId, status: 'verified' });
      await setUserKycStatus({ userId, kycStatus: 'verified' });
      const notification = await createAdminNotification({
        title: 'Verification Approved',
        message: 'Your identity verification has been approved. You can now start listing properties.',
        type: 'success',
        target: userId,
        actionPath: '/account',
      });

      setAllNotifications((current) => [notification, ...current]);
      setKycSubmissions((current) =>
        current.map((submission) =>
          submission.userId === userId
            ? {
                ...submission,
                status: 'verified',
                rejectionReason: null,
                reviewedAt: notification.createdAt,
                reviewerId: profileId ?? submission.reviewerId ?? null,
              }
            : submission,
        ),
      );

      notify({ title: 'Verification Approved', description: 'User has been verified.' });
    } catch (error) {
      console.error('Failed to approve KYC submission', error);
      notify({ title: 'Approval failed', description: 'Could not approve this KYC submission.', variant: 'destructive' });
    }
  }, [notify, profileId]);

  const handleUpdateSettings = useCallback(async (settings: Partial<PlatformSettings>) => {
    try {
      const updatedSettings = await updateAdminPlatformSettings(settings);
      setPlatformSettings(updatedSettings);
      notify({ title: 'Settings Updated', description: 'Platform configuration has been saved.' });
    } catch (error) {
      console.error('Failed to update platform settings', error);
      notify({ title: 'Settings update failed', description: 'Could not save platform settings.', variant: 'destructive' });
    }
  }, [notify]);

  const handleSetHostGreylist = useCallback(async (params: {
    userId: string;
    greylisted: boolean;
    reason?: string | null;
  }) => {
    try {
      const account = await setAdminHostGreylist(params);
      setAllHostBillingAccounts((current) =>
        current.some((item) => item.userId === account.userId)
          ? current.map((item) => item.userId === account.userId ? account : item)
          : [account, ...current],
      );
      notify({
        title: params.greylisted ? 'Host greylisted' : 'Host restored',
        description: params.greylisted ? 'Listings were paused for billing follow-up.' : 'Greylist flag removed.',
      });
    } catch (error) {
      console.error('Failed to update host greylist state', error);
      notify({ title: 'Greylist update failed', description: 'Could not update host billing status.', variant: 'destructive' });
    }
  }, [notify]);

  return {
    allBookings,
    allCheckouts,
    allHostBillingAccounts,
    allListings,
    allNotifications,
    allReferrals,
    allReviews,
    allSubscriptions,
    allUsers,
    handleApproveKyc,
    handleSetHostGreylist,
    handleUpdateListingStatus,
    handleUpdateSettings,
    handleUpdateUserRole,
    kycSubmissions,
    loading,
    observability,
    pendingKycCount,
    platformSettings,
    recentEnquiries,
    refreshCoreData,
    refreshKycSubmissions,
    refreshObservability,
    setAllBookings,
    setAllCheckouts,
    setAllHostBillingAccounts,
    setAllListings,
    setAllNotifications,
    setAllReferrals,
    setAllReviews,
    setAllSubscriptions,
    setAllUsers,
    setKycSubmissions,
    setPlatformSettings,
    setStats,
    setTopListings,
    stats,
    topListings,
  };
}
