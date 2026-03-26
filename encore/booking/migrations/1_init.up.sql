CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bookings_guest_id_idx ON bookings (guest_id);
CREATE INDEX bookings_host_id_idx ON bookings (host_id);
CREATE INDEX bookings_listing_id_idx ON bookings (listing_id);
