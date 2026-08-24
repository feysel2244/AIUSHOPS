-- Sellers can delete their own marketplace listings.
drop policy if exists "Owners can delete own products" on public.products;
create policy "Owners can delete own products"
  on public.products for delete
  using (public.is_shop_owner(shop_id::text));

drop policy if exists "Owners can delete own services" on public.services;
create policy "Owners can delete own services"
  on public.services for delete
  using (public.is_shop_owner(shop_id::text));
