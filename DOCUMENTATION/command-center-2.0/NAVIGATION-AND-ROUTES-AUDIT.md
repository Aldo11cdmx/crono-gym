# Navigation and Routes Audit

## Rutas verificadas
- `/` → DashboardPage (Today)
- `/train` → ActiveWorkoutView
- `/routines` → RoutinesPage
- `/progress` → ProgressPage
- `/coach` → CoachDashboard
- `/profile` → ProfilePage

## Componentes de navegación
- AppShell: layout shell, monta BottomNav + MobileNav.
- BottomNav: navegación móvil (breakpoint).
- MobileNav: navegación desktop.

## Constantes
- PROGRESS_PATH, TRAIN_PATH definidos en `navItems.ts` (verificado por import en DashboardPage).

## Clasificación
- Implementado y funcional: Train, Plan, Profile.
- Parcialmente implementado: Progress (PRs/historial no visibles en Dashboard).
- Pendiente de verificar: Coach RLS.

## Coherencia responsive
- Mobile: BottomNav fijo. Desktop: AppShell sidebar. Sin duplicar controles (CSS).