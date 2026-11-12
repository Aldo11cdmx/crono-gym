alter table public.announcements
  add column if not exists image_url text;

alter table public.gym_classes
  add column if not exists price_cents integer not null default 0
  check (price_cents >= 0);
