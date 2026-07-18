-- Provider subscriptions: mock payment, usage limits, marketplace gating.

DO $$ BEGIN
  CREATE TYPE public.billing_interval AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_payment_source AS ENUM ('mock', 'admin_manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Platform settings (singleton)
-- Recreate if an older/partial schema exists without the expected columns.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_settings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_settings'
      AND column_name = 'id'
  ) THEN
    DROP TABLE public.platform_settings CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 500,
  yearly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 5000,
  grace_period_days INTEGER NOT NULL DEFAULT 3,
  default_max_services INTEGER NOT NULL DEFAULT 10,
  default_max_bookings_per_week INTEGER NOT NULL DEFAULT 50,
  currency TEXT NOT NULL DEFAULT 'ETB',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS id INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS yearly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_max_services INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_max_bookings_per_week INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Subscription plans (admin-defined tiers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  monthly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  yearly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_services INTEGER NOT NULL DEFAULT 10,
  max_bookings_per_week INTEGER NOT NULL DEFAULT 50,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured_in_search BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS monthly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_fee_etb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_services INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_bookings_per_week INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured_in_search BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_slug_idx
  ON public.subscription_plans (slug);

INSERT INTO public.subscription_plans (
  name, slug, description, monthly_fee_etb, yearly_fee_etb,
  max_services, max_bookings_per_week, sort_order, is_active, is_featured_in_search
) VALUES
  (
    'Free', 'free', 'Get started with limited listings and bookings.',
    0, 0, 3, 10, 1, true, false
  ),
  (
    'Basic', 'basic', 'Standard plan for growing businesses.',
    500, 5000, 10, 50, 2, true, false
  ),
  (
    'Premium', 'premium', 'Higher limits plus featured placement at the top of search results.',
    1500, 15000, 50, 200, 3, true, true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_fee_etb = EXCLUDED.monthly_fee_etb,
  yearly_fee_etb = EXCLUDED.yearly_fee_etb,
  max_services = EXCLUDED.max_services,
  max_bookings_per_week = EXCLUDED.max_bookings_per_week,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  is_featured_in_search = EXCLUDED.is_featured_in_search,
  updated_at = now();

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS featured_in_search BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Business subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses (id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans (id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  billing_interval public.billing_interval,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_subscriptions_status_idx
  ON public.business_subscriptions (status);

CREATE INDEX IF NOT EXISTS business_subscriptions_period_end_idx
  ON public.business_subscriptions (current_period_end);

ALTER TABLE public.business_subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans (id),
  ADD COLUMN IF NOT EXISTS status public.subscription_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_interval public.billing_interval,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Subscription payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans (id),
  billing_interval public.billing_interval NOT NULL,
  amount_etb NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  source public.subscription_payment_source NOT NULL DEFAULT 'mock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_payments_business_id_idx
  ON public.subscription_payments (business_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_reference_code_idx
  ON public.subscription_payments (reference_code);

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans (id),
  ADD COLUMN IF NOT EXISTS billing_interval public.billing_interval,
  ADD COLUMN IF NOT EXISTS amount_etb NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source public.subscription_payment_source NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.addis_week_bounds()
RETURNS TABLE (week_start TIMESTAMPTZ, week_end TIMESTAMPTZ)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (date_trunc('week', (now() AT TIME ZONE 'Africa/Addis_Ababa')) AT TIME ZONE 'Africa/Addis_Ababa') AS week_start,
    ((date_trunc('week', (now() AT TIME ZONE 'Africa/Addis_Ababa')) + interval '7 days') AT TIME ZONE 'Africa/Addis_Ababa') AS week_end;
$$;

CREATE OR REPLACE FUNCTION public.business_subscription_limits(p_business_id UUID)
RETURNS TABLE (max_services INTEGER, max_bookings_per_week INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.max_services::INTEGER,
    sp.max_bookings_per_week::INTEGER
  FROM public.business_subscriptions bs
  JOIN public.subscription_plans sp ON sp.id = bs.plan_id
  WHERE bs.business_id = p_business_id
  UNION ALL
  SELECT sp.max_services::INTEGER, sp.max_bookings_per_week::INTEGER
  FROM public.subscription_plans sp
  WHERE sp.slug = 'free'
    AND NOT EXISTS (
      SELECT 1 FROM public.business_subscriptions bs
      WHERE bs.business_id = p_business_id AND bs.plan_id IS NOT NULL
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.business_active_service_count(p_business_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.services s
  WHERE s.business_id = p_business_id
    AND s.is_active = true;
$$;

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
    AND b.scheduled_at >= w.week_start
    AND b.scheduled_at < w.week_end;
$$;

CREATE OR REPLACE FUNCTION public.business_is_marketplace_live(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    JOIN public.business_subscriptions bs ON bs.business_id = b.id
    WHERE b.id = p_business_id
      AND b.status = 'approved'
      AND bs.status IN ('active', 'past_due')
      AND bs.current_period_end IS NOT NULL
      AND bs.current_period_end > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.business_can_accept_booking(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limits RECORD;
  weekly_count INTEGER;
BEGIN
  IF NOT public.business_is_marketplace_live(p_business_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO limits FROM public.business_subscription_limits(p_business_id);
  weekly_count := public.business_weekly_booking_count(p_business_id);

  RETURN weekly_count < limits.max_bookings_per_week;
END;
$$;

-- ---------------------------------------------------------------------------
-- Owner selects a plan (mock payment when fee > 0)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_subscription_payment(
  p_business_id UUID,
  p_plan_id UUID,
  p_billing_interval public.billing_interval,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  plan RECORD;
  sub RECORD;
  amount NUMERIC(10, 2);
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  ref_code TEXT;
  payment_id UUID;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = actor
  ) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;

  SELECT * INTO plan
  FROM public.subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected plan is not available';
  END IF;

  IF p_billing_interval = 'monthly' THEN
    amount := plan.monthly_fee_etb;
    new_end := GREATEST(now(), COALESCE(
      (SELECT current_period_end FROM public.business_subscriptions WHERE business_id = p_business_id),
      now()
    )) + interval '1 month';
  ELSIF p_billing_interval = 'yearly' THEN
    amount := plan.yearly_fee_etb;
    new_end := GREATEST(now(), COALESCE(
      (SELECT current_period_end FROM public.business_subscriptions WHERE business_id = p_business_id),
      now()
    )) + interval '12 months';
  ELSE
    RAISE EXCEPTION 'Invalid billing interval';
  END IF;

  IF amount > 0 THEN
    IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
      RAISE EXCEPTION 'Payment method is required for paid plans';
    END IF;
  END IF;

  new_start := now();
  ref_code := 'SUB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.business_subscriptions (
    business_id,
    plan_id,
    status,
    billing_interval,
    current_period_start,
    current_period_end,
    grace_ends_at,
    cancelled_at,
    updated_at
  ) VALUES (
    p_business_id,
    p_plan_id,
    'active',
    p_billing_interval,
    new_start,
    new_end,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (business_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    billing_interval = EXCLUDED.billing_interval,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    grace_ends_at = NULL,
    cancelled_at = NULL,
    updated_at = now()
  RETURNING * INTO sub;

  INSERT INTO public.subscription_payments (
    business_id,
    plan_id,
    billing_interval,
    amount_etb,
    payment_method,
    reference_code,
    period_start,
    period_end,
    source
  ) VALUES (
    p_business_id,
    p_plan_id,
    p_billing_interval,
    amount,
    CASE WHEN amount > 0 THEN trim(p_payment_method) ELSE 'free' END,
    ref_code,
    new_start,
    new_end,
    'mock'
  )
  RETURNING id INTO payment_id;

  RETURN jsonb_build_object(
    'subscription', to_jsonb(sub),
    'plan', to_jsonb(plan),
    'payment_id', payment_id,
    'reference_code', ref_code,
    'amount_etb', amount
  );
END;
$$;

DROP FUNCTION IF EXISTS public.record_subscription_payment(UUID, public.billing_interval, TEXT);

-- ---------------------------------------------------------------------------
-- Subscription summary for owner / admin UI
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subscription_summary(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  settings RECORD;
  sub RECORD;
  current_plan RECORD;
  limits RECORD;
  active_services INTEGER;
  weekly_bookings INTEGER;
  is_live BOOLEAN;
  plans_json JSONB;
BEGIN
  IF actor IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = actor
  ) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;

  SELECT * INTO settings FROM public.platform_settings WHERE id = 1;
  SELECT * INTO sub FROM public.business_subscriptions WHERE business_id = p_business_id;

  IF sub.plan_id IS NOT NULL THEN
    SELECT * INTO current_plan FROM public.subscription_plans WHERE id = sub.plan_id;
  END IF;

  SELECT * INTO limits FROM public.business_subscription_limits(p_business_id);
  active_services := public.business_active_service_count(p_business_id);
  weekly_bookings := public.business_weekly_booking_count(p_business_id);
  is_live := public.business_is_marketplace_live(p_business_id);

  SELECT coalesce(jsonb_agg(to_jsonb(sp) ORDER BY sp.sort_order, sp.name), '[]'::jsonb)
  INTO plans_json
  FROM public.subscription_plans sp
  WHERE sp.is_active = true;

  RETURN jsonb_build_object(
    'subscription', to_jsonb(sub),
    'current_plan', to_jsonb(current_plan),
    'plans', plans_json,
    'platform', jsonb_build_object(
      'currency', COALESCE(settings.currency, 'ETB'),
      'grace_period_days', COALESCE(settings.grace_period_days, 3)
    ),
    'limits', jsonb_build_object(
      'max_services', limits.max_services,
      'max_bookings_per_week', limits.max_bookings_per_week
    ),
    'usage', jsonb_build_object(
      'active_services', active_services,
      'weekly_bookings', weekly_bookings
    ),
    'is_marketplace_live', is_live
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_subscription_payment(UUID, UUID, public.billing_interval, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_summary(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Service cap enforcement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_service_subscription_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limits RECORD;
  current_count INTEGER;
  activating BOOLEAN;
BEGIN
  activating := NEW.is_active = true
    AND (TG_OP = 'INSERT' OR COALESCE(OLD.is_active, false) = false);

  IF NOT activating THEN
    RETURN NEW;
  END IF;

  SELECT * INTO limits FROM public.business_subscription_limits(NEW.business_id);
  current_count := public.business_active_service_count(NEW.business_id);

  IF TG_OP = 'UPDATE' AND OLD.is_active = true THEN
    current_count := current_count - 1;
  END IF;

  IF current_count >= limits.max_services THEN
    RAISE EXCEPTION 'Service limit reached (% of % active services). Upgrade your subscription or deactivate a service.',
      current_count, limits.max_services;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_enforce_subscription_limit ON public.services;
CREATE TRIGGER services_enforce_subscription_limit
  BEFORE INSERT OR UPDATE OF is_active ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_service_subscription_limit();

-- ---------------------------------------------------------------------------
-- Booking insert: marketplace + weekly cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_booking_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc RECORD;
  dow INTEGER;
  slot_local TIMESTAMP;
  slot_time TIME;
  wh RECORD;
  slot_rec RECORD;
  booked_count INTEGER;
  actor UUID := auth.uid();
  block_mins INTEGER;
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
  IF actor IS NOT NULL AND NOT public.is_admin() THEN
    NEW.status := 'pending';
  END IF;

  SELECT
    id,
    business_id,
    duration_minutes,
    pricing_model,
    duration_model,
    price,
    price_min,
    price_max,
    scheduling_block_minutes
    INTO svc
    FROM public.services
   WHERE id = NEW.service_id
     AND business_id = NEW.business_id
     AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected service is not available for this business';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
     WHERE id = NEW.business_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'This business is not available for booking';
  END IF;

  IF NOT public.business_can_accept_booking(NEW.business_id) THEN
    RAISE EXCEPTION 'This business is not accepting bookings right now';
  END IF;

  IF NEW.employee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.employees e
       WHERE e.id = NEW.employee_id
         AND e.business_id = NEW.business_id
         AND e.is_active = true
    ) THEN
      RAISE EXCEPTION 'Selected staff member is not available for this business';
    END IF;
  END IF;

  NEW.duration_minutes := svc.duration_minutes;
  NEW.pricing_model := svc.pricing_model;
  NEW.duration_model := svc.duration_model;
  NEW.scheduling_block_minutes := COALESCE(svc.scheduling_block_minutes, svc.duration_minutes);
  block_mins := NEW.scheduling_block_minutes;

  NEW.listed_price := NULL;
  NEW.listed_price_min := NULL;
  NEW.listed_price_max := NULL;

  IF svc.pricing_model = 'fixed' OR svc.pricing_model = 'starting_from' THEN
    NEW.listed_price := svc.price;
  ELSIF svc.pricing_model = 'range' THEN
    NEW.listed_price_min := svc.price_min;
    NEW.listed_price_max := svc.price_max;
  ELSIF svc.pricing_model = 'variable' THEN
    NEW.listed_price_min := svc.price_min;
  END IF;

  IF NEW.scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot book a time in the past';
  END IF;

  slot_local := NEW.scheduled_at AT TIME ZONE tz;
  dow := EXTRACT(DOW FROM slot_local)::INTEGER;
  slot_time := slot_local::TIME;

  SELECT open_time, close_time, is_closed
    INTO wh
    FROM public.working_hours
   WHERE business_id = NEW.business_id AND day_of_week = dow;

  IF NOT FOUND OR wh.is_closed THEN
    RAISE EXCEPTION 'Business is closed on the selected day';
  END IF;

  IF slot_time < wh.open_time
     OR (slot_time + make_interval(mins => block_mins)) > wh.close_time THEN
    RAISE EXCEPTION 'Selected time is outside the business working hours';
  END IF;

  SELECT s.id, s.max_capacity
    INTO slot_rec
    FROM public.appointment_slots s
   WHERE s.business_id = NEW.business_id
     AND s.day_of_week = dow
     AND s.start_time = slot_time
     AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This time slot is not available for booking';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.business_id::text || '|' || NEW.scheduled_at::text)::bigint
  );

  SELECT count(*)
    INTO booked_count
    FROM public.bookings b
   WHERE b.business_id = NEW.business_id
     AND b.scheduled_at = NEW.scheduled_at
     AND b.status <> 'cancelled';

  IF booked_count >= slot_rec.max_capacity THEN
    RAISE EXCEPTION 'This time slot is fully booked';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill subscriptions for approved businesses (Free plan, active period)
-- ---------------------------------------------------------------------------
INSERT INTO public.business_subscriptions (
  business_id,
  plan_id,
  status,
  billing_interval,
  current_period_start,
  current_period_end,
  updated_at
)
SELECT
  b.id,
  sp.id,
  'active',
  'monthly',
  now(),
  now() + interval '1 month',
  now()
FROM public.businesses b
CROSS JOIN public.subscription_plans sp
WHERE b.status = 'approved'
  AND sp.slug = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_subscriptions bs WHERE bs.business_id = b.id
  );

UPDATE public.business_subscriptions bs
SET
  plan_id = COALESCE(bs.plan_id, sp.id),
  status = 'active',
  billing_interval = COALESCE(bs.billing_interval, 'monthly'),
  current_period_start = COALESCE(bs.current_period_start, now()),
  current_period_end = CASE
    WHEN bs.current_period_end IS NULL OR bs.current_period_end <= now()
      THEN now() + interval '1 month'
    ELSE bs.current_period_end
  END,
  grace_ends_at = NULL,
  updated_at = now()
FROM public.businesses b
CROSS JOIN public.subscription_plans sp
WHERE bs.business_id = b.id
  AND b.status = 'approved'
  AND sp.slug = 'free'
  AND (
    bs.plan_id IS NULL
    OR bs.status NOT IN ('active', 'past_due')
    OR bs.current_period_end IS NULL
    OR bs.current_period_end <= now()
  );

-- New businesses start on the Free plan automatically
CREATE OR REPLACE FUNCTION public.ensure_business_subscription_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  SELECT id INTO free_plan_id
  FROM public.subscription_plans
  WHERE slug = 'free' AND is_active = true
  LIMIT 1;

  INSERT INTO public.business_subscriptions (
    business_id,
    plan_id,
    status,
    billing_interval,
    current_period_start,
    current_period_end,
    grace_ends_at,
    cancelled_at,
    updated_at
  ) VALUES (
    NEW.id,
    free_plan_id,
    'active',
    'monthly',
    now(),
    now() + interval '1 month',
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (business_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_ensure_subscription ON public.businesses;
CREATE TRIGGER businesses_ensure_subscription
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.ensure_business_subscription_row();

-- ---------------------------------------------------------------------------
-- Featured search sync (Premium plan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_business_featured_search(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_feature BOOLEAN;
BEGIN
  SELECT
    COALESCE(sp.is_featured_in_search, false)
    AND public.business_is_marketplace_live(p_business_id)
  INTO should_feature
  FROM public.business_subscriptions bs
  LEFT JOIN public.subscription_plans sp ON sp.id = bs.plan_id
  WHERE bs.business_id = p_business_id;

  IF NOT FOUND THEN
    should_feature := false;
  END IF;

  UPDATE public.businesses
  SET featured_in_search = should_feature
  WHERE id = p_business_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_business_featured_search()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_business_featured_search(
    COALESCE(NEW.business_id, OLD.business_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS business_subscriptions_sync_featured ON public.business_subscriptions;
CREATE TRIGGER business_subscriptions_sync_featured
  AFTER INSERT OR UPDATE OF plan_id, status, current_period_end
  ON public.business_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_business_featured_search();

CREATE OR REPLACE FUNCTION public.trg_sync_plan_featured_search()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  biz RECORD;
BEGIN
  IF NEW.is_featured_in_search IS DISTINCT FROM OLD.is_featured_in_search THEN
    FOR biz IN
      SELECT business_id FROM public.business_subscriptions WHERE plan_id = NEW.id
    LOOP
      PERFORM public.sync_business_featured_search(biz.business_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_sync_featured ON public.subscription_plans;
CREATE TRIGGER subscription_plans_sync_featured
  AFTER UPDATE OF is_featured_in_search
  ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_plan_featured_search();

DO $$
DECLARE
  biz RECORD;
BEGIN
  FOR biz IN SELECT id FROM public.businesses
  LOOP
    PERFORM public.sync_business_featured_search(biz.id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS platform_settings_admin ON public.platform_settings;
CREATE POLICY platform_settings_admin ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS business_subscriptions_owner_read ON public.business_subscriptions;
CREATE POLICY business_subscriptions_owner_read ON public.business_subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS business_subscriptions_admin ON public.business_subscriptions;
CREATE POLICY business_subscriptions_admin ON public.business_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS subscription_payments_owner_read ON public.subscription_payments;
CREATE POLICY subscription_payments_owner_read ON public.subscription_payments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS subscription_payments_admin ON public.subscription_payments;
CREATE POLICY subscription_payments_admin ON public.subscription_payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Approved businesses are publicly readable" ON public.businesses;
DROP POLICY IF EXISTS businesses_select ON public.businesses;
CREATE POLICY businesses_select ON public.businesses
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR (
      status = 'approved'
      AND public.business_is_marketplace_live(id)
    )
  );

DROP POLICY IF EXISTS businesses_select_anon ON public.businesses;
CREATE POLICY businesses_select_anon ON public.businesses
  FOR SELECT TO anon
  USING (
    status = 'approved'
    AND public.business_is_marketplace_live(id)
  );

DROP POLICY IF EXISTS "Services follow business visibility" ON public.services;
CREATE POLICY "Services follow business visibility"
  ON public.services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
        AND (
          b.owner_id = auth.uid()
          OR public.is_admin()
          OR (
            b.status = 'approved'
            AND public.business_is_marketplace_live(b.id)
          )
        )
    )
  );

DROP POLICY IF EXISTS subscription_plans_read ON public.subscription_plans;
CREATE POLICY subscription_plans_read ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS subscription_plans_admin ON public.subscription_plans;
CREATE POLICY subscription_plans_admin ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
