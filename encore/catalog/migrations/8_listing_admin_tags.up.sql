ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS admin_tag_key TEXT,
  ADD COLUMN IF NOT EXISTS admin_tag_note TEXT,
  ADD COLUMN IF NOT EXISTS admin_tag_applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_tag_applied_by TEXT;

CREATE INDEX IF NOT EXISTS listings_admin_tag_key_idx
  ON listings (admin_tag_key);
