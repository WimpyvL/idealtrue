CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY,
  referral_reward_amount INTEGER NOT NULL DEFAULT 50,
  commission_rate INTEGER NOT NULL DEFAULT 15,
  min_withdrawal_amount INTEGER NOT NULL DEFAULT 100,
  platform_name TEXT NOT NULL DEFAULT 'Ideal Stay',
  support_email TEXT NOT NULL DEFAULT 'support@example.com',
  cancellation_policy_days INTEGER NOT NULL DEFAULT 7,
  max_guests_per_listing INTEGER NOT NULL DEFAULT 10,
  enable_reviews BOOLEAN NOT NULL DEFAULT TRUE,
  enable_referrals BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (
  id,
  referral_reward_amount,
  commission_rate,
  min_withdrawal_amount,
  platform_name,
  support_email,
  cancellation_policy_days,
  max_guests_per_listing,
  enable_reviews,
  enable_referrals,
  maintenance_mode,
  updated_at
)
VALUES (
  'global',
  50,
  15,
  100,
  'Ideal Stay',
  'support@example.com',
  7,
  10,
  TRUE,
  TRUE,
  FALSE,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
