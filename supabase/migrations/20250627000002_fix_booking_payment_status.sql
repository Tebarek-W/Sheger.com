-- Fix legacy DB triggers/defaults that set payment_status to 'unpaid' (invalid for booking_payment_status).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'bookings'
     AND NOT t.tgisinternal
     AND t.tgname NOT IN (
       'bookings_set_payment_expiry',
       'bookings_validate_insert',
       'bookings_enforce_update',
       'bookings_set_updated_at',
       'bookings_zzz_normalize_payment_status'
     )
     AND pg_get_functiondef(p.oid) ILIKE '%payment_status%'
     AND pg_get_functiondef(p.oid) ILIKE '%unpaid%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.bookings', r.trigger_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_booking_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(coalesce(NEW.payment_method, '')) IN ('telebirr', 'cbe_birr', 'card') THEN
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

DROP TRIGGER IF EXISTS bookings_zzz_normalize_payment_status ON public.bookings;
CREATE TRIGGER bookings_zzz_normalize_payment_status
  BEFORE INSERT OR UPDATE OF payment_method, payment_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.normalize_booking_payment_status();
