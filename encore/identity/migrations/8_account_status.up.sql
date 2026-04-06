ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS account_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_status_changed_by TEXT;

UPDATE users
SET
  account_status = COALESCE(account_status, 'active'),
  account_status_reason = NULL
WHERE account_status IS DISTINCT FROM 'active'
   OR account_status_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_account_status_idx ON users (account_status);
