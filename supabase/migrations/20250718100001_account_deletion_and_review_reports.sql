-- Store compliance: review reporting / moderation + rating summaries ignore hidden reviews.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS reviews_business_visible_idx
  ON public.reviews (business_id, created_at DESC)
  WHERE is_hidden = false;

COMMENT ON COLUMN public.reviews.is_hidden IS
  'When true, review is hidden from public listings after moderation.';

CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews (id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 500),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  UNIQUE (review_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS review_reports_status_idx
  ON public.review_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS review_reports_review_id_idx
  ON public.review_reports (review_id);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users report reviews" ON public.review_reports;
CREATE POLICY "Users report reviews"
  ON public.review_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_id
        AND r.is_hidden = false
        AND r.customer_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own review reports" ON public.review_reports;
CREATE POLICY "Users read own review reports"
  ON public.review_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage review reports" ON public.review_reports;
CREATE POLICY "Admins manage review reports"
  ON public.review_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update reviews" ON public.reviews;
CREATE POLICY "Admins update reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public read of reviews should exclude hidden ones for non-admins.
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'Public can read reviews'
  ) THEN
    EXECUTE 'DROP POLICY "Public can read reviews" ON public.reviews';
  END IF;
END $$;

CREATE POLICY "Visible reviews are readable"
  ON public.reviews FOR SELECT
  USING (
    is_hidden = false
    OR public.is_admin()
    OR customer_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.get_business_rating_summaries()
RETURNS TABLE (business_id uuid, average numeric, review_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.business_id, avg(r.rating)::numeric, count(*)::bigint
  FROM public.reviews r
  WHERE r.is_hidden = false
  GROUP BY r.business_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_rating_summaries() TO anon, authenticated;

-- Exclude hidden reviews from marketplace discovery ratings.
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
        AND r.is_hidden = false
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
