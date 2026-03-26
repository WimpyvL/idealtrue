ALTER TABLE referral_rewards
  ADD COLUMN program TEXT NOT NULL DEFAULT 'guest',
  ADD COLUMN source_subscription_id TEXT,
  ADD COLUMN note TEXT;

CREATE INDEX referral_rewards_program_idx ON referral_rewards (program, created_at DESC);
CREATE INDEX referral_rewards_source_subscription_idx ON referral_rewards (source_subscription_id);
