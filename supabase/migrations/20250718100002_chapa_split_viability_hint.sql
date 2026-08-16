-- Eligibility: require payout subaccount; expose whether automatic Chapa split is
-- viable for a given amount (commission must cover estimated processing fee).
-- Checkout may still proceed via merchant-only fallback when auto_split is false.

CREATE OR REPLACE FUNCTION public.check_chapa_booking_eligibility(
  p_business_id UUID,
  p_amount NUMERIC DEFAULT NULL
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

  FOR amt IN 1..100000 LOOP
    fee := GREATEST(6::NUMERIC, CEIL(amt * 0.06 * 100) / 100.0);
    commission := ROUND(amt * rate, 2);
    IF commission >= fee THEN
      min_amt := amt;
      EXIT;
    END IF;
  END LOOP;

  IF min_amt IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'auto_split_viable', false,
      'code', 'split_not_viable_for_plan'
    );
  END IF;

  IF amount > 0 AND amount < min_amt THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'auto_split_viable', false,
      'min_amount_for_auto_split_etb', min_amt
    );
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'auto_split_viable', true,
    'min_amount_for_auto_split_etb', min_amt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_chapa_booking_eligibility(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_chapa_booking_eligibility(UUID, NUMERIC) TO authenticated;
