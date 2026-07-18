-- Fix premature $0 booking_financials rows from legacy trigger on booking insert.
-- Financials should only be recorded after a successful Chapa payment (finalize_chapa_payment).

DROP TRIGGER IF EXISTS bookings_create_financials ON public.bookings;
DROP FUNCTION IF EXISTS public.create_booking_financials();

DELETE FROM public.booking_financials bf
USING public.bookings b
WHERE b.id = bf.booking_id
  AND b.payment_status IS DISTINCT FROM 'paid';

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
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', txn.booking_id,
    'payment_status', 'paid'
  );
END;
$$;

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
        b.payment_status,
        b.scheduled_at,
        CASE
          WHEN b.status = 'completed' THEN COALESCE(
            CASE WHEN b.payment_status = 'paid' THEN bf.owner_net_etb END,
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
