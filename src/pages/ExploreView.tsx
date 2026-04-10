import React, { useState, useMemo } from 'react';
import { Listing } from '@/types';
import SearchFilterBar, { SearchFilterState } from '@/components/SearchFilterBar';
import FilterBar from '@/components/FilterBar';
import FiltersModal, { ListingFilters } from '@/components/FiltersModal';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import PropertyGrid from '@/components/PropertyGrid';
import PropertyCard from '@/components/PropertyCard';
import PropertyMap from '@/components/PropertyMap';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { eachDayOfInterval, format, startOfDay } from 'date-fns';

const DEFAULT_LISTING_FILTERS: ListingFilters = {
  minPrice: "",
  maxPrice: "",
  adults: 0,
  children: 0,
  amenities: [],
  facilities: [],
  province: "all",
  category: "all",
};

export default function ExploreView({ listings, onBook }: { listings: Listing[], onBook: (l: Listing) => void }) {
  const navigate = useNavigate();
  const [searchFilters, setSearchFilters] = useState<SearchFilterState>({ query: "", guests: 1 });
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ListingFilters>(DEFAULT_LISTING_FILTERS);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.adults > 0) count++;
    if (filters.children > 0) count++;
    if (filters.amenities.length > 0) count++;
    if (filters.facilities.length > 0) count++;
    if (filters.province !== "all") count++;
    if (filters.category !== "all") count++;
    return count;
  }, [filters]);

  const filteredListings = useMemo(() => {
    const query = searchFilters.query.trim().toLowerCase();
    const selectedListingId = searchFilters.listingId;
    const selectedFrom = searchFilters.date?.from ? startOfDay(searchFilters.date.from) : null;
    const selectedTo = searchFilters.date?.to ? startOfDay(searchFilters.date.to) : null;

    return listings.filter(listing => {
      const matchesCategory = filters.category === "all" ||
        listing.category === filters.category ||
        listing.type === filters.category;
      
      const matchesSearch =
        !query ||
        listing.id === selectedListingId ||
        listing.title.toLowerCase().includes(query) ||
        listing.location.toLowerCase().includes(query) ||
        listing.description.toLowerCase().includes(query) ||
        listing.area?.toLowerCase().includes(query) ||
        listing.province?.toLowerCase().includes(query);

      const minP = filters.minPrice ? parseInt(filters.minPrice) : 0;
      const maxP = filters.maxPrice ? parseInt(filters.maxPrice) : Infinity;
      const matchesPrice = listing.pricePerNight >= minP && listing.pricePerNight <= maxP;

      const requestedGuests = searchFilters.guests || 0;
      const matchesGuests = requestedGuests <= 1 || (listing.adults + listing.children) >= requestedGuests;

      const matchesDateRange = !selectedFrom || !selectedTo || selectedTo < selectedFrom
        ? true
        : (() => {
            const blockedDates = new Set((listing.blockedDates || []).map((date) => date.slice(0, 10)));
            return eachDayOfInterval({ start: selectedFrom, end: selectedTo })
              .map((date) => format(date, 'yyyy-MM-dd'))
              .every((dateKey) => !blockedDates.has(dateKey));
          })();

      const matchesAmenities = filters.amenities.every(a => listing.amenities?.includes(a));

      const matchesFacilities = filters.facilities.every(f => listing.facilities?.includes(f));

      const matchesProvince = filters.province === "all" || listing.province === filters.province;

      return matchesCategory && matchesSearch && matchesPrice && matchesGuests && matchesDateRange && matchesAmenities && matchesFacilities && matchesProvince;
    });
  }, [listings, filters, searchFilters]);

  const recentlyAddedListings = useMemo(() => {
    return [...filteredListings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [filteredListings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex bg-surface-container-high p-0.5 rounded-lg border border-outline-variant/30">
          <button 
            onClick={() => setViewMode('grid')}
            className={cn(
              'px-3 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all',
              viewMode === 'grid' ? 'bg-surface-container-lowest text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Grid
          </button>
          <button 
            onClick={() => setViewMode('map')}
            className={cn(
              'px-3 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all',
              viewMode === 'map' ? 'bg-surface-container-lowest text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Map
          </button>
        </div>
        <div className="w-full max-w-3xl mx-auto flex gap-2 items-center">
          <div className="flex-1">
            <SearchFilterBar 
              listings={listings}
              onChange={setSearchFilters} 
              onSendMessage={(msg) => navigate(`/planner?q=${encodeURIComponent(msg)}`)}
            />
          </div>
        </div>
      </div>

      <FilterBar 
        activeCategory={filters.category}
        onFilterChange={(category) => setFilters((current) => ({ ...current, category }))} 
        onOpenFilters={() => setIsFiltersOpen(true)}
        activeFiltersCount={activeFiltersCount}
      />
      
      <FiltersModal 
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApply={setFilters}
        initialFilters={filters}
      />
      
      {viewMode === 'grid' ? (
        <>
          {recentlyAddedListings.length > 0 && (
            <FeaturedCarousel listings={recentlyAddedListings} onListingClick={onBook} />
          )}

          {recentlyAddedListings.length > 0 && (
            <section className="space-y-6 pt-4 pb-8 border-b border-outline-variant/30">
              <header className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Recently Added</h2>
                <p className="text-on-surface-variant">Check out the newest properties on Ideal Stay.</p>
              </header>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                {recentlyAddedListings.map((listing) => (
                  <PropertyCard
                    key={listing.id}
                    listing={listing}
                    onClick={onBook}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

          <header className="space-y-2 pt-4">
            <h1 className="text-4xl font-bold tracking-tight">Find your next Ideal Stay</h1>
            <p className="text-on-surface-variant text-lg">Discover unique accommodations around the world.</p>
          </header>

          <PropertyGrid listings={filteredListings} onListingClick={onBook} />
        </>
      ) : (
        <div className="h-[70vh] w-full rounded-3xl overflow-hidden border border-outline-variant shadow-xl">
          <PropertyMap listings={filteredListings} onListingClick={onBook} />
        </div>
      )}
    </div>
  );
}
