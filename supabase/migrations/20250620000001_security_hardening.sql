-- Security & integrity hardening.
-- Addresses: owner self-approval, customer-set booking status, slot overbooking
-- race, service end-time validation, employee validation, category visibility,
-- function permissions, cascade data-loss, and value bounds.
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. Businesses: owners cannot approve themselves or change ownership.
--    Owner inserts are forced to 'pending'; status/owner_id are admin-only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_business_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
BEGIN
  -- Service role (admin panel) and admins bypass.
  IF actor IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only an administrator can change business approval status';
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Business ownership cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_enforce_write ON public.businesses;
CREATE TRIGGER businesses_enforce_write
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_write();

-- ---------------------------------------------------------------------------
-- 2. Booking insert hardening:
--    - force status = 'pending' for non-admin callers
--    - validate employee belongs to the business and is active
--    - require the full service duration to fit before closing time
--    - advisory lock to prevent concurrent slot overbooking (TOCTOU)
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
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
  -- Customers/owners may only create pending bookings; admin/service role exempt.
  IF actor IS NOT NULL AND NOT public.is_admin() THEN
    NEW.status := 'pending';
  END IF;

  SELECT id, business_id, duration_minutes
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

  -- Trust the service's duration, not the client.
  NEW.duration_minutes := svc.duration_minutes;

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
     OR (slot_time + make_interval(mins => NEW.duration_minutes)) > wh.close_time THEN
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

  -- Serialize concurrent inserts for the same business/instant so two requests
  -- cannot both pass the capacity check (lock auto-releases at transaction end).
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
-- 3. Booking update: keep pending-only customer cancellation (migration 8)
--    and make employee_id immutable for non-admins.
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
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  admin_actor := public.is_admin();

  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = actor
  ) INTO is_owner;

  IF NOT admin_actor THEN
    IF NEW.customer_id    IS DISTINCT FROM OLD.customer_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.service_id  IS DISTINCT FROM OLD.service_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
      RAISE EXCEPTION 'Booking details cannot be modified after creation';
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

-- ---------------------------------------------------------------------------
-- 4. Categories: hide inactive categories at the RLS layer (admins see all).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories are publicly readable" ON public.categories;
CREATE POLICY "Categories are publicly readable"
  ON public.categories FOR SELECT
  USING (is_active = true OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Lock down seed_default_working_hours so only the trigger / service role
--    can run it (it is SECURITY DEFINER and bypasses RLS).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.seed_default_working_hours(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 6. Prevent accidental cascade wipe of an owner's entire business graph.
--    Deleting a profile that still owns businesses now fails loudly.
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_id_fkey;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles (id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 7. Value bounds (NOT VALID: enforced for new/updated rows, existing rows
--    are not retro-validated so the migration cannot fail on legacy data).
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_cancellation_hours_bounds;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_cancellation_hours_bounds
  CHECK (cancellation_hours >= 0 AND cancellation_hours <= 168) NOT VALID;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_latitude_range;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) NOT VALID;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_longitude_range;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)) NOT VALID;

ALTER TABLE public.working_hours DROP CONSTRAINT IF EXISTS working_hours_valid_range;
ALTER TABLE public.working_hours
  ADD CONSTRAINT working_hours_valid_range
  CHECK (is_closed OR close_time > open_time) NOT VALID;

-- ---------------------------------------------------------------------------
-- 8. Hot-path index for capacity counts and owner dashboards.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS bookings_business_slot_active_idx
  ON public.bookings (business_id, scheduled_at)
  WHERE status <> 'cancelled';
