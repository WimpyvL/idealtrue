import { useEffect, useState } from 'react';
import type { Booking, Listing, Referral } from '@/types';
import type { AuthSessionUser } from '@/contexts/AuthContext';
import { getListing, listHostListings, listMyBookings, listPublicListings, listReferralRewards } from '@/lib/platform-client';

interface PlatformDataState {
  listings: Listing[];
  myListings: Listing[];
  myBookings: Booking[];
  hostBookings: Booking[];
  referrals: Referral[];
  syncUpdatedBooking: (updatedBooking: Booking) => void;
  syncUpdatedListing: (updatedListing: Listing) => void;
  removeListing: (listingId: string) => void;
}

export function usePlatformData(user: AuthSessionUser | null): PlatformDataState {
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [hostBookings, setHostBookings] = useState<Booking[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [publicListings, sessionBookings, rewardHistory] = await Promise.all([
        listPublicListings(),
        user ? listMyBookings() : Promise.resolve([]),
        user ? listReferralRewards() : Promise.resolve([]),
      ]);

      if (cancelled) {
        return;
      }

      setListings(publicListings);
      setReferrals(rewardHistory);

      if (!user) {
        setMyListings([]);
        setMyBookings([]);
        setHostBookings([]);
        return;
      }

      const hostListings = await listHostListings(user.id);
      if (cancelled) {
        return;
      }

      setMyListings(hostListings);
      setMyBookings(sessionBookings.filter((booking) => booking.guestId === user.id));
      setHostBookings(sessionBookings.filter((booking) => booking.hostId === user.id));
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    listings,
    myListings,
    myBookings,
    hostBookings,
    referrals,
    syncUpdatedBooking(updatedBooking) {
      setMyBookings((current) => {
        const existingIndex = current.findIndex((item) => item.id === updatedBooking.id);
        if (existingIndex === -1 && updatedBooking.guestId === user?.id) {
          return [updatedBooking, ...current];
        }
        return current.map((item) => item.id === updatedBooking.id ? updatedBooking : item);
      });
      setHostBookings((current) => {
        const existingIndex = current.findIndex((item) => item.id === updatedBooking.id);
        if (existingIndex === -1 && updatedBooking.hostId === user?.id) {
          return [updatedBooking, ...current];
        }
        return current.map((item) => item.id === updatedBooking.id ? updatedBooking : item);
      });

      if (["confirmed", "completed", "cancelled", "declined"].includes(updatedBooking.status)) {
        void getListing(updatedBooking.listingId)
          .then((updatedListing) => {
            setListings((current) => current.map((item) => item.id === updatedListing.id ? updatedListing : item));
            setMyListings((current) => current.map((item) => item.id === updatedListing.id ? updatedListing : item));
          })
          .catch((error) => {
            console.warn("Failed to refresh listing availability after booking update:", error);
          });
      }
    },
    syncUpdatedListing(updatedListing) {
      setListings((current) => {
        const existingIndex = current.findIndex((item) => item.id === updatedListing.id);
        if (existingIndex === -1) {
          return [updatedListing, ...current];
        }
        return current.map((item) => item.id === updatedListing.id ? updatedListing : item);
      });
      setMyListings((current) => {
        const existingIndex = current.findIndex((item) => item.id === updatedListing.id);
        if (existingIndex === -1 && updatedListing.hostId === user?.id) {
          return [updatedListing, ...current];
        }
        return current.map((item) => item.id === updatedListing.id ? updatedListing : item);
      });
    },
    removeListing(listingId) {
      setListings((current) => current.filter((item) => item.id !== listingId));
      setMyListings((current) => current.filter((item) => item.id !== listingId));
    },
  };
}
