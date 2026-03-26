CREATE TABLE content_credit_wallets (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_credit_ledger_user_id_idx ON content_credit_ledger (user_id);
CREATE INDEX content_credit_ledger_created_at_idx ON content_credit_ledger (created_at DESC);

CREATE TABLE content_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  listing_title TEXT NOT NULL,
  listing_location TEXT NOT NULL,
  platform TEXT NOT NULL,
  tone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_drafts_user_id_idx ON content_drafts (user_id);
CREATE INDEX content_drafts_created_at_idx ON content_drafts (created_at DESC);
