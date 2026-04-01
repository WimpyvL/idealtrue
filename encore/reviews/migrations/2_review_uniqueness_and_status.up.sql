DELETE FROM reviews
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY booking_id
        ORDER BY created_at DESC, id DESC
      ) AS duplicate_rank
    FROM reviews
  ) ranked_reviews
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_id_unique_idx
  ON reviews (booking_id);

CREATE INDEX IF NOT EXISTS reviews_status_idx
  ON reviews (status, created_at DESC);
