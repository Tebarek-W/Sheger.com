-- Wipe user-generated data on a linked STAGING Supabase project.
-- KEEPS: schema, migrations history, categories, subscription_plans, platform_settings, storage buckets.
-- REMOVES: all auth users, businesses, bookings, payments, files, notifications, etc.
--
-- Run (staging only — verify project ref before executing):
--   supabase link --project-ref bukowczszrzgveilqnrr
--   npm run db:wipe-staging
--   npm run db:seed
--
-- After wipe: sign up again in the app, then promote admin in SQL Editor:
--   UPDATE public.profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');

BEGIN;

-- Storage: optional — CLI rm -r removes entire buckets (recreated at end of this script).
--   npm run db:wipe-staging:storage

TRUNCATE TABLE
  public.notification_deliveries,
  public.booking_reminder_deliveries,
  public.notifications,
  public.push_tokens,
  public.booking_financials,
  public.payment_transactions,
  public.transactions,
  public.reviews,
  public.bookings,
  public.appointment_slots,
  public.business_chapa_subaccounts,
  public.business_documents,
  public.business_promotions,
  public.promoted_listings,
  public.business_subscriptions,
  public.subscription_payments,
  public.working_hours,
  public.employees,
  public.services,
  public.businesses
RESTART IDENTITY;

-- Profiles cascade from auth.users
DELETE FROM auth.users;

-- Recreate storage buckets if cleared via CLI (rm -r deletes the bucket, not only objects)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'business-images',
    'business-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'business-licenses',
    'business-licenses',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
