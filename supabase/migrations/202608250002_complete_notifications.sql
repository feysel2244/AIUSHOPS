-- Complete notification preferences + Web Push subscriptions + server-side event notifications.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  order_updates boolean not null default true,
  bookings boolean not null default true,
  reviews boolean not null default true,
  promotions boolean not null default false,
  shop_updates boolean not null default true,
  browser_notifications boolean not null default true,
  sound boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences" on public.notification_preferences for select using (auth.uid() = user_id);
create policy "Users can insert own notification preferences" on public.notification_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own notification preferences" on public.notification_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "Users can insert own push subscriptions" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update own push subscriptions" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own push subscriptions" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- Service bookings: seller gets a notification with the requested date/time.
create or replace function public.notify_service_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare seller_id uuid; buyer_name text; service_name text; booking_date date; booking_time text;
begin
  if new.service_id is null then return new; end if;
  select o.booking_date, o.booking_time::text into booking_date, booking_time from public.orders o where o.id = new.order_id;
  select s.owner_id into seller_id from public.shops s join public.orders o on o.shop_id=s.id where o.id=new.order_id;
  select coalesce(p.name, 'A buyer') into buyer_name from public.profiles p join public.orders o on o.buyer_id=p.id where o.id=new.order_id;
  select coalesce(s.name, new.name, 'Service') into service_name from public.order_items oi left join public.services s on s.id=oi.service_id where oi.id=new.id;
  if seller_id is not null then
    insert into public.notifications(user_id, icon, title, body, type, link_to, is_unread)
    values (seller_id, '📅', 'New service booking',
      buyer_name || ' requested ' || service_name || ' for ' || coalesce(to_char(booking_date, 'DD Mon YYYY'), 'a date') || ' at ' || coalesce(booking_time, 'a time') || '.',
      'booking', '/seller/dashboard', true);
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_service_booking on public.orders;
drop trigger if exists trg_notify_service_booking_item on public.order_items;
create trigger trg_notify_service_booking_item after insert on public.order_items for each row execute function public.notify_service_booking();

-- Reviews: notify the shop owner about the exact product/service reviewed.
create or replace function public.notify_new_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare seller_id uuid; listing_name text; listing_type text;
begin
  select owner_id into seller_id from public.shops where id = new.shop_id;
  if new.product_id is not null then
    listing_type := 'product';
    select name into listing_name from public.products where id = new.product_id;
  elsif new.service_id is not null then
    listing_type := 'service';
    select name into listing_name from public.services where id = new.service_id;
  else
    listing_type := 'listing'; listing_name := 'your listing';
  end if;
  if seller_id is not null then
    insert into public.notifications(user_id, icon, title, body, type, link_to, is_unread)
    values (seller_id, '⭐', 'New ' || listing_type || ' review',
      'A buyer left a ' || new.rating || '-star review for ' || coalesce(listing_name, 'your listing') || '.',
      'review', '/seller/dashboard', true);
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_new_review on public.reviews;
create trigger trg_notify_new_review after insert on public.reviews for each row execute function public.notify_new_review();

-- Order status changes: notify the buyer when the seller changes the order status.
create or replace function public.notify_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare status_label text;
begin
  if old.status is not distinct from new.status or new.buyer_id is null then return new; end if;
  if auth.uid() = new.buyer_id then return new; end if;
  status_label := replace(initcap(new.status::text), '_', ' ');
  insert into public.notifications(user_id, icon, title, body, type, link_to, is_unread)
  values (new.buyer_id, case when new.status::text in ('completed','delivered') then '✅' when new.status::text in ('cancelled','rejected') then '⚠️' else '📦' end,
    'Order status updated', 'Your order ' || coalesce(new.order_code, '') || ' is now ' || status_label || '.', 'order', '/orders', true);
  return new;
end $$;

drop trigger if exists trg_notify_order_status_change on public.orders;
create trigger trg_notify_order_status_change after update of status on public.orders for each row execute function public.notify_order_status_change();


-- Payment proof: seller is alerted when a buyer submits a receipt.
create or replace function public.notify_payment_proof() returns trigger
language plpgsql security definer set search_path = public as $$
declare seller_id uuid;
begin
  if new.payment_proof_url is null or old.payment_proof_url is not distinct from new.payment_proof_url then return new; end if;
  select owner_id into seller_id from public.shops where id = new.shop_id;
  if seller_id is not null then
    insert into public.notifications(user_id, icon, title, body, type, link_to, is_unread)
    values (seller_id, '💳', 'Payment proof submitted', 'A buyer submitted payment proof for order ' || coalesce(new.order_code, '') || '. Please verify the payment.', 'order', '/seller/dashboard', true);
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_payment_proof on public.orders;
create trigger trg_notify_payment_proof after update of payment_proof_url on public.orders for each row execute function public.notify_payment_proof();
