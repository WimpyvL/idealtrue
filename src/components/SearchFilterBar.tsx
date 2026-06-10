import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Plus, Minus, MapPin, Search, TrendingUp, Building, Home, Palmtree, LucideIcon } from "lucide-react";
import type { Listing } from "@/types";
import { fetchPlaceAutocomplete, fetchPlaceDetails, type GooglePlacePrediction } from "@/lib/google-places";
import { persistSearchContext, type SearchContextPlace } from "@/lib/search-context";

export type SearchFilterState = {
  query: string;
  listingId?: string;
  place?: SearchContextPlace;
  guests: number;
  date?: {
    from?: Date;
    to?: Date;
  };
};

type Props = {
  onChange: (state: SearchFilterState) => void;
  onModeChange?: (mode: 'chat' | 'search') => void;
  onSendMessage?: (message: string) => void;
  mode?: 'chat' | 'search';
  listings?: Listing[];
};

// Popular destinations shown when user focuses the input
const POPULAR_DESTINATIONS = [
  { label: "Cape Town", type: "city" as const, icon: Building },
  { label: "Johannesburg", type: "city" as const, icon: Building },
  { label: "Durban", type: "city" as const, icon: Palmtree },
  { label: "Kruger National Park", type: "place" as const, icon: MapPin },
  { label: "Garden Route", type: "place" as const, icon: Palmtree },
  { label: "Western Cape", type: "province" as const, icon: MapPin },
];

