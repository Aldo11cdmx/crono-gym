# Transactional Sync & RLS Guardian
> Se activa cuando: tocas `supabase/migrations/`, `supabase/schema.sql`, `src/types/supabase.ts`, políticas RLS, llamadas RPC de Supabase, Edge Functions (`coach-assistant`, `coach-auth`), o la lógica de finalización y sincronización de sesiones (`sessionSync.ts`, `pushSession`).

## Misión
Garantizar la integridad transaccional absoluta de los datos de entrenamiento y la seguridad impenetrable del modelo multi-tenant en Supabase: un entrenamiento se persiste atómicamente (todo o nada, jamás una sesión sin series), cada usuario solo puede acceder a sus propios registros y las Edge Functions operan con privilegio mínimo.

## Principios Innegociables
1. **Transaccionalidad "Todo o Nada" (RPC):**
   - La finalización de una sesión de entrenamiento nunca debe realizarse mediante múltiples `INSERT` desacoplados desde el cliente (peligro de fallo de red a mitad del proceso).
   - Debe ejecutarse a través del procedimiento transaccional `finalize_session` (RPC en Postgres) que:
     - Realiza el upsert de `workout_logs`.
     - Inserta todas las filas de `completed_sets` asociadas.
     - Actualiza marcas personales (PRs) o hitos en la misma transacción.
     - Si cualquier set falla, la transacción completa hace rollback sin dejar filas huérfanas.
2. **RLS (Row Level Security) Hermético:**
   - Cada tabla en `public` (`workout_logs`, `completed_sets`, `routines`, `routine_exercises`, `bodyweight_entries`, etc.) debe tener `ENABLE ROW LEVEL SECURITY`.
   - Las políticas deben forzar: `auth.uid() = user_id` para `SELECT`, `INSERT`, `UPDATE` y `DELETE`.
   - Prohibido crear políticas `USING (true)` en tablas que contengan datos de atletas.
3. **Seguridad en Edge Functions:**
   - Validar siempre el token JWT del usuario (`Bearer <token>`) extrayendo el `auth.uid()`.
   - La clave `SERVICE_ROLE_KEY` solo puede usarse en entornos de backend estrictamente controlados, nunca retornarse al cliente ni incluirse en respuestas HTTP.
   - Encabezados CORS seguros restringidos al origen de la app.

## Patrones Obligatorios
- **Llamada Canónica a RPC de Finalización:**
  ```ts
  const { data, error } = await supabase.rpc("finalize_session", {
    p_log_id: payload.logId,
    p_user_id: payload.userId,
    p_routine_id: payload.routineId,
    p_name: payload.name,
    p_started_at: payload.startedAt,
    p_ended_at: payload.endedAt,
    p_duration_seconds: payload.durationSeconds,
    p_notes: payload.notes,
    p_sets: payload.sets, // Array JSON validado
  });
  ```
- **Idempotencia:**
  - El `p_log_id` se origina en el cliente mediante UUIDv4 (`newSessionId()`). Reejecutar el RPC con el mismo id reemplaza limpiamente el payload sin duplicar sesiones.
- **Sincronización de Tipos TypeScript:**
  - Cualquier cambio en una tabla o migración debe reflejarse inmediatamente en `src/types/supabase.ts`.
  - Los tipos de columna deben ser exactos (ej. pesos numéricos como `number`, no asumir casting implícito).

## Cómo debe responder Kilo
1. Presenta la migración SQL con su contraparte de reversión (down migration).
2. Muestra las políticas RLS correspondientes y describe qué usuario puede leer o escribir.
3. Comprueba que el tipo de datos generado en TypeScript (`supabase.ts`) coincida con las columnas del esquema.

## Comportamiento Proactivo
- Detecta inserciones encadenadas (`await supabase.from('workout_logs').insert(...); await supabase.from('completed_sets').insert(...)`) y propone migrarlas a una transacción RPC.
- Audita tablas nuevas en `supabase/migrations/` y avisa inmediatamente si falta la política RLS o el trigger de `updated_at`.
- Revisa que ningún log o mensaje de error exponga el token JWT o datos sensibles del usuario.

## Anti-patrones
- Operaciones no atómicas para registrar entrenamientos en la nube.
- Políticas RLS permisivas que permitan a un usuario leer entrenamientos de otro.
- Dejar columnas tipadas en `supabase.ts` sin DDL en Postgres (ej. `bodyweight_entries` sin tabla real).
- Ejecutar migraciones destructivas (`DROP TABLE`, `ALTER TABLE ... DROP COLUMN`) sin plan de backup o compatibilidad hacia atrás.

## Checklist
- [ ] Transaccionalidad garantizada por RPC para guardar sesiones
- [ ] RLS activado y verificado en todas las tablas (`auth.uid() = user_id`)
- [ ] `src/types/supabase.ts` sincronizado con las migraciones
- [ ] Operación idempotente por `logId` generado en cliente
- [ ] Cero exposición de `SERVICE_ROLE_KEY` en código cliente
