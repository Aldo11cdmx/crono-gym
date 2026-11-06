# Feature Keep / Improve / Replace

## CONSERVAR
- ActiveSessionContext (rehidratación, guards, retry).
- useDashboardSessions (invalidación, set_number).
- dashboardHomeModel (PRs, volumen, rachas).
- Temporizador por deadline (restTimer).
- Catálogo bajo demanda (catalogLoader).
- Offline-first (drafts, cola).
- WeeklyProgressSection, TipSection, TrainingHeroSection (extraídos).

## MEJORAR
- DashboardPage: jerarquía visual, densidad.
- AppShell: pill de sesión (2 fallos preexistentes en jsdom).
- Progress: renderizar PRs e historial.

## INTEGRAR
- PRs e historial en Today (resúmenes compactos) y Progress (análisis completo).

## REEMPLAZAR
- Ninguno identificado (no rehacer sin necesidad).

## ELIMINAR
- Ninguno.

## INVESTIGAR
- Coach RLS (no auditado).
- Notificaciones push (soporte no verificado).