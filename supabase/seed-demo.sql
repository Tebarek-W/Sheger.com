-- Demo data for MVP testing (run after seed.sql on staging/dev)
-- Requires at least one auth user to exist as business owner, OR use service role in SQL editor.

-- Example: after creating a test user in Auth, replace OWNER_UUID below.
-- For quick demo via SQL editor with service role, insert a profile-linked business:

DO $$
DECLARE
  barber_cat UUID;
  salon_cat UUID;
BEGIN
  SELECT id INTO barber_cat FROM public.categories WHERE slug = 'barbershops' LIMIT 1;
  SELECT id INTO salon_cat FROM public.categories WHERE slug = 'hair-salons' LIMIT 1;

  -- Skip if demo businesses already exist
  IF EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Bole Premium Barbers') THEN
    RETURN;
  END IF;

  -- Demo businesses need an owner profile. Create a placeholder only if profiles table allows.
  -- In practice: sign up a business_owner user, then run:
  -- UPDATE public.profiles SET role = 'business_owner' WHERE id = 'YOUR_USER_ID';

  INSERT INTO public.businesses (id, owner_id, category_id, name, description, address, city, phone, status)
  SELECT
    gen_random_uuid(),
    p.id,
    barber_cat,
    'Bole Premium Barbers',
    'Professional cuts and grooming in the heart of Bole.',
    'Bole Road, near Edna Mall',
    'Addis Ababa',
    '+251911000001',
    'approved'
  FROM public.profiles p
  WHERE p.role IN ('business_owner', 'admin')
  LIMIT 1;

  INSERT INTO public.businesses (id, owner_id, category_id, name, description, address, city, phone, status)
  SELECT
    gen_random_uuid(),
    p.id,
    salon_cat,
    'Sheger Beauty Studio',
    'Hair styling, treatments, and nail care.',
    'Kazanchis, Churchill Ave',
    'Addis Ababa',
    '+251911000002',
    'approved'
  FROM public.profiles p
  WHERE p.role IN ('business_owner', 'admin')
  LIMIT 1;
END $$;

-- Services for demo businesses
INSERT INTO public.services (business_id, name, description, price, duration_minutes)
SELECT b.id, 'Classic Haircut', 'Wash, cut, and style', 250.00, 30
FROM public.businesses b WHERE b.name = 'Bole Premium Barbers'
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.business_id = b.id);

INSERT INTO public.services (business_id, name, description, price, duration_minutes)
SELECT b.id, 'Beard Trim', 'Shape and trim', 150.00, 20
FROM public.businesses b WHERE b.name = 'Bole Premium Barbers'
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.business_id = b.id AND s.name = 'Beard Trim');

INSERT INTO public.services (business_id, name, description, price, duration_minutes)
SELECT b.id, 'Hair Styling', 'Full styling session', 400.00, 45
FROM public.businesses b WHERE b.name = 'Sheger Beauty Studio'
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.business_id = b.id);

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
