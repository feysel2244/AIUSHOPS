-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Final security + feature fixes
-- ════════════════════════════════════════════════════════════════════════════

-- ── §1: RLS on platform_settings ────────────────────────────────────────────
alter table platform_settings enable row level security;

create policy "Platform settings are publicly readable"
  on platform_settings for select using (true);

create policy "Only admins can update platform settings"
  on platform_settings for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

create policy "Only admins can insert platform settings"
  on platform_settings for insert
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- platform-qr storage bucket (created via dashboard; SQL policy mirrors payment-qr pattern)
insert into storage.buckets (id, name, public)
  values ('platform-qr', 'platform-qr', true)
  on conflict (id) do nothing;

create policy "Anyone can read platform QR"
  on storage.objects for select
  using (bucket_id = 'platform-qr');

create policy "Only admins can upload platform QR"
  on storage.objects for insert
  with check (
    bucket_id = 'platform-qr'
    and exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can update platform QR"
  on storage.objects for update
  using (
    bucket_id = 'platform-qr'
    and exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can delete platform QR"
  on storage.objects for delete
  using (
    bucket_id = 'platform-qr'
    and exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ── §2: is_suspended on profiles ────────────────────────────────────────────
alter table profiles add column if not exists is_suspended boolean default false;

-- Admins can update is_suspended on any profile
create policy "Admins can suspend users"
  on profiles for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- ── §3: categories table ─────────────────────────────────────────────────────
create table if not exists categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table categories enable row level security;

create policy "Categories are publicly readable"
  on categories for select using (true);

create policy "Only admins manage categories"
  on categories for insert
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

create policy "Only admins update categories"
  on categories for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

create policy "Only admins delete categories"
  on categories for delete
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- Seed from static CATEGORIES constant
insert into categories (name, icon, sort_order) values
  ('Food & Drinks',  '🍱', 1),
  ('Fashion',        '👗', 2),
  ('Tutoring',       '📚', 3),
  ('Printing',       '🖨️', 4),
  ('Electronics',    '💻', 5),
  ('Crafts & Art',   '🎨', 6),
  ('Beauty',         '💄', 7),
  ('Sports',         '⚽', 8)
on conflict (name) do nothing;

-- ── §4: listing_views table ──────────────────────────────────────────────────
create table if not exists listing_views (
  id           uuid primary key default gen_random_uuid(),
  listing_type text check (listing_type in ('product', 'service')),
  listing_id   uuid not null,
  shop_id      uuid references shops(id) on delete cascade,
  viewer_id    uuid references profiles(id),
  created_at   timestamptz default now()
);

alter table listing_views enable row level security;

create policy "Anyone can log a view"
  on listing_views for insert with check (true);

create policy "Shop owners see own listing views"
  on listing_views for select
  using (exists (select 1 from shops where id = shop_id and owner_id = auth.uid()));
