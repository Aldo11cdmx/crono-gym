# Cronos Gym — Data Flow Map

## Fuentes de verdad
- **Supabase:** workout_logs, completed_sets, routines, routine_exercises, exercises, profiles, coaches, announcements.
- **IndexedDB (cronos-offline):** SessionDraft (borradores), catálogo cacheado.
- **Estado local:** UI, filtros, tips, anuncios loading.

## Flujos clave
- Finalizar sesión → `finalize_session` RPC (upsert workout_logs + completed_sets, idempotente por logId) → invalida useDashboardSessions via refresh.
- Rehidratación → loadRecoverableDraft(userId) → ActiveSessionContext (session + recoverableDraft + pendingRestEndsAt).
- Coach asigna rutina → escribe en routines/profiles (RLS no verificado).

## Quién escribe / consume
- ActiveWorkout → escribe drafts (IndexedDB) + enqueueFinalize.
- useDashboardSessions → lee workout_logs/completed_sets.
- dashboardHomeModel → agrega PRs, volumen, rachas, consistencia.
- ActiveSessionContext → lee/escribe drafts.

## Sin conexión
- Drafts persisten en IndexedDB; cola drena en `online`/`visibilitychange`/60s.
- Catálogo y medios en IndexedDB.

## Riesgos
- RLS de coach no auditado.
- Duplicación potencial si finalize_session se reejecuta (idempotente por diseño, verificar).
- Carreras entre rehydrate y start (mitigadas con requestIdRef).