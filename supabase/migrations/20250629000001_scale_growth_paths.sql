-- Scale growth paths: marketplace pagination, booking list RPCs, admin summaries,
-- and queued push delivery to reduce synchronous fan-out.

-- ---------------------------------------------------------------------------
-- Discovery indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS businesses_status_featured_name_idx
  ON public.businesses (status, featured_in_search DESC, name, id);

CREATE INDEX IF NOT EXISTS services_business_active_price_idx
  ON public.services (business_id, is_active, price, price_min, price_max);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read_at, created_at DESC)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Notification delivery queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_created_idx
  ON public.notification_deliveries (status, created_at, id);

CREATE INDEX IF NOT EXISTS notification_deliveries_notification_idx
  ON public.notification_deliveries (notification_id);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Admins read notification deliveries"
  ON public.notification_deliveries FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.enqueue_notification_deliveries(
  p_notification_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.notification_deliveries (
    notification_id,
    user_id,
    expo_push_token,
    title,
    body,
    data
  )
  SELECT
    p_notification_id,
    p_user_id,
    pt.expo_push_token,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb)
  FROM public.push_tokens pt
  WHERE pt.user_id = p_user_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  notification_id UUID,
  user_id UUID,
  expo_push_token TEXT,
  title TEXT,
  body TEXT,
  data JSONB,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT nd.id
    FROM public.notification_deliveries nd
    WHERE nd.status = 'pending'
    ORDER BY nd.created_at, nd.id
    LIMIT safe_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.notification_deliveries nd
    SET
      status = 'processing',
      claimed_at = now(),
      attempts = nd.attempts + 1
    WHERE nd.id IN (SELECT id FROM picked)
    RETURNING nd.id, nd.notification_id, nd.user_id, nd.expo_push_token, nd.title, nd.body, nd.data, nd.attempts
  )
  SELECT * FROM updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_notification_delivery(
  p_delivery_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'pending') THEN
    RAISE EXCEPTION 'Invalid delivery status';
  END IF;

  UPDATE public.notification_deliveries
  SET
    status = p_status,
    last_error = p_error,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    claimed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE claimed_at END
  WHERE id = p_delivery_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Marketplace discovery page
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_marketplace_businesses_page(
  p_limit INTEGER DEFAULT 20,
  p_cursor_featured BOOLEAN DEFAULT NULL,
  p_cursor_name TEXT DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_query TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  page_rows JSONB;
  page_count INTEGER;
  next_cursor JSONB;
BEGIN
  WITH filtered AS (
    SELECT
      b.id,
      b.owner_id,
      b.category_id,
      b.name,
      b.description,
      b.address,
      b.city,
      b.latitude,
      b.longitude,
      b.phone,
      b.email,
      b.cover_image_url,
      b.status,
      b.cancellation_hours,
      b.featured_in_search,
      b.created_at,
      b.updated_at,
      c.name AS category_name,
      c.slug AS category_slug,
      svc.from_price,
      rate.average_rating,
      rate.review_count,
      CASE
        WHEN p_latitude IS NOT NULL
         AND p_longitude IS NOT NULL
         AND b.latitude IS NOT NULL
         AND b.longitude IS NOT NULL
        THEN (
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(p_latitude)) * cos(radians(b.latitude)) *
              cos(radians(b.longitude) - radians(p_longitude)) +
              sin(radians(p_latitude)) * sin(radians(b.latitude))
            ))
          )
        )
        ELSE NULL
      END AS distance_km
    FROM public.businesses b
    LEFT JOIN public.categories c ON c.id = b.category_id
    LEFT JOIN LATERAL (
      SELECT min(COALESCE(s.price, s.price_min, s.price_max)) AS from_price
      FROM public.services s
      WHERE s.business_id = b.id
        AND s.is_active = true
    ) svc ON true
    LEFT JOIN LATERAL (
      SELECT avg(r.rating)::NUMERIC AS average_rating, count(*)::INTEGER AS review_count
      FROM public.reviews r
      WHERE r.business_id = b.id
    ) rate ON true
    WHERE b.status = 'approved'
      AND public.business_is_marketplace_live(b.id)
      AND (p_category_id IS NULL OR b.category_id = p_category_id)
      AND (
        COALESCE(trim(p_query), '') = ''
        OR b.name ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(b.description, '') ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(b.city, '') ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(b.address, '') ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(c.name, '') ILIKE '%' || trim(p_query) || '%'
        OR EXISTS (
          SELECT 1
          FROM public.services qs
          WHERE qs.business_id = b.id
            AND qs.is_active = true
            AND qs.name ILIKE '%' || trim(p_query) || '%'
        )
      )
      AND (COALESCE(trim(p_city), '') = '' OR COALESCE(b.city, '') ILIKE trim(p_city))
      AND (p_min_rating IS NULL OR COALESCE(rate.average_rating, 0) >= p_min_rating)
      AND (p_price_min IS NULL OR svc.from_price IS NOT NULL AND svc.from_price >= p_price_min)
      AND (p_price_max IS NULL OR svc.from_price IS NOT NULL AND svc.from_price <= p_price_max)
      AND (
        p_radius_km IS NULL
        OR p_latitude IS NULL
        OR p_longitude IS NULL
        OR (
          b.latitude IS NOT NULL AND b.longitude IS NOT NULL
          AND (
            6371 * acos(
              LEAST(1, GREATEST(-1,
                cos(radians(p_latitude)) * cos(radians(b.latitude)) *
                cos(radians(b.longitude) - radians(p_longitude)) +
                sin(radians(p_latitude)) * sin(radians(b.latitude))
              ))
            )
          ) <= p_radius_km
        )
      )
      AND (
        p_cursor_name IS NULL
        OR p_cursor_id IS NULL
        OR (NOT b.featured_in_search, lower(b.name), b.id) >
           (NOT COALESCE(p_cursor_featured, false), lower(p_cursor_name), p_cursor_id)
      )
    ORDER BY b.featured_in_search DESC, lower(b.name) ASC, b.id ASC
    LIMIT safe_limit
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', filtered.id,
          'owner_id', filtered.owner_id,
          'category_id', filtered.category_id,
          'name', filtered.name,
          'description', filtered.description,
          'address', filtered.address,
          'city', filtered.city,
          'latitude', filtered.latitude,
          'longitude', filtered.longitude,
          'phone', filtered.phone,
          'email', filtered.email,
          'cover_image_url', filtered.cover_image_url,
          'status', filtered.status,
          'cancellation_hours', filtered.cancellation_hours,
          'featured_in_search', filtered.featured_in_search,
          'created_at', filtered.created_at,
          'updated_at', filtered.updated_at,
          'categories', CASE
            WHEN filtered.category_name IS NULL AND filtered.category_slug IS NULL THEN NULL
            ELSE jsonb_build_object('name', filtered.category_name, 'slug', filtered.category_slug)
          END,
          'from_price', filtered.from_price,
          'rating_average', filtered.average_rating,
          'rating_count', COALESCE(filtered.review_count, 0),
          'distance_km', filtered.distance_km
        )
        ORDER BY filtered.featured_in_search DESC, lower(filtered.name) ASC, filtered.id ASC
      ),
      '[]'::jsonb
    ),
    COUNT(*)::INTEGER
  INTO page_rows, page_count
  FROM filtered;

  IF page_count = safe_limit THEN
    SELECT jsonb_build_object(
      'featured_in_search', f.featured_in_search,
      'name', f.name,
      'id', f.id
    )
    INTO next_cursor
    FROM (
      SELECT filtered.featured_in_search, filtered.name, filtered.id
      FROM filtered
      ORDER BY filtered.featured_in_search ASC, lower(filtered.name) DESC, filtered.id DESC
      LIMIT 1
    ) f;
  ELSE
    next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'rows', page_rows,
    'next_cursor', next_cursor,
    'limit', safe_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_marketplace_businesses_page(
  INTEGER, BOOLEAN, TEXT, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rich booking page RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_customer_booking_cards_page(
  p_limit INTEGER DEFAULT 20,
  p_cursor_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  page_rows JSONB;
  page_count INTEGER;
  next_cursor JSONB;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH page AS (
    SELECT
      b.*,
      biz.name AS business_name,
      biz.address AS business_address,
      biz.city AS business_city,
      biz.cancellation_hours,
      svc.name AS service_name,
      svc.price AS service_price
    FROM public.bookings b
    LEFT JOIN public.businesses biz ON biz.id = b.business_id
    LEFT JOIN public.services svc ON svc.id = b.service_id
    WHERE b.customer_id = actor
      AND (
        p_cursor_scheduled_at IS NULL
        OR p_cursor_id IS NULL
        OR (b.scheduled_at, b.id) < (p_cursor_scheduled_at, p_cursor_id)
      )
    ORDER BY b.scheduled_at DESC, b.id DESC
    LIMIT safe_limit
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'customer_id', page.customer_id,
          'business_id', page.business_id,
          'service_id', page.service_id,
          'employee_id', page.employee_id,
          'scheduled_at', page.scheduled_at,
          'duration_minutes', page.duration_minutes,
          'scheduling_block_minutes', page.scheduling_block_minutes,
          'pricing_model', page.pricing_model,
          'duration_model', page.duration_model,
          'listed_price', page.listed_price,
          'listed_price_min', page.listed_price_min,
          'listed_price_max', page.listed_price_max,
          'final_price', page.final_price,
          'actual_duration_minutes', page.actual_duration_minutes,
          'status', page.status,
          'payment_status', page.payment_status,
          'paid_amount_etb', page.paid_amount_etb,
          'payment_expires_at', page.payment_expires_at,
          'payment_method', page.payment_method,
          'notes', page.notes,
          'metadata', page.metadata,
          'created_at', page.created_at,
          'updated_at', page.updated_at,
          'businesses', jsonb_build_object(
            'name', page.business_name,
            'address', page.business_address,
            'city', page.business_city,
            'cancellation_hours', page.cancellation_hours
          ),
          'services', jsonb_build_object(
            'name', page.service_name,
            'price', page.service_price
          )
        )
        ORDER BY page.scheduled_at DESC, page.id DESC
      ),
      '[]'::jsonb
    ),
    COUNT(*)::INTEGER
  INTO page_rows, page_count
  FROM page;

  IF page_count = safe_limit THEN
    SELECT jsonb_build_object('scheduled_at', p.scheduled_at, 'id', p.id)
    INTO next_cursor
    FROM (
      SELECT page.scheduled_at, page.id
      FROM page
      ORDER BY page.scheduled_at ASC, page.id ASC
      LIMIT 1
    ) p;
  ELSE
    next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object('rows', page_rows, 'next_cursor', next_cursor, 'limit', safe_limit);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_business_booking_cards_page(
  p_business_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_cursor_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  is_owner BOOLEAN;
  page_rows JSONB;
  page_count INTEGER;
  next_cursor JSONB;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.businesses biz
    WHERE biz.id = p_business_id
      AND biz.owner_id = actor
  ) INTO is_owner;

  IF NOT is_owner AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;

  WITH page AS (
    SELECT
      b.*,
      svc.*,
      p.full_name AS profile_full_name,
      p.phone AS profile_phone
    FROM public.bookings b
    LEFT JOIN public.services svc ON svc.id = b.service_id
    LEFT JOIN public.profiles p ON p.id = b.customer_id
    WHERE b.business_id = p_business_id
      AND (
        p_cursor_scheduled_at IS NULL
        OR p_cursor_id IS NULL
        OR (b.scheduled_at, b.id) < (p_cursor_scheduled_at, p_cursor_id)
      )
    ORDER BY b.scheduled_at DESC, b.id DESC
    LIMIT safe_limit
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(page) ||
        jsonb_build_object(
          'profiles', jsonb_build_object(
            'full_name', page.profile_full_name,
            'phone', page.profile_phone
          ),
          'services', jsonb_build_object(
            'id', page.service_id,
            'business_id', page.business_id,
            'name', page.name,
            'description', page.description,
            'price', page.price,
            'price_min', page.price_min,
            'price_max', page.price_max,
            'pricing_model', page.pricing_model,
            'duration_model', page.duration_model,
            'duration_minutes', page.duration_minutes,
            'scheduling_block_minutes', page.scheduling_block_minutes,
            'is_active', page.is_active,
            'created_at', page.created_at
          )
        )
        - 'profile_full_name' - 'profile_phone' - 'name' - 'description' - 'price' - 'price_min' - 'price_max'
        - 'is_active'
        ORDER BY page.scheduled_at DESC, page.id DESC
      ),
      '[]'::jsonb
    ),
    COUNT(*)::INTEGER
  INTO page_rows, page_count
  FROM page;

  IF page_count = safe_limit THEN
    SELECT jsonb_build_object('scheduled_at', p.scheduled_at, 'id', p.id)
    INTO next_cursor
    FROM (
      SELECT page.scheduled_at, page.id
      FROM page
      ORDER BY page.scheduled_at ASC, page.id ASC
      LIMIT 1
    ) p;
  ELSE
    next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object('rows', page_rows, 'next_cursor', next_cursor, 'limit', safe_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_customer_booking_cards_page(INTEGER, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_business_booking_cards_page(UUID, INTEGER, TIMESTAMPTZ, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Owner and admin summaries
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
        b.scheduled_at,
        CASE
          WHEN b.status = 'completed' THEN COALESCE(
            b.final_price,
            b.listed_price,
            b.listed_price_min,
            s.price,
            0
          )
          ELSE 0
        END AS completed_revenue
      FROM public.bookings b
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

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'users', (SELECT count(*)::INTEGER FROM public.profiles),
        'businesses', (SELECT count(*)::INTEGER FROM public.businesses),
        'bookings', (SELECT count(*)::INTEGER FROM public.bookings),
        'revenue', (
          SELECT COALESCE(SUM(COALESCE(b.final_price, b.listed_price, b.listed_price_min, s.price, 0)), 0)
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
    'bookingsByStatus', (
      SELECT COALESCE(jsonb_object_agg(status, count_value), '{}'::jsonb)
      FROM (
        SELECT status::TEXT AS status, count(*)::INTEGER AS count_value
        FROM public.bookings
        GROUP BY status
      ) s
    ),
    'topBusinesses', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT
          biz.name,
          count(*)::INTEGER AS bookings,
          COALESCE(SUM(
            CASE
              WHEN b.status = 'completed'
              THEN COALESCE(b.final_price, b.listed_price, b.listed_price_min, svc.price, 0)
              ELSE 0
            END
          ), 0) AS revenue
        FROM public.bookings b
        JOIN public.businesses biz ON biz.id = b.business_id
        LEFT JOIN public.services svc ON svc.id = b.service_id
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
        date_trunc(trunc_unit, b.created_at) AS bucket_start,
        count(*)::INTEGER AS bookings,
        COALESCE(SUM(
          CASE
            WHEN b.status = 'completed'
            THEN COALESCE(b.final_price, b.listed_price, b.listed_price_min, s.price, 0)
            ELSE 0
          END
        ), 0) AS revenue
      FROM public.bookings b
      LEFT JOIN public.services s ON s.id = b.service_id
      GROUP BY 1
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'key', to_char(b.bucket_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'label', trim(to_char(b.bucket_start, step_format)),
      'users', COALESCE(u.users, 0),
      'businesses', COALESCE(bs.businesses, 0),
      'bookings', COALESCE(bk.bookings, 0),
      'revenue', COALESCE(bk.revenue, 0)
    ) ORDER BY b.bucket_start), '[]'::jsonb)
    FROM buckets b
    LEFT JOIN user_counts u ON u.bucket_start = b.bucket_start
    LEFT JOIN business_counts bs ON bs.bucket_start = b.bucket_start
    LEFT JOIN booking_counts bk ON bk.bucket_start = b.bucket_start
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'statusCounts', (
      SELECT COALESCE(jsonb_object_agg(status, count_value), '{}'::jsonb)
      FROM (
        SELECT status::TEXT AS status, count(*)::INTEGER AS count_value
        FROM public.bookings
        GROUP BY status
      ) s
    ),
    'last30Days', (
      SELECT count(*)::INTEGER
      FROM public.bookings
      WHERE created_at >= now() - interval '30 days'
    ),
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
    ),
    'total', (SELECT count(*)::INTEGER FROM public.bookings)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_booking_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_timeseries(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_reports_snapshot() TO authenticated;

-- ---------------------------------------------------------------------------
-- Set-based subscription expiry update
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_subscriptions_past_due()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grace_days INTEGER := 3;
  updated_count INTEGER := 0;
BEGIN
  SELECT ps.grace_period_days
  INTO grace_days
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  WITH updated AS (
    UPDATE public.business_subscriptions bs
    SET
      status = 'past_due',
      grace_ends_at = bs.current_period_end + make_interval(days => COALESCE(grace_days, 3)),
      updated_at = now()
    WHERE bs.status = 'active'
      AND bs.current_period_end IS NOT NULL
      AND bs.current_period_end < now()
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$;

