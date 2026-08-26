-- Run this in your Supabase SQL Editor to improve the notification text for Counter-Offers
CREATE OR REPLACE FUNCTION public.notify_order_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  status_label text;
  notification_title text;
  notification_body text;
  notification_icon text;
BEGIN
  IF old.status IS NOT DISTINCT FROM new.status OR new.buyer_id IS NULL THEN 
    RETURN new; 
  END IF;
  IF auth.uid() = new.buyer_id THEN 
    RETURN new; 
  END IF;
  
  IF new.status::text = 'pending_buyer_approval' THEN
    notification_title := 'New Time Proposed';
    notification_body := 'The seller has proposed a new time for your service booking ' || coalesce(new.order_code, '') || '. Please review it.';
    notification_icon := '📅';
  ELSE
    status_label := replace(initcap(new.status::text), '_', ' ');
    notification_title := 'Order status updated';
    notification_body := 'Your order ' || coalesce(new.order_code, '') || ' is now ' || status_label || '.';
    notification_icon := CASE 
      WHEN new.status::text IN ('completed','delivered') THEN '✅' 
      WHEN new.status::text IN ('cancelled','rejected') THEN '❌' 
      ELSE '📦' 
    END;
  END IF;

  INSERT INTO public.notifications(user_id, icon, title, body, type, link_to, is_unread)
  VALUES (new.buyer_id, notification_icon, notification_title, notification_body, 'order', '/orders', true);
  
  RETURN new;
END $$;
