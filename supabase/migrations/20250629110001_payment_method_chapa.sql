-- Recognize unified "chapa" payment_method alongside legacy online ids.

CREATE OR REPLACE FUNCTION public.normalize_booking_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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
