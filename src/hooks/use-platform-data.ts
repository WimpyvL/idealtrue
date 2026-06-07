import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking, Listing, Referral, UserProfile } from '@/types';
import type { AuthSessionUser } from '@/contexts/AuthContext';
import { getEncoreErrorMessage } from '@/lib/encore-client';
import { isBookedStay } from '@/lib/inquiry-state';
import { getListing, listHostListings, listMyBookings, listPublicListings, listReferralRewards } from '@/lib/platform-client';

type PlatformDataErrorKey = 'listings' | 'bookings' | 'hostListings' | 'referrals';

type PlatformDataErrors = Partial<Record<PlatformDataErrorKey, string>>;

type PlatformDataLoading = Record<PlatformDataErrorKey, boolean>;

interface PlatformDataState {
  listings: Listing[];
  myListings: Listing[];
  myBookings: Booking[];
  hostBookings: Booking[];
  referrals: Referral[];
  dataErrors: PlatformDataErrors;
  dataLoading: PlatformDataLoading;
  hasDataErrors: boolean;
  reloadPlatformData: () => void;
  syncUpdatedBooking: (updatedBooking: Booking) => void;
  syncUpdatedListing: (updatedListing: Listing) => void;
  removeListing: (listingId: string) => void;
}

const BOOKING_SYNC_INTERVAL_MS = 12_000;
const EMPTY_LISTINGS: Listing[] = [];
const EMPTY_BOOKINGS: Booking[] = [];
const EMPTY_REFERRALS: Referral[] = [];

function toDataError(error: unknown, fallback: string) {
  return getEncoreErrorMessage(error, fallback);
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const existingIndex = items.findIndex((current) => current.id === item.id);
  if (existingIndex === -1) {
    return [item, ...items];
  }
  return items.map((current) => (current.id === item.id ? item : current));
}

function replaceById<T extends { id: string }>(items: T[], item: T) {
  return items.map((current) => (current.id === item.id ? item : current));
}

// Author: (|/) Klaasvaakie
export function usePlatformData(user: AuthSessionUser | null, profile: UserProfile | null): PlatformDataState {
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const profileRole = profile?.role ?? null;
  const isAdminProfile = Boolean(profile?.isAdmin);
  const canLoadHostData = Boolean(
    userId &&
    profile &&
    (profileRole === 'host' || profileRole === 'admin' || isAdminProfile),
  );

  const publicListingsQuery = useQuery({
    queryKey: ['platform', 'listings', 'public'],
    queryFn: listPublicListings,
  });

  const bookingsQuery = useQuery({
    queryKey: ['platform', 'bookings', 'me', userId],
    queryFn: listMyBookings,
    enabled: Boolean(userId),
    refetchInterval: BOOKING_SYNC_INTERVAL_MS,
  });

  const hostListingsQuery = useQuery({
    queryKey: ['platform', 'listings', 'host', userId],
    queryFn: () => listHostListings(userId!),
    enabled: canLoadHostData,
  });

  const referralsQuery = useQuery({
    queryKey: ['platform', 'referrals', userId],
    queryFn: listReferralRewards,
    enabled: Boolean(userId),
  });

  const listings = publicListingsQuery.data ?? EMPTY_LISTINGS;
  const sessionBookings = bookingsQuery.data ?? EMPTY_BOOKINGS;
  const myListings = hostListingsQuery.data ?? EMPTY_LISTINGS;
  const referrals = referralsQuery.data ?? EMPTY_REFERRALS;

  const myBookings = useMemo(
    () => (userId ? sessionBookings.filter((booking) => booking.guestId === userId) : EMPTY_BOOKINGS),
    [sessionBookings, userId],
  );
  const hostBookings = useMemo(
    () => (userId ? sessionBookings.filter((booking) => booking.hostId === userId) : EMPTY_BOOKINGS),
    [sessionBookings, userId],
  );

  const dataErrors = useMemo<PlatformDataErrors>(() => {
    const errors: PlatformDataErrors = {};
    if (publicListingsQuery.error) {
      errors.listings = toDataError(publicListingsQuery.error, 'Could not load public listings.');
    }
    if (bookingsQuery.error) {
      errors.bookings = toDataError(bookingsQuery.error, 'Could not load bookings.');
    }
    if (hostListingsQuery.error) {
      errors.hostListings = toDataError(hostListingsQuery.error, 'Could not load host listings.');
    }
    if (referralsQuery.error) {
      errors.referrals = toDataError(referralsQuery.error, 'Could not load referral rewards.');
    }
    return errors;
  }, [bookingsQuery.error, hostListingsQuery.error, publicListingsQuery.error, referralsQuery.error]);

  const dataLoading: PlatformDataLoading = {
    listings: publicListingsQuery.isFetching,
    bookings: bookingsQuery.isFetching,
    hostListings: hostListingsQuery.isFetching,
    referrals: referralsQuery.isFetching,
  };

  const reloadPlatformData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['platform'] });
  }, [queryClient]);

  const syncUpdatedBooking = useCallback((updatedBooking: Booking) => {
    queryClient.setQueryData<Booking[]>(['platform', 'bookings', 'me', userId], (current = []) =>
      upsertById(current, updatedBooking),
    );

    if (isBookedStay(updatedBooking) || ['DECLINED', 'EXPIRED'].includes(updatedBooking.inquiryState)) {
      void getListing(updatedBooking.listingId)
        .then((updatedListing) => {
          queryClient.setQueryData<Listing[]>(['platform', 'listings', 'public'], (current = []) =>
            replaceById(current, updatedListing),
          );
          queryClient.setQueryData<Listing[]>(['platform', 'listings', 'host', userId], (current = []) =>
            replaceById(current, updatedListing),
          );
        })
        .catch((error) => {
          console.warn('Failed to refresh listing availability after booking update:', error);
        });
    }
  }, [queryClient, userId]);

  const syncUpdatedListing = useCallback((updatedListing: Listing) => {
    queryClient.setQueryData<Listing[]>(['platform', 'listings', 'public'], (current = []) =>
      upsertById(current, updatedListing),
    );
    queryClient.setQueryData<Listing[]>(['platform', 'listings', 'host', userId], (current = []) => {
      if (updatedListing.hostId !== userId) {
        return current;
      }
      return upsertById(current, updatedListing);
    });
  }, [queryClient, userId]);

  const removeListing = useCallback((listingId: string) => {
    queryClient.setQueryData<Listing[]>(['platform', 'listings', 'public'], (current = []) =>
      current.filter((item) => item.id !== listingId),
    );
    queryClient.setQueryData<Listing[]>(['platform', 'listings', 'host', userId], (current = []) =>
      current.filter((item) => item.id !== listingId),
    );
  }, [queryClient, userId]);

  const hasDataErrors = Object.keys(dataErrors).length > 0;

  return {
    listings,
    myListings,
    myBookings,
    hostBookings,
    referrals,
    dataErrors,
    dataLoading,
    hasDataErrors,
    reloadPlatformData,
    syncUpdatedBooking,
    syncUpdatedListing,
    removeListing,
  };
}
