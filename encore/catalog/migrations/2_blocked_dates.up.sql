ALTER TABLE listings
ADD COLUMN blocked_dates TEXT[] NOT NULL DEFAULT '{}';
