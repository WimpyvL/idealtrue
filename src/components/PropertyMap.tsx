import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/types";
import { formatRand } from "@/lib/currency";
import { getGoogleMapsApiKey, loadGoogleMapsScript } from "@/lib/google-maps";
import { getListingNightlyRate } from "@/lib/listing-pricing";

interface PropertyMapProps {
  listings: Listing[];
  onListingClick: (listing: Listing) => void;
}

const defaultCenter = { lat: -29.8587, lng: 31.0218 };

function buildInfoWindowContent(listing: Listing, onView: () => void) {
  const content = document.createElement("div");
  content.className = "w-64 p-1";

  const imageWrap = document.createElement("div");
  imageWrap.className = "relative mb-2 h-32 w-full overflow-hidden rounded-lg";

  const image = document.createElement("img");
  image.src = listing.images[0];
  image.alt = listing.title;
  image.className = "h-full w-full object-cover";
  image.referrerPolicy = "no-referrer";
  imageWrap.appendChild(image);

  const title = document.createElement("h3");
  title.className = "mb-1 text-sm font-semibold";
  title.textContent = listing.title;

  const footer = document.createElement("div");
  footer.className = "flex items-center justify-between gap-3";

  const price = document.createElement("span");
  price.className = "text-sm font-bold";
  price.innerHTML = `${formatRand(getListingNightlyRate(listing))} <span class="font-normal text-slate-500">/ night</span>`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "inline-flex h-7 items-center rounded-md bg-[#08a8c8] px-3 text-xs font-medium text-white";
  button.textContent = "View";
  button.addEventListener("click", onView);

  footer.appendChild(price);
  footer.appendChild(button);

  content.appendChild(imageWrap);
  content.appendChild(title);
  content.appendChild(footer);

  return content;
}

export default function PropertyMap({ listings = [], onListingClick }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const hasGoogleMapsKey = useMemo(() => Boolean(getGoogleMapsApiKey()), []);

  useEffect(() => {
    if (!mapRef.current || !hasGoogleMapsKey) {
      return;
    }

    let cancelled = false;

    void loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) {
          return;
        }

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center: defaultCenter,
            zoom: 6,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: "greedy",
          });
          infoWindowRef.current = new window.google.maps.InfoWindow();
        }

        setMapError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load Google Maps:", error);
          setMapError("Google Maps could not be loaded right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasGoogleMapsKey]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();

    const validListings = listings.filter((listing) => listing.coordinates);
    if (validListings.length === 0) {
      map.setCenter(defaultCenter);
      map.setZoom(6);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    validListings.forEach((listing) => {
      const marker = new window.google.maps.Marker({
        map,
        position: listing.coordinates!,
        title: listing.title,
      });

      marker.addListener("click", () => {
        const infoWindow = infoWindowRef.current ?? new window.google.maps.InfoWindow();
        infoWindowRef.current = infoWindow;
        infoWindow.setContent(buildInfoWindowContent(listing, () => onListingClick(listing)));
        infoWindow.open({ anchor: marker, map });
      });

      markersRef.current.push(marker);
      bounds.extend(listing.coordinates!);
    });

    if (validListings.length === 1) {
      map.setCenter(validListings[0].coordinates!);
      map.setZoom(13);
      return;
    }

    map.fitBounds(bounds, 50);
  }, [listings, onListingClick]);

  if (!hasGoogleMapsKey) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-center text-sm text-on-surface-variant">
        Add `VITE_GOOGLE_MAPS_API_KEY` to render the Google marketplace map.
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-center text-sm text-on-surface-variant">
        {mapError}
      </div>
    );
  }

  return <div ref={mapRef} className="relative z-0 h-full w-full overflow-hidden rounded-xl" />;
}
