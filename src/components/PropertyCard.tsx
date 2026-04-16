import { useState, useEffect, useRef } from "react";
import { Listing } from "@/types";
import { Star, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "./ui/use-toast";
import { cn } from "@/lib/utils";

interface PropertyCardProps {
  listing: Listing;
  onClick: (listing: Listing) => void;
  showBorder?: boolean;
  compact?: boolean;
}

export default function PropertyCard({ listing, onClick, showBorder = false, compact = false }: PropertyCardProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.6, // Play when 60% of the card is visible
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const shouldPlay = isHovered || isIntersecting;
    if (shouldPlay && videoRef.current) {
      videoRef.current.play().catch(err => console.warn("Video auto-play blocked or failed", err));
    } else if (!shouldPlay && videoRef.current) {
      videoRef.current.pause();
      if (!isIntersecting) {
        videoRef.current.currentTime = 0;
      }
    }
  }, [isHovered, isIntersecting]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle state locally
    setSaved(!saved);
    toast({ title: saved ? "Removed from wishlist" : "Added to wishlist" });
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group cursor-pointer flex flex-col",
        compact ? "gap-2" : "gap-3",
        showBorder && (compact
          ? "border border-outline-variant rounded-2xl p-2 bg-surface-container-lowest"
          : "border border-outline-variant rounded-2xl p-3 bg-surface-container-lowest")
      )}
      onClick={() => onClick(listing)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn(
        "relative overflow-hidden rounded-xl bg-surface-dim isolate",
        compact ? "aspect-[4/3]" : "aspect-[20/19]",
      )}>
        <img
          src={listing.images[0] || `https://picsum.photos/seed/${listing.id}/800/600`}
          alt={listing.title}
          className={cn(
            "h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
          )}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <button
          className={cn(
            "absolute rounded-full hover:bg-surface/10 transition-all active:scale-90 z-10",
            compact ? "top-2 right-2 p-1.5" : "top-3 right-3 p-2",
          )}
          onClick={toggleWishlist}
        >
          <Heart
            className={cn(
              "transition-colors",
              compact ? "w-4 h-4" : "w-6 h-6",
              saved ? "text-red-500 fill-red-500" : "text-white fill-black/40",
            )}
            strokeWidth={2}
          />
        </button>

        {listing.discount > 0 && (
          <div className={cn("absolute z-10 flex gap-2", compact ? "top-2 left-2" : "top-3 left-3")}>
            <Badge variant="secondary" className={cn(
              "bg-surface/95 text-on-surface font-semibold shadow-sm hover:bg-surface backdrop-blur-sm border-none",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1",
            )}>
              Save {listing.discount}%
            </Badge>
          </div>
        )}
      </div>

      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-semibold text-on-surface truncate uppercase leading-tight",
            compact ? "text-xs sm:text-sm" : "text-sm sm:text-base",
          )}>
            {listing.title}
          </h3>
          <p className={cn(
            "text-on-surface-variant truncate",
            compact ? "text-[11px] mt-0" : "text-xs sm:text-sm mt-0.5",
          )}>
            {listing.location}
          </p>
          <div className={cn("flex flex-col", compact ? "gap-0.5 mt-0.5" : "gap-1 mt-1")}>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "font-semibold text-on-surface",
                compact ? "text-xs sm:text-sm" : "text-sm sm:text-base",
              )}>
                R{listing.pricePerNight.toLocaleString()}
              </span>
              <span className={cn(
                "text-on-surface",
                compact ? "text-[9px]" : "text-[10px] sm:text-xs",
              )}>
                night
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
