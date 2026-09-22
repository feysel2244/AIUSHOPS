
CREATE POLICY "Sellers can view own quick listings"
ON public.quick_listings FOR SELECT
TO authenticated
USING (auth.uid() = seller_id);

