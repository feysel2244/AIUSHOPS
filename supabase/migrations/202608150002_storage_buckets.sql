-- Create public storage buckets
insert into storage.buckets (id, name, public)
values
  ('avatars',        'avatars',        true),
  ('shop-logos',     'shop-logos',     true),
  ('shop-banners',   'shop-banners',   true),
  ('product-images', 'product-images', true),
  ('service-images', 'service-images', true)
on conflict (id) do nothing;

-- ============================================================
-- avatars  (path: {user_id}/avatar-{ts}.{ext})
-- ============================================================
drop policy if exists "Public read avatars"          on storage.objects;
drop policy if exists "Users upload own avatar"       on storage.objects;
drop policy if exists "Users update own avatar"       on storage.objects;

create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- shop-logos  (path: {shop_id}/logo-{ts}.{ext})
-- ============================================================
drop policy if exists "Public read shop logos"        on storage.objects;
drop policy if exists "Owners upload shop logo"       on storage.objects;
drop policy if exists "Owners update shop logo"       on storage.objects;

create policy "Public read shop logos"
  on storage.objects for select
  using (bucket_id = 'shop-logos');

create policy "Owners upload shop logo"
  on storage.objects for insert
  with check (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

create policy "Owners update shop logo"
  on storage.objects for update
  using (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- shop-banners  (path: {shop_id}/banner-{ts}.{ext})
-- ============================================================
drop policy if exists "Public read shop banners"      on storage.objects;
drop policy if exists "Owners upload shop banner"     on storage.objects;
drop policy if exists "Owners update shop banner"     on storage.objects;

create policy "Public read shop banners"
  on storage.objects for select
  using (bucket_id = 'shop-banners');

create policy "Owners upload shop banner"
  on storage.objects for insert
  with check (
    bucket_id = 'shop-banners'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

create policy "Owners update shop banner"
  on storage.objects for update
  using (
    bucket_id = 'shop-banners'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- product-images  (path: {shop_id}/{product_id}-{i}.{ext})
-- ============================================================
drop policy if exists "Public read product images"    on storage.objects;
drop policy if exists "Owners upload product image"   on storage.objects;
drop policy if exists "Owners update product image"   on storage.objects;

create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Owners upload product image"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

create policy "Owners update product image"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- service-images  (path: {shop_id}/{service_id}.{ext})
-- ============================================================
drop policy if exists "Public read service images"    on storage.objects;
drop policy if exists "Owners upload service image"   on storage.objects;
drop policy if exists "Owners update service image"   on storage.objects;

create policy "Public read service images"
  on storage.objects for select
  using (bucket_id = 'service-images');

create policy "Owners upload service image"
  on storage.objects for insert
  with check (
    bucket_id = 'service-images'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

create policy "Owners update service image"
  on storage.objects for update
  using (
    bucket_id = 'service-images'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );
