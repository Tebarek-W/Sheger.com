-- Aggregate review ratings per business in the database instead of pulling
-- every review row to the client. Used by discovery (home / search / nearby).
CREATE OR REPLACE FUNCTION public.get_business_rating_summaries()
RETURNS TABLE (business_id uuid, average numeric, review_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.business_id, avg(r.rating)::numeric, count(*)::bigint
  FROM public.reviews r
  GROUP BY r.business_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_rating_summaries() TO anon, authenticated;
