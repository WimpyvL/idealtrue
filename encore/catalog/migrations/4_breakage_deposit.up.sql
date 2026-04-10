ALTER TABLE listings
ADD COLUMN breakage_deposit INTEGER;

UPDATE listings
SET breakage_deposit = 500
WHERE breakage_deposit IS NULL;
