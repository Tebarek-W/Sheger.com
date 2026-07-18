-- Online Chapa eligibility: only require an active payout subaccount.
-- No minimum service price or commission-vs-fee checks (fee handling is per
-- the Chapa merchant agreement, not enforced in-app).

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

  RETURN jsonb_build_object('eligible', true);
END;
$$;

REVOKE ALL ON FUNCTION public.check_chapa_booking_eligibility(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_chapa_booking_eligibility(UUID, NUMERIC) TO authenticated;
