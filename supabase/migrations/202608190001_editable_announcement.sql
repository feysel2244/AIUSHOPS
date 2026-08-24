-- Editable site announcement controlled by admins.
alter table public.platform_settings
  add column if not exists announcement_text text;
