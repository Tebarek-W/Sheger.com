-- Fix list_marketplace_businesses_page: next_cursor referenced CTE outside its scope.

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
  last_row JSONB;
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

  IF page_count = safe_limit AND jsonb_array_length(page_rows) > 0 THEN
    last_row := page_rows -> (jsonb_array_length(page_rows) - 1);
    next_cursor := jsonb_build_object(
      'featured_in_search', last_row -> 'featured_in_search',
      'name', last_row -> 'name',
      'id', last_row -> 'id'
    );
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
