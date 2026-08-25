-- Run this AFTER your base table schema.
-- It fixes seller image uploads: shop logo, banner, product images, service images,
-- and payment QR codes.

alter table public.shops add column if not exists payment_qr_url text;

-- Make seller image uploads reliable even when shops has restrictive RLS.
-- Storage policies call this helper to check ownership without depending on
-- the caller's SELECT visibility on the shops table.
create or replace function public.is_shop_owner(shop_id_text text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops
    where id::text = shop_id_text
      and owner_id = auth.uid()
  );
$$;

grant execute on function public.is_shop_owner(text) to authenticated;

-- If RLS is enabled on your app tables, sellers must be able to save the
-- public URL returned by Storage back onto their shop/listing rows.
drop policy if exists "Owners can update own shops" on public.shops;
create policy "Owners can update own shops"
  on public.shops for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners can update own products" on public.products;
create policy "Owners can update own products"
  on public.products for update
  using (public.is_shop_owner(shop_id::text))
  with check (public.is_shop_owner(shop_id::text));

drop policy if exists "Owners can update own services" on public.services;
create policy "Owners can update own services"
  on public.services for update
  using (public.is_shop_owner(shop_id::text))
  with check (public.is_shop_owner(shop_id::text));

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('shop-logos', 'shop-logos', true),
  ('shop-banners', 'shop-banners', true),
  ('product-images', 'product-images', true),
  ('service-images', 'service-images', true),
  ('payment-qr', 'payment-qr', true),
  ('promotion-receipts', 'promotion-receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Public read shop logos" on storage.objects;
create policy "Public read shop logos"
  on storage.objects for select
  using (bucket_id = 'shop-logos');

drop policy if exists "Owners upload shop logo" on storage.objects;
drop policy if exists "Owners update shop logo" on storage.objects;
create policy "Owners upload shop logo"
  on storage.objects for insert
  with check (bucket_id = 'shop-logos' and public.is_shop_owner((storage.foldername(name))[1]));
create policy "Owners update shop logo"
  on storage.objects for update
  using (bucket_id = 'shop-logos' and public.is_shop_owner((storage.foldername(name))[1]))
  with check (bucket_id = 'shop-logos' and public.is_shop_owner((storage.foldername(name))[1]));

drop policy if exists "Public read shop banners" on storage.objects;
create policy "Public read shop banners"
  on storage.objects for select
  using (bucket_id = 'shop-banners');

drop policy if exists "Owners upload shop banner" on storage.objects;
drop policy if exists "Owners update shop banner" on storage.objects;
create policy "Owners upload shop banner"
  on storage.objects for insert
  with check (bucket_id = 'shop-banners' and public.is_shop_owner((storage.foldername(name))[1]));
create policy "Owners update shop banner"
  on storage.objects for update
  using (bucket_id = 'shop-banners' and public.is_shop_owner((storage.foldername(name))[1]))
  with check (bucket_id = 'shop-banners' and public.is_shop_owner((storage.foldername(name))[1]));

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Owners upload product image" on storage.objects;
drop policy if exists "Owners update product image" on storage.objects;
create policy "Owners upload product image"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_shop_owner((storage.foldername(name))[1]));
create policy "Owners update product image"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_shop_owner((storage.foldername(name))[1]))
  with check (bucket_id = 'product-images' and public.is_shop_owner((storage.foldername(name))[1]));

drop policy if exists "Public read service images" on storage.objects;
create policy "Public read service images"
  on storage.objects for select
  using (bucket_id = 'service-images');

drop policy if exists "Owners upload service image" on storage.objects;
drop policy if exists "Owners update service image" on storage.objects;
create policy "Owners upload service image"
  on storage.objects for insert
  with check (bucket_id = 'service-images' and public.is_shop_owner((storage.foldername(name))[1]));
create policy "Owners update service image"
  on storage.objects for update
  using (bucket_id = 'service-images' and public.is_shop_owner((storage.foldername(name))[1]))
  with check (bucket_id = 'service-images' and public.is_shop_owner((storage.foldername(name))[1]));

drop policy if exists "Public read payment QR" on storage.objects;
create policy "Public read payment QR"
  on storage.objects for select
  using (bucket_id = 'payment-qr');

drop policy if exists "Owners upload payment QR" on storage.objects;
drop policy if exists "Owners update payment QR" on storage.objects;
create policy "Owners upload payment QR"
  on storage.objects for insert
  with check (bucket_id = 'payment-qr' and public.is_shop_owner((storage.foldername(name))[1]));
create policy "Owners update payment QR"
  on storage.objects for update
  using (bucket_id = 'payment-qr' and public.is_shop_owner((storage.foldername(name))[1]))
  with check (bucket_id = 'payment-qr' and public.is_shop_owner((storage.foldername(name))[1]));
