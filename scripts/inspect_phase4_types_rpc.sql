-- FASE 4: CONSULTAS SOLO LECTURA PARA VERIFICAR TIPOS Y RPC
-- Ejecutar en Supabase Dashboard → SQL Editor (proyecto xghhxyairaopppimnxrd)

-- 1) Tipos de columnas clave
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('exercises','completed_sets','workout_logs','routines')
  AND column_name IN ('id','exercise_id','user_id','routine_id','log_id')
ORDER BY table_name, column_name;

-- 2) Claves foráneas
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('completed_sets','workout_logs','routines')
ORDER BY tc.table_name;

-- 3) Definición de finalize_session
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS security_definer,
  p.proconfig AS search_path_config,
  pg_get_userbyid(p.proowner) AS owner,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'finalize_session';

-- 4) Privilegios
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  (aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner)))).grantee AS grantee_oid,
  pg_get_userbyid((aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner)))).grantee) AS grantee,
  (aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner)))).privilege_type AS privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'finalize_session';
