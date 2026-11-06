# Cronos Gym — Current State Audit

## Rutas (src/lib/router.tsx)
- `/` → DashboardPage (Today)
- `/train` → ActiveWorkoutView
- `/routines` → RoutinesPage
- `/progress` → ProgressPage
- `/coach` → CoachDashboard / AthleteDetailView
- `/profile` → ProfilePage

## Páginas implementadas
- DashboardPage (Today): hero, progreso semanal, coach banner, anuncios/tips.
- ActiveWorkoutView: ejecución de sesión, sets, timer.
- RoutinesPage + WeeklyPlanner: rutinas y plan semanal.
- ProgressPage: historial, PRs (parcial).
- CoachDashboard: portal coach.
- ProfilePage: perfil, equipamiento.

## Funcionalidades implementadas
- Sesión activa con rehidratación (ActiveSessionContext).
- Offline-first (IndexedDB drafts, cola finalize_session).
- Temporizador por deadline.
- Catálogo de ejercicios bajo demanda.
- RLS por usuario (sospecha: no auditado para coach).

## Parcialmente implementadas
- PRs: calculados en modelo, no renderizados en Dashboard.
- Historial de sesiones: cargado en useDashboardSessions, no visible en Dashboard.
- Anuncios: tabla `announcements`, UI en Dashboard.
- Coach: banner + modal de solicitud; portal separado.

## Solo UI (sin soporte real)
- Notificaciones push (no verificado soporte).
- Anuncios: dependen de tabla `announcements` (verificar RLS).

## No existentes
- Heatmap de consistencia visual.
- Timeline de PRs.
- Sustitución de ejercicios mid-sesión (parcial).