CREATE TABLE listing_availability_blocks (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  nights TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, source_type, source_id)
);

CREATE INDEX listing_availability_blocks_listing_id_idx
  ON listing_availability_blocks (listing_id, starts_on, ends_on);

CREATE INDEX listing_availability_blocks_source_idx
  ON listing_availability_blocks (source_type, source_id);
