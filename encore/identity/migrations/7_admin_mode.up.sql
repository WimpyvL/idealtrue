ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

UPDATE users
SET is_admin = true,
    updated_at = NOW()
WHERE role = 'admin';
