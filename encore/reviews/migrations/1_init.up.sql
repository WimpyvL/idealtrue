CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  cleanliness INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  communication INTEGER NOT NULL,
  location INTEGER NOT NULL,
  value INTEGER NOT NULL,
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reviews_listing_id_idx ON reviews (listing_id);
