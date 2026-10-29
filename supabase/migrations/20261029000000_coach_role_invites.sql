-- Invitaciones de rol: se otorgan solo cuando el email está verificado y el proveedor es Google.

create table if not exists public.role_invites (
  email text not null check (email = lower(email)),
  role public.app_role not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  primary key (email, role)
);

alter table public.role_invites enable row level security;
revoke all on public.role_invites from anon, authenticated;

insert into public.role_invites (email, role) values
  ('cronosgymoficial@gmail.com', 'admin'),
  ('alejandro.calixtomas@gmail.com', 'coach'),
  ('stephemercadov@gmail.com', 'coach'),
  ('michnsqk07@gmail.com', 'admin'),
  ('michnsqk07@gmail.com', 'coach'),
  ('michnsqk07@gmail.com', 'developer')
on conflict (email, role) do nothing;

create or replace function public.apply_role_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  select new.id, ri.role
  from public.role_invites ri
  where ri.email = lower(new.email) and ri.consumed_at is null
  on conflict (user_id, role) do nothing;

  update public.role_invites
  set consumed_at = now()
  where email = lower(new.email) and consumed_at is null;

  return new;
exception when others then
  raise warning 'apply_role_invites failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke execute on function public.apply_role_invites() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_apply_roles on auth.users;
create trigger on_auth_user_created_apply_roles
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null and new.raw_app_meta_data->>'provider' = 'google')
  execute function public.apply_role_invites();

drop trigger if exists on_auth_user_confirmed_apply_roles on auth.users;
create trigger on_auth_user_confirmed_apply_roles
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null and new.raw_app_meta_data->>'provider' = 'google')
  execute function public.apply_role_invites();

insert into public.user_roles (user_id, role)
select u.id, ri.role
from public.role_invites ri
join auth.users u on lower(u.email) = ri.email
where u.email_confirmed_at is not null and ri.consumed_at is null
  and u.raw_app_meta_data->>'provider' = 'google'
on conflict (user_id, role) do nothing;

update public.role_invites ri
set consumed_at = now()
where ri.consumed_at is null
  and exists (
    select 1 from auth.users u
    where lower(u.email) = ri.email and u.email_confirmed_at is not null
      and u.raw_app_meta_data->>'provider' = 'google'
  );
