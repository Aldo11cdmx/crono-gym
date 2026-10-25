-- CRONOS GYM - TEST HARNESS finalize_session (B.4)
-- NO EJECUTAR SIN REVISAR. Requiere entorno PostgreSQL aislado.
-- NO se ejecuta automáticamente.

-- NOTAS:
-- - auth.uid() en Supabase viene de JWT; en Postgres puro hay que simularlo.
-- - RLS depende de auth.uid() y políticas reales. Este script no reproduce RLS completo.
-- - Dos conexiones necesarias para prueba de concurrencia (ver comentarios).

-- PREPARACIÓN (requiere contexto aislado)
-- 1) Crear schema de pruebas: CREATE SCHEMA IF NOT EXISTS test_fs;
-- 2) Aplicar SOLO la migración 20261024010000_finalize_session_definitive.sql (no todo el historial)
-- 3) Crear usuarios/rutinas/ejercicios mínimos
-- 4) Para simular auth: usar SET LOCAL app.current_user_id = '<uuid>'; o función que lea auth.uid()

-- ESCENARIO 1: Finalización sesión propia
-- PREPARACIÓN:
--   - auth.uid() = u1
--   - Insertar workout_logs para u1 con p_log_id L1 (o dejar que RPC lo cree)
-- OPERACIÓN:
--   SELECT public.finalize_session(L1, u1, r1, null, now()-interval '1h', now(), 3600, 'nota', '[{"exercise_id":"0001","set_number":1,"weight":60,"reps":8,"rpe":8,"is_warmup":false}]'::jsonb);
-- COMPROBAR ANTES/DESPUÉS:
--   SELECT * FROM public.workout_logs WHERE id=L1;
--   SELECT * FROM public.completed_sets WHERE log_id=L1 ORDER BY set_number;
-- ESPERADO: éxito, sets insertados, exercise_id '0001' preservado

-- ESCENARIO 2: Intento modificación sesión ajena
-- PREPARACIÓN: log L2 pertenece a u2, auth.uid() = u1
-- OPERACIÓN: misma llamada con p_log_id=L2, p_user_id=u1
-- ESPERADO: excepción not_owner, sin cambios en L2/sets

-- ESCENARIO 3: Dos conexiones concurrentes mismo p_log_id
-- REQUIERE: conexión A y conexión B simultáneas
-- CONEXIÓN A: BEGIN; SET LOCAL ... auth.uid() = u1; SELECT ... (adquiere advisory lock)
-- CONEXIÓN B: BEGIN; intenta misma llamada mientras A mantiene transacción
-- ESPERADO: B espera lock, luego según orden uno tiene éxito otro falla o idempotente

-- ESCENARIO 4: Fallo validación preserva datos
-- PREPARACIÓN: log L4 con sets existentes válidos
-- OPERACIÓN: llamar con sets que contienen exercise_id inexistente
-- COMPROBAR: sets originales intactos
-- ESPERADO: excepción, rollback, sin cambios

-- ESCENARIO 5: Fallo durante inserción y rollback completo
-- PREPARACIÓN: log L5 válido
-- OPERACIÓN: último elemento con tipo inválido
-- ESPERADO: rollback completo

-- ESCENARIO 6: p_sets = NULL / no-array / []
-- NULL: excepción invalid_sets_payload
-- '[]'::jsonb: éxito, borra sets
-- '{}'::jsonb: excepción invalid_sets_payload

-- ESCENARIO 7: Reintento idempotente
-- Llamar dos veces con misma petición → segunda reemplaza sets correctamente

-- ESCENARIO 8: Rutina no autorizada
-- p_routine_id de otra cuenta → routine_not_authorized

-- ESCENARIO 9: anon y usuario incorrecto
-- Sin auth o p_user_id != auth.uid() → not_authenticated/not_owner

-- ESCENARIO 10: exercise_id '0001' conservado
-- Verificar tipo texto y ceros preservados

-- NOTAS DE SEGURIDAD:
-- - NO usar DELETE/TRUNCATE en tablas globales
-- - Crear datos SOLO en schema test o con prefijo test_
-- - Limpiar únicamente datos creados por estas pruebas
-- - NO modificar roles/privilegios globales
-- - advisory lock requiere hashtextextended compatible con tipo bigint (verificar)
