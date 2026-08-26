-- Enable pg_net for HTTP calls from SQL triggers
create extension if not exists pg_net;

-- Drop old broken version if it exists
drop trigger if exists trg_send_web_push on public.notifications;
drop trigger if exists trg_send_push_notification on public.notifications;
drop function if exists public.trigger_send_web_push();
drop function if exists public.trigger_push_notification();

-- Create the trigger function using the correct net schema
create or replace function public.trigger_send_web_push()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url     := 'https://ilqexfieqqktafjimvqo.supabase.co/functions/v1/send-web-push',
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'id',      new.id,
        'user_id', new.user_id,
        'title',   new.title,
        'body',    new.body,
        'type',    new.type,
        'link_to', new.link_to,
        'icon',    new.icon
      )
    ),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer sb_publishable_OEKz1puusdoPzqIhs7Zxug_nt8uprcP'
    )
  );
  return new;
exception
  when others then
    -- Never block the notification insert even if push delivery fails
    raise warning 'Push trigger failed: %', sqlerrm;
    return new;
end;
$$;

-- Attach trigger to notifications table
create trigger trg_send_web_push
  after insert on public.notifications
  for each row
  execute function public.trigger_send_web_push();
