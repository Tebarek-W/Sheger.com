-- Unified analytics: one canonical definition for booking counts, gross revenue,
-- and settled payment metrics across admin and owner dashboards.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.booking_gross_etb(
  p_final_price NUMERIC,
  p_listed_price NUMERIC,
  p_listed_price_min NUMERIC,
  p_service_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(p_final_price, 0),
    NULLIF(p_listed_price, 0),
    NULLIF(p_listed_price_min, 0),
    NULLIF(p_service_price, 0),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_booking_status_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(status, count_value),
    '{}'::jsonb
  )
  FROM (
    SELECT status::TEXT AS status, count(*)::INTEGER AS count_value
    FROM public.bookings
    GROUP BY status
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.platform_paid_financial_totals(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  paid_bookings INTEGER,
  paid_gross_revenue NUMERIC,
  platform_commission NUMERIC,
  owner_net_revenue NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::INTEGER AS paid_bookings,
    COALESCE(SUM(bf.service_price_etb), 0) AS paid_gross_revenue,
    COALESCE(SUM(bf.platform_fee_etb), 0) AS platform_commission,
    COALESCE(SUM(bf.owner_net_etb), 0) AS owner_net_revenue
  FROM public.booking_financials bf
  JOIN public.bookings b ON b.id = bf.booking_id
  WHERE b.payment_status = 'paid'
    AND bf.service_price_etb > 0
    AND (p_since IS NULL OR bf.created_at >= p_since);
$$;

-- ---------------------------------------------------------------------------
-- Owner stats: earnings from booking_financials only (paid completed bookings)
-- ---------------------------------------------------------------------------

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
          WHEN b.status = 'completed' AND b.payment_status = 'paid'
          THEN COALESCE(bf.owner_net_etb, 0)
          ELSE 0
        END AS owner_net_revenue
      FROM public.bookings b
      LEFT JOIN public.booking_financials bf ON bf.booking_id = b.id
      WHERE b.business_id = p_business_id
    )
    SELECT jsonb_build_object(
      'totalBookings', COUNT(*)::INTEGER,
      'pendingBookings', COUNT(*) FILTER (WHERE status = 'pending')::INTEGER,
      'completedBookings', COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
      'cancelledBookings', COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER,
      'confirmedBookings', COUNT(*) FILTER (WHERE status = 'confirmed')::INTEGER,
      'totalRevenue', COALESCE(SUM(owner_net_revenue), 0),
      'last30DaysRevenue', COALESCE(SUM(owner_net_revenue) FILTER (
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
-- Admin dashboard snapshot
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_totals RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO paid_totals FROM public.platform_paid_financial_totals(NULL);

  RETURN jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'users', (SELECT count(*)::INTEGER FROM public.profiles),
        'businesses', (SELECT count(*)::INTEGER FROM public.businesses),
        'bookings', (SELECT count(*)::INTEGER FROM public.bookings),
        'completedGrossRevenue', (
          SELECT COALESCE(SUM(
            public.booking_gross_etb(
              b.final_price,
              b.listed_price,
              b.listed_price_min,
              s.price
            )
          ), 0)
          FROM public.bookings b
          LEFT JOIN public.services s ON s.id = b.service_id
          WHERE b.status = 'completed'
        ),
        'paidGrossRevenue', paid_totals.paid_gross_revenue,
        'platformCommission', paid_totals.platform_commission,
        'ownerNetRevenue', paid_totals.owner_net_revenue,
        'paidBookings', paid_totals.paid_bookings,
        'revenue', (
          SELECT COALESCE(SUM(
            public.booking_gross_etb(
              b.final_price,
              b.listed_price,
              b.listed_price_min,
              s.price
            )
          ), 0)
          FROM public.bookings b
          LEFT JOIN public.services s ON s.id = b.service_id
          WHERE b.status = 'completed'
        ),
        'pendingBusinesses', (
          SELECT count(*)::INTEGER FROM public.businesses WHERE status = 'pending'
        ),
        'categories', (SELECT count(*)::INTEGER FROM public.categories)
      )
    ),
    'bookingsByStatus', public.platform_booking_status_counts(),
    'topBusinesses', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT
          biz.name,
          count(*)::INTEGER AS bookings,
          COALESCE(SUM(
            CASE
              WHEN b.status = 'completed'
              THEN public.booking_gross_etb(
                b.final_price,
                b.listed_price,
                b.listed_price_min,
                svc.price
              )
              ELSE 0
            END
          ), 0) AS completedGrossRevenue,
          COALESCE(SUM(
            CASE
              WHEN b.status = 'completed' AND b.payment_status = 'paid'
              THEN bf.owner_net_etb
              ELSE 0
            END
          ), 0) AS paidRevenue
        FROM public.bookings b
        JOIN public.businesses biz ON biz.id = b.business_id
        LEFT JOIN public.services svc ON svc.id = b.service_id
        LEFT JOIN public.booking_financials bf ON bf.booking_id = b.id
        GROUP BY biz.id, biz.name
        ORDER BY count(*) DESC, biz.name ASC
        LIMIT 5
      ) x
    ),
    'timeSeries', (
      SELECT jsonb_build_object(
        'daily', public.get_admin_dashboard_timeseries('daily'),
        'weekly', public.get_admin_dashboard_timeseries('weekly'),
        'monthly', public.get_admin_dashboard_timeseries('monthly'),
        'yearly', public.get_admin_dashboard_timeseries('yearly')
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_timeseries(
  p_period TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket_count INTEGER;
  bucket_interval INTERVAL;
  trunc_unit TEXT;
  step_format TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  CASE p_period
    WHEN 'daily' THEN
      bucket_count := 24;
      bucket_interval := interval '1 hour';
      trunc_unit := 'hour';
      step_format := 'HH24:00';
    WHEN 'weekly' THEN
      bucket_count := 7;
      bucket_interval := interval '1 day';
      trunc_unit := 'day';
      step_format := 'Mon DD';
    WHEN 'monthly' THEN
      bucket_count := 30;
      bucket_interval := interval '1 day';
      trunc_unit := 'day';
      step_format := 'Mon DD';
    WHEN 'yearly' THEN
      bucket_count := 12;
      bucket_interval := interval '1 month';
      trunc_unit := 'month';
      step_format := 'Mon YY';
    ELSE
      RAISE EXCEPTION 'Unsupported period %', p_period;
  END CASE;

  RETURN (
    WITH buckets AS (
      SELECT
        generate_series(
          date_trunc(trunc_unit, now()) - ((bucket_count - 1) * bucket_interval),
          date_trunc(trunc_unit, now()),
          bucket_interval
        ) AS bucket_start
    ),
    user_counts AS (
      SELECT date_trunc(trunc_unit, created_at) AS bucket_start, count(*)::INTEGER AS users
      FROM public.profiles
      GROUP BY 1
    ),
    business_counts AS (
      SELECT date_trunc(trunc_unit, created_at) AS bucket_start, count(*)::INTEGER AS businesses
      FROM public.businesses
      GROUP BY 1
    ),
    booking_counts AS (
      SELECT
        date_trunc(trunc_unit, b.scheduled_at) AS bucket_start,
        count(*)::INTEGER AS bookings,
        COALESCE(SUM(
          CASE
            WHEN b.status = 'completed'
            THEN public.booking_gross_etb(
              b.final_price,
              b.listed_price,
              b.listed_price_min,
              s.price
            )
            ELSE 0
          END
        ), 0) AS completed_gross_revenue
      FROM public.bookings b
      LEFT JOIN public.services s ON s.id = b.service_id
      GROUP BY 1
    ),
    payment_counts AS (
      SELECT
        date_trunc(trunc_unit, bf.created_at) AS bucket_start,
        COALESCE(SUM(bf.service_price_etb), 0) AS paid_gross_revenue,
        COALESCE(SUM(bf.platform_fee_etb), 0) AS platform_commission
      FROM public.booking_financials bf
      JOIN public.bookings b ON b.id = bf.booking_id
      WHERE b.payment_status = 'paid'
        AND bf.service_price_etb > 0
      GROUP BY 1
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'key', to_char(b.bucket_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'label', trim(to_char(b.bucket_start, step_format)),
      'users', COALESCE(u.users, 0),
      'businesses', COALESCE(bs.businesses, 0),
      'bookings', COALESCE(bk.bookings, 0),
      'completedGrossRevenue', COALESCE(bk.completed_gross_revenue, 0),
      'paidGrossRevenue', COALESCE(pc.paid_gross_revenue, 0),
      'platformCommission', COALESCE(pc.platform_commission, 0),
      'revenue', COALESCE(bk.completed_gross_revenue, 0)
    ) ORDER BY b.bucket_start), '[]'::jsonb)
    FROM buckets b
    LEFT JOIN user_counts u ON u.bucket_start = b.bucket_start
    LEFT JOIN business_counts bs ON bs.bucket_start = b.bucket_start
    LEFT JOIN booking_counts bk ON bk.bucket_start = b.bucket_start
    LEFT JOIN payment_counts pc ON pc.bucket_start = b.bucket_start
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_reports_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_totals RECORD;
  paid_30d RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO paid_totals FROM public.platform_paid_financial_totals(NULL);
  SELECT * INTO paid_30d FROM public.platform_paid_financial_totals(now() - interval '30 days');

  RETURN jsonb_build_object(
    'statusCounts', public.platform_booking_status_counts(),
    'total', (SELECT count(*)::INTEGER FROM public.bookings),
    'last30Days', (
      SELECT count(*)::INTEGER
      FROM public.bookings
      WHERE scheduled_at >= now() - interval '30 days'
    ),
    'paidBookings', paid_totals.paid_bookings,
    'paidGrossRevenue', paid_totals.paid_gross_revenue,
    'platformCommission', paid_totals.platform_commission,
    'last30DaysCommission', paid_30d.platform_commission,
    'top', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT
          biz.name,
          count(*)::INTEGER AS count
        FROM public.bookings b
        JOIN public.businesses biz ON biz.id = b.business_id
        GROUP BY biz.id, biz.name
        ORDER BY count(*) DESC, biz.name ASC
        LIMIT 5
      ) x
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_payments_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_totals RECORD;
  paid_30d RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO paid_totals FROM public.platform_paid_financial_totals(NULL);
  SELECT * INTO paid_30d FROM public.platform_paid_financial_totals(now() - interval '30 days');

  RETURN jsonb_build_object(
    'paidBookings', paid_totals.paid_bookings,
    'paidGrossRevenue', paid_totals.paid_gross_revenue,
    'platformCommission', paid_totals.platform_commission,
    'ownerNetRevenue', paid_totals.owner_net_revenue,
    'last30DaysCommission', paid_30d.platform_commission
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.booking_gross_etb(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_booking_status_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_paid_financial_totals(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_booking_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_timeseries(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_reports_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payments_snapshot() TO authenticated;
