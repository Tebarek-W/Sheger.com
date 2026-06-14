-- Public bucket for business profile / cover photos shown on the platform.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-images',
  'business-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.storage_business_image_owner_check(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_uuid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  business_uuid := split_part(object_name, '/', 1)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = business_uuid
      AND b.owner_id = auth.uid()
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_business_image_owner_check(text) TO authenticated;

DROP POLICY IF EXISTS "Public read business images" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload business images" ON storage.objects;
DROP POLICY IF EXISTS "Owners update business images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete business images" ON storage.objects;

CREATE POLICY "Public read business images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-images');

CREATE POLICY "Owners upload business images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-images'
    AND public.storage_business_image_owner_check(name)
  );

CREATE POLICY "Owners update business images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-images'
    AND public.storage_business_image_owner_check(name)
  )
  WITH CHECK (
    bucket_id = 'business-images'
    AND public.storage_business_image_owner_check(name)
  );

CREATE POLICY "Owners delete business images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-images'
    AND public.storage_business_image_owner_check(name)
  );
