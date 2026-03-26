ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
