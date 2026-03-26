import React, { useState, useMemo } from 'react';
import { Booking, Listing } from '../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { updateListingBlockedDates } from '../lib/platform-client';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { CalendarDays, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function HostAvailability({
  listings,
  bookings,
  onListingUpdated,
}: {
  listings: Listing[];
  bookings: Booking[];
  onListingUpdated?: (listing: Listing) => void;
}) {
  const [selectedListingId, setSelectedListingId] = useState<string>(listings[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  const selectedListing = listings.find(l => l.id === selectedListingId);

  // Calculate booked dates
  const bookedDates = useMemo(() => {
    if (!selectedListingId) return [];
    
    const listingBookings = bookings.filter(b => 
      b.listingId === selectedListingId && 
      (b.status === 'confirmed' || b.status === 'completed')
    );

    const dates: Date[] = [];
    listingBookings.forEach(booking => {
      try {
        const interval = eachDayOfInterval({
          start: parseISO(booking.checkIn),
          end: parseISO(booking.checkOut)
        });
        dates.push(...interval);
      } catch (e) {
        console.error("Error parsing booking dates", e);
      }
    });
    return dates;
  }, [bookings, selectedListingId]);

  // Blocked dates from listing
  const blockedDates = useMemo(() => {
    if (!selectedListing?.blockedDates) return [];
    return selectedListing.blockedDates.map(d => parseISO(d));
  }, [selectedListing?.blockedDates]);

  const handleSelectDates = async (dates: Date[] | undefined) => {
    if (!selectedListing || !dates) return;
    
    // Filter out any dates that are already booked (they can't be manually blocked/unblocked)
    const newBlockedDates = dates.filter(date => 
      !bookedDates.some(bookedDate => isSameDay(bookedDate, date))
    ).map(d => format(d, 'yyyy-MM-dd'));

    setIsSaving(true);
    try {
      const updatedListing = await updateListingBlockedDates(selectedListing.id, newBlockedDates);
      onListingUpdated?.(updatedListing);
    } catch (error) {
      console.error('Failed to update listing availability', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Availability Calendar</h1>
        <p className="text-on-surface-variant">Manage your listing's availability. Block off dates when you cannot host.</p>
      </header>

      {listings.length === 0 ? (
        <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
          <CalendarDays className="w-12 h-12 mx-auto text-outline-variant mb-4" />
          <h3 className="text-lg font-bold mb-2">No listings found</h3>
          <p className="text-on-surface-variant">Create a listing first to manage its availability.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Select Listing</h3>
              <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a listing" />
                </SelectTrigger>
                <SelectContent>
                  {listings.map(listing => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Legend</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm bg-surface border border-outline-variant"></div>
                  <span className="text-sm">Available</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm bg-primary border border-primary"></div>
                  <span className="text-sm">Blocked (by you)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm bg-red-100 border border-red-200 flex items-center justify-center">
                    <div className="w-full h-[1px] bg-red-400 rotate-45"></div>
                  </div>
                  <span className="text-sm">Booked (by guest)</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant text-sm text-on-surface-variant">
                <p className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Click on available dates to block them. Click on blocked dates to make them available again. Booked dates cannot be modified here.</span>
                </p>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="p-6 flex justify-center overflow-x-auto">
              {selectedListing ? (
                <div className="relative">
                  {isSaving && (
                    <div className="absolute inset-0 bg-surface/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
                      <div className="bg-surface px-4 py-2 rounded-full shadow-md text-sm font-medium flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </div>
                    </div>
                  )}
                  <Calendar
                    mode="multiple"
                    selected={blockedDates}
                    onSelect={handleSelectDates}
                    disabled={bookedDates}
                    modifiers={{
                      booked: bookedDates,
                    }}
                    modifiersClassNames={{
                      booked: "bg-red-50 text-red-900 line-through opacity-70 hover:bg-red-50 hover:text-red-900",
                    }}
                    className="p-4 pointer-events-auto"
                    numberOfMonths={2}
                    showOutsideDays={false}
                  />
                </div>
              ) : (
                <div className="py-20 text-center text-on-surface-variant">
                  Please select a listing to view its calendar.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
