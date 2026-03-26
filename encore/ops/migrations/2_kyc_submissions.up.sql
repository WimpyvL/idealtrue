CREATE TABLE IF NOT EXISTS kyc_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  id_image_key TEXT NOT NULL,
  selfie_image_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS kyc_submissions_user_id_idx ON kyc_submissions (user_id);
CREATE INDEX IF NOT EXISTS kyc_submissions_status_idx ON kyc_submissions (status);
