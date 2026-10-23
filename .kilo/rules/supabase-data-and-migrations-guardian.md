# Supabase Data and Migrations Guardian
> Se activa cuando: `supabase/schema.sql`, `supabase/migrations/**`, `src/types/supabase.ts`, queries `.from(...)`, políticas RLS, Edge Functions.

## Misión
Esquema, políticas y tipos consistentes, versionados, reversibles y compatibles con clientes offline antiguos.

## Framework de Decisión
1. ¿Hay migración versionada (`supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`)?
2. ¿La tabla nueva tiene RLS activo y política por operación (`select/insert/update/delete`)?
3. ¿`src/types/supabase.ts` coincide con el DDL? (hoy `bodyweight_entries`, `body_measurements` y `session_checkins` están tipadas sin DDL: no asumas que existen)
4. ¿Un cliente con la cola offline vieja sigue funcionando tras el cambio?

## Patrones Obligatorios
- Toda alteración vía archivo de migración; idempotente (`create table if not exists`, políticas precedidas de `drop policy if exists`), como `20261003020000_coach_human.sql`.
- Tablas actuales: `exercises`, `routines`, `routine_exercises`, `workout_logs`, `completed_sets`, `profiles`, y las de coach (`coaches`, `coach_session_requests`, `coach_messages`, `coach_login_attempts`, `coach_rate_limits`, `coach_usage`). Verifica en `schema.sql` y migraciones.
- Datos por usuario: columna `user_id` + política con `auth.uid()`. Coach/Edge Functions: validar rol en servidor.
- Cambios aditivos primero; destructivos en dos pasos (deprecar → migrar datos → eliminar). Cambiar el tipo de una columna usada por `FinalizePayload` exige plan de compatibilidad con la cola offline.
- Tras migrar: actualizar `src/types/supabase.ts`, y los tests que lo usan.
- Consultas: columnas explícitas, `.limit()` donde aplique, sin N+1; `numeric` llega como string (normalizar).
- Persistir `SetKind` (`drop`/`failure`) o `durationSec`/`distanceM` requiere migración y revisar el importador CSV (`lib/import/*`).

## Cómo debe responder Kilo
Entrega: SQL de migración + política RLS + rollback + impacto en tipos y en la cola offline. Si no puede ejecutarlo contra el proyecto, di que queda sin aplicar.

## Comportamiento Proactivo
- Señala `select("*")`, falta de índices para consultas reales y tablas tipadas sin DDL.
- Propone vistas/RPC cuando una consulta repetida es compleja.
- Revisa la coherencia `schema.sql` vs migraciones (¿cuál es la fuente?) y propone consolidar.

## Anti-patrones
- Cambiar el esquema desde el dashboard sin archivo de migración.
- Tabla sin RLS; política `using (true)` sobre datos de usuario.
- Renombrar/eliminar columnas que la cola offline aún envía.
- Secretos en migraciones.

## Checklist
- [ ] Migración versionada e idempotente
- [ ] RLS + política por operación
- [ ] `src/types/supabase.ts` al día
- [ ] Compatible con la cola offline
- [ ] Rollback descrito
