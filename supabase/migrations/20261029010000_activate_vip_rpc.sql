-- 20261029010000_activate_vip_rpc.sql
-- RPC para que un coach active a un atleta como VIP (pago en efectivo).
--
-- Why an RPC rather than a direct UPDATE from the client:
--
--   `20261029000000_athlete_vip.sql` revokes table-level UPDATE on `profiles`
--   and re-grants it per column, leaving `is_vip`, `vip_status` and
--   `vip_activated_at` outside the grant. A direct client UPDATE therefore
--   fails with "permission denied", which is the point -- the paywall is
--   column-level, not policy-level. But a coach still has to be able to
--   activate somebody, so the write needs a server-side path, and this is it.
--
--   Beyond the column grant, the RPC does two things a client UPDATE cannot:
--
--   1. **Authorization.** It checks that the caller is an active coach and that
--      the target athlete has an active session request with *that coach*.
--      Without this the button would let any authenticated user activate
--      anybody; with it, activation is scoped to the coach's own roster, which
--      is exactly the relationship the rest of the portal already gates on
--      (`athlete_phases_coach_write`, the profiles read policy, etc.).
--
--   2. **Atomicity.** `is_vip`, `vip_status` and `vip_activated_at` are set in
--      one statement, so there is no window in which an athlete is "VIP" without
--      a status or a timestamp. A client doing three round trips could end up
--      halfway and then lose the thread.
--
-- Idempotent: re-running for an already-VIP athlete just re-stamps
-- `vip_activated_at`. That is the right shape for an activation -- it is a
-- record of when the coach pressed the button, and pressing it twice is the
-- same action, not a second activation.

create or replace function public.activate_vip(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  coach_row public.coaches%rowtype;
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- El actor debe ser un coach activo.
  select * into coach_row
  from public.coaches
  where user_id = actor and is_active = true
  limit 1;

  if coach_row.id is null then
    raise exception 'solo un coach activo puede activar VIP' using errcode = '42501';
  end if;

  -- El atleta debe tener una solicitud activa con este coach.
  if not exists (
    select 1
    from public.coach_session_requests r
    where r.athlete_id = target_user_id
      and r.coach_id = coach_row.id
      and r.status = 'active'
  ) then
    raise exception 'el atleta no tiene una solicitud activa con este coach'
      using errcode = '42501';
  end if;

  update public.profiles
  set is_vip = true,
      vip_status = 'Efectivo',
      vip_activated_at = now()
  where user_id = target_user_id;
end
$$;

alter function public.activate_vip(uuid) owner to postgres;

revoke all on function public.activate_vip(uuid) from public, anon;
grant execute on function public.activate_vip(uuid) to authenticated;