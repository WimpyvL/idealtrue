import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  format,
  formatDistanceToNowStrict,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  AlertCircle,
  CalendarDays,
  CircleDollarSign,
  Lock,
  ShieldCheck,
  WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Booking, Listing, ListingAvailabilitySummary } from '../types';
import {
  getListingAvailabilitySummary,
  isEncoreEndpointNotFound,
  updateListingAvailabilityBlocks,
  updateListingBlockedDates,
} from '../lib/platform-client';
import {
  applyAvailabilityRangeAction,
  buildDateKeysFromRange,
  buildManualBlockInputsFromDateKeys,
  getApprovedHoldDateKeys,
  getAvailabilityDayState,
  getBookedDateKeys,
  getManualBlockedDateKeys,
  normalizeDateKey,
} from '@/lib/host-availability';

type RangeAction = 'block' | 'unblock';

export default function HostAvailability({
  listings,
  bookings,
  onListingUpdated,
}: {
  listings: Listing[];
  bookings: Booking[];
  onListingUpdated?: (listing: Listing) => void;
}) {
  const navigate = useNavigate();
  const [selectedListingId, setSelectedListingId] = useState<string>(listings[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const [blockNote, setBlockNote] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [availabilitySummary, setAvailabilitySummary] = useState<ListingAvailabilitySummary | null>(null);
  const [supportsAvailabilityBlocksApi, setSupportsAvailabilityBlocksApi] = useState(true);

  const selectedListing = listings.find((listing) => listing.id === selectedListingId);
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (!selectedListingId) {
      setAvailabilitySummary(null);
      return;
    }

    let cancelled = false;
    setIsSummaryLoading(true);

    void getListingAvailabilitySummary(selectedListingId)
      .then((summary) => {
        if (!cancelled) {
          setSupportsAvailabilityBlocksApi(true);
          setAvailabilitySummary(summary);
        }
      })
      .catch((error) => {
        console.error('Failed to load listing availability summary', error);
        if (!cancelled) {
          if (isEncoreEndpointNotFound(error)) {
            setSupportsAvailabilityBlocksApi(false);
          } else {
            toast.error('Failed to load availability summary.');
          }
          setAvailabilitySummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedListingId]);

  const manualAvailabilityBlocks = useMemo(
    () => (selectedListing?.availabilityBlocks ?? []).filter((block) => block.sourceType === 'MANUAL'),
    [selectedListing?.availabilityBlocks],
  );
  const manualBlockedDateKeys = useMemo(
    () => availabilitySummary?.manualBlockedDates ?? getManualBlockedDateKeys(selectedListing),
    [availabilitySummary?.manualBlockedDates, selectedListing],
  );
  const approvedHoldDateKeys = useMemo(
    () => getApprovedHoldDateKeys(selectedListing),
    [selectedListing],
  );
  const bookedDateKeys = useMemo(
    () => (selectedListingId ? getBookedDateKeys(bookings, selectedListingId) : []),
    [bookings, selectedListingId],
  );

  const manualBlockedDateSet = useMemo(() => new Set(manualBlockedDateKeys), [manualBlockedDateKeys]);
  const approvedHoldDateSet = useMemo(() => new Set(approvedHoldDateKeys), [approvedHoldDateKeys]);
  const bookedDateSet = useMemo(() => new Set(bookedDateKeys), [bookedDateKeys]);
  const lockedDateSet = useMemo(
    () => new Set(availabilitySummary?.lockedDates ?? [...approvedHoldDateKeys, ...bookedDateKeys]),
    [approvedHoldDateKeys, availabilitySummary?.lockedDates, bookedDateKeys],
  );

  const manualBlockedDates = useMemo(
    () => manualBlockedDateKeys.map((dateKey) => parseISO(dateKey)),
    [manualBlockedDateKeys],
  );
  const approvedHoldDates = useMemo(
    () => approvedHoldDateKeys.map((dateKey) => parseISO(dateKey)),
    [approvedHoldDateKeys],
  );
  const bookedDates = useMemo(
    () => bookedDateKeys.map((dateKey) => parseISO(dateKey)),
    [bookedDateKeys],
  );

  const selectedDateState = useMemo(
    () =>
      getAvailabilityDayState(selectedDateKey, {
        manualBlockedDateKeys: manualBlockedDateSet,
        approvedHoldDateKeys: approvedHoldDateSet,
        bookedDateKeys: bookedDateSet,
      }),
    [approvedHoldDateSet, bookedDateSet, manualBlockedDateSet, selectedDateKey],
  );

  const selectedDateBlocks = useMemo(
    () =>
      (selectedListing?.availabilityBlocks ?? []).filter((block) =>
        block.nights.some((night) => normalizeDateKey(night) === selectedDateKey),
      ),
    [selectedDateKey, selectedListing?.availabilityBlocks],
  );

  const selectedDateBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.listingId === selectedListingId &&
          normalizeDateKey(booking.checkIn) <= selectedDateKey &&
          normalizeDateKey(booking.checkOut) > selectedDateKey,
      ),
    [bookings, selectedDateKey, selectedListingId],
  );

  const upcomingConstraints = useMemo(() => {
    if (availabilitySummary?.upcomingBlocks?.length) {
      return availabilitySummary.upcomingBlocks.slice(0, 8);
    }

    return (selectedListing?.availabilityBlocks ?? [])
      .filter((block) => parseISO(block.endsOn) >= today)
      .sort((left, right) => parseISO(left.startsOn).getTime() - parseISO(right.startsOn).getTime())
      .slice(0, 8);
  }, [availabilitySummary?.upcomingBlocks, selectedListing?.availabilityBlocks, today]);

  const stats = useMemo(
    () => [
      {
        label: 'Manual blocks',
        value: availabilitySummary?.manualBlockCount ?? manualAvailabilityBlocks.length,
        helper: 'Distinct manual intervals you control.',
        icon: Lock,
      },
      {
        label: 'Approved holds',
        value: approvedHoldDateKeys.length,
        helper: 'Nights reserved while payment is pending.',
        icon: ShieldCheck,
      },
      {
        label: 'Booked nights',
        value: bookedDateKeys.length,
        helper: 'Confirmed occupied nights.',
        icon: CalendarDays,
      },
      {
        label: 'Upcoming constraints',
        value: upcomingConstraints.length,
        helper: 'Future holds and bookings visible below.',
        icon: CircleDollarSign,
      },
    ],
    [
      approvedHoldDateKeys.length,
      availabilitySummary?.manualBlockCount,
      bookedDateKeys.length,
      manualAvailabilityBlocks.length,
      upcomingConstraints.length,
    ],
  );

  const persistManualBlockedDates = async (
    nextManualBlockedDateKeys: string[],
    successMessage: string,
    skippedDateKeys: string[] = [],
  ) => {
    if (!selectedListing) return;

    setIsSaving(true);
    try {
      let updatedListing: Listing;

      if (supportsAvailabilityBlocksApi) {
        try {
          const manualBlocks = buildManualBlockInputsFromDateKeys(nextManualBlockedDateKeys, manualAvailabilityBlocks);
          const response = await updateListingAvailabilityBlocks(selectedListing.id, manualBlocks);
          updatedListing = response.listing;
          setAvailabilitySummary(response.summary);
          setSupportsAvailabilityBlocksApi(true);
        } catch (error) {
          if (!isEncoreEndpointNotFound(error)) {
            throw error;
          }

          setSupportsAvailabilityBlocksApi(false);
          updatedListing = await updateListingBlockedDates(selectedListing.id, nextManualBlockedDateKeys);
          setAvailabilitySummary(null);
        }
      } else {
        updatedListing = await updateListingBlockedDates(selectedListing.id, nextManualBlockedDateKeys);
        setAvailabilitySummary(null);
      }

      onListingUpdated?.(updatedListing);
      if (skippedDateKeys.length > 0) {
        toast.warning(`${successMessage} ${skippedDateKeys.length} locked date${skippedDateKeys.length === 1 ? ' was' : 's were'} skipped.`);
      } else {
        toast.success(successMessage);
      }
    } catch (error) {
      console.error('Failed to update listing availability', error);
      toast.error('Failed to update availability.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectDates = async (dates: Date[] | undefined) => {
    if (!selectedListing || !dates) return;

    const nextManualBlockedDateKeys = dates.map((date) => normalizeDateKey(date)).filter((dateKey) => !lockedDateSet.has(dateKey));
    const skippedDateKeys = dates
      .map((date) => normalizeDateKey(date))
      .filter((dateKey) => lockedDateSet.has(dateKey));

    await persistManualBlockedDates(nextManualBlockedDateKeys, 'Availability updated.', skippedDateKeys);
  };

  const handleRangeAction = async (action: RangeAction) => {
    if (!selectedListing || !rangeStart || !rangeEnd) return;

    const rangeDateKeys = buildDateKeysFromRange(parseISO(rangeStart), parseISO(rangeEnd));

    if (action === 'block') {
      const skippedDateKeys = rangeDateKeys.filter((dateKey) => lockedDateSet.has(dateKey));
      const allowedRangeDateKeys = rangeDateKeys.filter((dateKey) => !lockedDateSet.has(dateKey));
      const nextManualBlockedDateKeys = Array.from(new Set([...manualBlockedDateKeys, ...allowedRangeDateKeys])).sort();

      setIsSaving(true);
      try {
        let updatedListing: Listing;

        if (supportsAvailabilityBlocksApi) {
          try {
            const manualBlocks = buildManualBlockInputsFromDateKeys(nextManualBlockedDateKeys, manualAvailabilityBlocks, blockNote);
            const response = await updateListingAvailabilityBlocks(selectedListing.id, manualBlocks);
            updatedListing = response.listing;
            setAvailabilitySummary(response.summary);
            setSupportsAvailabilityBlocksApi(true);
          } catch (error) {
            if (!isEncoreEndpointNotFound(error)) {
              throw error;
            }

            setSupportsAvailabilityBlocksApi(false);
            updatedListing = await updateListingBlockedDates(selectedListing.id, nextManualBlockedDateKeys);
            setAvailabilitySummary(null);
          }
        } else {
          updatedListing = await updateListingBlockedDates(selectedListing.id, nextManualBlockedDateKeys);
          setAvailabilitySummary(null);
        }

        onListingUpdated?.(updatedListing);
        if (skippedDateKeys.length > 0) {
          toast.warning(`Range blocked. ${skippedDateKeys.length} locked date${skippedDateKeys.length === 1 ? ' was' : 's were'} skipped.`);
        } else {
          toast.success('Range blocked.');
        }
        setBlockNote('');
      } catch (error) {
        console.error('Failed to update listing availability', error);
        toast.error('Failed to update availability.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const { nextManualBlockedDateKeys, skippedDateKeys } = applyAvailabilityRangeAction({
      currentManualBlockedDateKeys: manualBlockedDateKeys,
      rangeDateKeys,
      action,
      lockedDateKeys: lockedDateSet,
    });

    await persistManualBlockedDates(nextManualBlockedDateKeys, 'Range reopened.', skippedDateKeys);
  };

  const handleQuickBlock = async (days: number) => {
    const start = startOfDay(new Date());
    const end = addDays(start, days - 1);
    setRangeStart(format(start, 'yyyy-MM-dd'));
    setRangeEnd(format(end, 'yyyy-MM-dd'));

    if (!selectedListing) return;

    const rangeDateKeys = buildDateKeysFromRange(start, end);
    const skippedDateKeys = rangeDateKeys.filter((dateKey) => lockedDateSet.has(dateKey));
    const allowedRangeDateKeys = rangeDateKeys.filter((dateKey) => !lockedDateSet.has(dateKey));
    const nextManualBlockedDateKeys = Array.from(new Set([...manualBlockedDateKeys, ...allowedRangeDateKeys])).sort();

    setIsSaving(true);
    try {
      let updatedListing: Listing;

      if (supportsAvailabilityBlocksApi) {
        try {
          const manualBlocks = buildManualBlockInputsFromDateKeys(nextManualBlockedDateKeys, manualAvailabilityBlocks, blockNote);
          const response = await updateListingAvailabilityBlocks(selectedListing.id, manualBlocks);
          updatedListing = response.listing;
          setAvailabilitySummary(response.summary);
          setSupportsAvailabilityBlocksApi(true);
        } catch (error) {
          if (!isEncoreEndpointNotFound(error)) {
            throw error;
          }

          setSupportsAvailabilityBlocksApi(false);
          updatedListing = await updateListingBlockedDates(selectedListing.id, nextManualBlockedDateKeys);
          setAvailabilitySummary(null);
        }
      } else {
        updatedListing = await updateListingBlockedDates(selectedListing.id, nextManualBlockedDateKeys);
        setAvailabilitySummary(null);
      }

      onListingUpdated?.(updatedListing);
      if (skippedDateKeys.length > 0) {
        toast.warning(`Blocked the next ${days} day${days === 1 ? '' : 's'}. ${skippedDateKeys.length} locked date${skippedDateKeys.length === 1 ? ' was' : 's were'} skipped.`);
      } else {
        toast.success(`Blocked the next ${days} day${days === 1 ? '' : 's'}.`);
      }
      setBlockNote('');
    } catch (error) {
      console.error('Failed to update listing availability', error);
      toast.error('Failed to update availability.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Availability Calendar</h1>
        <p className="text-on-surface-variant">Run availability like an operations tool: bulk block ranges, inspect specific nights, and see exactly what is consuming inventory.</p>
      </header>

      {listings.length === 0 ? (
        <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
          <CalendarDays className="w-12 h-12 mx-auto text-outline-variant mb-4" />
          <h3 className="text-lg font-bold mb-2">No listings found</h3>
          <p className="text-on-surface-variant">Create a listing first to manage its availability.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-on-surface-variant">{stat.label}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-xs text-on-surface-variant">{stat.helper}</p>
                    </div>
                    <div className="rounded-full bg-surface-container-low px-2 py-2">
                      <Icon className="w-4 h-4 text-on-surface-variant" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">Select Listing</h3>
                  <p className="text-sm text-on-surface-variant">Availability changes always apply to one listing at a time.</p>
                </div>
                <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a listing" />
                  </SelectTrigger>
                  <SelectContent>
                    {listings.map((listing) => (
                      <SelectItem key={listing.id} value={listing.id}>
                        {listing.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>

              <Card className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">Range Actions</h3>
                  <p className="text-sm text-on-surface-variant">Block or reopen a full span without clicking every single date.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Start</label>
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">End</label>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Block note</label>
                  <input
                    type="text"
                    value={blockNote}
                    onChange={(event) => setBlockNote(event.target.value)}
                    placeholder="Maintenance, owner stay, private event"
                    className="h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm"
                  />
                  <p className="text-xs text-on-surface-variant">Used for newly blocked range intervals. Single-day calendar toggles stay fast and note-light.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={() => void handleRangeAction('block')} disabled={isSaving || !selectedListing}>
                    Block range
                  </Button>
                  <Button variant="outline" onClick={() => void handleRangeAction('unblock')} disabled={isSaving || !selectedListing}>
                    Reopen range
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Quick actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void handleQuickBlock(3)} disabled={isSaving || !selectedListing}>
                      Next 3 days
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleQuickBlock(7)} disabled={isSaving || !selectedListing}>
                      Next 7 days
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleQuickBlock(14)} disabled={isSaving || !selectedListing}>
                      Next 14 days
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">Selected Day Inspector</h3>
                  <p className="text-sm text-on-surface-variant">Click any day in the calendar to inspect what owns that inventory.</p>
                </div>
                <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Day</p>
                      <p className="text-lg font-bold text-on-surface">{format(parseISO(selectedDateKey), 'EEE, MMM d, yyyy')}</p>
                    </div>
                    <div className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-surface-container-low text-on-surface">
                      {isSummaryLoading ? 'loading' : selectedDateState.replace('_', ' ')}
                    </div>
                  </div>

                  {selectedDateBlocks.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDateBlocks.map((block) => (
                        <div key={block.id} className="rounded-lg border border-outline-variant bg-surface p-3 text-sm">
                          <p className="font-semibold text-on-surface">{block.sourceType.replace('_', ' ')}</p>
                          <p className="text-on-surface-variant">
                            {format(parseISO(block.startsOn), 'MMM d')} - {format(parseISO(block.endsOn), 'MMM d, yyyy')}
                          </p>
                          {block.note ? <p className="text-xs text-on-surface">{block.note}</p> : null}
                          <p className="text-xs text-on-surface-variant">
                            Updated {formatDistanceToNowStrict(parseISO(block.updatedAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">No availability block is attached to this day yet.</p>
                  )}

                  {selectedDateBookings.length > 0 && (
                    <Button variant="outline" className="w-full" onClick={() => navigate('/host/enquiries')}>
                      Open enquiry workflow
                    </Button>
                  )}
                </div>
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
                    <span className="text-sm">Blocked by you</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-sm bg-amber-100 border border-amber-300"></div>
                    <span className="text-sm">Approved enquiry hold</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-sm bg-red-50 border border-red-200"></div>
                    <span className="text-sm">Booked stay</span>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant text-sm text-on-surface-variant">
                  <p className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Locked dates from approved holds and booked stays are protected. Bulk actions skip them automatically instead of pretending they were changed.</span>
                  </p>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 flex justify-center overflow-x-auto">
                {selectedListing ? (
                  <div className="relative">
                    {isSaving && (
                      <div className="absolute inset-0 bg-surface/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
                        <div className="bg-surface px-4 py-2 rounded-full shadow-md text-sm font-medium flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          Saving availability...
                        </div>
                      </div>
                    )}
                    <Calendar
                      mode="multiple"
                      selected={manualBlockedDates}
                      onSelect={handleSelectDates}
                      onDayClick={(day) => setSelectedDateKey(normalizeDateKey(day))}
                      disabled={[...bookedDates, ...approvedHoldDates]}
                      modifiers={{
                        booked: bookedDates,
                        approvedHold: approvedHoldDates,
                        inspected: [parseISO(selectedDateKey)],
                      }}
                      modifiersClassNames={{
                        booked: 'bg-red-50 text-red-900 opacity-80 hover:bg-red-50 hover:text-red-900',
                        approvedHold: 'bg-amber-50 text-amber-900 opacity-90 hover:bg-amber-50 hover:text-amber-900',
                        inspected: 'ring-2 ring-primary/40',
                      }}
                      className="p-4 pointer-events-auto"
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      showOutsideDays={false}
                    />
                  </div>
                ) : (
                  <div className="py-20 text-center text-on-surface-variant">
                    Please select a listing to view its calendar.
                  </div>
                )}
              </Card>

              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Upcoming Constraints</h3>
                    <p className="text-sm text-on-surface-variant">The next holds and bookings that will shape this listing’s near-term inventory.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/host/enquiries')}>
                    Open enquiries
                  </Button>
                </div>
                <div className="space-y-3">
                  {upcomingConstraints.length > 0 ? (
                    upcomingConstraints.map((block) => (
                      <div key={block.id} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{block.sourceType.replace('_', ' ')}</p>
                          <p className="text-sm text-on-surface-variant">
                            {format(parseISO(block.startsOn), 'MMM d')} - {format(parseISO(block.endsOn), 'MMM d, yyyy')}
                          </p>
                          {block.note ? <p className="text-xs text-on-surface-variant">{block.note}</p> : null}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {block.nights.length} night{block.nights.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-outline-variant border-dashed bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
                      No future holds or bookings are currently scheduled for this listing.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <WandSparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Operator Notes</h3>
                </div>
                <div className="space-y-3 text-sm text-on-surface-variant">
                  <p>Use the calendar for individual day toggles. Use range actions when you need to close maintenance windows, personal travel, or seasonal shutdowns quickly.</p>
                  <p>Range blocks can now carry an operational note, so future-you can see why inventory was taken offline instead of reverse engineering it from dates alone.</p>
                  <p>Approved enquiry holds are an operational warning, not a visual decoration. If too many nights are sitting in hold, jump to the enquiry queue and force the workflow forward.</p>
                  <p>Booked nights are intentionally protected here. This surface should help hosts manage inventory, not accidentally fight confirmed stays.</p>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
