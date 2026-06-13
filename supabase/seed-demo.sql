-- Demo data for MVP testing
-- Run in Supabase SQL Editor (service role) AFTER:
--   1. 20250611000001_initial_schema.sql (migrations)
--   2. seed.sql (categories)
--   3. At least one user signed up in the app (creates a profile row)

DO $$
DECLARE
  barber_cat UUID;
  salon_cat UUID;
  owner_id UUID;
  inserted_count INTEGER := 0;
BEGIN
  SELECT id INTO barber_cat FROM public.categories WHERE slug = 'barbershops' LIMIT 1;
  SELECT id INTO salon_cat FROM public.categories WHERE slug = 'hair-salons' LIMIT 1;

  IF barber_cat IS NULL OR salon_cat IS NULL THEN
    RAISE EXCEPTION 'Categories missing. Run supabase/seed.sql first.';
  END IF;

  -- Prefer business_owner/admin, but fall back to any profile so demo data still loads.
  SELECT p.id INTO owner_id
  FROM public.profiles p
  ORDER BY
    CASE p.role
      WHEN 'business_owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    p.created_at
  LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'No profiles found. Sign up at least one user in the mobile app, then re-run this script.';
  END IF;

  -- Upsert Bole Premium Barbers (fixes partial runs / missing coordinates)
  IF EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Bole Premium Barbers') THEN
    UPDATE public.businesses
    SET
      category_id = barber_cat,
      description = 'Professional cuts and grooming in the heart of Bole.',
      address = 'Bole Road, near Edna Mall',
      city = 'Addis Ababa',
      latitude = 8.99380,
      longitude = 38.78690,
      phone = '+251911000001',
      status = 'approved'
    WHERE name = 'Bole Premium Barbers';
  ELSE
    INSERT INTO public.businesses (
      owner_id, category_id, name, description, address, city,
      latitude, longitude, phone, status
    ) VALUES (
      owner_id,
      barber_cat,
      'Bole Premium Barbers',
      'Professional cuts and grooming in the heart of Bole.',
      'Bole Road, near Edna Mall',
      'Addis Ababa',
      8.99380,
      38.78690,
      '+251911000001',
      'approved'
    );
    inserted_count := inserted_count + 1;
  END IF;

  -- Upsert Sheger Beauty Studio
  IF EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Sheger Beauty Studio') THEN
    UPDATE public.businesses
    SET
      category_id = salon_cat,
      description = 'Hair styling, treatments, and nail care.',
      address = 'Kazanchis, Churchill Ave',
      city = 'Addis Ababa',
      latitude = 9.01540,
      longitude = 38.76130,
      phone = '+251911000002',
      status = 'approved'
    WHERE name = 'Sheger Beauty Studio';
  ELSE
    INSERT INTO public.businesses (
      owner_id, category_id, name, description, address, city,
      latitude, longitude, phone, status
    ) VALUES (
      owner_id,
      salon_cat,
      'Sheger Beauty Studio',
      'Hair styling, treatments, and nail care.',
      'Kazanchis, Churchill Ave',
      'Addis Ababa',
      9.01540,
      38.76130,
      '+251911000002',
      'approved'
    );
    inserted_count := inserted_count + 1;
  END IF;

  RAISE NOTICE 'Demo businesses ready (owner_id: %, new inserts: %)', owner_id, inserted_count;
END $$;

-- Services for demo businesses
INSERT INTO public.services (business_id, name, description, price, duration_minutes)
SELECT b.id, 'Classic Haircut', 'Wash, cut, and style', 250.00, 30
FROM public.businesses b WHERE b.name = 'Bole Premium Barbers'
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.business_id = b.id AND s.name = 'Classic Haircut');

INSERT INTO public.services (business_id, name, description, price, duration_minutes)
SELECT b.id, 'Beard Trim', 'Shape and trim', 150.00, 20
FROM public.businesses b WHERE b.name = 'Bole Premium Barbers'
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.business_id = b.id AND s.name = 'Beard Trim');

INSERT INTO public.services (business_id, name, description, price, duration_minutes)
SELECT b.id, 'Hair Styling', 'Full styling session', 400.00, 45
FROM public.businesses b WHERE b.name = 'Sheger Beauty Studio'
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.business_id = b.id AND s.name = 'Hair Styling');

-- Working hours Mon-Sat 9-18
INSERT INTO public.working_hours (business_id, day_of_week, open_time, close_time, is_closed)
SELECT b.id, d.day, '09:00', '18:00', false
FROM public.businesses b
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS d(day)
WHERE b.name IN ('Bole Premium Barbers', 'Sheger Beauty Studio')
ON CONFLICT (business_id, day_of_week) DO NOTHING;

INSERT INTO public.working_hours (business_id, day_of_week, open_time, close_time, is_closed)
SELECT b.id, 0, '09:00', '18:00', true
FROM public.businesses b
WHERE b.name IN ('Bole Premium Barbers', 'Sheger Beauty Studio')
ON CONFLICT (business_id, day_of_week) DO NOTHING;

-- Demo staff
INSERT INTO public.employees (business_id, full_name, role, is_active)
SELECT b.id, 'Daniel Tadesse', 'Senior Barber', true
FROM public.businesses b WHERE b.name = 'Bole Premium Barbers'
AND NOT EXISTS (
  SELECT 1 FROM public.employees e WHERE e.business_id = b.id AND e.full_name = 'Daniel Tadesse'
);

INSERT INTO public.employees (business_id, full_name, role, is_active)
SELECT b.id, 'Meron Assefa', 'Hair Stylist', true
FROM public.businesses b WHERE b.name = 'Sheger Beauty Studio'
AND NOT EXISTS (
  SELECT 1 FROM public.employees e WHERE e.business_id = b.id AND e.full_name = 'Meron Assefa'
);

-- Demo appointment slots (Mon–Sat, within 09:00–18:00 working hours)
INSERT INTO public.appointment_slots (business_id, day_of_week, start_time, max_capacity)
SELECT b.id, d.day, t.slot_time::time, t.capacity
FROM public.businesses b
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS d(day)
CROSS JOIN (
  VALUES
    ('09:00', 3),
    ('10:00', 2),
    ('11:00', 2),
    ('14:00', 2),
    ('15:00', 2),
    ('16:00', 1)
) AS t(slot_time, capacity)
WHERE b.name = 'Bole Premium Barbers'
AND NOT EXISTS (
  SELECT 1 FROM public.appointment_slots s
  WHERE s.business_id = b.id AND s.day_of_week = d.day AND s.start_time = t.slot_time::time
);

INSERT INTO public.appointment_slots (business_id, day_of_week, start_time, max_capacity)
SELECT b.id, d.day, t.slot_time::time, t.capacity
FROM public.businesses b
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS d(day)
CROSS JOIN (
  VALUES
    ('09:00', 1),
    ('10:30', 2),
    ('12:00', 1),
    ('14:00', 2),
    ('16:00', 1)
) AS t(slot_time, capacity)
WHERE b.name = 'Sheger Beauty Studio'
AND NOT EXISTS (
  SELECT 1 FROM public.appointment_slots s
  WHERE s.business_id = b.id AND s.day_of_week = d.day AND s.start_time = t.slot_time::time
);

-- Verify (should return 2 rows):
-- SELECT name, status, latitude, longitude FROM public.businesses
-- WHERE name IN ('Bole Premium Barbers', 'Sheger Beauty Studio');
