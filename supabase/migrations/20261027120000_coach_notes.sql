-- ---------------------------------------------------------------------------
-- 20261027120000_coach_notes.sql
--
-- Notas privadas del coach: una ficha interna por atleta que solo el coach
-- puede leer y escribir. El atleta nunca ve estas filas.
-- ---------------------------------------------------------------------------

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.coach_notes enable row level security;

drop policy if exists coach_notes_select_own on public.coach_notes;
create policy coach_notes_select_own on public.coach_notes
  for select
  to authenticated
  using (
    auth.uid() = (select user_id from public.coaches where id = coach_id)
  );

drop policy if exists coach_notes_insert_own on public.coach_notes;
create policy coach_notes_insert_own on public.coach_notes
  for insert
  to authenticated
  with check (
    auth.uid() = (select user_id from public.coaches where id = coach_id)
  );

drop policy if exists coach_notes_update_own on public.coach_notes;
create policy coach_notes_update_own on public.coach_notes
  for update
  to authenticated
  using (
    auth.uid() = (select user_id from public.coaches where id = coach_id)
  )
  with check (
    auth.uid() = (select user_id from public.coaches where id = coach_id)
  );

drop policy if exists coach_notes_delete_own on public.coach_notes;
create policy coach_notes_delete_own on public.coach_notes
  for delete
  to authenticated
  using (
    auth.uid() = (select user_id from public.coaches where id = coach_id)
  );

-- Un atleta nunca lee ni escribe las notas de su coach: no hay políticas para
-- el atleta en esta tabla, y RLS las deniega por defecto.
