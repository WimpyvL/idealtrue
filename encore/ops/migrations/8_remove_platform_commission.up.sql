-- ( |╲ ) Author: Klaasvaakie
-- Ideal Stay does not take commission from booking transactions.
ALTER TABLE platform_settings
DROP COLUMN IF EXISTS commission_rate;
