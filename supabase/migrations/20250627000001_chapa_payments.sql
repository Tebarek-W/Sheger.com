-- Chapa payment integration (test mode) — booking checkout Phase 1

-- If an older/different payment_status column exists, rename it so we can add ours.
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO col_type
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'bookings'
     AND a.attname = 'payment_status'
     AND NOT a.attisdropped;

  IF col_type IS NOT NULL AND col_type <> 'booking_payment_status' THEN
    ALTER TABLE public.bookings RENAME COLUMN payment_status TO payment_status_legacy;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_payment_status AS ENUM (
    'not_required',
    'awaiting_payment',
    'paid',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_transaction_status AS ENUM (
    'initialized',
    'success',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_purpose AS ENUM ('booking', 'subscription');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status public.booking_payment_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS paid_amount_etb NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose public.payment_purpose NOT NULL DEFAULT 'booking',
  booking_id UUID REFERENCES public.bookings (id) ON DELETE SET NULL,
  tx_ref TEXT NOT NULL,
  chapa_reference TEXT,
  amount_etb NUMERIC(10, 2) NOT NULL CHECK (amount_etb > 0),
  currency TEXT NOT NULL DEFAULT 'ETB',
  status public.payment_transaction_status NOT NULL DEFAULT 'initialized',
  payment_method TEXT,
  chapa_mode TEXT NOT NULL DEFAULT 'test',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_tx_ref_idx
  ON public.payment_transactions (tx_ref);

CREATE INDEX IF NOT EXISTS payment_transactions_booking_id_idx
  ON public.payment_transactions (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_payment_expires_idx
  ON public.bookings (payment_expires_at)
  WHERE payment_status = 'awaiting_payment' AND status = 'pending';

-- Default payment_expires_at for online checkout bookings
CREATE OR REPLACE FUNCTION public.set_booking_payment_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status = 'awaiting_payment' AND NEW.payment_expires_at IS NULL THEN
    NEW.payment_expires_at := now() + interval '15 minutes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_payment_expiry ON public.bookings;
CREATE TRIGGER bookings_set_payment_expiry
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_payment_expiry();

-- Customers cannot mutate payment fields after insert
CREATE OR REPLACE FUNCTION public.enforce_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  is_owner BOOLEAN;
  admin_actor BOOLEAN;
  cancel_hours INTEGER;
  completing BOOLEAN;
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  admin_actor := public.is_admin();

  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = actor
  ) INTO is_owner;

  completing := is_owner
    AND NEW.status = 'completed'
    AND OLD.status = 'confirmed';

  IF NOT admin_actor THEN
    IF NEW.customer_id    IS DISTINCT FROM OLD.customer_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.service_id  IS DISTINCT FROM OLD.service_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.scheduling_block_minutes IS DISTINCT FROM OLD.scheduling_block_minutes
       OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
       OR NEW.duration_model IS DISTINCT FROM OLD.duration_model
       OR NEW.listed_price IS DISTINCT FROM OLD.listed_price
       OR NEW.listed_price_min IS DISTINCT FROM OLD.listed_price_min
       OR NEW.listed_price_max IS DISTINCT FROM OLD.listed_price_max
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.paid_amount_etb IS DISTINCT FROM OLD.paid_amount_etb
       OR NEW.payment_expires_at IS DISTINCT FROM OLD.payment_expires_at THEN
      RAISE EXCEPTION 'Booking details cannot be modified after creation';
    END IF;

    IF NEW.final_price IS DISTINCT FROM OLD.final_price
       OR NEW.actual_duration_minutes IS DISTINCT FROM OLD.actual_duration_minutes THEN
      IF NOT completing THEN
        RAISE EXCEPTION 'Final price and actual duration can only be set when completing a booking';
      END IF;
      IF NEW.final_price IS NOT NULL AND NEW.final_price < 0 THEN
        RAISE EXCEPTION 'Final price must be >= 0';
      END IF;
      IF NEW.actual_duration_minutes IS NOT NULL AND NEW.actual_duration_minutes <= 0 THEN
        RAISE EXCEPTION 'Actual duration must be > 0';
      END IF;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF admin_actor THEN
      NULL;
    ELSIF is_owner THEN
      IF OLD.status IN ('cancelled', 'completed') THEN
        RAISE EXCEPTION 'Cannot change a % booking', OLD.status;
      END IF;
      IF NEW.status NOT IN ('confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid booking status transition';
      END IF;
    ELSIF actor = OLD.customer_id THEN
      IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Customers can only cancel upcoming bookings';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not authorized to modify this booking';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Idempotent finalize after Chapa verify / webhook
CREATE OR REPLACE FUNCTION public.finalize_chapa_payment(
  p_tx_ref TEXT,
  p_chapa_reference TEXT,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_chapa_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn RECORD;
  booking_row RECORD;
BEGIN
  SELECT *
    INTO txn
    FROM public.payment_transactions
   WHERE tx_ref = p_tx_ref
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF txn.status = 'success' THEN
    RETURN jsonb_build_object('ok', true, 'already_finalized', true, 'booking_id', txn.booking_id);
  END IF;

  IF txn.status NOT IN ('initialized', 'failed') THEN
    RAISE EXCEPTION 'Payment transaction cannot be finalized from status %', txn.status;
  END IF;

  IF txn.amount_etb IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'Payment amount mismatch';
  END IF;

  UPDATE public.payment_transactions
  SET
    status = 'success',
    chapa_reference = COALESCE(p_chapa_reference, chapa_reference),
    payment_method = COALESCE(p_payment_method, payment_method),
    chapa_mode = COALESCE(p_chapa_mode, chapa_mode),
    verified_at = now(),
    updated_at = now()
  WHERE id = txn.id;

  IF txn.purpose = 'booking' AND txn.booking_id IS NOT NULL THEN
    SELECT *
      INTO booking_row
      FROM public.bookings
     WHERE id = txn.booking_id
     FOR UPDATE;

    IF FOUND THEN
      UPDATE public.bookings
      SET
        payment_status = 'paid',
        paid_amount_etb = p_amount,
        payment_expires_at = NULL,
        updated_at = now()
      WHERE id = booking_row.id
        AND payment_status = 'awaiting_payment';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', txn.booking_id,
    'payment_status', 'paid'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_unpaid_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER := 0;
  row RECORD;
BEGIN
  FOR row IN
    SELECT id
      FROM public.bookings
     WHERE payment_status = 'awaiting_payment'
       AND status = 'pending'
       AND payment_expires_at IS NOT NULL
       AND payment_expires_at < now()
     FOR UPDATE
  LOOP
    UPDATE public.bookings
    SET status = 'cancelled', updated_at = now()
    WHERE id = row.id;

    UPDATE public.payment_transactions
    SET status = 'cancelled', updated_at = now()
    WHERE booking_id = row.id
      AND status = 'initialized';

    expired_count := expired_count + 1;
  END LOOP;

  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_chapa_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_chapa_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.expire_unpaid_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_bookings() TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_transactions_customer_read ON public.payment_transactions;
CREATE POLICY payment_transactions_customer_read ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.bookings b
       WHERE b.id = payment_transactions.booking_id
         AND b.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payment_transactions_owner_read ON public.payment_transactions;
CREATE POLICY payment_transactions_owner_read ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.bookings b
        JOIN public.businesses biz ON biz.id = b.business_id
       WHERE b.id = payment_transactions.booking_id
         AND biz.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payment_transactions_admin ON public.payment_transactions;
CREATE POLICY payment_transactions_admin ON public.payment_transactions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
