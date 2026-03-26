CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_booking_id_idx ON messages (booking_id);
