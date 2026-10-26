-- 20261026020000_dev_auto_role_and_grant_rpc.sql
-- Rol de desarrollador automático para michnsqk07@gmail.com y RPC de concesión de roles.
--
-- 1. El correo de desarrollo recibe el rol 'developer' al crearse la cuenta
--    (handle_new_user) y se rellena de forma idempotente para cuentas ya existentes.
-- 2. grant_user_role(target_email, new_role) permite a developer/admin asignar
--    roles athlete, coach o admin a cualquier usuario por correo.
-- 3. user_roles permite lectura completa a developer/admin (panel de gestión de roles).

-- ---------------------------------------------------------------------------
-- 1. Auto-asignación de desarrollador al crear la cuenta
-- ---------------------------------------------------------------------------

-- Cuentas ya existentes: conceder desarrollador si coincide el correo (idempotente).
insert into public.user_roles (user_id, role, granted_by)
select id, 'developer'::public.app_role, null
from auth.users
where email = 'michnsqk07@gmail.com'
on conflict (user_id, role) do nothing;

-- handle_new_user se ejecuta al crearse un usuario de auth (webhook de Supabase Auth).
-- Se extiende para conceder 'developer' al correo de desarrollo sin intervención de otro admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (user_id) do nothing;

  if new.email = 'michnsqk07@gmail.com' then
    insert into public.user_roles (user_id, role, granted_by)
    values (new.id, 'developer'::public.app_role, null)
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end
$$;

alter function public.handle_new_user() owner to postgres;

-- ---------------------------------------------------------------------------
-- 2. RPC grant_user_role: solo developer o admin pueden asignar roles
-- ---------------------------------------------------------------------------

create or replace function public.grant_user_role(target_email text, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target uuid;
begin
  -- Solo desarrollador o administrador pueden conceder roles.
  if not (public.has_role('developer') or public.has_role('admin')) then
    raise exception 'Solo desarrollador o administrador pueden asignar roles.'
      using errcode = '42501';
  end if;

  -- Los roles que este RPC puede asignar: nunca 'developer' (alta automática).
  if new_role <> all (array['athlete', 'coach', 'admin']::public.app_role[]) then
    raise exception 'El rol % no puede asignarse desde este punto.', new_role
      using errcode = '22023';
  end if;

  select id into target
  from auth.users
  where email = target_email
  limit 1;

  if target is null then
    raise exception 'No existe ninguna cuenta con el correo %.', target_email
      using errcode = '22023';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (target, new_role, actor)
  on conflict (user_id, role) do update
  set granted_by = actor,
      granted_at = now();
end
$$;

alter function public.grant_user_role(text, public.app_role) owner to postgres;

revoke all on function public.grant_user_role(text, public.app_role) from public, anon;
grant execute on function public.grant_user_role(text, public.app_role) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lectura completa de user_roles para developer y admin (panel de roles)
-- ---------------------------------------------------------------------------

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role('developer')
    or public.has_role('admin')
  );
