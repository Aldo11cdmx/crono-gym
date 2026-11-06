# Implementation Plan

## P0 — Today Command Center
- Nueva jerarquía visual.
- Hero contextual (ya extraído).
- Sesión activa y recuperación.
- Progreso semanal (ya extraído).
- PRs (diseñar UI con datos reales).
- Historial resumido (diseñar UI con datos reales).
- Cobertura muscular.
- Integración con navegación.

## P1 — Áreas conectadas
- Train, Plan, Progress.
- Sincronización de estados.
- Experiencia responsive completa.

## P2 — Ecosistema avanzado
- Coach (verificar RLS primero).
- Mejoras de analítica.
- Notificaciones solo si hay soporte real.

## Archivos P0
- src/components/dashboard/DashboardPage.tsx
- src/components/dashboard/sections/* (nuevos)
- src/lib/dashboard/dashboardHomeModel.ts (sin cambios de contrato)

## Riesgos
- RLS coach no auditado.
- Fallos preexistentes AppShell/ShiftPanel.
- Notificaciones sin soporte verificado.

## Criterios de aceptación
- Typecheck 0.
- Tests del área en verde.
- Sin datos ficticios.
- RLS verificado para coach.