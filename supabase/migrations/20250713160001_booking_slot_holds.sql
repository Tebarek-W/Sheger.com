-- Soft-reserve appointment slots for 2 minutes while a customer is on Chapa checkout.
-- Holds count toward capacity so two people cannot pay for the last seat.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_tx_id UUID NOT NULL UNIQUE REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_slot_holds_expires_after_created
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS booking_slot_holds_active_lookup_idx
  ON public.booking_slot_holds (business_id, scheduled_at)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS booking_slot_holds_expires_idx
  ON public.booking_slot_holds (expires_at)
  WHERE released_at IS NULL;

ALTER TABLE public.booking_slot_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages slot holds" ON public.booking_slot_holds;
CREATE POLICY "Service role manages slot holds"
  ON public.booking_slot_holds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Realtime / slot UI: allow reading active holds (short-lived occupancy only).
DROP POLICY IF EXISTS "Read active slot holds" ON public.booking_slot_holds;
CREATE POLICY "Read active slot holds"
  ON public.booking_slot_holds
  FOR SELECT
  TO anon, authenticated
  USING (released_at IS NULL AND expires_at > now());

COMMENT ON TABLE public.booking_slot_holds IS
  'Temporary 2-minute reservation created when Chapa checkout starts; frees if unpaid.';

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- Partial: release holds when payment txn reaches a terminal status.
CREATE OR REPLACE FUNCTION public.release_slot_hold_on_payment_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('cancelled', 'success', 'failed', 'paid_unfulfilled') THEN
    UPDATE public.booking_slot_holds
       SET released_at = COALESCE(released_at, now())
     WHERE payment_tx_id = NEW.id
       AND released_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_slot_hold_on_payment_terminal ON public.payment_transactions;
CREATE TRIGGER trg_release_slot_hold_on_payment_terminal
  AFTER UPDATE OF status ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.release_slot_hold_on_payment_terminal();

