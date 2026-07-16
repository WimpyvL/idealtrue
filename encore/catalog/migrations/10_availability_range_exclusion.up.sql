-- Author: ( |╲ ) Klaasvaakie
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  DELETE FROM listing_availability_blocks
  WHERE starts_on >= ends_on;

  WITH ordered_rows AS (
    SELECT
      id,
      listing_id,
      starts_on,
      ends_on,
      row_number() OVER (
        PARTITION BY listing_id
        ORDER BY starts_on, ends_on, id
      ) AS rn
    FROM listing_availability_blocks
  ),
  overlaps AS (
    SELECT a.id
    FROM ordered_rows a
    JOIN ordered_rows b
      ON a.listing_id = b.listing_id
     AND b.rn < a.rn
    WHERE a.starts_on < b.ends_on
      AND b.starts_on < a.ends_on
  )
  DELETE FROM listing_availability_blocks target
  USING overlaps
  WHERE target.id = overlaps.id;
END $$;

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
