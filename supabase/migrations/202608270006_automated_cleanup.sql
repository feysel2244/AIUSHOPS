-- ============================================================
-- Automated Cleanup: Notifications & Proof of Payment
-- ============================================================

create or replace function public.cleanup_old_data()
returns void
language plpgsql
security definer
as $$
declare
  order_record record;
  object_path text;
begin
  -- 1. Delete notifications older than 1 day
  delete from public.notifications
  where created_at < now() - interval '1 day';

  -- 2. Delete proof of payments for orders approved more than 1 day ago
  for order_record in
    select id, payment_proof_url 
    from public.orders
    where payment_status = 'paid'
      and payment_confirmed_at < now() - interval '1 day'
      and payment_proof_url is not null
  loop
    -- Extract the object path from the URL.
    -- The URL looks like: https://[project].supabase.co/storage/v1/object/public/payment-proofs/buyer_id/timestamp.jpg
    -- We want everything after '/payment-proofs/'
    object_path := substring(order_record.payment_proof_url from '/payment-proofs/(.*)$');
    
    if object_path is not null then
      -- Delete the file from storage.objects
      delete from storage.objects
      where bucket_id = 'payment-proofs' and name = object_path;
    end if;

    -- Set the url to null in the order
    update public.orders
    set payment_proof_url = null
    where id = order_record.id;
  end loop;
end;
$$;

-- Enable pg_cron extension if not already enabled (this requires appropriate privileges, usually works on Supabase)
create extension if not exists pg_cron with schema extensions;

-- Schedule the cleanup function to run every hour
-- If a job with this name already exists, we unschedule it first to avoid duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM cron.job 
    WHERE jobname = 'cleanup_old_data_job'
  ) THEN
    PERFORM cron.unschedule('cleanup_old_data_job');
  END IF;
END $$;

select cron.schedule(
  'cleanup_old_data_job',
  '0 * * * *', -- Run at minute 0 of every hour
  $$ select public.cleanup_old_data(); $$
);
