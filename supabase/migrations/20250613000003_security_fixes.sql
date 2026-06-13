-- Sheger security & flow fixes
-- Closes privilege-escalation holes and enforces booking integrity server-side.
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. Signup role lockdown
--    handle_new_user() previously trusted raw_user_meta_data->>'role', which a
--    client using the public anon key could set to 'admin'. Only allow
--    'customer' or 'business_owner'; everything else (incl. 'admin') -> customer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, ''),
    CASE NEW.raw_user_meta_data ->> 'role'
      WHEN 'business_owner' THEN 'business_owner'::public.user_role
      ELSE 'customer'::public.user_role
    END
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Prevent self role escalation via profile update
--    The "Users can update own profile" RLS policy allows updating any column
--    of one's own row, including `role`. Block role changes unless the actor is
--    an admin (or the service role, which has no auth.uid()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'You are not allowed to change account role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();

-- ---------------------------------------------------------------------------
-- 3. Booking update state machine
--    Row-level RLS cannot restrict which columns / transitions are allowed.
--    Enforce: customers may only cancel their own upcoming bookings; owners may
--    confirm/complete/cancel their business's non-terminal bookings; admins and
--    the service role are unrestricted. Core booking fields are immutable.
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
BEGIN
  -- Service role (admin panel) has no JWT context -> allow.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  admin_actor := public.is_admin();

  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = actor
  ) INTO is_owner;

  -- Core fields are immutable for everyone except admins.
  IF NOT admin_actor THEN
    IF NEW.customer_id    IS DISTINCT FROM OLD.customer_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.service_id  IS DISTINCT FROM OLD.service_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
      RAISE EXCEPTION 'Booking details cannot be modified after creation';
    END IF;
  END IF;

  -- Status transition rules.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF admin_actor THEN
      NULL; -- admins unrestricted
    ELSIF is_owner THEN
      IF OLD.status IN ('cancelled', 'completed') THEN
        RAISE EXCEPTION 'Cannot change a % booking', OLD.status;
      END IF;
      IF NEW.status NOT IN ('confirmed', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid booking status transition';
      END IF;
    ELSIF actor = OLD.customer_id THEN
      IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Customers can only cancel upcoming bookings';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not authorized to modify this booking';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_enforce_update ON public.bookings;
CREATE TRIGGER bookings_enforce_update
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_update();

-- ---------------------------------------------------------------------------
-- 4. Booking insert validation
--    Client-side slot logic is advisory only. Enforce, server-side:
--    service belongs to an approved business, time is in the future and within
--    working hours, duration comes from the service, and no overlap exists.
--    Times are evaluated in the business local timezone.
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
  overlap_count INTEGER;
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
  -- Service must belong to the target business and be active.
  SELECT id, business_id, duration_minutes
    INTO svc
    FROM public.services
   WHERE id = NEW.service_id
     AND business_id = NEW.business_id
     AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected service is not available for this business';
  END IF;

  -- Business must be approved.
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
     WHERE id = NEW.business_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'This business is not available for booking';
  END IF;

  -- Trust the service's duration, not the client.
  NEW.duration_minutes := svc.duration_minutes;

  -- Must be in the future.
  IF NEW.scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot book a time in the past';
  END IF;

  -- Within working hours for that weekday (business local time).
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

  -- No overlap with existing (non-cancelled) bookings for the business.
  SELECT count(*)
    INTO overlap_count
    FROM public.bookings b
   WHERE b.business_id = NEW.business_id
     AND b.status <> 'cancelled'
     AND tstzrange(
           b.scheduled_at,
           b.scheduled_at + make_interval(mins => b.duration_minutes),
           '[)'
         ) && tstzrange(
           NEW.scheduled_at,
           NEW.scheduled_at + make_interval(mins => NEW.duration_minutes),
           '[)'
         );
  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'This time slot is no longer available';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_validate_insert ON public.bookings;
CREATE TRIGGER bookings_validate_insert
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_insert();
