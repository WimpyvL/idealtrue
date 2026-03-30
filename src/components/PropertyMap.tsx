import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Listing } from "@/types";

import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import L from "leaflet";
import { formatRand } from "@/lib/currency";

// Fix for default marker icon using CDN
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface PropertyMapProps {
  listings: Listing[];
  onListingClick: (listing: Listing) => void;
  apiKey?: string;
}

const defaultCenter: [number, number] = [-29.8587, 31.0218]; // Durban

function MapController({ listings }: { listings: Listing[] }) {
  const map = useMap();

  useEffect(() => {
    if (listings.length > 0) {
      const validCoords = listings.filter(l => l.coordinates).map(l => [l.coordinates!.lat, l.coordinates!.lng] as [number, number]);
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [listings, map]);

  return null;
}

export default function PropertyMap({ listings = [], onListingClick }: PropertyMapProps) {

  return (
    <div className="w-full h-full rounded-xl overflow-hidden z-0 relative">
      <MapContainer
        {...({
          center: defaultCenter,
          zoom: 6,
          style: { width: "100%", height: "100%" }
        } as any)}
      >
        <TileLayer
          {...({
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          } as any)}
        />

        <MapController listings={listings} />

        {(listings || []).filter(l => l.coordinates).map((listing) => (
          <Marker
            key={listing.id}
            position={[listing.coordinates!.lat, listing.coordinates!.lng] as [number, number]}
            eventHandlers={{
              click: () => onListingClick(listing),
            }}
          >
            <Popup>
              <div className="w-64 p-1">
                <div className="relative h-32 w-full mb-2 rounded-lg overflow-hidden">
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="font-semibold text-sm mb-1">{listing.title}</h3>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">{formatRand(listing.pricePerNight)} <span className="font-normal text-on-surface-variant">/ night</span></span>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onListingClick(listing)}
                  >
                    View
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