CREATE OR REPLACE FUNCTION public.release_booking_slot_hold(p_payment_tx_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.booking_slot_holds
     SET released_at = COALESCE(released_at, now())
   WHERE payment_tx_id = p_payment_tx_id
     AND released_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.release_booking_slot_hold(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_booking_slot_hold(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_booking_slot_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE public.booking_slot_holds
     SET released_at = now()
   WHERE released_at IS NULL
     AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_booking_slot_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_booking_slot_holds() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Create hold after draft payment txn is inserted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_slot_hold(p_payment_tx_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn RECORD;
  draft JSONB;
  hold_id UUID;
  hold_expires TIMESTAMPTZ;
  business_uuid UUID;
  scheduled TIMESTAMPTZ;
  employee_uuid UUID;
  customer_uuid UUID;
BEGIN
  SELECT id, purpose, booking_id, status, metadata
    INTO txn
    FROM public.payment_transactions
   WHERE id = p_payment_tx_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF txn.purpose <> 'booking' OR txn.booking_id IS NOT NULL THEN
    RAISE EXCEPTION 'Slot holds only apply to deferred booking checkouts';
  END IF;

  IF txn.status <> 'initialized' THEN
    RAISE EXCEPTION 'Payment transaction is not active';
  END IF;

  draft := COALESCE(txn.metadata, '{}'::jsonb)->'booking_draft';
  IF draft IS NULL OR jsonb_typeof(draft) <> 'object' THEN
    RAISE EXCEPTION 'Booking draft is missing for this payment';
  END IF;

  business_uuid := (draft->>'business_id')::uuid;
  scheduled := (draft->>'scheduled_at')::timestamptz;
  employee_uuid := NULLIF(draft->>'employee_id', '')::uuid;
  customer_uuid := (draft->>'customer_id')::uuid;

  -- Re-check capacity including other customers' active holds.
  PERFORM public.assert_booking_slot_available(
    business_uuid,
    scheduled,
    employee_uuid,
    customer_uuid,
    true
  );

  hold_expires := now() + interval '2 minutes';

  INSERT INTO public.booking_slot_holds (
    business_id,
    scheduled_at,
    employee_id,
    customer_id,
    payment_tx_id,
    expires_at
  ) VALUES (
    business_uuid,
    scheduled,
    employee_uuid,
    customer_uuid,
    p_payment_tx_id,
    hold_expires
  )
  ON CONFLICT (payment_tx_id) DO UPDATE
    SET
      business_id = EXCLUDED.business_id,
      scheduled_at = EXCLUDED.scheduled_at,
      employee_id = EXCLUDED.employee_id,
      customer_id = EXCLUDED.customer_id,
      expires_at = EXCLUDED.expires_at,
      released_at = NULL,
      created_at = now()
  RETURNING id INTO hold_id;

  RETURN jsonb_build_object(
    'hold_id', hold_id,
    'expires_at', hold_expires,
    'ttl_seconds', 120
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_slot_hold(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_slot_hold(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. assert_booking_slot_available — count active holds (exclude own)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_booking_slot_available(
  p_business_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_employee_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_acquire_lock BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dow INTEGER;
  slot_local TIMESTAMP;
  slot_time TIME;
  slot_rec RECORD;
  booked_count INTEGER;
  hold_count INTEGER;
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
  -- Drop expired holds opportunistically so capacity stays accurate.
  PERFORM public.expire_booking_slot_holds();

  slot_local := p_scheduled_at AT TIME ZONE tz;
  dow := EXTRACT(DOW FROM slot_local)::INTEGER;
  slot_time := slot_local::TIME;

  SELECT s.id, s.max_capacity
    INTO slot_rec
    FROM public.appointment_slots s
   WHERE s.business_id = p_business_id
     AND s.day_of_week = dow
     AND s.start_time = slot_time
     AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This time slot is not available for booking';
  END IF;

  IF p_acquire_lock THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(p_business_id::text || '|' || p_scheduled_at::text)::bigint
    );
  END IF;

  IF p_customer_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM public.bookings b
       WHERE b.customer_id = p_customer_id
         AND b.business_id = p_business_id
         AND b.scheduled_at = p_scheduled_at
         AND b.status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'You already have a booking at this time';
    END IF;
  END IF;

  IF p_employee_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM public.bookings b
       WHERE b.employee_id = p_employee_id
         AND b.scheduled_at = p_scheduled_at
         AND b.status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Selected staff member is not available at this time';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public.booking_slot_holds h
       WHERE h.employee_id = p_employee_id
         AND h.scheduled_at = p_scheduled_at
         AND h.released_at IS NULL
         AND h.expires_at > now()
         AND (p_customer_id IS NULL OR h.customer_id <> p_customer_id)
    ) THEN
      RAISE EXCEPTION 'Selected staff member is not available at this time';
    END IF;
  END IF;

  SELECT count(*)
    INTO booked_count
    FROM public.bookings b
   WHERE b.business_id = p_business_id
     AND b.scheduled_at = p_scheduled_at
     AND b.status <> 'cancelled';

  SELECT count(*)
    INTO hold_count
    FROM public.booking_slot_holds h
   WHERE h.business_id = p_business_id
     AND h.scheduled_at = p_scheduled_at
     AND h.released_at IS NULL
     AND h.expires_at > now()
     AND (p_customer_id IS NULL OR h.customer_id <> p_customer_id);

  IF (booked_count + hold_count) >= slot_rec.max_capacity THEN
    RAISE EXCEPTION 'This time slot is fully booked';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_booking_slot_available(UUID, TIMESTAMPTZ, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_booking_slot_available(UUID, TIMESTAMPTZ, UUID, UUID, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Slot UI counts — bookings + active holds
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_slot_booking_counts(
  p_business_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_employee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  scheduled_at timestamptz,
  booking_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH occupancy AS (
    SELECT b.scheduled_at AS scheduled_at
    FROM public.bookings b
    INNER JOIN public.businesses bus ON bus.id = b.business_id
    WHERE b.business_id = p_business_id
      AND bus.status = 'approved'
      AND b.scheduled_at >= p_range_start
      AND b.scheduled_at <= p_range_end
      AND b.status <> 'cancelled'
      AND (
        p_employee_id IS NULL
        OR b.employee_id = p_employee_id
      )

    UNION ALL

    SELECT h.scheduled_at AS scheduled_at
    FROM public.booking_slot_holds h
    INNER JOIN public.businesses bus ON bus.id = h.business_id
    WHERE h.business_id = p_business_id
      AND bus.status = 'approved'
      AND h.scheduled_at >= p_range_start
      AND h.scheduled_at <= p_range_end
      AND h.released_at IS NULL
      AND h.expires_at > now()
      AND (
        p_employee_id IS NULL
        OR h.employee_id = p_employee_id
      )
  )
  SELECT o.scheduled_at, count(*)::bigint AS booking_count
  FROM occupancy o
  GROUP BY o.scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime so slot pickers refresh when holds appear/expire
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'booking_slot_holds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_slot_holds;
  END IF;
END;
$$;

ALTER TABLE public.booking_slot_holds REPLICA IDENTITY FULL;
