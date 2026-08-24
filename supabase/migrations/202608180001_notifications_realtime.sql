-- Notifications: ensure the table exists, is protected by RLS, and is available to Realtime.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  icon text default '🔔',
  title text not null,
  body text not null,
  type text not null default 'system',
  link_to text,
  is_unread boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists icon text default '🔔';
alter table public.notifications add column if not exists link_to text;
alter table public.notifications add column if not exists is_unread boolean default true;
alter table public.notifications add column if not exists created_at timestamptz default now();

update public.notifications set is_unread = true where is_unread is null;
alter table public.notifications alter column is_unread set default true;
alter table public.notifications alter column is_unread set not null;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- Users can only read and change their own notifications.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can read own notifications') then
    create policy "Users can read own notifications"
      on public.notifications for select
      using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can update own notifications') then
    create policy "Users can update own notifications"
      on public.notifications for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- The app creates notifications for other users from authenticated client code.
-- Restrict inserts to a signed-in user; the application controls the recipient.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Authenticated users can create notifications') then
    create policy "Authenticated users can create notifications"
      on public.notifications for insert
      to authenticated
      with check (auth.uid() is not null);
  end if;
end $$;

-- Add notifications to Supabase Realtime publication once, without failing if
-- the table was already added in the dashboard.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
