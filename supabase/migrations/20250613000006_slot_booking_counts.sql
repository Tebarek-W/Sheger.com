-- Aggregated slot booking counts for availability (no customer PII exposed).

CREATE OR REPLACE FUNCTION public.get_slot_booking_counts(
  p_business_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
RETURNS TABLE (
  scheduled_at timestamptz,
  booking_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.scheduled_at, count(*)::bigint AS booking_count
  FROM public.bookings b
  INNER JOIN public.businesses bus ON bus.id = b.business_id
  WHERE b.business_id = p_business_id
    AND bus.status = 'approved'
    AND b.scheduled_at >= p_range_start
    AND b.scheduled_at <= p_range_end
    AND b.status <> 'cancelled'
  GROUP BY b.scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.get_slot_booking_counts(uuid, timestamptz, timestamptz) TO authenticated;
