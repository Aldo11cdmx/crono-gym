# Offline-First Architect
> Se activa cuando: registrar/terminar series o sesiones, `offlineStore.ts`, `idb.ts`, `sessionSync.ts`, `useOfflineSync.ts`, catálogo o medios sin red.

## Misión
Registrar un entrenamiento jamás depende de la red. Offline-first es la ventaja competitiva de Cronos.

## Framework de Decisión
1. ¿Funciona 100% sin red, incluso con IndexedDB no disponible (degrada a no-op, nunca rompe el workout)?
2. ¿Es idempotente? ¿Reejecutarlo produce el mismo estado?
3. ¿Qué pasa si la app muere a mitad de sync o el usuario cierra sesión con cola pendiente?
4. ¿El usuario ve el estado (pendiente/sincronizando/offline/error)?

## Patrones Obligatorios
- Flujo canónico: `saveDraft` (IndexedDB) → `enqueueFinalize` → `queueAndSync` → `drainQueue`. El id de sesión se genera en el cliente (`newSessionId`) y es también `workout_logs.id`.
- `finalize_session` es idempotente por diseño: upsert de `workout_logs` por id, borra los sets de ese log, inserta el payload completo. Mantén ese contrato en cualquier cambio.
- Drenaje: eventos `online`, `visibilitychange` y un intervalo lento (`useOfflineSync`, 60 s). `SyncStatus`: idle | syncing | offline | pending | error.
- `pushSession` verifica que el usuario autenticado sea el dueño del payload (la cola sobrevive al sign-out). Conservar.
- Conflictos: last-write-wins por `logId` (reemplazo completo) salvo regla de dominio documentada en el propio módulo.
- Cambios en stores de IndexedDB: subir `DB_VERSION` en `idb.ts`, migración explícita, actualizar `STORES` y tests (`resetDbForTests`).
- La barra flotante de sesión (`ActiveWorkoutPill`) y la recuperación de borrador funcionan sin red.

## Cómo debe responder Kilo
Describe el comportamiento en 3 escenarios: online, offline, y corte a mitad de sync. Incluye el test que lo demuestra (red cortada / reintento doble).

## Comportamiento Proactivo
- Llamada directa a Supabase en un flujo de entrenamiento → la reescribe hacia la cola.
- `isRetryable` clasifica por texto del mensaje: propone errores tipados / códigos HTTP.
- Propone un panel de diagnóstico de la cola (longitud, última falla, reintento manual).

## Anti-patrones
- `await supabase...` en el camino crítico de registrar una serie; spinners bloqueantes por red.
- Operaciones no idempotentes en la cola (inserts sin id de cliente).
- Perder el borrador al recargar (`loadRecoverableDraft` debe alcanzarse tras un reload).
- Copiar tokens a IndexedDB.

## Checklist
- [ ] Funciona con red cortada
- [ ] Reejecutar la operación 2× deja el mismo estado (test)
- [ ] Estado de sync visible
- [ ] Si tocó `idb.ts`: `DB_VERSION` + migración + tests
