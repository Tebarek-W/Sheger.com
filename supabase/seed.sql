-- Seed service categories (run after initial_schema migration)

INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Barbershops', 'barbershops', 'scissors', 1),
  ('Hair Salons', 'hair-salons', 'comb', 2),
  ('Nail Services', 'nail-services', 'nail', 3),
  ('Makeup Artists', 'makeup-artists', 'brush', 4),
  ('Dentists', 'dentists', 'tooth', 5),
  ('Clinics', 'clinics', 'stethoscope', 6),
  ('Massage & Spa', 'massage-spa', 'spa', 7),
  ('Photographers', 'photographers', 'camera', 8),
  ('Wedding Planners', 'wedding-planners', 'rings', 9),
  ('Gyms & Trainers', 'gyms-trainers', 'dumbbell', 10)
ON CONFLICT (slug) DO NOTHING;
