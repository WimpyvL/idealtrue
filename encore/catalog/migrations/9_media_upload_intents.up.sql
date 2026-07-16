-- Author: ( |╲ ) Klaasvaakie
CREATE TABLE listing_media_upload_intents (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  listing_id TEXT REFERENCES listings (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  expected_size BIGINT NOT NULL CHECK (expected_size > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'committed', 'abandoned')),
  expires_at TIMESTAMPTZ NOT NULL,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX listing_media_upload_intents_expiry_idx
  ON listing_media_upload_intents (status, expires_at);

CREATE INDEX listing_media_upload_intents_listing_idx
  ON listing_media_upload_intents (listing_id, status);
