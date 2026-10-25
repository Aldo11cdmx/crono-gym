-- CRONOS GYM - TEST HARNESS EJECUTABLE finalize_session
\set ON_ERROR_STOP on

-- VARIABLES
\set u1 '00000000-0000-0000-0000-000000000001'
\set u2 '00000000-0000-0000-0000-000000000002'
\set r1 '10000000-0000-0000-0000-000000000001'
\set l1 '20000000-0000-0000-0000-000000000001'
\set l2 '30000000-0000-0000-0000-000000000002'
\set ex1 '0001'

-- SETUP REQUISITOS EN TABLAS
INSERT INTO auth.users (id, email) VALUES
  (:'u1'::uuid, 'test_u1@cronos.gym'),
  (:'u2'::uuid, 'test_u2@cronos.gym')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, name, body_part, target, equipment, gif_url)
VALUES (:'ex1', 'Press Test', 'chest', 'pectorals', 'barbell', 'https://localhost/test.gif')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.routines (id, user_id, title)
VALUES (:'r1'::uuid, :'u1'::uuid, 'Rutina Test')
ON CONFLICT (id) DO NOTHING;

BEGIN;

-- SIMULAR ROL AUTENTICADO Y JWT DE SUPABASE
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

-- TEST 1: Ejecución exitosa de finalize_session
SELECT public.finalize_session(
  p_log_id           => :'l1'::uuid,
  p_user_id          => :'u1'::uuid,
  p_routine_id       => :'r1'::uuid,
  p_name             => 'Sesion de Prueba'::text,
  p_started_at       => now() - interval '1 hour',
  p_ended_at         => now(),
  p_duration_seconds => 3600::integer,
  p_notes            => 'Notas de prueba'::text,
  p_sets             => '[{"exercise_id": "0001", "set_number": 1, "reps": 10, "weight": 50.0, "is_completed": true}]'::jsonb
);

COMMIT;

-- TEST 2: Verificación de persistencia atómica
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.workout_logs WHERE id = '20000000-0000-0000-0000-000000000001';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'TEST FAILED: El workout_log no fue creado';
  END IF;

  SELECT count(*) INTO v_count FROM public.completed_sets WHERE log_id = '20000000-0000-0000-0000-000000000001';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Los completed_sets no fueron creados';
  END IF;

  RAISE NOTICE 'SUCCESS: finalize_session ejecutado y verificado correctamente.';
END $$;

-- CLEANUP
DELETE FROM public.completed_sets WHERE log_id IN (:'l1'::uuid, :'l2'::uuid);
DELETE FROM public.workout_logs WHERE id IN (:'l1'::uuid, :'l2'::uuid);
DELETE FROM public.routines WHERE id = :'r1'::uuid;
DELETE FROM public.exercises WHERE id = :'ex1';
DELETE FROM auth.users WHERE id IN (:'u1'::uuid, :'u2'::uuid);
