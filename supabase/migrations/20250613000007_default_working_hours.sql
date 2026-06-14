-- System default working hours: 2 ጠዋት–4 ማታ (08:00–22:00 GC), Mon–Sat open, Sunday closed.

CREATE OR REPLACE FUNCTION public.seed_default_working_hours(p_business_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.working_hours (business_id, day_of_week, open_time, close_time, is_closed)
  VALUES
    (p_business_id, 0, '08:00', '22:00', true),
    (p_business_id, 1, '08:00', '22:00', false),
    (p_business_id, 2, '08:00', '22:00', false),
    (p_business_id, 3, '08:00', '22:00', false),
    (p_business_id, 4, '08:00', '22:00', false),
    (p_business_id, 5, '08:00', '22:00', false),
    (p_business_id, 6, '08:00', '22:00', false)
  ON CONFLICT (business_id, day_of_week) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_business_seed_working_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_working_hours(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_seed_working_hours ON public.businesses;

CREATE TRIGGER business_seed_working_hours
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_business_seed_working_hours();

-- Backfill businesses that are missing any day row (does not overwrite owner customizations).
INSERT INTO public.working_hours (business_id, day_of_week, open_time, close_time, is_closed)
SELECT b.id, d.day, '08:00'::time, '22:00'::time, d.day = 0
FROM public.businesses b
CROSS JOIN generate_series(0, 6) AS d(day)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.working_hours wh
  WHERE wh.business_id = b.id AND wh.day_of_week = d.day
);
