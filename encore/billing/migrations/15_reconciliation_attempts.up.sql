-- Retry scheduling is independent of business state timestamps.
ALTER TABLE billing_payment_intents ADD COLUMN reconciliation_attempted_at TIMESTAMPTZ;
CREATE INDEX billing_payment_intents_reconciliation_idx
  ON billing_payment_intents (reconciliation_attempted_at ASC NULLS FIRST, created_at, id)
  WHERE status = 'pending' AND provider = 'yoco';

ALTER TABLE billing_webhook_events ADD COLUMN dispatch_attempted_at TIMESTAMPTZ;
CREATE INDEX billing_webhook_events_dispatch_idx
  ON billing_webhook_events (dispatch_attempted_at ASC NULLS FIRST, received_at, id)
  WHERE processed_at IS NULL;
