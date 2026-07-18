-- Pre-check whether a fixed-price booking can be paid online via Chapa (platform
-- minimum + split-payment fee viability + payout account). Used by the mobile
-- payment screen so customers are not sent to checkout only to fail server-side.

CREATE OR REPLACE FUNCTION public.check_chapa_booking_eligibility(
  p_business_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate NUMERIC;
  amt INTEGER;
  fee NUMERIC;
  commission NUMERIC;
  min_amt NUMERIC := NULL;
  amount NUMERIC := GREATEST(COALESCE(p_amount, 0), 0);
  chapa_floor CONSTANT NUMERIC := 300;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.business_chapa_subaccounts
     WHERE business_id = p_business_id
       AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'code', 'payout_not_configured'
    );
  END IF;

  rate := public.get_business_commission_rate(p_business_id);

  -- Find the lowest price (>= Chapa floor) where commission covers Chapa fees.
  FOR amt IN 300..100000 LOOP
    fee := GREATEST(6::NUMERIC, CEIL(amt * 0.06 * 100) / 100.0);
    commission := ROUND(amt * rate, 2);
    IF commission >= fee THEN
      min_amt := amt;
      EXIT;
    END IF;
  END LOOP;

  IF min_amt IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'code', 'split_not_viable'
    );
  END IF;

  IF amount < chapa_floor THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'code', 'amount_below_chapa_minimum',
      'min_amount_etb', GREATEST(min_amt, chapa_floor)
    );
  END IF;

  fee := GREATEST(6::NUMERIC, CEIL(amount * 0.06 * 100) / 100.0);
  commission := ROUND(amount * rate, 2);

  IF commission >= fee THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'min_amount_etb', min_amt
    );
  END IF;

  RETURN jsonb_build_object(
    'eligible', false,
    'code', 'amount_too_low_for_chapa_split',
    'min_amount_etb', min_amt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_chapa_booking_eligibility(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_chapa_booking_eligibility(UUID, NUMERIC) TO authenticated;
