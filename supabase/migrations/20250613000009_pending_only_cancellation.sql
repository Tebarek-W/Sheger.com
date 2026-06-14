-- Customers may cancel only pending bookings (not confirmed ones).

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
