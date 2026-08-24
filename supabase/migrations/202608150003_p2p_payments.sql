-- ============================================================
-- P2P QR Payment Migration
-- ============================================================

-- 1. shops: add payment QR code URL
alter table shops add column if not exists payment_qr_url text;

-- 2. orders: payment confirmation fields
alter table orders add column if not exists payment_confirmed_by  text;
alter table orders add column if not exists payment_confirmed_at  timestamptz;
alter table orders add column if not exists payment_timing        text default 'now';
alter table orders add column if not exists payment_verified_by_seller boolean default false;

-- drop old constraint (may exist with only 'buyer'), re-add to include 'seller'
alter table orders drop constraint if exists orders_payment_confirmed_by_check;
alter table orders add  constraint orders_payment_confirmed_by_check
  check (payment_confirmed_by in ('buyer', 'seller'));

-- payment_timing constraint
alter table orders drop constraint if exists orders_payment_timing_check;
alter table orders add  constraint orders_payment_timing_check
  check (payment_timing in ('now', 'on_pickup'));

-- 3. platform_settings singleton (for platform QR / bank details used in promotion payments)
create table if not exists platform_settings (
  id             boolean primary key default true check (id = true),
  payment_qr_url text,
  bank_name      text,
  account_name   text,
  account_number text
);
insert into platform_settings (id) values (true) on conflict do nothing;

-- 4. listing_promotions — admin-reviewed promotion payment requests
create table if not exists listing_promotions (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid references shops(id) on delete cascade,
  listing_type     text check (listing_type in ('product', 'service')),
  listing_id       uuid not null,
  duration_days    int  not null,
  amount           numeric(10,2) not null,
  receipt_url      text,
  status           text default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  submitted_at     timestamptz default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references profiles(id),
  promoted_until   timestamptz
);

-- RLS for listing_promotions
alter table listing_promotions enable row level security;

create policy "Sellers can insert own promotions"
  on listing_promotions for insert
  with check (
    exists (select 1 from shops where id = shop_id and owner_id = auth.uid())
  );

create policy "Sellers can view own promotions"
  on listing_promotions for select
  using (
    exists (select 1 from shops where id = shop_id and owner_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update promotions"
  on listing_promotions for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- 5. payment-qr storage bucket
insert into storage.buckets (id, name, public) values ('payment-qr', 'payment-qr', true)
  on conflict (id) do nothing;

drop policy if exists "Public read payment QR" on storage.objects;
create policy "Public read payment QR"
  on storage.objects for select using (bucket_id = 'payment-qr');

drop policy if exists "Owners upload payment QR" on storage.objects;
create policy "Owners upload payment QR"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-qr'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

drop policy if exists "Owners update payment QR" on storage.objects;
create policy "Owners update payment QR"
  on storage.objects for update
  using (
    bucket_id = 'payment-qr'
    and exists (
      select 1 from public.shops
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- 6. promotion-receipts storage bucket
insert into storage.buckets (id, name, public) values ('promotion-receipts', 'promotion-receipts', true)
  on conflict (id) do nothing;

drop policy if exists "Public read promotion receipts" on storage.objects;
create policy "Public read promotion receipts"
  on storage.objects for select using (bucket_id = 'promotion-receipts');

drop policy if exists "Sellers upload promotion receipt" on storage.objects;
create policy "Sellers upload promotion receipt"
  on storage.objects for insert
  with check (
    bucket_id = 'promotion-receipts'
    and auth.role() = 'authenticated'
  );
