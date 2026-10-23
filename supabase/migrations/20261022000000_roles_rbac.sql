do $$ begin
  create type public.app_role as enum ('athlete','coach','admin','developer');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = _role) $$;
revoke all on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;

create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.coaches where user_id = auth.uid() and is_active = true) $$;
revoke all on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated;

create or replace function public.my_roles()
returns setof public.app_role language sql stable security invoker set search_path = public as
$$
  select role from public.user_roles where user_id = auth.uid()
  union
  select 'coach'::public.app_role where public.is_coach()
$$;
revoke all on function public.my_roles() from public, anon;
grant execute on function public.my_roles() to authenticated;

create table if not exists public.role_audit_log (
  id bigserial primary key,
  user_id uuid,
  role public.app_role not null,
  action text not null,
  actor uuid,
  at timestamptz not null default now()
);
alter table public.role_audit_log enable row level security;
revoke all on public.role_audit_log from anon, authenticated;

create or replace function public.role_audit_log_guard()
returns trigger language plpgsql set search_path = public as
$$ begin raise exception 'role_audit_log is append-only'; end $$;
drop trigger if exists role_audit_log_no_update on public.role_audit_log;
create trigger role_audit_log_no_update before update or delete on public.role_audit_log
  for each row execute function public.role_audit_log_guard();
drop trigger if exists role_audit_log_no_truncate on public.role_audit_log;
create trigger role_audit_log_no_truncate before truncate on public.role_audit_log
  for each statement execute function public.role_audit_log_guard();

create or replace function public.user_roles_audit()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if tg_op in ('DELETE','UPDATE') then
    insert into public.role_audit_log (user_id, role, action, actor)
    values (old.user_id, old.role, 'revoke', auth.uid());
  end if;
  if tg_op in ('INSERT','UPDATE') then
    insert into public.role_audit_log (user_id, role, action, actor)
    values (new.user_id, new.role, 'grant', auth.uid());
  end if;
  return coalesce(new, old);
end
$$;
revoke all on function public.user_roles_audit() from public, anon, authenticated;
drop trigger if exists user_roles_audit_trg on public.user_roles;
create trigger user_roles_audit_trg after insert or update or delete on public.user_roles
  for each row execute function public.user_roles_audit();