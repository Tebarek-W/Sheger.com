-- Business license documents for registration and admin verification.
-- All businesses require trade_license; clinics and dentists also require health_facility_license.

DO $$ BEGIN
  CREATE TYPE public.business_document_type AS ENUM (
    'trade_license',
    'health_facility_license'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.business_document_status AS ENUM (
    'pending_review',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.business_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  document_type public.business_document_type NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  status public.business_document_status NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, document_type)
);

CREATE INDEX IF NOT EXISTS business_documents_business_idx
  ON public.business_documents (business_id);

CREATE INDEX IF NOT EXISTS business_documents_status_idx
  ON public.business_documents (status);

-- ---------------------------------------------------------------------------
-- Private storage bucket for license documents (PDF + images, max 10 MB)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
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

CREATE OR REPLACE FUNCTION public.storage_business_owner_check(object_name text)
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

GRANT EXECUTE ON FUNCTION public.storage_business_owner_check(text) TO authenticated;

DROP POLICY IF EXISTS "Owners and admins read business licenses" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload business licenses" ON storage.objects;
DROP POLICY IF EXISTS "Owners update business licenses" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete business licenses" ON storage.objects;

CREATE POLICY "Owners and admins read business licenses"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'business-licenses'
    AND (
      public.storage_business_owner_check(name)
      OR public.is_admin()
    )
  );

CREATE POLICY "Owners upload business licenses"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-licenses'
    AND public.storage_business_owner_check(name)
  );

CREATE POLICY "Owners update business licenses"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-licenses'
    AND public.storage_business_owner_check(name)
  )
  WITH CHECK (
    bucket_id = 'business-licenses'
    AND public.storage_business_owner_check(name)
  );

CREATE POLICY "Owners delete business licenses"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-licenses'
    AND public.storage_business_owner_check(name)
  );

-- ---------------------------------------------------------------------------
-- Required document types per category slug
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_requires_health_facility_license(p_business_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    JOIN public.categories c ON c.id = b.category_id
    WHERE b.id = p_business_id
      AND c.slug IN ('clinics', 'dentists')
  );
$$;

GRANT EXECUTE ON FUNCTION public.business_requires_health_facility_license(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_required_document_types(p_business_id UUID)
RETURNS public.business_document_type[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.business_requires_health_facility_license(p_business_id) THEN
    RETURN ARRAY['trade_license', 'health_facility_license']::public.business_document_type[];
  END IF;
  RETURN ARRAY['trade_license']::public.business_document_type[];
END;
$$;

GRANT EXECUTE ON FUNCTION public.business_required_document_types(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Block business approval until all required documents are uploaded and approved
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_business_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.business_document_type;
  doc RECORD;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    FOREACH req IN ARRAY public.business_required_document_types(NEW.id)
    LOOP
      SELECT d.status INTO doc
      FROM public.business_documents d
      WHERE d.business_id = NEW.id
        AND d.document_type = req;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot approve business: missing required document (%)', req;
      END IF;

      IF doc.status IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'Cannot approve business: document % is not approved', req;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_enforce_approval ON public.businesses;
CREATE TRIGGER businesses_enforce_approval
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_approval();

-- ---------------------------------------------------------------------------
-- RLS on business_documents
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins read business documents" ON public.business_documents;
DROP POLICY IF EXISTS "Owners insert business documents while pending" ON public.business_documents;
DROP POLICY IF EXISTS "Owners update business documents while pending" ON public.business_documents;

CREATE POLICY "Owners and admins read business documents"
  ON public.business_documents FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners insert business documents while pending"
  ON public.business_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
        AND b.owner_id = auth.uid()
        AND b.status = 'pending'
    )
  );

CREATE POLICY "Owners update business documents while pending"
  ON public.business_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
        AND b.owner_id = auth.uid()
        AND b.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
        AND b.owner_id = auth.uid()
        AND b.status = 'pending'
    )
  );
