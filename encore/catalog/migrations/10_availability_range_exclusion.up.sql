-- Author: ( |╲ ) Klaasvaakie
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE listing_availability_blocks
  ADD COLUMN availability_range DATERANGE
  GENERATED ALWAYS AS (daterange(starts_on, ends_on, '[)')) STORED;

ALTER TABLE listing_availability_blocks
  ADD CONSTRAINT listing_availability_blocks_no_overlap
  EXCLUDE USING GIST (
    listing_id WITH =,
    availability_range WITH &&
  );

ALTER TABLE listing_availability_blocks
  ADD CONSTRAINT listing_availability_blocks_valid_range
  CHECK (starts_on < ends_on);
