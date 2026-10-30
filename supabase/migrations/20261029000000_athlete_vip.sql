-- 20261029000000_athlete_vip.sql
-- VIP por activación manual (efectivo) desde el coach en el portal.
--
-- Three columns, one question: has this athlete been activated as VIP by a coach
-- paying in cash, rather than through the paid subscription flow?
--
--   - `is_vip` is the fact. `not null default false` so a read never has to
--     distinguish "not VIP" from "never asked", exactly like `is_premium`.
--   - `vip_status` is the human label the coach chooses at activation time. It is
--     a free-form string rather than an enum on purpose: a coach may record
--     "Efectivo", "Transferencia", "Invitación" or anything else, and forcing an
--     enum would either reject legitimate values or require a migration every time
--     a payment method is named. The `is_vip` flag is what the app branches on.
--   - `vip_activated_at` records when. Nullable: an athlete who was never activated
--     has no activation instant, and stamping one would be a lie.
--
-- Writes are coach-only. The reasoning is the same as the premium migration:
-- `authenticated` holds table-level UPDATE on `profiles` and `profiles_crud_own`
-- is `for all` scoped to `auth.uid() = user_id`, so without a column grant an
-- athlete could run `update profiles set is_vip = true where user_id = auth.uid()`
-- and the RLS policy would permit it -- it *is* their own row. The gate has to be
-- at the column, so the table-level UPDATE is revoked and re-granted per column.
-- `is_vip`, `vip_status` and `vip_activated_at` are absent from the grant, and
-- the coach writes them through the service role (the portal's RPC path), which
-- keeps its table-level grant and bypasses RLS entirely.
--
-- Idempotent: `add column if not exists` throughout, so applying this to a database
-- that already has them is a no-op.

-- ---------------------------------------------------------------------------
-- is_vip
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_vip boolean not null default false;

-- ---------------------------------------------------------------------------
-- vip_status / vip_activated_at
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists vip_status text;

alter table public.profiles
  add column if not exists vip_activated_at timestamptz;

-- ---------------------------------------------------------------------------
-- Coach write path: revoke table-level UPDATE and re-grant per column.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;

grant update (
  display_name,
  birth_date,
  sex,
  height_cm,
  weight_kg,
  unit_system,
  experience_level,
  activity_level,
  goal,
  guardian_consent_at,
  onboarding_completed_at,
  updated_at
) on public.profiles to authenticated;