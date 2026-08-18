-- Align slot holds with the 15-minute Chapa checkout window so customers
-- are not paying after the hold has already expired.

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

  PERFORM public.assert_booking_slot_available(
    business_uuid,
    scheduled,
    employee_uuid,
    customer_uuid,
    true
  );

  hold_expires := now() + interval '15 minutes';

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
    'ttl_seconds', 900
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_slot_hold(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_slot_hold(UUID) TO service_role;
