do $$ begin
  create type public.announcement_kind as enum ('promo','notice','event');
exception when duplicate_object then null;
end $$;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 80),
  message text not null check (char_length(message) <= 500),
  kind public.announcement_kind not null default 'notice',
  banner_path text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint announcements_dates_check check (expires_at > starts_at)
);
alter table public.announcements enable row level security;
drop policy if exists announcements_read_active on public.announcements;
create policy announcements_read_active on public.announcements
  for select to authenticated using (now() >= starts_at and now() < expires_at);
drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements
  for all to authenticated using (public.has_role('admin'))
  with check (public.has_role('admin') and created_by = auth.uid());