-- Harden booking slot enforcement: employee conflicts, duplicate customer slots,
-- advisory locks on draft validation, and graceful handling when a paid Chapa
-- checkout loses the slot before finalize.

ALTER TYPE public.payment_transaction_status ADD VALUE IF NOT EXISTS 'paid_unfulfilled';

-- ---------------------------------------------------------------------------
-- Shared slot availability check (capacity + per-staff + duplicate customer).
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
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
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
  END IF;

  SELECT count(*)
    INTO booked_count
    FROM public.bookings b
   WHERE b.business_id = p_business_id
     AND b.scheduled_at = p_scheduled_at
     AND b.status <> 'cancelled';

  IF booked_count >= slot_rec.max_capacity THEN
    RAISE EXCEPTION 'This time slot is fully booked';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_booking_slot_available(UUID, TIMESTAMPTZ, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_booking_slot_available(UUID, TIMESTAMPTZ, UUID, UUID, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- validate_booking_draft: lock + full slot checks before Chapa redirect.
-- ---------------------------------------------------------------------------
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
    scheduling_block_minutes
    INTO svc
    FROM public.services
   WHERE id = p_service_id
     AND business_id = p_business_id
     AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected service is not available for this business';
  END IF;

  IF svc.pricing_model <> 'fixed' OR svc.price IS NULL THEN
    RAISE EXCEPTION 'Only fixed-price services can be paid online';
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
    'listed_price', svc.price,
    'duration_minutes', svc.duration_minutes,
    'scheduling_block_minutes', block_mins
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_booking_draft(UUID, UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_booking_draft(UUID, UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;

-- ---------------------------------------------------------------------------
-- validate_booking_insert: reuse shared slot checks under advisory lock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_booking_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc RECORD;
  dow INTEGER;
  slot_local TIMESTAMP;
  slot_time TIME;
  wh RECORD;
  actor UUID := auth.uid();
  block_mins INTEGER;
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
  IF actor IS NOT NULL AND NOT public.is_admin() THEN
    NEW.status := 'pending';
  END IF;

  SELECT
    id,
    business_id,
    duration_minutes,
    pricing_model,
    duration_model,
    price,
    price_min,
    price_max,
    scheduling_block_minutes
    INTO svc
    FROM public.services
   WHERE id = NEW.service_id
     AND business_id = NEW.business_id
     AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected service is not available for this business';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
     WHERE id = NEW.business_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'This business is not available for booking';
  END IF;

  IF NOT public.business_can_accept_booking(NEW.business_id) THEN
    RAISE EXCEPTION 'This business is not accepting bookings right now';
  END IF;

  IF NEW.employee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.employees e
       WHERE e.id = NEW.employee_id
         AND e.business_id = NEW.business_id
         AND e.is_active = true
    ) THEN
      RAISE EXCEPTION 'Selected staff member is not available for this business';
    END IF;
  END IF;

  NEW.duration_minutes := svc.duration_minutes;
  NEW.pricing_model := svc.pricing_model;
  NEW.duration_model := svc.duration_model;
  NEW.scheduling_block_minutes := COALESCE(svc.scheduling_block_minutes, svc.duration_minutes);
  block_mins := NEW.scheduling_block_minutes;

  NEW.listed_price := NULL;
  NEW.listed_price_min := NULL;
  NEW.listed_price_max := NULL;

  IF svc.pricing_model = 'fixed' OR svc.pricing_model = 'starting_from' THEN
    NEW.listed_price := svc.price;
  ELSIF svc.pricing_model = 'range' THEN
    NEW.listed_price_min := svc.price_min;
    NEW.listed_price_max := svc.price_max;
  ELSIF svc.pricing_model = 'variable' THEN
    NEW.listed_price_min := svc.price_min;
  END IF;

  IF NEW.scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot book a time in the past';
  END IF;

  slot_local := NEW.scheduled_at AT TIME ZONE tz;
  dow := EXTRACT(DOW FROM slot_local)::INTEGER;
  slot_time := slot_local::TIME;

  SELECT open_time, close_time, is_closed
    INTO wh
    FROM public.working_hours
   WHERE business_id = NEW.business_id AND day_of_week = dow;

  IF NOT FOUND OR wh.is_closed THEN
    RAISE EXCEPTION 'Business is closed on the selected day';
  END IF;

  IF slot_time < wh.open_time
     OR (slot_time + make_interval(mins => block_mins)) > wh.close_time THEN
    RAISE EXCEPTION 'Selected time is outside the business working hours';
  END IF;

  PERFORM public.assert_booking_slot_available(
    NEW.business_id,
    NEW.scheduled_at,
    NEW.employee_id,
    NEW.customer_id,
    true
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- finalize_chapa_payment: create booking before marking success; record
-- paid_unfulfilled when the slot was taken after payment.
-- ---------------------------------------------------------------------------
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
  draft JSONB;
  target_booking_id UUID;
  rate NUMERIC;
  commission NUMERIC;
  owner_net NUMERIC;
  meta JSONB;
  sub_plan_id UUID;
  sub_interval public.billing_interval;
  slot_unavailable BOOLEAN := false;
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
    RETURN jsonb_build_object(
      'ok', true,
      'already_finalized', true,
      'booking_id', txn.booking_id,
      'business_id', txn.business_id,
      'purpose', txn.purpose
    );
  END IF;

  IF txn.status = 'paid_unfulfilled' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'slot_unavailable',
      'purpose', txn.purpose,
      'payment_status', 'paid_unfulfilled',
      'booking_id', txn.booking_id
    );
  END IF;

  IF txn.status NOT IN ('initialized', 'failed') THEN
    RAISE EXCEPTION 'Payment transaction cannot be finalized from status %', txn.status;
  END IF;

  IF txn.amount_etb IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'Payment amount mismatch';
  END IF;

  IF txn.purpose = 'booking' THEN
    target_booking_id := txn.booking_id;

    IF target_booking_id IS NULL THEN
      meta := COALESCE(txn.metadata, '{}'::jsonb);
      draft := meta->'booking_draft';

      IF draft IS NULL OR jsonb_typeof(draft) <> 'object' THEN
        RAISE EXCEPTION 'Booking draft is missing for this payment';
      END IF;

      BEGIN
        INSERT INTO public.bookings (
          customer_id,
          business_id,
          service_id,
          employee_id,
          scheduled_at,
          duration_minutes,
          status,
          payment_method,
          payment_status,
          paid_amount_etb
        ) VALUES (
          (draft->>'customer_id')::uuid,
          (draft->>'business_id')::uuid,
          (draft->>'service_id')::uuid,
          NULLIF(draft->>'employee_id', '')::uuid,
          (draft->>'scheduled_at')::timestamptz,
          COALESCE(NULLIF(draft->>'duration_minutes', '')::integer, 30),
          'pending',
          COALESCE(NULLIF(draft->>'payment_method', ''), 'chapa'),
          'paid',
          p_amount
        )
        RETURNING * INTO booking_row;
      EXCEPTION
        WHEN unique_violation THEN
          slot_unavailable := true;
        WHEN OTHERS THEN
          IF SQLERRM LIKE '%fully booked%'
             OR SQLERRM LIKE '%not available at this time%'
             OR SQLERRM LIKE '%not available for booking%'
             OR SQLERRM LIKE '%already have a booking%' THEN
            slot_unavailable := true;
          ELSE
            RAISE;
          END IF;
      END;

      IF slot_unavailable THEN
        UPDATE public.payment_transactions
        SET
          status = 'paid_unfulfilled',
          chapa_reference = COALESCE(p_chapa_reference, chapa_reference),
          payment_method = COALESCE(p_payment_method, payment_method),
          chapa_mode = COALESCE(p_chapa_mode, chapa_mode),
          verified_at = now(),
          updated_at = now(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('slot_unavailable', true)
        WHERE id = txn.id;

        RETURN jsonb_build_object(
          'ok', false,
          'code', 'slot_unavailable',
          'purpose', 'booking',
          'payment_status', 'paid_unfulfilled'
        );
      END IF;

      target_booking_id := booking_row.id;

      UPDATE public.payment_transactions
      SET booking_id = target_booking_id
      WHERE id = txn.id;
    ELSE
      SELECT *
        INTO booking_row
        FROM public.bookings
       WHERE id = target_booking_id
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

    UPDATE public.payment_transactions
    SET
      status = 'success',
      chapa_reference = COALESCE(p_chapa_reference, chapa_reference),
      payment_method = COALESCE(p_payment_method, payment_method),
      chapa_mode = COALESCE(p_chapa_mode, chapa_mode),
      verified_at = now(),
      updated_at = now()
    WHERE id = txn.id;

    IF booking_row.id IS NOT NULL THEN
      rate := COALESCE(txn.commission_rate, public.get_business_commission_rate(booking_row.business_id));
      commission := COALESCE(txn.commission_amount_etb, round(p_amount * rate, 2));
      owner_net := COALESCE(txn.owner_net_etb, round(p_amount - commission, 2));

      INSERT INTO public.booking_financials (
        booking_id,
        business_id,
        service_price_etb,
        commission_rate,
        commission_amount_etb,
        platform_fee_etb,
        owner_net_etb,
        currency,
        chapa_subaccount_id
      )
      VALUES (
        booking_row.id,
        booking_row.business_id,
        p_amount,
        rate,
        commission,
        commission,
        owner_net,
        COALESCE(txn.currency, 'ETB'),
        txn.chapa_subaccount_id
      )
      ON CONFLICT (booking_id) DO UPDATE
      SET
        service_price_etb = EXCLUDED.service_price_etb,
        commission_rate = EXCLUDED.commission_rate,
        commission_amount_etb = EXCLUDED.commission_amount_etb,
        platform_fee_etb = EXCLUDED.platform_fee_etb,
        owner_net_etb = EXCLUDED.owner_net_etb,
        currency = EXCLUDED.currency,
        chapa_subaccount_id = EXCLUDED.chapa_subaccount_id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'purpose', 'booking',
      'booking_id', target_booking_id,
      'payment_status', 'paid'
    );
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

  IF txn.purpose = 'subscription' AND txn.business_id IS NOT NULL THEN
    meta := COALESCE(txn.metadata, '{}'::jsonb);
    sub_plan_id := NULLIF(meta->>'plan_id', '')::UUID;
    sub_interval := (meta->>'billing_interval')::public.billing_interval;

    IF sub_plan_id IS NULL OR sub_interval IS NULL THEN
      RAISE EXCEPTION 'Subscription payment metadata is incomplete';
    END IF;

    PERFORM public.activate_business_subscription(
      txn.business_id,
      sub_plan_id,
      sub_interval,
      'chapa',
      COALESCE(p_payment_method, 'chapa'),
      txn.tx_ref,
      p_amount
    );

    RETURN jsonb_build_object(
      'ok', true,
      'purpose', 'subscription',
      'business_id', txn.business_id,
      'payment_status', 'paid'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'purpose', txn.purpose,
    'booking_id', txn.booking_id,
    'business_id', txn.business_id,
    'payment_status', 'paid'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_chapa_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_chapa_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
