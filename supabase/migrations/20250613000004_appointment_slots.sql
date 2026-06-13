-- Owner-defined appointment slots with per-slot capacity.
-- Replaces implicit auto-generated slots with explicit business-controlled availability.

CREATE TABLE public.appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 1 CHECK (max_capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, day_of_week, start_time)
);

CREATE INDEX appointment_slots_business_day_idx
  ON public.appointment_slots (business_id, day_of_week);

ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appointment slots follow business visibility"
  ON public.appointment_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
        AND (b.status = 'approved' OR b.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Owners manage appointment slots"
  ON public.appointment_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND (b.owner_id = auth.uid() OR public.is_admin())
    )
  );

-- Slots must fall within configured working hours for that weekday.
CREATE OR REPLACE FUNCTION public.validate_appointment_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wh RECORD;
BEGIN
  SELECT open_time, close_time, is_closed
    INTO wh
    FROM public.working_hours
   WHERE business_id = NEW.business_id
     AND day_of_week = NEW.day_of_week;

  IF NOT FOUND OR wh.is_closed THEN
    RAISE EXCEPTION 'Configure working hours for this day before adding slots';
  END IF;

  IF NEW.start_time < wh.open_time OR NEW.start_time >= wh.close_time THEN
    RAISE EXCEPTION 'Slot must start within working hours (%) - (%)',
      to_char(wh.open_time, 'HH24:MI'),
      to_char(wh.close_time, 'HH24:MI');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointment_slots_validate ON public.appointment_slots;
CREATE TRIGGER appointment_slots_validate
  BEFORE INSERT OR UPDATE ON public.appointment_slots
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_slot();

-- Allow multiple bookings at the same instant up to slot capacity.
DROP INDEX IF EXISTS public.bookings_business_slot_unique;

-- Booking insert: require a configured slot and enforce capacity (not overlap).
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
  tz CONSTANT TEXT := 'Africa/Addis_Ababa';
BEGIN
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

  IF slot_time < wh.open_time OR slot_time >= wh.close_time THEN
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

DROP TRIGGER IF EXISTS bookings_validate_insert ON public.bookings;
CREATE TRIGGER bookings_validate_insert
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_insert();
