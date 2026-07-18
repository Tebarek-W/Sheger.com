-- Fix booking page RPCs: next_cursor referenced CTE outside scope.

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
  last_row JSONB;
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

  IF page_count = safe_limit AND jsonb_array_length(page_rows) > 0 THEN
    last_row := page_rows -> (jsonb_array_length(page_rows) - 1);
    next_cursor := jsonb_build_object(
      'scheduled_at', last_row -> 'scheduled_at',
      'id', last_row -> 'id'
    );
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
  last_row JSONB;
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
      b.id,
      b.customer_id,
      b.business_id,
      b.service_id,
      b.employee_id,
      b.scheduled_at,
      b.duration_minutes,
      b.scheduling_block_minutes,
      b.pricing_model,
      b.duration_model,
      b.listed_price,
      b.listed_price_min,
      b.listed_price_max,
      b.final_price,
      b.actual_duration_minutes,
      b.status,
      b.payment_status,
      b.paid_amount_etb,
      b.payment_expires_at,
      b.payment_method,
      b.notes,
      b.metadata,
      b.created_at,
      b.updated_at,
      svc.id AS svc_id,
      svc.name AS svc_name,
      svc.description AS svc_description,
      svc.price AS svc_price,
      svc.price_min AS svc_price_min,
      svc.price_max AS svc_price_max,
      svc.pricing_model AS svc_pricing_model,
      svc.duration_model AS svc_duration_model,
      svc.duration_minutes AS svc_duration_minutes,
      svc.scheduling_block_minutes AS svc_scheduling_block_minutes,
      svc.is_active AS svc_is_active,
      svc.created_at AS svc_created_at,
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
          'profiles', jsonb_build_object(
            'full_name', page.profile_full_name,
            'phone', page.profile_phone
          ),
          'services', jsonb_build_object(
            'id', page.svc_id,
            'business_id', page.business_id,
            'name', page.svc_name,
            'description', page.svc_description,
            'price', page.svc_price,
            'price_min', page.svc_price_min,
            'price_max', page.svc_price_max,
            'pricing_model', page.svc_pricing_model,
            'duration_model', page.svc_duration_model,
            'duration_minutes', page.svc_duration_minutes,
            'scheduling_block_minutes', page.svc_scheduling_block_minutes,
            'is_active', page.svc_is_active,
            'created_at', page.svc_created_at
          )
        )
        ORDER BY page.scheduled_at DESC, page.id DESC
      ),
      '[]'::jsonb
    ),
    COUNT(*)::INTEGER
  INTO page_rows, page_count
  FROM page;

  IF page_count = safe_limit AND jsonb_array_length(page_rows) > 0 THEN
    last_row := page_rows -> (jsonb_array_length(page_rows) - 1);
    next_cursor := jsonb_build_object(
      'scheduled_at', last_row -> 'scheduled_at',
      'id', last_row -> 'id'
    );
  ELSE
    next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object('rows', page_rows, 'next_cursor', next_cursor, 'limit', safe_limit);
END;
$$;
