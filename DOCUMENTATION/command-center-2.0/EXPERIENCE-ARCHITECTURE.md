# Cronos Gym — Experience Architecture

## A. Today (Command Center)
- Propósito: centro de mando diario.
- Componentes: TrainingHeroSection, WeeklyProgressSection, TipSection, CoachBanner, (futuro) PRSection, HistorySection.
- Datos disponibles: greeting, heroRoutineSummary, weeklyProgress, weeklyPlan, muscleCounts, activeSession, rehydrating, announcements.
- Datos faltantes: PRs visibles, historial visible, heatmap.
- Acciones: Comenzar/Continuar entrenamiento, reintentar, siguiente tip, solicitar rutina.
- Prioridad: P0.

## B. Train
- Propósito: ejecución de sesión.
- Componentes: ActiveWorkoutView, SetTable, RestTimer, ActiveWorkoutPill.
- Datos: ActiveSessionContext, SessionDraft.
- Acciones: registrar set, terminar, descartar.
- Prioridad: P0 (ya implementado).

## C. Plan
- Propósito: planificación semanal.
- Componentes: RoutinesPage, WeeklyPlanner, RoutineCard.
- Datos: routines, routine_exercises, weekly plan.
- Acciones: crear/editar/duplicar rutina, asignar día.
- Prioridad: P1.

## D. Progress
- Propósito: evolución.
- Componentes: ProgressPage (parcial), futuro PRChart, HistoryList.
- Datos: workout_logs, completed_sets, PRs calculados.
- Acciones: ver historial, ver PRs.
- Prioridad: P1.

## E. Coach
- Propósito: acompañamiento.
- Componentes: CoachDashboard, AthleteDetailView, CoachBanner.
- Datos: coaches, coach_session_requests, coach_messages, profiles.
- Acciones: solicitar rutina, chatear.
- Prioridad: P2 (verificar RLS antes).

## F. Profile
- Propósito: cuenta y preferencias.
- Componentes: ProfilePage, GymSettings.
- Datos: profiles, availableEquipment, myGymEquipment.
- Acciones: editar perfil, equipamiento.
- Prioridad: P2.

## Navegación
- Mobile: BottomNav (fijo, ≤2 taps). Desktop: AppShell sidebar + grid. Sin duplicar controles.