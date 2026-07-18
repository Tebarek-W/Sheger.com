-- Backend foundation: extension hooks, list indexes, paginated booking RPCs.
-- No feature tables (favorites, coupons, chat, etc.).

-- ---------------------------------------------------------------------------
-- JSONB extension hooks
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_idx
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- List query indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS bookings_customer_status_scheduled_idx
  ON public.bookings (customer_id, status, scheduled_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS bookings_business_status_scheduled_idx
  ON public.bookings (business_id, status, scheduled_at DESC, id DESC);

-- ---------------------------------------------------------------------------
-- Paginated booking lists (cursor template for future list RPCs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_customer_bookings_page(
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
    SELECT b.*
    FROM public.bookings b
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
    COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.scheduled_at DESC, page.id DESC), '[]'::jsonb),
    COUNT(*)::INTEGER
  INTO page_rows, page_count
  FROM page;

  IF page_count = safe_limit THEN
    SELECT jsonb_build_object(
      'scheduled_at', p.scheduled_at,
      'id', p.id
    )
    INTO next_cursor
    FROM (
      SELECT b.scheduled_at, b.id
      FROM public.bookings b
      WHERE b.customer_id = actor
        AND (
          p_cursor_scheduled_at IS NULL
          OR p_cursor_id IS NULL
          OR (b.scheduled_at, b.id) < (p_cursor_scheduled_at, p_cursor_id)
        )
      ORDER BY b.scheduled_at DESC, b.id DESC
      LIMIT safe_limit
    ) p
    ORDER BY p.scheduled_at ASC, p.id ASC
    LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.list_business_bookings_page(
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
  page_rows JSONB;
  page_count INTEGER;
  next_cursor JSONB;
  is_owner BOOLEAN;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id is required';
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
    SELECT b.*
    FROM public.bookings b
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
    COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.scheduled_at DESC, page.id DESC), '[]'::jsonb),
    COUNT(*)::INTEGER
  INTO page_rows, page_count
  FROM page;

  IF page_count = safe_limit THEN
    SELECT jsonb_build_object(
      'scheduled_at', p.scheduled_at,
      'id', p.id
    )
    INTO next_cursor
    FROM (
      SELECT b.scheduled_at, b.id
      FROM public.bookings b
      WHERE b.business_id = p_business_id
        AND (
          p_cursor_scheduled_at IS NULL
          OR p_cursor_id IS NULL
          OR (b.scheduled_at, b.id) < (p_cursor_scheduled_at, p_cursor_id)
        )
      ORDER BY b.scheduled_at DESC, b.id DESC
      LIMIT safe_limit
    ) p
    ORDER BY p.scheduled_at ASC, p.id ASC
    LIMIT 1;
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

GRANT EXECUTE ON FUNCTION public.list_customer_bookings_page(INTEGER, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_business_bookings_page(UUID, INTEGER, TIMESTAMPTZ, UUID) TO authenticated;

-- referral_code will be assigned by server RPC later; block direct client edits
CREATE OR REPLACE FUNCTION public.protect_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'referral_code cannot be changed directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_referral_code ON public.profiles;
CREATE TRIGGER profiles_protect_referral_code
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_referral_code();
