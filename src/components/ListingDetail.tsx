import React, { useState, useEffect } from 'react';
import { Listing, Review } from '@/types';
import { summarizeReviews } from '@/services/content';
import { X, Star, Loader2, MessageSquare, Calendar as CalendarIcon, Users, Minus, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, addDays, differenceInDays, isBefore, startOfToday } from 'date-fns';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { listListingReviews } from '@/lib/platform-client';
import { formatRand } from '@/lib/currency';

export default function ListingDetail({ 
  listing, 
  onClose, 
  onBook,
  currentUserId
}: { 
  listing: Listing, 
  onClose: () => void, 
  onBook: (bookingData: { checkIn: Date, checkOut: Date, adults: number, children: number, totalPrice: number, breakageDeposit?: number | null }) => Promise<void> | void,
  currentUserId?: string
}) {
  const blockedDateKeys = new Set(listing.blockedDates ?? []);
  const isDateBlocked = (date: Date) => blockedDateKeys.has(date.toISOString().slice(0, 10));
  const rangeIncludesBlockedDates = (from?: Date, to?: Date) => {
    if (!from || !to) return false;
    for (let cursor = new Date(from); cursor < to; cursor = addDays(cursor, 1)) {
      if (isDateBlocked(cursor)) {
        return true;
      }
    }
    return false;
  };

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewSummary, setReviewSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Booking state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoadingReviews(true);
    listListingReviews(listing.id)
      .then((nextReviews) => {
        if (!cancelled) {
          setReviews(nextReviews as Review[]);
        }
      })
      .catch((error) => {
        console.warn('Error fetching reviews:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [listing.id]);

  const handleSummarizeReviews = async () => {
    if (reviews.length === 0) return;
    setIsSummarizing(true);
    try {
      const summary = await summarizeReviews(reviews);
      setReviewSummary(summary || '');
    } catch (err) {
      console.error(err);
      toast.error('Could not summarize the reviews right now.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + (r.cleanliness + r.accuracy + r.communication + r.location + r.value) / 5, 0) / reviews.length).toFixed(1)
    : 'New';

  const ratings = reviews.length > 0 ? {
    cleanliness: (reviews.reduce((acc, r) => acc + r.cleanliness, 0) / reviews.length).toFixed(1),
    accuracy: (reviews.reduce((acc, r) => acc + r.accuracy, 0) / reviews.length).toFixed(1),
    communication: (reviews.reduce((acc, r) => acc + r.communication, 0) / reviews.length).toFixed(1),
    location: (reviews.reduce((acc, r) => acc + r.location, 0) / reviews.length).toFixed(1),
    value: (reviews.reduce((acc, r) => acc + r.value, 0) / reviews.length).toFixed(1),
  } : null;

  const nights = dateRange?.from && dateRange?.to 
    ? differenceInDays(dateRange.to, dateRange.from) 
    : 0;
  
  const subtotal = listing.pricePerNight * nights;
  const totalPrice = subtotal;
  const breakageDeposit = listing.breakageDeposit ?? null;
  const galleryImages = listing.images.length > 0
    ? listing.images
    : [`https://picsum.photos/seed/${listing.id}/1200/900`];
  const selectedImage = galleryImages[Math.min(selectedImageIndex, galleryImages.length - 1)];
  const blockedDates = (listing.blockedDates ?? [])
    .map((blockedDate) => new Date(`${blockedDate}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()));

  useEffect(() => {
    setDateRange((currentRange) => {
      if (
        currentRange?.from &&
        !isDateBlocked(currentRange.from) &&
        (!currentRange.to || !rangeIncludesBlockedDates(currentRange.from, currentRange.to))
      ) {
        return currentRange;
      }

      return undefined;
    });
  }, [listing.id, listing.blockedDates]);

  const handleDateRangeSelect = (nextRange: DateRange | undefined) => {
    setDateRange(nextRange);

    if (nextRange?.from && nextRange?.to) {
      setIsDatePopoverOpen(false);
    }
  };

  const handleBookClick = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select check-in and check-out dates.");
      return;
    }
    if (isDateBlocked(dateRange.from) || rangeIncludesBlockedDates(dateRange.from, dateRange.to)) {
      toast.error("Those dates are no longer available. Please choose different dates.");
      return;
    }
    setIsBooking(true);
    try {
      await onBook({
        checkIn: dateRange.from,
        checkOut: dateRange.to,
        adults,
        children,
        totalPrice,
        breakageDeposit,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to send booking request. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      <div className="p-6 flex justify-between items-center sticky top-0 bg-surface-container-lowest z-10">
        <h2 className="text-2xl font-bold truncate pr-8">{listing.title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Images */}
        <div className="space-y-4">
          <img src={selectedImage} className="w-full aspect-square md:aspect-video rounded-2xl object-cover" alt="" referrerPolicy="no-referrer" />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {galleryImages.map((imageUrl, index) => (
              <button
                key={`${imageUrl}-${index}`}
                type="button"
                onClick={() => setSelectedImageIndex(index)}
                className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border transition-all ${
                  selectedImageIndex === index ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant'
                }`}
              >
                <img src={imageUrl} className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{listing.type} in {listing.location}</h3>
                  <p className="text-on-surface-variant">
                    {listing.adults + listing.children} guests · {listing.bedrooms} bedrooms · {listing.bedrooms} beds · {listing.bathrooms} bath
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-2xl">
                  <Star className="w-5 h-5 fill-black" />
                  <span className="font-bold text-lg">{avgRating}</span>
                  <span className="text-outline-variant">·</span>
                  <span className="text-on-surface-variant">{reviews.length} reviews</span>
                </div>
              </div>
              <hr className="border-outline-variant" />
              <p className="text-on-surface-variant leading-relaxed text-lg">{listing.description}</p>
              {listing.amenities.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Amenities
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {listing.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm font-medium text-on-surface"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ratings Breakdown */}
            {ratings && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold">Guest Ratings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                  {Object.entries(ratings).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-on-surface-variant capitalize">{key}</span>
                      <div className="flex items-center gap-3 flex-1 max-w-[200px] ml-4">
                        <div className="h-1 bg-surface-container-high rounded-full flex-1 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-primary-container" style={{ width: `${(Number(val) / 5) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold w-6">{val}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Reviews</h3>
                {reviews.length > 0 && (
                  <button 
                    onClick={handleSummarizeReviews}
                    disabled={isSummarizing}
                    className="text-xs font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
                  >
                    {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                    Review Snapshot
                  </button>
                )}
              </div>

              {reviewSummary && (
                <Card className="bg-surface-container-low border-outline-variant p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary-container" />
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{reviewSummary}</Markdown>
                  </div>
                </Card>
              )}

              {loadingReviews ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-24 bg-surface-container-low rounded-2xl" />)}
                </div>
              ) : reviews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reviews.map(review => (
                    <Card key={review.id} className="p-6 space-y-4 border-outline-variant">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center font-bold">
                          {review.guestId[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold">Guest</p>
                          <p className="text-xs text-outline-variant">{format(new Date(review.createdAt), 'MMMM yyyy')}</p>
                        </div>
                      </div>
                      <p className="text-on-surface-variant line-clamp-3">{review.comment}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-outline-variant italic">No reviews yet for this listing.</p>
              )}
            </div>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24 shadow-[0_10px_40px_rgba(18,28,42,0.06)] border-outline-variant space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-2xl font-bold">{formatRand(listing.pricePerNight)}</span>
                  <span className="text-on-surface-variant"> / night</span>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Star className="w-4 h-4 fill-black" />
                  <span>{avgRating}</span>
                </div>
              </div>
              
              <div className="border border-outline-variant rounded-xl overflow-hidden">
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                  <PopoverTrigger className="w-full grid grid-cols-2 border-b border-outline-variant text-left hover:bg-surface-container-low transition-colors">
                    <div className={`p-3 border-r border-outline-variant transition-colors ${isDatePopoverOpen && !dateRange?.to ? 'bg-primary/5' : ''}`}>
                      <p className="text-[10px] font-bold uppercase text-on-surface-variant">Check-in</p>
                      <p className="text-sm">{dateRange?.from ? format(dateRange.from, 'MMM d, yyyy') : 'Add date'}</p>
                    </div>
                    <div className={`p-3 transition-colors ${isDatePopoverOpen && dateRange?.from && !dateRange?.to ? 'bg-primary/5' : ''}`}>
                      <p className="text-[10px] font-bold uppercase text-on-surface-variant">Checkout</p>
                      <p className="text-sm">{dateRange?.to ? format(dateRange.to, 'MMM d, yyyy') : 'Add date'}</p>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                      disabled={(date) =>
                        isBefore(date, startOfToday()) ||
                        blockedDates.some((blockedDate) => blockedDate.toDateString() === date.toDateString())
                      }
                      modifiers={{
                        booked: blockedDates,
                      }}
                      modifiersClassNames={{
                        booked: "bg-slate-200 text-slate-500 line-through opacity-100 cursor-not-allowed hover:bg-slate-200 hover:text-slate-500",
                      }}
                    />
                    <div className="border-t border-outline-variant px-4 py-3 text-xs text-on-surface-variant">
                      {!dateRange?.from
                        ? 'Choose your check-in date first.'
                        : !dateRange?.to
                          ? 'Now choose your check-out date.'
                          : 'Dates selected. You can click a new date to start over.'}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger className="w-full p-3 text-left hover:bg-surface-container-low transition-colors">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Guests</p>
                    <p className="text-sm">{adults + children} guest{adults + children !== 1 ? 's' : ''}</p>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="start">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">Adults</p>
                          <p className="text-xs text-on-surface-variant">Age 13+</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-full w-8 h-8"
                            onClick={() => setAdults(Math.max(1, adults - 1))}
                            disabled={adults <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-4 text-center">{adults}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-full w-8 h-8"
                            onClick={() => setAdults(Math.min(listing.adults, adults + 1))}
                            disabled={adults >= listing.adults}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">Children</p>
                          <p className="text-xs text-on-surface-variant">Ages 2–12</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-full w-8 h-8"
                            onClick={() => setChildren(Math.max(0, children - 1))}
                            disabled={children <= 0}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-4 text-center">{children}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-full w-8 h-8"
                            onClick={() => setChildren(Math.min(listing.children, children + 1))}
                            disabled={children >= listing.children}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Button 
                className="w-full py-4 text-lg" 
                onClick={handleBookClick}
                disabled={currentUserId === listing.hostId || isBooking}
              >
                {isBooking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  currentUserId === listing.hostId ? "This is your listing" : "Request to Book"
                )}
              </Button>

              <p className="text-center text-on-surface-variant text-xs font-medium">Payment is handled directly by the host</p>
              
              {nights > 0 && (
                <div className="space-y-3 pt-4 border-t border-outline-variant">
                  <div className="flex justify-between text-on-surface-variant">
                    <span className="underline">{formatRand(listing.pricePerNight)} x {nights} night{nights !== 1 ? 's' : ''}</span>
                    <span>{formatRand(subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-3 border-t border-outline-variant">
                    <span>Estimated Total</span>
                    <span>{formatRand(totalPrice)}</span>
                  </div>
                  <p className="text-[10px] text-outline-variant italic text-center">Final price and payment details will be provided by the host upon confirmation.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

