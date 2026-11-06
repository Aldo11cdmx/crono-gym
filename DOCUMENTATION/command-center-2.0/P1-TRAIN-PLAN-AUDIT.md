# P1 — Auditoría de integración Train + Plan (Command Center 2.0)

## 1. Resumen ejecutivo

Esta auditoría es solo de lectura. No se modificó código de producción, tests, persistencia, navegación ni catálogo. El objetivo es mapear el estado real de Train y Plan, su conexión actual con Today y Progress, y proponer una arquitectura objetivo + roadmap incremental antes de cualquier implementación.

Estado general:
- **Train:** implementación real y funcional (ActiveWorkout + RestTimer + ActiveSessionContext + offline draft). Es el corazón operativo de la app.
- **Plan:** RoutinesPage + WeeklyPlanner implementados, con asignaciones semanales y arranque de entrenamiento desde rutina.
- **Today:** ya consume sesión activa, borrador recuperable, PRs reales y historial reciente (P0 cerrado).
- **Progress:** existe como vista, pero la conexión formal Train→Progress depende de `workout_logs`/`completed_sets` sincronizados vía `finalize_session`.
- **Flujo Plan→Today→Train→Progress:** parcialmente cableado; Today ya sugiere rutina (`suggestedRoutine`) y arranca sesión (`startSession`), pero la selección de día/plan no está completamente reflejada en el hero ni en el CTA de Train.

## 2. Estado real de Train

### Componentes principales
- `src/components/ActiveWorkout.tsx` — pantalla de entrenamiento activo.
- `src/components/ActiveWorkoutHeader.tsx` — cabecera de sesión.
- `src/components/RestTimer.tsx` + `src/lib/workout/restTimer.ts` — temporizador basado en deadline absoluto.
- `src/components/SetLoggerRow.tsx`, `FinishWorkoutButton.tsx`, `WarmupPyramidSection.tsx`.
- `src/components/workout/*` — subcomponentes de sets/ejercicios.
- `src/components/ActiveWorkoutPill` / barra flotante de sesión (shell).

### Hooks / contextos / modelos
- `ActiveSessionContext` (`session`, `isActive`, `start`, `end`, `recoverableDraft`, `restoreDraft`, `discardDraft`, `rehydrating`).
- `usePreviousPerformance`, `useActiveSetProgress`, `useAthletePRs`.
- `src/lib/workout/*` (setKind, weightUtils, restTimer).
- `src/lib/offlineStore.ts` (`saveDraft`, `loadRecoverableDraft`, `deleteDraft`), `sessionSync.ts` (`queueAndSync`, `drainQueue`, `finalize_session`).

### Flujo de sesión
1. Inicio: `start({ id, title })` desde Today/Plan o rutina sugerida; genera `logId` en cliente.
2. Durante: series se registran en memoria + IndexedDB (`saveDraft`); descanso anclado a `endsAt`.
3. Finalización: `end()` → `enqueueFinalize` → RPC `finalize_session` (upsert `workout_logs`, replace `completed_sets`, PRs).
4. Recuperación: `loadRecoverableDraft` al montar → `recoverableDraft` → UI "Sesión interrumpida" (P0).

### Offline
- Guardado de borrador y cola de finalización funcionan sin red; estado de sync visible (`useOfflineSync`).

### Persistencia Supabase
- `workout_logs`, `completed_sets` vía `finalize_session` (idempotente por `logId`).

### Parcial / experimental
- `SetKind` `drop`/`failure` solo UI, no persistido (solo `is_warmup`).
- `RIR` derivado (`10 - RPE`), no columna.
- `RoutineBuilder.tsx` deprecado (usar Sheet de RoutinesPage).

## 3. Estado real de Plan

### Componentes
- `src/components/dashboard/RoutinesPage.tsx` (página de rutinas).
- `src/components/dashboard/WeeklyPlanner.tsx`, `WeeklyPlanEditor.tsx`.
- Subcomponentes: `RoutineCard`, `DayCarousel`, `DaySessionDetail`, `ExercisePickerModal`, `ExerciseSwapModal`, `AssignmentHistory`.
- `src/components/routines/*`.

### Hooks / modelos
- `useRoutines`, `useGymData`, `useExerciseCatalog`.
- `src/lib/dashboard/dashboardMetrics` (getWeeklyPlan, getNextSuggestedRoutine, etc.).
- `src/lib/routines/*` (save, swap, assignment history).

### Datos Supabase
- `routines`, `routine_exercises` (con `dayIndex`, `dayLabel`), asignaciones por usuario/coach.
- RLS por `user_id`; coach asigna vía `coach_session_requests`/rutinas asignadas.

### Funcionalidades
- Crear/editar/duplicar rutinas, asignar a días, plan semanal, cambio de ejercicios, deshacer.
- Iniciar entrenamiento desde rutina (navega a Train con rutina seleccionada).

### Incompleto / inconsistente
- Múltiples escritores de rutinas históricamente (audit: seis); consolidación parcial.
- Estado "pendiente/completado/no realizado" por día no siempre derivado de `workout_logs`.
- `RoutineBuilder.tsx` deprecado coexistiendo.

## 4. Mapa de integración actual Today↔Plan↔Train

- Today (`useDashboardHome`) calcula `suggestedRoutine` vía `getNextSuggestedRoutine(planSummary, sessions, now)` y `dailyFocus`.
- `handlePrimary` en DashboardPage: si no hay sesión activa, llama `data.startSession({id,title})` del suggested y navega a `/entrenar`.
- Plan (RoutinesPage) permite iniciar entrenamiento desde rutina asignada a un día.
- Train (`ActiveWorkout`) consume `ActiveSessionContext.session` (rutinaId) y carga ejercicios de la rutina.

