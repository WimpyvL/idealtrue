CREATE TABLE event_counters (
  event_type TEXT PRIMARY KEY,
  total_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
