-- Allow admins to hide categories from the mobile app without deleting them.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS categories_is_active_idx ON public.categories (is_active);
