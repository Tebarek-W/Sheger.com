-- Weekly subscription cap should count new bookings received this week,
-- not appointments scheduled in the current calendar week.
CREATE OR REPLACE FUNCTION public.business_weekly_booking_count(p_business_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.bookings b
  CROSS JOIN public.addis_week_bounds() w
  WHERE b.business_id = p_business_id
    AND b.status <> 'cancelled'
    AND b.created_at >= w.week_start
    AND b.created_at < w.week_end;
$$;
