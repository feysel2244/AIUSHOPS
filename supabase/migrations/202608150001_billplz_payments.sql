create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('order', 'promotion')),
  reference_id uuid not null,
  user_id uuid references profiles(id),
  billplz_bill_id text unique,
  amount numeric not null,
  status text default 'pending' check (status in ('pending', 'paid', 'failed')),
  duration_days integer,
  listing_type text check (listing_type in ('product', 'service')),
  created_at timestamp with time zone default now(),
  paid_at timestamp with time zone
);

alter table payments enable row level security;

drop policy if exists "Users see own payments" on payments;
create policy "Users see own payments"
  on payments for select
  using (user_id = auth.uid());

alter table orders
  add column if not exists payment_status text default 'unpaid'
  check (payment_status in ('unpaid', 'paid', 'failed'));

alter table products
  add column if not exists promoted_until timestamp with time zone;

alter table services
  add column if not exists promoted_until timestamp with time zone;
