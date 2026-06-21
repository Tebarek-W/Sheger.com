-- Flexible service pricing and duration models.

DO $$ BEGIN
  CREATE TYPE public.service_pricing_model AS ENUM (
    'fixed',
    'starting_from',
    'range',
    'variable'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_duration_model AS ENUM (
    'fixed',
    'estimated',
    'flexible'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS pricing_model public.service_pricing_model NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS duration_model public.service_duration_model NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS price_min NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_max NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS scheduling_block_minutes INTEGER;

ALTER TABLE public.services
  ALTER COLUMN price DROP NOT NULL;

UPDATE public.services
SET scheduling_block_minutes = duration_minutes
WHERE scheduling_block_minutes IS NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pricing_model public.service_pricing_model NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS duration_model public.service_duration_model NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS listed_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS listed_price_min NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS listed_price_max NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS scheduling_block_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;

UPDATE public.bookings b
SET
  scheduling_block_minutes = b.duration_minutes,
  listed_price = s.price
FROM public.services s
WHERE s.id = b.service_id
  AND b.listed_price IS NULL;

-- ---------------------------------------------------------------------------
-- Service pricing/duration validation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_service_pricing_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.scheduling_block_minutes := COALESCE(
    NEW.scheduling_block_minutes,
    NEW.duration_minutes
  );

  IF NEW.pricing_model = 'fixed' THEN
    IF NEW.price IS NULL OR NEW.price < 0 THEN
      RAISE EXCEPTION 'Fixed-price services require a price >= 0';
    END IF;
    NEW.price_min := NULL;
    NEW.price_max := NULL;
  ELSIF NEW.pricing_model = 'starting_from' THEN
    IF NEW.price IS NULL OR NEW.price < 0 THEN
      RAISE EXCEPTION 'Starting-from services require a minimum price >= 0';
    END IF;
    NEW.price_min := NULL;
    NEW.price_max := NULL;
  ELSIF NEW.pricing_model = 'range' THEN
    IF NEW.price_min IS NULL OR NEW.price_max IS NULL OR NEW.price_min < 0 OR NEW.price_max < NEW.price_min THEN
      RAISE EXCEPTION 'Range pricing requires price_min and price_max with price_min <= price_max';
    END IF;
    NEW.price := NULL;
  ELSIF NEW.pricing_model = 'variable' THEN
    NEW.price := NULL;
    NEW.price_max := NULL;
    IF NEW.price_min IS NOT NULL AND NEW.price_min < 0 THEN
      RAISE EXCEPTION 'Guide price must be >= 0';
    END IF;
  END IF;

  IF NEW.duration_model = 'fixed' THEN
    IF NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0 THEN
      RAISE EXCEPTION 'Fixed-duration services require duration_minutes > 0';
    END IF;
    NEW.scheduling_block_minutes := NEW.duration_minutes;
  ELSIF NEW.duration_model = 'estimated' THEN
    IF NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0 THEN
      RAISE EXCEPTION 'Estimated-duration services require a typical duration_minutes > 0';
    END IF;
    IF NEW.scheduling_block_minutes IS NULL OR NEW.scheduling_block_minutes <= 0 THEN
      RAISE EXCEPTION 'Estimated-duration services require scheduling_block_minutes > 0';
    END IF;
  ELSIF NEW.duration_model = 'flexible' THEN
    IF NEW.scheduling_block_minutes IS NULL OR NEW.scheduling_block_minutes <= 0 THEN
      RAISE EXCEPTION 'Flexible-duration services require scheduling_block_minutes > 0';
    END IF;
    NEW.duration_minutes := NEW.scheduling_block_minutes;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_validate_pricing_duration ON public.services;
CREATE TRIGGER services_validate_pricing_duration
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.validate_service_pricing_duration();

-- ---------------------------------------------------------------------------
-- Booking insert: snapshot pricing and use scheduling block for closing time
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
-- Booking update: allow final_price / actual_duration on owner completion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  is_owner BOOLEAN;
  admin_actor BOOLEAN;
  cancel_hours INTEGER;
  completing BOOLEAN;
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  admin_actor := public.is_admin();

  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = actor
  ) INTO is_owner;

  completing := is_owner
    AND NEW.status = 'completed'
    AND OLD.status = 'confirmed';

  IF NOT admin_actor THEN
    IF NEW.customer_id    IS DISTINCT FROM OLD.customer_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.service_id  IS DISTINCT FROM OLD.service_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.scheduling_block_minutes IS DISTINCT FROM OLD.scheduling_block_minutes
       OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
       OR NEW.duration_model IS DISTINCT FROM OLD.duration_model
       OR NEW.listed_price IS DISTINCT FROM OLD.listed_price
       OR NEW.listed_price_min IS DISTINCT FROM OLD.listed_price_min
       OR NEW.listed_price_max IS DISTINCT FROM OLD.listed_price_max THEN
      RAISE EXCEPTION 'Booking details cannot be modified after creation';
    END IF;

    IF NEW.final_price IS DISTINCT FROM OLD.final_price
       OR NEW.actual_duration_minutes IS DISTINCT FROM OLD.actual_duration_minutes THEN
      IF NOT completing THEN
        RAISE EXCEPTION 'Final price and actual duration can only be set when completing a booking';
      END IF;
      IF NEW.final_price IS NOT NULL AND NEW.final_price < 0 THEN
        RAISE EXCEPTION 'Final price must be >= 0';
      END IF;
      IF NEW.actual_duration_minutes IS NOT NULL AND NEW.actual_duration_minutes <= 0 THEN
        RAISE EXCEPTION 'Actual duration must be > 0';
      END IF;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF admin_actor THEN
      NULL;
    ELSIF is_owner THEN
      IF OLD.status IN ('cancelled', 'completed') THEN
        RAISE EXCEPTION 'Cannot change a % booking', OLD.status;
      END IF;
      IF NEW.status NOT IN ('confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid booking status transition';
      END IF;
    ELSIF actor = OLD.customer_id THEN
      IF NEW.status <> 'cancelled' OR OLD.status <> 'pending' THEN
        RAISE EXCEPTION 'Customers can only cancel pending bookings';
      END IF;

      SELECT COALESCE(b.cancellation_hours, 2)
        INTO cancel_hours
        FROM public.businesses b
       WHERE b.id = NEW.business_id;

      IF NEW.scheduled_at <= now() + make_interval(hours => cancel_hours) THEN
        RAISE EXCEPTION
          'Cancellations must be made at least % hours before the appointment',
          cancel_hours;
      END IF;
    ELSE
      RAISE EXCEPTION 'Not authorized to modify this booking';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
