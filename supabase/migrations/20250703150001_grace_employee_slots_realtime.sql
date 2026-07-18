-- Subscription grace visibility, optional employee slot counts, grace expiry,
-- and Realtime on bookings for live slot updates.

-- ---------------------------------------------------------------------------
-- 1. Marketplace live: honor grace period after period end
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_is_marketplace_live(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    JOIN public.business_subscriptions bs ON bs.business_id = b.id
    WHERE b.id = p_business_id
      AND b.status = 'approved'
      AND (
        (
          bs.status = 'active'
          AND bs.current_period_end IS NOT NULL
          AND bs.current_period_end > now()
        )
        OR (
          bs.status = 'past_due'
          AND bs.grace_ends_at IS NOT NULL
          AND bs.grace_ends_at > now()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Cancel subscriptions after grace expires
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_subscriptions_past_due()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grace_days INTEGER := 3;
  past_due_count INTEGER := 0;
  cancelled_count INTEGER := 0;
BEGIN
  SELECT ps.grace_period_days
  INTO grace_days
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  WITH updated AS (
    UPDATE public.business_subscriptions bs
    SET
      status = 'past_due',
      grace_ends_at = bs.current_period_end + make_interval(days => COALESCE(grace_days, 3)),
      updated_at = now()
    WHERE bs.status = 'active'
      AND bs.current_period_end IS NOT NULL
      AND bs.current_period_end < now()
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO past_due_count FROM updated;

  WITH cancelled AS (
    UPDATE public.business_subscriptions bs
    SET
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    WHERE bs.status = 'past_due'
      AND bs.grace_ends_at IS NOT NULL
      AND bs.grace_ends_at < now()
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO cancelled_count FROM cancelled;

  RETURN past_due_count + cancelled_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Slot counts: optional employee filter for per-staff availability
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_slot_booking_counts(uuid, timestamptz, timestamptz);

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
  SELECT b.scheduled_at, count(*)::bigint AS booking_count
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
  GROUP BY b.scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Realtime: booking changes refresh slot availability on clients
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END;
$$;
