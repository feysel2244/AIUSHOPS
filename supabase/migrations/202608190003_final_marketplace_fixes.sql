-- Final marketplace fixes: seller shop deactivation, service listings, buyer payment proofs,
-- admin/seller RLS, and realtime seller applications.

alter table public.shops add column if not exists shop_type text default 'both';
alter table public.shops add column if not exists deleted_at timestamptz;
update public.shops set shop_type = 'both' where shop_type is null or btrim(shop_type) = '';
alter table public.shops drop constraint if exists shops_shop_type_check;
alter table public.shops add constraint shops_shop_type_check check (shop_type in ('product','service','both'));

alter table public.orders add column if not exists payment_proof_url text;

-- Seller applications and admin management
drop policy if exists "Authenticated users can create shop applications" on public.shops;
create policy "Authenticated users can create shop applications" on public.shops for insert to authenticated
with check (auth.uid() = owner_id and status = 'pending');

drop policy if exists "Owners can view own shops" on public.shops;
create policy "Owners can view own shops" on public.shops for select to authenticated
using (owner_id = auth.uid());

drop policy if exists "Admins can view all shops" on public.shops;
create policy "Admins can view all shops" on public.shops for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "Admins can update all shops" on public.shops;
create policy "Admins can update all shops" on public.shops for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Buyer payment-proof storage
insert into storage.buckets (id,name,public) values ('payment-proofs','payment-proofs',true) on conflict (id) do update set public=true;
drop policy if exists "Public read payment proofs" on storage.objects;
create policy "Public read payment proofs" on storage.objects for select using (bucket_id='payment-proofs');
drop policy if exists "Buyers upload payment proofs" on storage.objects;
create policy "Buyers upload payment proofs" on storage.objects for insert to authenticated
with check (bucket_id='payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

-- Buyer can attach proof and confirm their own order.
drop policy if exists "Buyers can update own orders" on public.orders;
create policy "Buyers can update own orders" on public.orders for update to authenticated
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

-- Seller can update orders belonging to their shop.
drop policy if exists "Shop owners can update own orders" on public.orders;
create policy "Shop owners can update own orders" on public.orders for update to authenticated
using (exists (select 1 from public.shops s where s.id = orders.shop_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.shops s where s.id = orders.shop_id and s.owner_id = auth.uid()));

-- Service creation/edit/delete for the seller dashboard.
drop policy if exists "Owners can insert own services" on public.services;
create policy "Owners can insert own services" on public.services for insert to authenticated
with check (public.is_shop_owner(shop_id::text));

drop policy if exists "Owners can delete own services" on public.services;
create policy "Owners can delete own services" on public.services for delete to authenticated
using (public.is_shop_owner(shop_id::text));

-- Realtime for admin seller applications.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shops') then
    alter publication supabase_realtime add table public.shops;
  end if;
end $$;


-- Server-side notification creation so a student can notify admins without reading admin profiles.
create or replace function public.notify_admins_new_seller_application(p_shop_name text, p_applicant_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.notifications (user_id, icon, title, body, type, link_to, is_unread)
  select id, '🏪', 'New seller application',
         coalesce(p_applicant_name, 'A student') || ' submitted “' || coalesce(p_shop_name, 'New shop') || '” for review.',
         'shop', '/admin', true
  from public.profiles
  where is_admin = true;
end;
$$;

grant execute on function public.notify_admins_new_seller_application(text, text) to authenticated;


create or replace function public.notify_admins_new_seller_application(p_shop_name text, p_applicant_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.notifications (user_id, icon, title, body, type, link_to, is_unread)
  select id, '🏪', 'New seller application', coalesce(p_applicant_name, 'A student') || ' submitted “' || coalesce(p_shop_name, 'New shop') || '” for review.', 'shop', '/admin', true
  from public.profiles where is_admin = true;
end; $$;
grant execute on function public.notify_admins_new_seller_application(text, text) to authenticated;


create or replace function public.notify_admins_new_seller_application(p_shop_name text, p_applicant_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.notifications (user_id, icon, title, body, type, link_to, is_unread)
  select id, '🏪', 'New seller application', coalesce(p_applicant_name, 'A student') || ' submitted “' || coalesce(p_shop_name, 'New shop') || '” for review.', 'shop', '/admin', true
  from public.profiles where is_admin = true;
end; $$;
grant execute on function public.notify_admins_new_seller_application(text, text) to authenticated;
