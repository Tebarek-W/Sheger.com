-- Normalize and validate stored contact fields.
-- Phone accepts Ethiopian mobile numbers only:
--   09xxxxxxxx, 07xxxxxxxx, +2519xxxxxxxx, +2517xxxxxxxx
-- Optional fields may be null/blank; invalid existing optional data is nulled.

CREATE OR REPLACE FUNCTION public.normalize_ethiopian_mobile(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
  local_phone TEXT;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RETURN NULL;
  END IF;

  digits := regexp_replace(p_phone, '\D', '', 'g');

  IF length(digits) = 12 AND digits LIKE '251%' THEN
    local_phone := '0' || substr(digits, 4);
    IF local_phone ~ '^0[79][0-9]{8}$' THEN
      RETURN local_phone;
    END IF;
  ELSIF length(digits) = 10 AND digits ~ '^0[79][0-9]{8}$' THEN
    RETURN digits;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_contact_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  normalized := lower(btrim(p_email));
  IF normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN normalized;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_profile_and_business_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
      NEW.phone := NULL;
    ELSE
      NEW.phone := public.normalize_ethiopian_mobile(NEW.phone);
      IF NEW.phone IS NULL THEN
        RAISE EXCEPTION 'Phone must be a valid Ethiopian mobile number';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'businesses' THEN
    IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
      NEW.phone := NULL;
    ELSE
      NEW.phone := public.normalize_ethiopian_mobile(NEW.phone);
      IF NEW.phone IS NULL THEN
        RAISE EXCEPTION 'Phone must be a valid Ethiopian mobile number';
      END IF;
    END IF;

    IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
      NEW.email := NULL;
    ELSE
      NEW.email := public.normalize_contact_email(NEW.email);
      IF NEW.email IS NULL THEN
        RAISE EXCEPTION 'Email must be a valid email address';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.profiles
SET phone = public.normalize_ethiopian_mobile(phone)
WHERE phone IS NOT NULL;

UPDATE public.businesses
SET
  phone = public.normalize_ethiopian_mobile(phone),
  email = public.normalize_contact_email(email)
WHERE phone IS NOT NULL OR email IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_valid;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_phone_valid;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_email_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_valid
  CHECK (phone IS NULL OR phone = public.normalize_ethiopian_mobile(phone));

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_phone_valid
  CHECK (phone IS NULL OR phone = public.normalize_ethiopian_mobile(phone));

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_email_valid
  CHECK (email IS NULL OR email = public.normalize_contact_email(email));

DROP TRIGGER IF EXISTS profiles_normalize_contacts ON public.profiles;
CREATE TRIGGER profiles_normalize_contacts
  BEFORE INSERT OR UPDATE OF phone
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_and_business_contacts();

DROP TRIGGER IF EXISTS businesses_normalize_contacts ON public.businesses;
CREATE TRIGGER businesses_normalize_contacts
  BEFORE INSERT OR UPDATE OF phone, email
  ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_and_business_contacts();
