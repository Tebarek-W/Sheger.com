-- Subscription payments via Chapa (owner side).
-- Paid plans now go through a real Chapa checkout: a subscription payment
-- transaction is created (pending), then finalize_chapa_payment activates the
-- subscription on success. Free plans keep activating instantly (source 'mock').

-- ---------------------------------------------------------------------------
-- 1. New payment source + subscription context on payment_transactions
-- ---------------------------------------------------------------------------
ALTER TYPE public.subscription_payment_source ADD VALUE IF NOT EXISTS 'chapa';

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_transactions_business_id_idx
  ON public.payment_transactions (business_id, created_at DESC);

-- Owners can read their own subscription payment transactions (booking-linked
-- rows are already covered by payment_transactions_owner_read).
DROP POLICY IF EXISTS payment_transactions_owner_subscription_read ON public.payment_transactions;
CREATE POLICY payment_transactions_owner_subscription_read ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.businesses biz
       WHERE biz.id = payment_transactions.business_id
         AND biz.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Shared subscription activation helper
--    Used by both the free/instant path (record_subscription_payment) and the
--    Chapa finalize path (finalize_chapa_payment). Trusted callers only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_business_subscription(
  p_business_id UUID,
  p_plan_id UUID,
  p_billing_interval public.billing_interval,
  p_source public.subscription_payment_source,
  p_payment_method TEXT,
  p_reference_code TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan RECORD;
  sub RECORD;
  amount NUMERIC(10, 2);
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  ref_code TEXT;
  payment_id UUID;
BEGIN
  SELECT * INTO plan
  FROM public.subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected plan is not available';
  END IF;

  IF p_billing_interval = 'monthly' THEN
    amount := COALESCE(p_amount, plan.monthly_fee_etb);
    new_end := GREATEST(now(), COALESCE(
      (SELECT current_period_end FROM public.business_subscriptions WHERE business_id = p_business_id),
      now()
    )) + interval '1 month';
  ELSIF p_billing_interval = 'yearly' THEN
    amount := COALESCE(p_amount, plan.yearly_fee_etb);
    new_end := GREATEST(now(), COALESCE(
      (SELECT current_period_end FROM public.business_subscriptions WHERE business_id = p_business_id),
      now()
    )) + interval '12 months';
  ELSE
    RAISE EXCEPTION 'Invalid billing interval';
  END IF;

  new_start := now();
  ref_code := COALESCE(
    NULLIF(trim(p_reference_code), ''),
    'SUB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  INSERT INTO public.business_subscriptions (
    business_id,
    plan_id,
    status,
    billing_interval,
    current_period_start,
    current_period_end,
    grace_ends_at,
    cancelled_at,
    updated_at
  ) VALUES (
    p_business_id,
    p_plan_id,
    'active',
    p_billing_interval,
    new_start,
    new_end,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (business_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    billing_interval = EXCLUDED.billing_interval,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    grace_ends_at = NULL,
    cancelled_at = NULL,
    updated_at = now()
  RETURNING * INTO sub;

  INSERT INTO public.subscription_payments (
    business_id,
    plan_id,
    billing_interval,
    amount_etb,
    payment_method,
    reference_code,
    period_start,
    period_end,
    source
  ) VALUES (
    p_business_id,
    p_plan_id,
    p_billing_interval,
    amount,
    CASE WHEN amount > 0 THEN COALESCE(NULLIF(trim(p_payment_method), ''), 'unknown') ELSE 'free' END,
    ref_code,
    new_start,
    new_end,
    p_source
  )
  RETURNING id INTO payment_id;

  RETURN jsonb_build_object(
    'subscription', to_jsonb(sub),
    'plan', to_jsonb(plan),
    'payment_id', payment_id,
    'reference_code', ref_code,
    'amount_etb', amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_business_subscription(
  UUID, UUID, public.billing_interval, public.subscription_payment_source, TEXT, TEXT, NUMERIC
) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. Free/instant path now delegates to the shared helper (source 'mock')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_subscription_payment(
  p_business_id UUID,
  p_plan_id UUID,
  p_billing_interval public.billing_interval,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  plan RECORD;
  amount NUMERIC(10, 2);
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = actor
  ) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;

  SELECT * INTO plan
  FROM public.subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected plan is not available';
  END IF;

  IF p_billing_interval = 'monthly' THEN
    amount := plan.monthly_fee_etb;
  ELSIF p_billing_interval = 'yearly' THEN
    amount := plan.yearly_fee_etb;
  ELSE
    RAISE EXCEPTION 'Invalid billing interval';
  END IF;

  IF amount > 0 AND (p_payment_method IS NULL OR length(trim(p_payment_method)) = 0) THEN
    RAISE EXCEPTION 'Payment method is required for paid plans';
  END IF;

  RETURN public.activate_business_subscription(
    p_business_id,
    p_plan_id,
    p_billing_interval,
    'mock',
    CASE WHEN amount > 0 THEN trim(p_payment_method) ELSE 'free' END,
    NULL,
    amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_subscription_payment(UUID, UUID, public.billing_interval, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. finalize_chapa_payment: handle purpose = 'subscription'
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
  rate NUMERIC;
  commission NUMERIC;
  owner_net NUMERIC;
  meta JSONB;
  sub_plan_id UUID;
  sub_interval public.billing_interval;
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

      rate := COALESCE(txn.commission_rate, public.get_business_commission_rate(booking_row.business_id));
      commission := COALESCE(
        txn.commission_amount_etb,
        round(p_amount * rate, 2)
      );
      owner_net := COALESCE(
        txn.owner_net_etb,
        round(p_amount - commission, 2)
      );

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
      'booking_id', txn.booking_id,
      'payment_status', 'paid'
    );
  END IF;

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
