CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  role TEXT NOT NULL,
  host_plan TEXT NOT NULL DEFAULT 'free',
  kyc_status TEXT NOT NULL DEFAULT 'none',
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_referral_code_idx ON users (referral_code);