**Lo que funciona:** arranque desde Today con rutina sugerida; arranque desde Plan; recuperación de borrador; finalización idempotente.

**Lo que falta:** reflejar el día programado en Today (qué rutina toca hoy por plan semanal), estados por día (completado/no realizado) derivados de sesiones reales, y un único CTA coherente entre Today y Plan.

## 5. Contratos y fuentes de verdad

| Dato | Origen | Hook/owner | Consumidores |
|---|---|---|---|
| Sesión activa | ActiveSessionContext (memoria + IndexedDB draft) | ActiveSessionContext | Today, Train, Pill |
| Borrador recuperable | IndexedDB `cronos-offline` | ActiveSessionContext | Today |
| Rutinas | Supabase `routines`/`routine_exercises` | useRoutines | Plan, Today |
| Plan semanal | routine_exercises.dayIndex/dayLabel | useRoutines + dashboardMetrics | Plan, Today |
| Sesiones completadas | Supabase `workout_logs`/`completed_sets` | useDashboardSessions | Today, Progress |
| PRs | derivados de completed_sets | useAthletePRs/getRecentPRs | Today, Progress |

Regla: un solo dueño por dato; no duplicar consultas ni estados.

## 6. Riesgos y dependencias

- **Riesgo alto:** múltiples escritores de rutinas (consolidación incompleta) → posibles inconsistencias en plan semanal.
- **Riesgo alto:** estado por día no derivado de sesiones reales → UI puede mentir sobre completado.
- **Riesgo medio:** `SetKind` no persistido → pérdida de semántica de series drop/failure.
- **Riesgo medio:** rehidratación/cambio de usuario ya endurecido en P0 (requestIdRef).
- **Dependencia:** Progress necesita `workout_logs` sincronizados; no bloquear P1 por Progress (solo preparar contratos).

## 7. Arquitectura objetivo

- **Today:** panel de comando diario. Muestra sesión activa/borrador/rehidratación, rutina del día (por plan semanal), PRs, historial, progreso semanal. CTA único para iniciar/continuar.
- **Plan:** gestión y programación de rutinas. Vista semanal con estados por día (pendiente/completado/no realizado) derivados de sesiones reales. Acceso directo al entrenamiento del día.
- **Train:** experiencia inmersiva de sesión. Una sola implementación (ActiveWorkout). Series, descansos, recuperación, finalización idempotente.
- **Contratos compartidos:** `ActiveSession` (id, routineId, startedAt), `RoutineSummary`, `DashboardSession`, plan semanal derivado de `routine_exercises`.
- **Navegación:** `/inicio`, `/rutinas`, `/entrenar` (sin cambios de rutas).
- **Offline-first:** conservar draft + cola; estados visibles.

## 8. Propuesta de experiencia

- Train: inmersivo, barra de sesión siempre visible, registro ≤2 taps, descansos con deadline, recuperación segura, finalización clara.
- Plan: vista semanal L-D con pills 44px, estados con icono+texto, menú de opciones secundarias, deshacer.
- Today: jerarquía clara, un solo CTA primario, tarjetas solo cuando aportan información, sin saturación.

## 9. Roadmap P1 (fases)

1. **P1.1 — Contrato de día programado:** derivar "rutina de hoy" desde plan semanal en Today (sin nuevas consultas; reusar useRoutines + dashboardMetrics). Tests unitarios.
2. **P1.2 — Estados por día en Plan:** derivar completado/no realizado desde workout_logs reales. Tests.
3. **P1.3 — CTA coherente:** unificar arranque desde Today y Plan hacia Train con la misma rutina. Tests de integración.
4. **P1.4 — Refuerzo de recuperación:** asegurar que borrador interrumpido se distingue de sesión activa en ambos entry points. Tests.
5. **P1.5 — Preparación Progress:** exponer contrato de datos (workout_logs/completed_sets) para Progress sin cambiar persistencia. Tests de contrato.

Cada fase: cambios incrementales, tests de regresión, typecheck, sin commits hasta aprobación.

## 10. Preguntas para producto

1. ¿El estado "no realizado" de un día debe mostrarse automáticamente al día siguiente, o solo al cerrar el día?
2. ¿Plan debe permitir iniciar un entrenamiento distinto al programado sin romper la planificación?
3. ¿Today debe mostrar solo la rutina sugerida o también alternativas del plan semanal?
4. ¿Se requiere persistir `SetKind` (drop/failure) en P1 o se pospone a una migración posterior?
5. ¿Progress debe consumir datos en tiempo real o solo tras sincronización completa?

## 11. Archivos inspeccionados (principales)
- `src/lib/router.tsx`, `src/components/shell/navItems.ts`
- `src/components/ActiveWorkout.tsx`, `src/components/ActiveWorkoutHeader.tsx`, `src/components/RestTimer.tsx`
- `src/context/ActiveSessionContext.tsx`
- `src/components/dashboard/RoutinesPage.tsx`, `src/components/dashboard/WeeklyPlanner.tsx`, `src/components/dashboard/DashboardPage.tsx`
- `src/lib/dashboard/dashboardHomeModel.ts`, `src/lib/dashboard/dashboardMetrics.ts`
- `src/hooks/useDashboardSessions.ts`, `src/hooks/useRoutines.ts`
- `src/lib/offlineStore.ts`, `src/lib/sessionSync.ts`

## 12. Confirmación
No se modificó código de producción, tests, persistencia, navegación, catálogo ni mapeo biomecánico. No se crearon commits ni push. Esta auditoría es solo de lectura + documentación.
