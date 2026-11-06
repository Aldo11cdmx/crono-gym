# Data Contracts Audit

## Git state
- Branch: fix/p0-timer-and-session-draft
- HEAD: 8d32d7b (P0 commit)
- Working tree: untracked docs/images only; P0 changes committed.
- Ahead of origin: 1.

## PR contract
- Fuente: `dashboardHomeModel.ts` → `useAthletePRs` (max peso por ejercicio desde completed_sets).
- Campos disponibles: exerciseId, exerciseName, maxWeight, date (started_at del log).
- Limitación: solo peso máximo; no hay 1RM ni volumen por PR.
- Sin datos: retorna []. Estado empty manejable.

## History contract
- Fuente: `useDashboardSessions` → workout_logs (limit 30) + completed_sets + routines.
- Campos: id, startedAt, completedAt, routineId, routineTitle, sets[] (exerciseId, name, bodyPart, weight, reps, isWarmup, set_number).
- Orden: startedAt desc.
- Errores: setError + setLoading false. Loading: true inicial.
- Refresh: refresh() re-ejecuta.

## Session recovery contract
- Fuente: ActiveSessionContext (loadRecoverableDraft).
- Campos expuestos: session, isActive, recoverableDraft, rehydrating, recoveredLogId, pendingRestEndsAt.
- Guards: rehydratingRef, sessionRef, draftRef (pendiente).
- Retry: retryRehydrate().

## Muscle coverage contract
- Fuente: WeeklyVolumeCoverage + dashboardHomeModel (muscleCounts Map).
- Datos: body_part counts desde completed_sets join exercises.
- Unidades: conteo de sets por músculo.

## Tipos reutilizables
- `DashboardHomeData`, `ActiveSessionValue`, `SessionDraft`, `DashboardSession`.