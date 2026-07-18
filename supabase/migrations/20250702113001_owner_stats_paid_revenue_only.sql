-- Owner dashboard/report revenue should reflect paid bookings only.
-- Booking counts still come from bookings.status, but revenue now excludes
-- completed bookings that have not actually been paid.

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
          WHEN b.status = 'completed' AND b.payment_status = 'paid' THEN COALESCE(
            bf.owner_net_etb,
            b.final_price,
            b.listed_price,
            b.listed_price_min,
            s.price,
            0
          )
          ELSE 0
        END AS paid_revenue
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
      'totalRevenue', COALESCE(SUM(paid_revenue), 0),
      'last30DaysRevenue', COALESCE(SUM(paid_revenue) FILTER (
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
