# Cronos Gym — Risks and Dependencies

## Riesgos
- RLS de coach/athlete no auditado (riesgo de fuga de datos).
- Fallos preexistentes en AppShell (2 tests) y ShiftPanel (role checkbox→switch) no relacionados con P0.
- Carreras entre rehydrate y start (mitigadas con requestIdRef en ActiveSessionContext).
- Pérdida de borradores si IndexedDB no disponible (degrada a no-op, no rompe workout).
- Bundle size: entry chunk 270.87 kB gzip (bajo límite 300 kB).

## Dependencias
- `ActiveSessionContext` debe montarse por encima del router (ya así).
- `useDashboardHome` depende de `useActiveSession` (provider requerido).
- Coach features dependen de verificación RLS.
- Notificaciones dependen de soporte real (no verificado).

## Decisiones que requieren aprobación
- Verificar RLS antes de cualquier feature de coach.
- Confirmar soporte de notificaciones push antes de implementar.
- Definir si PRs/historial se renderizan en Dashboard o en Progress.