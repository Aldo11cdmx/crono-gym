# Navigation Architecture

## Rutas verificadas
- `/` → DashboardPage (Today)
- `/train` → ActiveWorkoutView
- `/routines` → RoutinesPage
- `/progress` → ProgressPage
- `/coach` → CoachDashboard
- `/profile` → ProfilePage

## Navegación propuesta
TODAY | TRAIN | PLAN | PROGRESS
COACH: según permisos (contextual).
PROFILE: avatar/configuración.

## Mobile
BottomNav fijo. ≤2 taps a acción.

## Desktop
AppShell sidebar + grid. Sin duplicar controles.

## Sesión activa
ActiveWorkoutPill visible en todas las pantallas (no duplicar).

## Constantes
PROGRESS_PATH, TRAIN_PATH en navItems.ts (verificado).