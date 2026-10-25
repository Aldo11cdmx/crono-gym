-- FASE G2: INSPECCIÓN REMOTA EN SOLO LECTURA
-- Ejecutar en Supabase Dashboard → SQL Editor (proyecto xghhxyairaopppimnxrd)

-- 1) Columnas de tablas relevantes
SELECT
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'workout_logs',
    'completed_sets',
    'routines',
    'exercises',
    'user_roles'
  )
ORDER BY table_name, ordinal_position;

-- 2) RLS habilitado/forzado
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'workout_logs',
    'completed_sets',
    'routines',
    'exercises',
    'user_roles'
  )
ORDER BY c.relname;

-- 3) Políticas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'workout_logs',
    'completed_sets',
    'routines',
    'exercises',
    'user_roles'
  )
ORDER BY tablename, policyname;

-- 4) Función finalize_session
SELECT
  p.proname AS function_name,
  n.nspname AS schema_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  l.lanname AS language,
  p.prosecdef AS security_definer,
  p.proconfig AS search_path_config,
  pg_get_userbyid(p.proowner) AS owner,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'finalize_session';

-- 5) Privilegios EXECUTE
SELECT
  p.proname,
  a.grantee,
  a.privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN information_schema.routine_privileges a
  ON a.specific_schema = n.nspname
 AND a.specific_name = p.proname || '_' || p.oid
WHERE n.nspname = 'public'
  AND p.proname = 'finalize_session';

-- 6) Claves/relaciones
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'workout_logs',
    'completed_sets',
    'routines',
    'exercises',
    'user_roles'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
