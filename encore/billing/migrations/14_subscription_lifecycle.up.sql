-- ( |╲ ) Klaasvaakie - explicit subscription lifecycle state for plan changes, renewal reminders, and grace access.
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS pending_plan TEXT,
ADD COLUMN IF NOT EXISTS pending_billing_interval TEXT,
ADD COLUMN IF NOT EXISTS pending_change_effective_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renewal_due_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_started_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deactivated_notified_at TIMESTAMPTZ;

ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_status_valid;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_status_valid
CHECK (status IN ('active', 'grace_period', 'expired', 'cancelled'));

ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_pending_plan_valid;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_pending_plan_valid
CHECK (pending_plan IS NULL OR pending_plan IN ('free', 'standard', 'professional', 'premium'));

ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_pending_interval_valid;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_pending_interval_valid
CHECK (pending_billing_interval IS NULL OR pending_billing_interval IN ('monthly', 'annual'));
