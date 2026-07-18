-- Chapa split payments: business payout accounts, commission model, booking financials.

-- ---------------------------------------------------------------------------
-- Commission settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_booking_commission_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.10;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(6, 4);

UPDATE public.subscription_plans
SET commission_rate = CASE slug
  WHEN 'free' THEN 0.15
  WHEN 'basic' THEN 0.10
  WHEN 'premium' THEN 0.08
  ELSE COALESCE(commission_rate, 0.10)
END
WHERE commission_rate IS NULL;

ALTER TABLE public.subscription_plans
  ALTER COLUMN commission_rate SET DEFAULT 0.10;

UPDATE public.subscription_plans
SET commission_rate = 0.10
WHERE commission_rate IS NULL;

ALTER TABLE public.subscription_plans
  ALTER COLUMN commission_rate SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Business Chapa subaccounts (vendor bank accounts for split settlement)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_chapa_subaccounts (
  business_id UUID PRIMARY KEY REFERENCES public.businesses (id) ON DELETE CASCADE,
  chapa_subaccount_id TEXT NOT NULL,
  bank_code INTEGER NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  business_name TEXT,
  split_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (split_type IN ('percentage', 'flat')),
  split_value NUMERIC(10, 4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_chapa_subaccounts_status_idx
  ON public.business_chapa_subaccounts (status)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Per-booking financial breakdown (after successful Chapa payment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  service_price_etb NUMERIC(10, 2) NOT NULL CHECK (service_price_etb >= 0),
  commission_rate NUMERIC(6, 4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  commission_amount_etb NUMERIC(10, 2) NOT NULL CHECK (commission_amount_etb >= 0),
  platform_fee_etb NUMERIC(10, 2) NOT NULL CHECK (platform_fee_etb >= 0),
  owner_net_etb NUMERIC(10, 2) NOT NULL CHECK (owner_net_etb >= 0),
  currency TEXT NOT NULL DEFAULT 'ETB',
  chapa_subaccount_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_financials_business_id_idx
  ON public.booking_financials (business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Split metadata on payment transactions (set at initialize time)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS chapa_subaccount_id TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS commission_amount_etb NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS owner_net_etb NUMERIC(10, 2);

-- ---------------------------------------------------------------------------
-- Commission helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_business_commission_rate(p_business_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_rate NUMERIC;
  default_rate NUMERIC := 0.10;
BEGIN
  SELECT COALESCE(ps.default_booking_commission_rate, 0.10)
    INTO default_rate
    FROM public.platform_settings ps
   WHERE ps.id = 1;

  SELECT sp.commission_rate
    INTO plan_rate
    FROM public.business_subscriptions bs
    JOIN public.subscription_plans sp ON sp.id = bs.plan_id
   WHERE bs.business_id = p_business_id
     AND bs.status IN ('active', 'past_due')
   ORDER BY bs.updated_at DESC
   LIMIT 1;

  RETURN LEAST(GREATEST(COALESCE(plan_rate, default_rate), 0), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_booking_split(
  p_amount NUMERIC,
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate NUMERIC;
  commission NUMERIC;
  owner_net NUMERIC;
  amount NUMERIC := GREATEST(COALESCE(p_amount, 0), 0);
BEGIN
  rate := public.get_business_commission_rate(p_business_id);
  commission := round(amount * rate, 2);
  owner_net := round(amount - commission, 2);

  IF owner_net < 0 THEN
    owner_net := 0;
    commission := amount;
  END IF;

  RETURN jsonb_build_object(
    'commission_rate', rate,
    'commission_amount_etb', commission,
    'platform_fee_etb', commission,
    'owner_net_etb', owner_net,
    'service_price_etb', amount
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Finalize Chapa payment + record booking financials
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
        COALESCE(txn.commission_rate, public.get_business_commission_rate(booking_row.business_id)),
        COALESCE(txn.commission_amount_etb, round(p_amount * public.get_business_commission_rate(booking_row.business_id), 2)),
        COALESCE(txn.commission_amount_etb, round(p_amount * public.get_business_commission_rate(booking_row.business_id), 2)),
        COALESCE(txn.owner_net_etb, round(p_amount - round(p_amount * public.get_business_commission_rate(booking_row.business_id), 2), 2)),
        COALESCE(txn.currency, 'ETB'),
        txn.chapa_subaccount_id
      )
      ON CONFLICT (booking_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', txn.booking_id,
    'payment_status', 'paid'
  );
END;
$$;

-- Owner revenue stats prefer net settlement when financials exist
CREATE OR REPLACE FUNCTION public.get_owner_booking_stats(
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  is_owner BOOLEAN;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = p_business_id AND owner_id = actor
  ) INTO is_owner;

  IF NOT is_owner AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        b.status,
        b.scheduled_at,
        CASE
          WHEN b.status = 'completed' THEN COALESCE(
            bf.owner_net_etb,
            b.final_price,
            b.listed_price,
            b.listed_price_min,
            s.price,
            0
          )
          ELSE 0
        END AS completed_revenue
      FROM public.bookings b
      LEFT JOIN public.booking_financials bf ON bf.booking_id = b.id
      LEFT JOIN public.services s ON s.id = b.service_id
      WHERE b.business_id = p_business_id
    )
    SELECT jsonb_build_object(
      'totalBookings', COUNT(*)::INTEGER,
      'pendingBookings', COUNT(*) FILTER (WHERE status = 'pending')::INTEGER,
      'completedBookings', COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
      'cancelledBookings', COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER,
      'confirmedBookings', COUNT(*) FILTER (WHERE status = 'confirmed')::INTEGER,
      'totalRevenue', COALESCE(SUM(completed_revenue), 0),
      'last30DaysRevenue', COALESCE(SUM(completed_revenue) FILTER (
        WHERE scheduled_at >= now() - interval '30 days'
      ), 0),
      'byStatus', jsonb_build_object(
        'pending', COUNT(*) FILTER (WHERE status = 'pending')::INTEGER,
        'confirmed', COUNT(*) FILTER (WHERE status = 'confirmed')::INTEGER,
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER,
        'completed', COUNT(*) FILTER (WHERE status = 'completed')::INTEGER
      )
    )
    FROM base
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_chapa_subaccounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_financials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_chapa_subaccounts_owner_select ON public.business_chapa_subaccounts;
CREATE POLICY business_chapa_subaccounts_owner_select
  ON public.business_chapa_subaccounts
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_chapa_subaccounts.business_id
        AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS booking_financials_owner_select ON public.booking_financials;
CREATE POLICY booking_financials_owner_select
  ON public.booking_financials
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = booking_financials.business_id
        AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS booking_financials_customer_select ON public.booking_financials;
CREATE POLICY booking_financials_customer_select
  ON public.booking_financials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings bk
      WHERE bk.id = booking_financials.booking_id
        AND bk.customer_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION public.get_business_commission_rate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_booking_split(NUMERIC, UUID) TO authenticated;
