CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  area TEXT,
  province TEXT,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  price_per_night INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms NUMERIC(4,1) NOT NULL DEFAULT 1,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  facilities TEXT[] NOT NULL DEFAULT '{}',
  restaurant_offers TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  is_self_catering BOOLEAN NOT NULL DEFAULT FALSE,
  has_restaurant BOOLEAN NOT NULL DEFAULT FALSE,
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX listings_host_id_idx ON listings (host_id);
CREATE INDEX listings_status_idx ON listings (status);
CREATE INDEX listings_location_idx ON listings (location);
