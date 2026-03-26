ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_reference_prefix TEXT;
