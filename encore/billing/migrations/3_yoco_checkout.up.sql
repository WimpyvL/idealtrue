CREATE TABLE billing_checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  checkout_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'yoco',
  status TEXT NOT NULL DEFAULT 'pending',
  currency TEXT NOT NULL DEFAULT 'ZAR',
  amount INTEGER NOT NULL,
  host_plan TEXT,
  billing_interval TEXT,
  credit_quantity INTEGER,
  provider_checkout_id TEXT,
  provider_payment_id TEXT,
  provider_mode TEXT,
  redirect_url TEXT,
  success_url TEXT,
  cancel_url TEXT,
  failure_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_checkout_type_valid CHECK (checkout_type IN ('subscription', 'content_credits')),
  CONSTRAINT billing_checkout_status_valid CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  CONSTRAINT billing_checkout_plan_valid CHECK (host_plan IS NULL OR host_plan IN ('free', 'standard', 'professional', 'premium')),
  CONSTRAINT billing_checkout_interval_valid CHECK (billing_interval IS NULL OR billing_interval IN ('monthly', 'annual')),
  CONSTRAINT billing_checkout_credit_qty_valid CHECK (credit_quantity IS NULL OR credit_quantity > 0)
);

CREATE INDEX billing_checkout_sessions_user_id_idx ON billing_checkout_sessions (user_id);
CREATE INDEX billing_checkout_sessions_status_idx ON billing_checkout_sessions (status);
CREATE UNIQUE INDEX billing_checkout_sessions_provider_checkout_id_idx ON billing_checkout_sessions (provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;

CREATE TABLE billing_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'yoco',
  event_type TEXT NOT NULL,
  signature TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  payload JSONB NOT NULL
);

CREATE INDEX billing_webhook_events_provider_idx ON billing_webhook_events (provider, received_at DESC);
