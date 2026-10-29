-- Índices para el portal del coach y métricas del atleta.
--
-- Generado a partir de `src/types/supabase.ts` (fuente de verdad de columnas).
-- Cada índice cubre una consulta real de la codebase:
--   - AthleteDetailView: profiles, coach_session_requests, athlete_phases, coach_notes
--   - CoachPortal: profiles
--   - saveCoachRoutine: routines, routine_exercises

-- Chat del coach: las peticiones de un atleta, ordenadas por la más reciente.
create index if not exists idx_coach_session_requests_athlete_created
  on public.coach_session_requests (athlete_id, created_at desc);

-- Cola del coach: las peticiones asignadas a un coach, ordenadas.
create index if not exists idx_coach_session_requests_coach_created
  on public.coach_session_requests (coach_id, created_at desc);

-- Transcripto del chat: mensajes de una petición, orden cronológico.
create index if not exists idx_coach_messages_request_created
  on public.coach_messages (request_id, created_at);

-- Notas privadas del coach: busca por atleta y coach.
create index if not exists idx_coach_notes_athlete_coach
  on public.coach_notes (athlete_id, coach_id);

-- Fase de entrenamiento: una fila por atleta.
create index if not exists idx_athlete_phases_athlete
  on public.athlete_phases (athlete_id);

-- Biblioteca de rutinas de un atleta, ordenadas por creación.
create index if not exists idx_routines_user_created
  on public.routines (user_id, created_at desc);

-- Limpieza compensatoria del coach: rutinas que él mismo autorizó.
create index if not exists idx_routines_authored_by_coach
  on public.routines (authored_by_coach);

-- Ejercicios de una rutina (relectura de plan).
create index if not exists idx_routine_exercises_routine
  on public.routine_exercises (routine_id);

-- Índices de métricas y perfiles del atleta.
create index if not exists idx_profiles_user_id on public.profiles (user_id);
create index if not exists idx_bodyweight_entries_user_measured
  on public.bodyweight_entries (user_id, measured_on);
create index if not exists idx_body_measurements_user_measured
  on public.body_measurements (user_id, measured_on);

-- Trigger de updated_at automático en profiles (si no existe la función).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
