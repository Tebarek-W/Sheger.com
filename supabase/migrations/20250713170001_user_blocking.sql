-- Allow platform admins to block mobile users (customers / business owners).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_is_blocked_idx
  ON public.profiles (is_blocked)
  WHERE is_blocked = true;

COMMENT ON COLUMN public.profiles.is_blocked IS
  'When true, the user cannot use the mobile app or create bookings.';

-- Non-admins cannot clear or set their own block flag.
CREATE OR REPLACE FUNCTION public.prevent_blocked_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
     OR NEW.blocked_at IS DISTINCT FROM OLD.blocked_at
     OR NEW.blocked_by IS DISTINCT FROM OLD.blocked_by THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change account block status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_blocked_self_change ON public.profiles;
CREATE TRIGGER profiles_prevent_blocked_self_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blocked_self_change();

CREATE OR REPLACE FUNCTION public.is_user_blocked(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND is_blocked = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_user_blocked(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(UUID) TO service_role;

-- Blocked customers cannot create bookings (covers pay-at-visit + finalize insert).
CREATE OR REPLACE FUNCTION public.reject_blocked_customer_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.customer_id AND is_blocked = true
  ) THEN
    RAISE EXCEPTION 'Your account has been suspended. Contact support for help.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_blocked_customer_booking ON public.bookings;
CREATE TRIGGER trg_reject_blocked_customer_booking
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_blocked_customer_booking();

-- Also block Chapa draft validation for suspended accounts.
CREATE OR REPLACE FUNCTION public.validate_booking_draft(
  p_customer_id UUID,
  p_business_id UUID,
  p_service_id UUID,
  p_employee_id UUID,
  p_scheduled_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc RECORD;
  dow INTEGER;
  slot_local TIMESTAMP;
  slot_time TIME;
  wh RECORD;
  block_mins INTEGER;
  chargeable NUMERIC;
  is_deposit BOOLEAN := false;
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_user_blocked(p_customer_id) THEN
    RAISE EXCEPTION 'Your account has been suspended. Contact support for help.';
  END IF;

  SELECT
    id,
    business_id,
    duration_minutes,
    pricing_model,
    price,
    price_min,
    price_max,
    scheduling_block_minutes
    INTO svc
    FROM public.services
   WHERE id = p_service_id
     AND business_id = p_business_id
     AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected service is not available for this business';
  END IF;

  IF svc.pricing_model = 'fixed' THEN
    chargeable := svc.price;
    is_deposit := false;
  ELSIF svc.pricing_model = 'starting_from' THEN
    chargeable := svc.price;
    is_deposit := true;
  ELSIF svc.pricing_model IN ('range', 'variable') THEN
    chargeable := svc.price_min;
    is_deposit := true;
  ELSE
    chargeable := NULL;
  END IF;

  IF chargeable IS NULL OR chargeable <= 0 THEN
    RAISE EXCEPTION 'This service cannot be paid online (no chargeable amount)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
     WHERE id = p_business_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'This business is not available for booking';
  END IF;

  IF NOT public.business_can_accept_booking(p_business_id) THEN
    RAISE EXCEPTION 'This business is not accepting bookings right now';
  END IF;

  IF p_employee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.employees e
       WHERE e.id = p_employee_id
         AND e.business_id = p_business_id
         AND e.is_active = true
    ) THEN
      RAISE EXCEPTION 'Selected staff member is not available for this business';
    END IF;
  END IF;

  block_mins := COALESCE(svc.scheduling_block_minutes, svc.duration_minutes);

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot book a time in the past';
  END IF;

  slot_local := p_scheduled_at AT TIME ZONE tz;
  dow := EXTRACT(DOW FROM slot_local)::INTEGER;
  slot_time := slot_local::TIME;

  SELECT open_time, close_time, is_closed
    INTO wh
    FROM public.working_hours
   WHERE business_id = p_business_id AND day_of_week = dow;

  IF NOT FOUND OR wh.is_closed THEN
    RAISE EXCEPTION 'Business is closed on the selected day';
  END IF;

  IF slot_time < wh.open_time
     OR (slot_time + make_interval(mins => block_mins)) > wh.close_time THEN
    RAISE EXCEPTION 'Selected time is outside the business working hours';
  END IF;

  PERFORM public.assert_booking_slot_available(
    p_business_id,
    p_scheduled_at,
    p_employee_id,
    p_customer_id,
    true
  );

  RETURN jsonb_build_object(
    'listed_price', chargeable,
    'duration_minutes', svc.duration_minutes,
    'scheduling_block_minutes', block_mins,
    'pricing_model', svc.pricing_model,
    'is_deposit', is_deposit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_booking_draft(UUID, UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_booking_draft(UUID, UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;
