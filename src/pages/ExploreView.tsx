import React, { useState, useMemo } from 'react';
import { Listing } from '@/types';
import { mockListings } from '@/data/mockListings';
import SearchFilterBar from '@/components/SearchFilterBar';
import FilterBar from '@/components/FilterBar';
import FiltersModal from '@/components/FiltersModal';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import PropertyGrid from '@/components/PropertyGrid';
import PropertyCard from '@/components/PropertyCard';
import PropertyMap from '@/components/PropertyMap';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ExploreView({ listings, onBook }: { listings: Listing[], onBook: (l: Listing) => void }) {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    adults: 0,
    children: 0,
    amenities: [] as string[],
    facilities: [] as string[],
    province: "all",
    category: "all"
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.adults > 0) count++;
    if (filters.children > 0) count++;
    if (filters.amenities.length > 0) count++;
    if (filters.facilities.length > 0) count++;
    if (filters.province !== "all") count++;
    return count;
  }, [filters]);

  const filteredListings = useMemo(() => {
    const source = listings.length > 0 ? listings : mockListings;
    return source.filter(listing => {
      // Category / Subcategory filter
      const matchesCategory = categoryFilter === "all" || 
                             listing.category === categoryFilter || 
                             listing.type === categoryFilter;
      
      // Search query filter
      const matchesSearch = 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.province?.toLowerCase().includes(searchQuery.toLowerCase());

      // Price filter
      const minP = filters.minPrice ? parseInt(filters.minPrice) : 0;
      const maxP = filters.maxPrice ? parseInt(filters.maxPrice) : Infinity;
      const matchesPrice = listing.pricePerNight >= minP && listing.pricePerNight <= maxP;

      // Guests filter
      const matchesGuests = (listing.adults >= filters.adults) && (listing.children >= filters.children);

      // Amenities filter
      const matchesAmenities = filters.amenities.every(a => listing.amenities?.includes(a));

      // Facilities filter
      const matchesFacilities = filters.facilities.every(f => listing.facilities?.includes(f));

      // Province filter
      const matchesProvince = filters.province === "all" || listing.province === filters.province;

      return matchesCategory && matchesSearch && matchesPrice && matchesGuests && matchesAmenities && matchesFacilities && matchesProvince;
    });
  }, [listings, categoryFilter, searchQuery, filters]);

  const recentlyAddedListings = useMemo(() => {
    const source = listings.length > 0 ? listings : mockListings;
    return [...source].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
  }, [listings]);

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
              onChange={(state) => setSearchQuery(state.query)} 
              onSendMessage={(msg) => navigate(`/planner?q=${encodeURIComponent(msg)}`)}
            />
          </div>
        </div>
      </div>

      <FilterBar 
        onFilterChange={(category) => setCategoryFilter(category)} 
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
          <FeaturedCarousel listings={mockListings} onListingClick={onBook} />

          {recentlyAddedListings.length > 0 && (
            <section className="space-y-6 pt-4 pb-8 border-b border-outline-variant/30">
              <header className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Recently Added</h2>
                <p className="text-on-surface-variant">Check out the newest properties on Ideal Stay.</p>
              </header>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10">
                {recentlyAddedListings.map((listing) => (
                  <PropertyCard
                    key={listing.id}
                    listing={listing}
                    onClick={onBook}
                  />
                ))}
              </div>
            </section>
          )}

          <header className="space-y-2 pt-4">
            <h1 className="text-4xl font-bold tracking-tight">Find your next ideal stay</h1>
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
