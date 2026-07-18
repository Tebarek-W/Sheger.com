-- Business owners can read profiles of customers who booked with their businesses.

CREATE POLICY "Owners can view profiles of their customers"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      INNER JOIN public.businesses bus ON bus.id = b.business_id
      WHERE b.customer_id = profiles.id
        AND bus.owner_id = auth.uid()
    )
  );
