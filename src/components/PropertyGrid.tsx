import { Listing } from "@/types";
import PropertyCard from "./PropertyCard";

interface PropertyGridProps {
  listings: Listing[];
  onListingClick: (listing: Listing) => void;
  compact?: boolean;
}

export default function PropertyGrid({ listings, onListingClick, compact = false }: PropertyGridProps) {
  if (!listings || listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-2xl font-semibold mb-2">No listings found</h3>
        <p className="text-on-surface-variant">Try adjusting your search or filters to find what you're looking for.</p>
      </div>
    );
  }

  return (
    <div className={compact
      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-6 pb-20"
      : "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10 pb-20"
    }>
      {listings.map((listing) => (
        <PropertyCard
          key={listing.id}
          listing={listing}
          onClick={onListingClick}
        />
      ))}
    </div>
  );
}
