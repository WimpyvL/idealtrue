import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Plus, Minus, MapPin, Search, TrendingUp, Building, Home, Palmtree, LucideIcon } from "lucide-react";
import { db } from "@/firebase";
import { collection, query, getDocs, limit } from "firebase/firestore";

type Props = {
  onChange: (state: { query: string; guests: number; date?: { from?: Date; to?: Date } }) => void;
  onModeChange?: (mode: 'chat' | 'search') => void;
  onSendMessage?: (message: string) => void;
  mode?: 'chat' | 'search';
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

export default function SearchFilterBar({ onChange, onModeChange, onSendMessage, mode = 'search' }: Props) {
  const [isFlipped, setIsFlipped] = useState(mode === 'search');
  const [message, setMessage] = useState("");
  const [showCheckInCal, setShowCheckInCal] = useState(false);
  const [showCheckOutCal, setShowCheckOutCal] = useState(false);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(1);
  const [location, setLocation] = useState("");
  const [suggestions, setSuggestions] = useState<{ label: string; type: "province" | "place" | "listing" | "city"; icon?: LucideIcon }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync isFlipped with mode prop
  useEffect(() => {
    setIsFlipped(mode === 'search');
  }, [mode]);

  const handleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    setShowCheckInCal(false);
    setShowCheckOutCal(false);
    onModeChange?.(nextFlipped ? 'search' : 'chat');
  };

  const emit = (loc = location, g = guests, from = checkIn ?? undefined, to = checkOut ?? undefined) => {
    onChange({ query: loc, guests: g, date: { from, to } });
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
    setLocation(v);
    emit(v);
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
    debounceRef.current = setTimeout(async () => {
      try {
        const q = query(
          collection(db, "listings"),
          limit(8)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data());

        const places = new Map<string, boolean>();
        const listings: { label: string; type: "listing"; icon: LucideIcon }[] = [];
        const provinces = new Set<string>();

        (data || []).forEach((p: any) => {
          if (p.location && !places.has(p.location)) {
            places.set(p.location, true);
          }
          if (p.title) {
            listings.push({ label: p.title, type: "listing", icon: Home });
          }
          if (p.province && p.province.toLowerCase().includes(v.toLowerCase())) {
            provinces.add(p.province);
          }
        });

        const placeItems = Array.from(places.keys()).slice(0, 4).map(l => ({ label: l, type: "place" as const, icon: MapPin }));
        const provinceItems = Array.from(provinces).slice(0, 2).map(p => ({ label: p, type: "province" as const, icon: MapPin }));

        const merged = [...provinceItems, ...placeItems, ...listings.slice(0, 3)];

        // If no results, show "no matches" state
        if (merged.length === 0) {
          setSuggestions([]);
        } else {
          setSuggestions(merged);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);
  };

  const pickSuggestion = (s: { label: string; type: "province" | "place" | "listing" | "city" }) => {
    setLocation(s.label);
    emit(s.label);
    setShowSuggestions(false);
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

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDateSelect = (date: Date, type: "checkin" | "checkout") => {
    if (type === "checkin") {
      setCheckIn(date);
      setShowCheckInCal(false);
      setTimeout(() => setShowCheckOutCal(true), 300);
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

    return (
      <div
        className="absolute top-full mt-2 bg-surface rounded-2xl p-4 z-40 w-[320px]"
        style={{
          animation: "slideDown 0.3s ease-out",
          left: type === "checkin" ? "0" : "auto",
          right: type === "checkout" ? "0" : "auto",
          boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
          minWidth: "300px",
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
            const isToday = date.toDateString() === today.toDateString();
            const isPast = date < today && !isToday;
            const isBeforeMin = minDate && date < minDate;
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            return (
              <button
                key={idx}
                onClick={() => !isPast && !isBeforeMin && onSelect(date)}
                disabled={isPast || isBeforeMin}
                className={`p-2 rounded-lg text-sm transition-all ${isPast || isBeforeMin ? "text-slate-300 cursor-not-allowed" : "hover:bg-primary/10 cursor-pointer"} ${isToday ? "bg-primary/20 text-primary font-semibold" : ""} ${isSelected ? "bg-primary text-white font-semibold" : "text-slate-700"}`}
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
      <div className="w-full max-w-3xl mx-auto mt-2 mb-2">
        <div className="bg-surface-container-lowest rounded-full border border-outline-variant shadow-[0_10px_40px_rgba(18,28,42,0.06)] p-1.5 relative z-30 transition-all hover:shadow-2xl">
          <div className="relative h-14 z-30">
            <div
              className="absolute w-full h-full z-30"
              style={{ transformStyle: "preserve-3d", transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)", transform: isFlipped ? "rotateX(180deg)" : "rotateX(0deg)" }}
            >
              <div className="absolute w-full h-full" style={{ backfaceVisibility: "hidden" }}>
                <div className="bg-surface rounded-full p-2 flex items-center gap-3 h-full">
                  <button onClick={handleFlip} className="p-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-4 h-4 text-white" />
                  </button>
                  <input 
                    type="text" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && onSendMessage?.(message)}
                    placeholder="Describe your dream stay..." 
                    className="flex-1 bg-transparent text-on-surface placeholder-on-surface-variant outline-none text-base px-2 font-medium" 
                  />
                  <button className="p-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30" onClick={() => onSendMessage?.(message)}>
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="absolute w-full h-full" style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}>
                <div className="bg-surface-container-lowest rounded-full p-1 flex items-center h-full divide-x divide-outline-variant">
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
                      <div className="absolute top-full left-0 mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-[0_10px_40px_rgba(18,28,42,0.06)] w-[350px] z-50 overflow-hidden">
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
                                        }`}>{s.type === 'listing' ? 'Property' : s.type}</span>
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
                    <button className="p-3 rounded-full bg-gradient-to-r from-slate-900 to-blue-600 text-white hover:opacity-90 transition-all shadow-lg shadow-blue-900/30" onClick={() => emit()}>
                      <Search className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
