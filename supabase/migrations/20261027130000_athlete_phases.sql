-- ---------------------------------------------------------------------------
-- 20261027130000_athlete_phases.sql
--
-- Fase de entrenamiento por atleta: descarga, mantenimiento o sobrecarga.
-- El coach la establece; se usa para ajustar sugerencias de RPE y volumen.
-- ---------------------------------------------------------------------------

create type public.athlete_phase as enum ('deload', 'maintenance', 'overload');

create table if not exists public.athlete_phases (
  athlete_id uuid primary key references auth.users(id) on delete cascade,
  phase public.athlete_phase not null default 'maintenance',
  updated_at timestamptz not null default now()
);

alter table public.athlete_phases enable row level security;

-- El atleta lee su propia fase.
drop policy if exists athlete_phases_read_own on public.athlete_phases;
create policy athlete_phases_read_own on public.athlete_phases
  for select
  to authenticated
  using (auth.uid() = athlete_id);

-- El coach lee/escribe la fase de sus atletas asignados (solicitud activa).
drop policy if exists athlete_phases_coach_write on public.athlete_phases;
create policy athlete_phases_coach_write on public.athlete_phases
  for all
  to authenticated
  using (
    exists (
      select 1 from public.coach_session_requests r
      where r.coach_id = (select id from public.coaches where user_id = auth.uid())
        and r.athlete_id = athlete_phases.athlete_id
        and r.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.coach_session_requests r
      where r.coach_id = (select id from public.coaches where user_id = auth.uid())
        and r.athlete_id = athlete_phases.athlete_id
        and r.status = 'active'
    )
  );
