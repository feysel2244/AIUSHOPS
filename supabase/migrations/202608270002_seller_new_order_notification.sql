-- Universal "New Order" notification for sellers
-- This fires when any new order is placed (including Pay on Pickup and Services)

create or replace function public.notify_seller_new_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  seller_id uuid;
  buyer_name text;
  shop_name text;
  order_desc text;
begin
  -- Get the seller's user ID and shop name
  select owner_id, name into seller_id, shop_name from public.shops where id = new.shop_id;
  
  -- Get the buyer's name
  select coalesce(name, email, 'A buyer') into buyer_name from public.profiles where id = new.buyer_id;
  
  -- If we can't find the seller, do nothing
  if seller_id is null then
    return new;
  end if;

  -- If the buyer selected 'Pay Now' (qr_bank_transfer), do NOT notify the seller yet.
  -- They haven't uploaded proof of payment. We will notify the seller when they click "I've Paid".
  if new.payment_method = 'qr_bank_transfer' then
    return new;
  end if;

  -- Create a descriptive message based on payment method / order type
  if new.payment_method = 'cash_on_pickup' then
    order_desc := 'placed a Cash on Pickup order';
  elsif new.type = 'service' then
    order_desc := 'requested a Service Booking';
  else
    order_desc := 'placed a new order';
  end if;

  -- Insert the notification for the seller
  insert into public.notifications(user_id, icon, title, body, type, link_to, is_unread)
  values (
    seller_id, 
    '🛍️', 
    'New Order Received!',
    buyer_name || ' ' || order_desc || ' (' || coalesce(new.order_code, 'New') || ').',
    'order', 
    '/seller/dashboard', 
    true
  );

  return new;
end;
$$;

-- Drop the old trigger if it exists and create the new one
drop trigger if exists trg_notify_seller_new_order on public.orders;
create trigger trg_notify_seller_new_order
  after insert on public.orders
  for each row
  execute function public.notify_seller_new_order();
