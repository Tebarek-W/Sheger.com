-- Tighten review creation to completed bookings only.
-- Allow reading reviewer first names on public reviews.

DROP POLICY IF EXISTS "Customers create reviews for own bookings" ON public.reviews;

CREATE POLICY "Customers create reviews for completed bookings"
  ON public.reviews FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND b.customer_id = auth.uid()
        AND b.business_id = business_id
        AND b.status = 'completed'
    )
  );

CREATE POLICY "Reviewer names are publicly readable"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.reviews r
      INNER JOIN public.businesses b ON b.id = r.business_id
      WHERE r.customer_id = profiles.id
        AND b.status = 'approved'
    )
  );
