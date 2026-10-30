-- Cronos — avatar de atleta, gestión de ejercicios por el coach y plantillas de rutina.
--
-- Cambios aditivos: ninguna columna existente se altera ni se borra, así un cliente
-- con la cola offline vieja sigue funcionando tras aplicarlo.

-- ---------------------------------------------------------------------------
-- 1. avatar_url en profiles.
--    Solo lectura desde el cliente (no está en la concesión UPDATE de profiles).
--    El service role / panel de administración la escribe; el cliente la muestra
--    con fallback al asset del proyecto cuando es nula o falla la carga.
-- ---------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists avatar_url text;

-- ---------------------------------------------------------------------------
-- 2. Ejercicios: soft-delete del catálogo y nombre en español (coach).
--    `is_active` / `is_hidden` ocultan el ejercicio del selector al armar nuevas
--    rutinas sin borrar el historial de series pasadas (`completed_sets` referencia
--    `exercises.id`, que se conserva).
-- ---------------------------------------------------------------------------
alter table if exists public.exercises
  add column if not exists is_active boolean not null default true,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists name_es text;

create index if not exists idx_exercises_is_active on public.exercises (is_active);
create index if not exists idx_exercises_is_hidden on public.exercises (is_hidden);

-- El coach (public.is_coach()) renombra y oculta ejercicios. Se concede UPDATE
-- solo en las columnas que escribe; la política RLS la restringe a coaches.
grant update (name, name_es, is_active, is_hidden) on public.exercises to authenticated;
drop policy if exists exercises_update_coach on public.exercises;
create policy exercises_update_coach
  on public.exercises
  for update
  to authenticated
  using (public.is_coach())
  with check (public.is_coach());

-- El coach puede crear ejercicios nuevos en el catálogo (INSERT).
grant insert on public.exercises to authenticated;
drop policy if exists exercises_insert_coach on public.exercises;
create policy exercises_insert_coach
  on public.exercises
  for insert
  to authenticated
  with check (public.is_coach());

-- ---------------------------------------------------------------------------
-- 3. Rutinas: marca de plantilla base clonable al plan de un atleta.
-- ---------------------------------------------------------------------------
alter table if exists public.routines
  add column if not exists is_template boolean not null default false;

create index if not exists idx_routines_is_template on public.routines (is_template);

-- Cualquier coach autenticado puede leer plantillas globales (is_template = true),
-- sin importar quién las creó. Las plantillas propias siguen bajo la política
-- routines_crud_own (auth.uid() = user_id).
drop policy if exists routines_select_templates on public.routines;
create policy routines_select_templates
  on public.routines
  for select
  to authenticated
  using (is_template = true);
