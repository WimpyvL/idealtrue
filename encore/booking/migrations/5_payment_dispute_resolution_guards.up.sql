-- Author: ( |╲ ) Klaasvaakie
-- Keep booking payment state aligned when a payment dispute is resolved from the ledger.

CREATE OR REPLACE FUNCTION apply_payment_dispute_resolution()
RETURNS TRIGGER AS $$
DECLARE
  dispute_resolution TEXT;
BEGIN
  IF NEW.event <> 'DISPUTE_RESOLVED' THEN
    RETURN NEW;
  END IF;

  dispute_resolution := NEW.metadata ->> 'resolution';

  IF dispute_resolution = 'PAYMENT_CONFIRMED' THEN
    UPDATE bookings
    SET payment_state = 'COMPLETED',
        inquiry_state = 'BOOKED',
        status = 'confirmed',
        payment_confirmed_at = COALESCE(payment_confirmed_at, NEW.created_at),
        booked_at = COALESCE(booked_at, NEW.created_at),
        expires_at = NULL,
        updated_at = NEW.created_at
    WHERE id = NEW.inquiry_id
      AND inquiry_state = 'APPROVED'
      AND payment_state = 'INITIATED';
  ELSIF dispute_resolution = 'PAYMENT_REJECTED' THEN
    UPDATE bookings
    SET payment_state = 'FAILED',
        status = 'payment_submitted',
        updated_at = NEW.created_at
    WHERE id = NEW.inquiry_id
      AND inquiry_state = 'APPROVED'
      AND payment_state <> 'COMPLETED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_dispute_resolution_guard ON inquiry_ledger;

CREATE TRIGGER payment_dispute_resolution_guard
AFTER INSERT ON inquiry_ledger
FOR EACH ROW
EXECUTE FUNCTION apply_payment_dispute_resolution();
