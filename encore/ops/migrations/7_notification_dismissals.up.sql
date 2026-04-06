CREATE TABLE IF NOT EXISTS notification_dismissals (
  notification_id TEXT NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_dismissals_user_id_idx
ON notification_dismissals (user_id, dismissed_at DESC);
