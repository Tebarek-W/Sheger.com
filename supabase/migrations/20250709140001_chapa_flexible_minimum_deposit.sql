-- Allow Chapa checkout for flexible services that have a known minimum
-- ("from" / price_min). That amount is charged now as a deposit; final may be higher.

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

  -- Chargeable amount for Chapa:
  -- fixed / starting_from → price; range / variable → price_min when set.
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
