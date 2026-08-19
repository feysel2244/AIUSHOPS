-- Per-shop commission tracking and monthly settlement receipts.

alter table public.shops add column if not exists commission_per_order numeric default 0;

-- Sellers may update their shop through owner policies, but only admins can
-- change the platform commission rate.
create or replace function public.protect_commission_field()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  ) then
    new.commission_per_order := old.commission_per_order;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_commission_field_trigger on public.shops;
create trigger protect_commission_field_trigger
before update on public.shops
for each row execute function public.protect_commission_field();

create table if not exists public.commission_settlements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  period_month date not null,
  order_count int not null,
  amount_owed numeric(10,2) not null,
  receipt_url text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (shop_id, period_month)
);

alter table public.commission_settlements enable row level security;

drop policy if exists "Sellers can insert own settlements" on public.commission_settlements;
create policy "Sellers can insert own settlements"
  on public.commission_settlements for insert
  with check (
    exists (
      select 1
      from public.shops
      where id = shop_id
        and owner_id = auth.uid()
    )
  );

drop policy if exists "Sellers can view own settlements, admins view all" on public.commission_settlements;
create policy "Sellers can view own settlements, admins view all"
  on public.commission_settlements for select
  using (
    exists (
      select 1
      from public.shops
      where id = shop_id
        and owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

drop policy if exists "Admins can update settlements" on public.commission_settlements;
create policy "Admins can update settlements"
  on public.commission_settlements for update
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

insert into storage.buckets (id, name, public)
values ('commission-receipts', 'commission-receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read commission receipts" on storage.objects;
create policy "Public read commission receipts"
  on storage.objects for select
  using (bucket_id = 'commission-receipts');

drop policy if exists "Sellers upload commission receipt" on storage.objects;
create policy "Sellers upload commission receipt"
  on storage.objects for insert
  with check (
    bucket_id = 'commission-receipts'
    and public.is_shop_owner((storage.foldername(name))[1])
  );