export default function SearchFilterBar({ onChange, onModeChange, onSendMessage, mode = 'search', listings = [] }: Props) {
  const [isFlipped, setIsFlipped] = useState(mode === 'search');
  const [message, setMessage] = useState("");
  const [showCheckInCal, setShowCheckInCal] = useState(false);
  const [showCheckOutCal, setShowCheckOutCal] = useState(false);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(1);
  const [location, setLocation] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>();
  const [selectedPlace, setSelectedPlace] = useState<SearchContextPlace | undefined>();
  const [selectedListingBlockedDates, setSelectedListingBlockedDates] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{
    label: string;
    type: "province" | "place" | "listing" | "city";
    icon?: LucideIcon;
    listingId?: string;
    blockedDates?: string[];
    placeId?: string;
    secondaryText?: string;
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const checkOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestLocationRef = useRef("");

  // Sync isFlipped with mode prop
  useEffect(() => {
    setIsFlipped(mode === 'search');
  }, [mode]);

  useEffect(() => {
    if (!selectedListingId) {
      return;
    }

    const selectedListing = listings.find((listing) => listing.id === selectedListingId);
    setSelectedListingBlockedDates(selectedListing?.blockedDates ?? []);
  }, [listings, selectedListingId]);

  const handleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    setShowCheckInCal(false);
    setShowCheckOutCal(false);
    onModeChange?.(nextFlipped ? 'search' : 'chat');
  };

  const emit = (
    loc = location,
    g = guests,
    from = checkIn ?? undefined,
    to = checkOut ?? undefined,
    listingId = selectedListingId,
    place = selectedPlace,
  ) => {
    onChange({ query: loc, listingId, place, guests: g, date: { from, to } });
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), i - today.getDay() + 1);
      days.push(date);
    }
    return days;
  };

  const handleLocationFocus = () => {
    setShowSuggestions(true);
    if (!location.trim()) {
      // Show popular destinations when field is empty
      setSuggestions(POPULAR_DESTINATIONS.map(d => ({ ...d })));
    }
  };

  const handleLocationChange = (v: string) => {
    latestLocationRef.current = v;
    setLocation(v);
    setSelectedListingId(undefined);
    setSelectedPlace(undefined);
    persistSearchContext(null);
    setSelectedListingBlockedDates([]);
    emit(v, guests, checkIn ?? undefined, checkOut ?? undefined, undefined, undefined);
    setShowSuggestions(true);
    setActiveIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!v.trim()) {
      setSuggestions(POPULAR_DESTINATIONS.map(d => ({ ...d })));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      const requestQuery = v.trim();
      const normalizedQuery = requestQuery.toLowerCase();
      const data = listings.filter((listing) =>
          listing.title.toLowerCase().includes(normalizedQuery) ||
          listing.location.toLowerCase().includes(normalizedQuery) ||
          listing.area?.toLowerCase().includes(normalizedQuery) ||
          listing.province?.toLowerCase().includes(normalizedQuery),
      );

      const listingSuggestions: { label: string; type: "listing"; icon: LucideIcon; listingId: string; blockedDates: string[] }[] = [];
      const provinces = new Set<string>();

      data.forEach((p: Listing) => {
        if (p.title) {
          listingSuggestions.push({
            label: p.title,
            type: "listing",
            icon: Home,
            listingId: p.id,
            blockedDates: p.blockedDates ?? [],
          });
        }
        if (p.province && p.province.toLowerCase().includes(requestQuery.toLowerCase())) {
          provinces.add(p.province);
        }
      });

      const provinceItems = Array.from(provinces).slice(0, 2).map((p) => ({ label: p, type: "province" as const, icon: MapPin }));

      void fetchPlaceAutocomplete(requestQuery, { regionCodes: ["za"], limit: 5 })
        .then((predictions) => {
          if (latestLocationRef.current.trim() !== requestQuery) {
            return;
          }

          const googleSuggestions = predictions.map((prediction: GooglePlacePrediction) => ({
            label: prediction.label,
            type: "place" as const,
            icon: MapPin,
            placeId: prediction.placeId,
            secondaryText: prediction.secondaryText,
          }));

          const merged = [...googleSuggestions, ...provinceItems, ...listingSuggestions.slice(0, 5)];
          const deduped = merged.filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label && candidate.type === item.type) === index);
          setSuggestions(deduped);
        })
        .catch(() => {
          if (latestLocationRef.current.trim() !== requestQuery) {
            return;
          }

          const merged = [...provinceItems, ...listingSuggestions.slice(0, 5)];
          setSuggestions(merged);
        })
        .finally(() => {
          if (latestLocationRef.current.trim() === requestQuery) {
            setIsLoading(false);
          }
        });
    }, 250);
  };

  const pickSuggestion = async (s: { label: string; type: "province" | "place" | "listing" | "city"; listingId?: string; blockedDates?: string[]; placeId?: string }) => {
    setShowSuggestions(false);

    if (s.placeId && s.type !== "listing") {
      try {
        const placeDetails = await fetchPlaceDetails(s.placeId);
        const nextPlace: SearchContextPlace = {
          placeId: placeDetails.placeId,
          label: placeDetails.label,
          formattedAddress: placeDetails.formattedAddress,
          coordinates: placeDetails.coordinates,
        };
        const nextLabel = placeDetails.formattedAddress || placeDetails.label || s.label;
        setLocation(nextLabel);
        setSelectedListingId(undefined);
        setSelectedPlace(nextPlace);
        setSelectedListingBlockedDates([]);
        persistSearchContext(nextPlace);
        emit(nextLabel, guests, checkIn ?? undefined, checkOut ?? undefined, undefined, nextPlace);
        return;
      } catch {
        // Fall back to the raw suggestion label if Google place details fail.
      }
    }

    setLocation(s.label);
    const nextListingId = s.type === "listing" ? s.listingId : undefined;
    setSelectedListingId(nextListingId);
    setSelectedPlace(undefined);
    setSelectedListingBlockedDates(nextListingId ? (s.blockedDates ?? []) : []);
    persistSearchContext(null);
    emit(s.label, guests, checkIn ?? undefined, checkOut ?? undefined, nextListingId, undefined);
  };

  const onLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (checkOutTimerRef.current) {
        clearTimeout(checkOutTimerRef.current);
      }
    };
  }, []);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDateSelect = (date: Date, type: "checkin" | "checkout") => {
    if (type === "checkin") {
      setCheckIn(date);
      setShowCheckInCal(false);
      if (checkOutTimerRef.current) {
        clearTimeout(checkOutTimerRef.current);
      }
      checkOutTimerRef.current = setTimeout(() => setShowCheckOutCal(true), 300);
      emit(location, guests, date, checkOut ?? undefined);
    } else {
      setCheckOut(date);
      setShowCheckOutCal(false);
      emit(location, guests, checkIn ?? undefined, date);
    }
  };

  const CalendarDropdown = ({ onSelect, selectedDate, type, minDate }: { onSelect: (d: Date) => void; selectedDate: Date | null; type: "checkin" | "checkout"; minDate?: Date | null }) => {
    const days = generateCalendarDays();
    const today = new Date();
    const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const blockedDateSet = new Set(selectedListingBlockedDates);

    return (
      <div
        className="absolute top-full mt-2 z-40 w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-surface p-4"
        style={{
          animation: "slideDown 0.3s ease-out",
          left: type === "checkin" ? "0" : "auto",
          right: type === "checkout" ? "0" : "auto",
          boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <div className="text-center mb-3">
          <h3 className="text-slate-800 font-semibold">{monthName}</h3>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-slate-500 p-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, idx) => {
            const dateKey = date.toISOString().slice(0, 10);
            const isToday = date.toDateString() === today.toDateString();
            const isPast = date < today && !isToday;
            const isBeforeMin = minDate && date < minDate;
            const isBlocked = blockedDateSet.has(dateKey);
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            return (
              <button
                key={idx}
                onClick={() => !isPast && !isBeforeMin && !isBlocked && onSelect(date)}
                disabled={isPast || isBeforeMin || isBlocked}
                className={`p-2 rounded-lg text-sm transition-all ${
                  isBlocked
                    ? "bg-slate-200 text-slate-500 line-through cursor-not-allowed"
                    : isPast || isBeforeMin
                      ? "text-slate-300 cursor-not-allowed"
                      : "hover:bg-primary/10 cursor-pointer"
                } ${isToday && !isBlocked ? "bg-primary/20 text-primary font-semibold" : ""} ${isSelected ? "bg-primary text-white font-semibold" : !isBlocked ? "text-slate-700" : ""}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-0 flex items-center justify-center">
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="mx-auto my-2 w-full max-w-full md:max-w-3xl">
        <div className="relative z-30 rounded-[2rem] border border-outline-variant bg-surface-container-lowest p-1.5 shadow-[0_10px_40px_rgba(18,28,42,0.06)] transition-all hover:shadow-2xl md:rounded-full">
          <div className="relative z-30 h-[10.5rem] md:h-14">
            <div
              className="absolute w-full h-full z-30"
              style={{ transformStyle: "preserve-3d", transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)", transform: isFlipped ? "rotateX(180deg)" : "rotateX(0deg)" }}
            >
              <div className="absolute h-full w-full md:hidden" style={{ backfaceVisibility: "hidden" }}>
                <div className="flex h-full flex-col gap-2 rounded-[1.75rem] bg-surface p-2">
                  <div className="flex items-center gap-2">
                    <button onClick={handleFlip} className="rounded-full bg-[#08a8c8] p-2.5 shadow-lg shadow-[#08a8c8]/20 transition-all hover:bg-[#08a8c8]/90">
                      <Sparkles className="h-4 w-4 text-white" />
                    </button>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onSendMessage?.(message)}
                      placeholder="Describe the trip you want to plan..."
                      className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-on-surface outline-none placeholder-on-surface-variant"
                    />
                    <button className="rounded-full bg-[#08a8c8] p-2.5 shadow-lg shadow-[#08a8c8]/20 transition-all hover:bg-[#08a8c8]/90" onClick={() => onSendMessage?.(message)}>
                      <Send className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="absolute h-full w-full hidden md:block" style={{ backfaceVisibility: "hidden" }}>
                <div className="bg-surface rounded-full p-2 flex items-center gap-3 h-full">
                  <button onClick={handleFlip} className="p-2.5 rounded-full bg-[#08a8c8] hover:bg-[#08a8c8]/90 transition-all shadow-lg shadow-[#08a8c8]/20">
                    <Sparkles className="w-4 h-4 text-white" />
                  </button>
                  <input 
                    type="text" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && onSendMessage?.(message)}
                    placeholder="Describe the trip you want to plan..." 
                    className="flex-1 bg-transparent text-on-surface placeholder-on-surface-variant outline-none text-base px-2 font-medium" 
                  />
                  <button className="p-2.5 rounded-full bg-[#08a8c8] hover:bg-[#08a8c8]/90 transition-all shadow-lg shadow-[#08a8c8]/20" onClick={() => onSendMessage?.(message)}>
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="absolute w-full h-full" style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}>
                <div className="hidden h-full items-center divide-x divide-outline-variant rounded-full bg-surface-container-lowest p-1 md:flex">
                  <button onClick={handleFlip} className="p-3 rounded-full hover:bg-surface-container-low transition-colors mr-1">
                    <Sparkles className="w-4 h-4 text-on-surface-variant" />
                  </button>

                  <div ref={inputRef} className="relative flex-1 px-4 hover:bg-surface-container-low rounded-full transition-colors cursor-pointer group">
                    <div className="text-[10px] font-bold text-on-surface uppercase tracking-wider mb-0.5">Where</div>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      onFocus={handleLocationFocus}
                      onKeyDown={onLocationKeyDown}
                      placeholder="Search destinations"
                      className="w-full bg-transparent border-none text-on-surface-variant text-sm outline-none placeholder-on-surface-variant truncate"
                    />
                    {showSuggestions && (
                      <div className="absolute top-full left-0 z-50 mt-4 w-[min(350px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_10px_40px_rgba(18,28,42,0.06)]">
                        {!location.trim() && (
                          <div className="px-4 py-2 border-b border-outline-variant">
                            <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                              <TrendingUp className="w-3 h-3" />
                              Popular Destinations
                            </div>
                          </div>
                        )}
                        {isLoading ? (
                          <div className="px-4 py-6 text-center">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <span className="text-sm text-on-surface-variant">Searching...</span>
                          </div>
                        ) : suggestions.length > 0 ? (
                          <ul className="max-h-72 overflow-auto py-2">
                            {suggestions.map((s, idx) => {
                              const IconComp = s.icon || MapPin;
                              return (
                                <li key={`${s.type}-${s.label}-${idx}`}>
                                  <button
                                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-surface-container-low transition-colors ${activeIndex === idx ? "bg-surface-container-low" : ""}`}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => pickSuggestion(s)}
                                  >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.type === 'city' ? 'bg-primary/10' :
                                      s.type === 'province' ? 'bg-green-100' :
                                        s.type === 'listing' ? 'bg-purple-100' : 'bg-surface-dim'
                                      }`}>
                                      <IconComp className={`w-5 h-5 ${s.type === 'city' ? 'text-primary' :
                                        s.type === 'province' ? 'text-green-600' :
                                          s.type === 'listing' ? 'text-purple-600' : 'text-on-surface-variant'
                                        }`} />
                                    </div>
                                      <div className="flex flex-col">
                                        <span className="font-medium text-on-surface">{s.label}</span>
                                        <span className={`text-xs capitalize ${s.type === 'city' ? 'text-primary/80' :
                                          s.type === 'province' ? 'text-green-500' :
                                            s.type === 'listing' ? 'text-purple-500' : 'text-on-surface-variant'
                                        }`}>{s.type === 'listing' ? 'Property' : s.secondaryText || s.type}</span>
                                      </div>
                                    </button>
                                  </li>
                              );
                            })}
                          </ul>
                        ) : location.trim() ? (
                          <div className="px-4 py-6 text-center">
                            <MapPin className="w-8 h-8 text-outline-variant mx-auto mb-2" />
                            <span className="text-sm text-on-surface-variant">No destinations found</span>
                            <p className="text-xs text-on-surface-variant mt-1">Try a different search term</p>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="relative px-4 hover:bg-surface-container-low rounded-full transition-colors cursor-pointer group flex flex-col justify-center" onClick={() => { setShowCheckInCal(!showCheckInCal); setShowCheckOutCal(false); }}>
                    <div className="text-[10px] font-bold text-on-surface uppercase tracking-wider mb-0.5">Check in</div>
                    <div className="text-sm text-on-surface-variant truncate">
                      {checkIn ? formatDate(checkIn) : "Add dates"}
                    </div>
                    {showCheckInCal && (
                      <CalendarDropdown
                        type="checkin"
                        selectedDate={checkIn}
                        onSelect={(d) => handleDateSelect(d, "checkin")}
                      />
                    )}
                  </div>

                  <div className="relative px-4 hover:bg-surface-container-low rounded-full transition-colors cursor-pointer group flex flex-col justify-center" onClick={() => { setShowCheckOutCal(!showCheckOutCal); setShowCheckInCal(false); }}>
                    <div className="text-[10px] font-bold text-on-surface uppercase tracking-wider mb-0.5">Check out</div>
                    <div className="text-sm text-on-surface-variant truncate">
                      {checkOut ? formatDate(checkOut) : "Add dates"}
                    </div>
                    {showCheckOutCal && (
                      <CalendarDropdown
                        type="checkout"
                        selectedDate={checkOut}
                        minDate={checkIn}
                        onSelect={(d) => handleDateSelect(d, "checkout")}
                      />
                    )}
                  </div>

                  <div className="relative px-4 hover:bg-surface-container-low rounded-full transition-colors cursor-pointer group flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-on-surface uppercase tracking-wider mb-0.5">Who</div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setGuests(Math.max(1, guests - 1)); emit(location, Math.max(1, guests - 1)); }}
                        className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium text-on-surface min-w-[1rem] text-center">{guests}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setGuests(guests + 1); emit(location, guests + 1); }}
                        className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="pl-2 pr-1 flex items-center ml-auto">
                    <button className="p-3 rounded-full bg-[#08a8c8] text-white hover:bg-[#08a8c8]/90 transition-all shadow-lg shadow-[#08a8c8]/20" onClick={() => emit()}>
                      <Search className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <div className="grid h-full grid-cols-2 gap-2 rounded-[1.75rem] bg-surface-container-lowest p-2 md:hidden">
                  <div className="col-span-2 flex items-center gap-2 rounded-[1.5rem] bg-surface px-3 py-2">
                    <button onClick={handleFlip} className="rounded-full p-2 transition-colors hover:bg-surface-container-low">
                      <Sparkles className="h-4 w-4 text-on-surface-variant" />
                    </button>
                    <div ref={inputRef} className="relative min-w-0 flex-1">
                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface">Where</div>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => handleLocationChange(e.target.value)}
                        onFocus={handleLocationFocus}
                        onKeyDown={onLocationKeyDown}
                        placeholder="Search destinations"
                        className="w-full min-w-0 bg-transparent text-sm text-on-surface-variant outline-none placeholder-on-surface-variant"
                      />
                      {showSuggestions && (
                        <div className="absolute left-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_10px_40px_rgba(18,28,42,0.06)]">
                          {!location.trim() && (
                            <div className="border-b border-outline-variant px-4 py-2">
                              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                                <TrendingUp className="h-3 w-3" />
                                Popular Destinations
                              </div>
                            </div>
                          )}
                          {isLoading ? (
                            <div className="px-4 py-6 text-center">
                              <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              <span className="text-sm text-on-surface-variant">Searching...</span>
                            </div>
                          ) : suggestions.length > 0 ? (
                            <ul className="max-h-72 overflow-auto py-2">
                              {suggestions.map((s, idx) => {
                                const IconComp = s.icon || MapPin;
                                return (
                                  <li key={`${s.type}-${s.label}-${idx}`}>
                                    <button
                                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-container-low ${activeIndex === idx ? "bg-surface-container-low" : ""}`}
                                      onMouseEnter={() => setActiveIndex(idx)}
                                      onClick={() => pickSuggestion(s)}
                                    >
                                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.type === 'city' ? 'bg-primary/10' :
                                        s.type === 'province' ? 'bg-green-100' :
                                          s.type === 'listing' ? 'bg-purple-100' : 'bg-surface-dim'
                                        }`}>
                                        <IconComp className={`h-5 w-5 ${s.type === 'city' ? 'text-primary' :
                                          s.type === 'province' ? 'text-green-600' :
                                            s.type === 'listing' ? 'text-purple-600' : 'text-on-surface-variant'
                                          }`} />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-medium text-on-surface">{s.label}</span>
                                        <span className={`text-xs capitalize ${s.type === 'city' ? 'text-primary/80' :
                                          s.type === 'province' ? 'text-green-500' :
                                            s.type === 'listing' ? 'text-purple-500' : 'text-on-surface-variant'
                                          }`}>{s.type === 'listing' ? 'Property' : s.secondaryText || s.type}</span>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : location.trim() ? (
                            <div className="px-4 py-6 text-center">
                              <MapPin className="mx-auto mb-2 h-8 w-8 text-outline-variant" />
                              <span className="text-sm text-on-surface-variant">No destinations found</span>
                              <p className="mt-1 text-xs text-on-surface-variant">Try a different search term</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative rounded-[1.5rem] bg-surface px-3 py-2" onClick={() => { setShowCheckInCal(!showCheckInCal); setShowCheckOutCal(false); }}>
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface">Check in</div>
                    <div className="truncate text-sm text-on-surface-variant">
                      {checkIn ? formatDate(checkIn) : "Add dates"}
                    </div>
                    {showCheckInCal && (
                      <CalendarDropdown
                        type="checkin"
                        selectedDate={checkIn}
                        onSelect={(d) => handleDateSelect(d, "checkin")}
                      />
                    )}
                  </div>

                  <div className="relative rounded-[1.5rem] bg-surface px-3 py-2" onClick={() => { setShowCheckOutCal(!showCheckOutCal); setShowCheckInCal(false); }}>
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface">Check out</div>
                    <div className="truncate text-sm text-on-surface-variant">
                      {checkOut ? formatDate(checkOut) : "Add dates"}
                    </div>
                    {showCheckOutCal && (
                      <CalendarDropdown
                        type="checkout"
                        selectedDate={checkOut}
                        minDate={checkIn}
                        onSelect={(d) => handleDateSelect(d, "checkout")}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-[1.5rem] bg-surface px-3 py-2">
                    <div>
                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface">Who</div>
                      <span className="text-sm font-medium text-on-surface">{guests}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setGuests(Math.max(1, guests - 1)); emit(location, Math.max(1, guests - 1)); }}
                        className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setGuests(guests + 1); emit(location, guests + 1); }}
                        className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <button
                    className="flex items-center justify-center rounded-[1.5rem] bg-[#08a8c8] text-white shadow-lg shadow-[#08a8c8]/20 transition-all hover:bg-[#08a8c8]/90"
                    onClick={() => emit()}
                  >
                    <Search className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
