-- normalize_booking_payment_status was resetting payment_status to awaiting_payment
-- whenever payment_status was updated to 'paid' for chapa bookings (BEFORE UPDATE trigger).

CREATE OR REPLACE FUNCTION public.normalize_booking_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Preserve successful online payments; only default unpaid online bookings to awaiting_payment.
  IF NEW.payment_status = 'paid' THEN
    NULL;
  ELSIF lower(coalesce(NEW.payment_method, '')) IN ('chapa', 'telebirr', 'cbe_birr', 'card') THEN
    NEW.payment_status := 'awaiting_payment';
  ELSIF lower(coalesce(NEW.payment_method, '')) IN ('cash', 'free', '') THEN
    NEW.payment_status := 'not_required';
  ELSIF NEW.payment_status::text = 'unpaid' THEN
    NEW.payment_status := 'awaiting_payment';
  END IF;

  IF NEW.payment_status = 'awaiting_payment' AND NEW.payment_expires_at IS NULL THEN
    NEW.payment_expires_at := now() + interval '15 minutes';
  END IF;

  RETURN NEW;
END;
$$;

-- Repair bookings already paid via Chapa (txn success + financials) but stuck on awaiting_payment.
UPDATE public.bookings b
SET
  payment_status = 'paid',
  paid_amount_etb = COALESCE(b.paid_amount_etb, pt.amount_etb),
  payment_expires_at = NULL,
  updated_at = now()
FROM public.payment_transactions pt
WHERE pt.booking_id = b.id
  AND pt.status = 'success'
  AND pt.purpose = 'booking'
  AND b.payment_status IS DISTINCT FROM 'paid';
