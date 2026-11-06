# Cronos Gym — Preparación técnica del Dashboard Command Center

## 1. Estado real de Git

- **Rama actual:** `fix/p0-timer-and-session-draft`
- **Cambios sin commitear:** 5 archivos modificados + 3 imágenes nuevas + 1 directorio untracked.
- **Commits locales pendientes de push:** ninguno reportado (rama al día con origin).
- **Cambios sin guardar relacionados con P0 ActiveSessionContext y Dashboard:** sí, todos los cambios P0 están en working tree.

### Inventario de cambios

| Archivo | Tipo | Clasificación |
|---|---|---|
| `src/components/dashboard/DashboardPage.tsx` | Modificado | P0 Dashboard (guards rehydrating, navigate en in-progress) |
| `src/context/ActiveSessionContext.tsx` | Modificado | P0 ActiveSession (requestIdRef, retry, guards) |
| `src/context/ActiveSessionContext.test.tsx` | Modificado | P0 tests (17 + 8 nuevos) |
| `src/hooks/useDashboardSessions.ts` | Modificado | P0 Dashboard (requestId, set_number, catch) |
| `src/lib/dashboard/dashboardHomeModel.ts` | Modificado | P0 Dashboard (rehydrating) |
| `public/images/gym-equipment/CG-EQP-0075/0076/0077_*.jpg` | Nuevo | Ajenos al Dashboard (inventario equipamiento) |
| `DOCUMENTATION/exercise-equipment-mapping/` | Nuevo | Documentación de mapeo de equipamiento |

### Resumen de cambios relevantes
- P0 endureció recuperación de sesión (requestId, retry, guards) y protección de sesiones activas.
- DashboardPage ahora deshabilita CTA durante rehidratación y navega a TRAIN en in-progress.
- useDashboardSessions invalida respuestas obsoletas por usuario y ordena por set_number.
- Cambios mezclados en un solo archivo: `useDashboardSessions.ts` mezcla tipado (`set_number`) con lógica de invalidación; recomendable separar en PRs.

### Archivos ajenos al Dashboard
- Imágenes CG-EQP-0075/0076/0077 y `DOCUMENTATION/exercise-equipment-mapping/`. No tocar.

## 2. Auditoría técnica del Dashboard

### Inventario de archivos y responsabilidades

| Archivo | Responsabilidad | Fuente de datos | Estado |
|---|---|---|---|
| `DashboardPage.tsx` | Orquestador de vista, CTA, progreso semanal, tip, PRs, historial | `useDashboardHome`, `useActiveSession` | Real |
| `dashboardHomeModel.ts` | Agregación: PRs, volumen, rachas, consistencia, activeSession | Supabase (logs/sets) + ActiveSessionContext | Real/calculado |
| `useDashboardSessions.ts` | Carga hasta 30 sesiones completadas + sets + rutinas | Supabase | Real |
| `ActiveSessionContext.tsx` | Sesión viva, rehidratación, borradores | IndexedDB (offlineStore) | Real |
| `AppShell.tsx` | Layout shell, monta navegaciones | useActiveSession (isActive) | Real |
| `BottomNav.tsx` / `MobileNav.tsx` | Navegación móvil/desktop | useActiveSession (session) | Real |
| `WeeklyVolumeCoverage.tsx` | Cobertura semanal por músculo | datos de useDashboardSessions | Calculado |
| `RoutinesPage.tsx` | Gestión de rutinas, inicio de sesión | Supabase routines + ActiveSessionContext.start | Real |
| `WeeklyPlanner.tsx` | Planificación semanal | Supabase routines/plans | Real |
| `CoachFloatingButton.tsx` / `AthleteDetailView.tsx` | Interacción coach | Supabase coach tables (RLS no verificado) | Sospechoso |

### Contratos
- `useDashboardHome(userId)` → `DashboardHomeData` (incluye `rehydrating`, `activeSession`, `isSessionActive`).
- `useDashboardSessions(userId)` → `{ sessions, loading, error, refresh }`.
- `ActiveSessionContext` → `{ session, isActive, start, end, rehydrate, retryRehydrate, ... }`.
- `start(routine | null)` rechaza si rehydrating, sesión activa o borrador pendiente.

### Consultas Supabase
- `workout_logs` (limit 30, completed_at not null) + `routines` (batch titles) + `completed_sets` (batch por logIds). Sin N+1 evidente.
- Columnas explícitas (no `select("*")`).

### Estados
- loading: `useDashboardSessions.loading`.
- empty: sin sesiones / sin rutina.
- error: `useDashboardSessions.error`.
- rehydrating: `ActiveSessionContext.rehydrating` (expuesto en DashboardHomeData).

### RLS
- No verificado en esta auditoría. Sospecha: políticas de `profiles` para coach/athlete no auditadas. Recomendación: verificar antes de Command Center.

### Accesibilidad
- CTA con `aria-label` implícito via texto. Botones solo-icono en BottomNav requieren verificación (sospecha).

### Dependencias para extracción segura
- `useDashboardHome` depende de `useActiveSession` (provider requerido).
- `DashboardPage` depende de router (`useNavigate`) y contextos.

## 3. Arquitectura propuesta del Command Center

### Estructura de carpetas
```
src/
  features/
    dashboard/
      DashboardPage.tsx
      sections/
        WeeklyProgressSection.tsx
        SessionHistorySection.tsx
        PRSection.tsx
        CoachSection.tsx
        TipSection.tsx
      hooks/
        useDashboardHome.ts  (mover desde lib/dashboard)
        useDashboardSessions.ts
      models/
        dashboardHomeModel.ts
```

### Componentes y responsabilidades
- **DashboardPage**: orquestador, layout, estados globales.
- **Secciones puras**: reciben props, sin fetch directo.
- **Hooks**: dueños de datos remotos.
- **Modelos**: funciones puras de agregación.

### Flujo de datos
Supabase → hooks → modelo → secciones → DashboardPage. Un solo dueño por dato.

### Estados por sección
Cada sección maneja loading/empty/error/rehydrating localmente o hereda del orquestador.

### Navegación
- Mobile: BottomNav fijo (≤2 taps a acción).
- Desktop: AppShell con sidebar + grid. Sin duplicar controles (BottomNav oculto en desktop via CSS).

### Reutilización
- `GlassCard`, `GlassButton`, tokens (`SURFACE`, `ACCENT`, `TEXT`, `TYPE`, `SPACE`, `RADIUS`, `MOTION`).
- `useActiveSession`, `useDashboardSessions`, `useDashboardHome`.

### Estrategia de pruebas
- Tests por sección (props puras).
- Tests de hooks con mocks de Supabase.
- Tests de integración de DashboardPage (ya existentes: 14).
- Tests de ActiveSessionContext (25).

## 4. Plan de implementación por fases

### Fase 1 — Extracción de secciones y pruebas
- **Archivos:** DashboardPage.tsx → secciones en `features/dashboard/sections/`.
- **Riesgo:** romper tests existentes. Mitigación: mantener DashboardPage como orquestador.
- **Pruebas:** tests de secciones puras + DashboardPage existente.
- **Criterio:** DashboardPage < 200 líneas, tests verdes.

### Fase 2 — Nueva jerarquía visual Command Center
- **Archivos:** secciones, tokens (sin cambiar valores, solo uso).
- **Riesgo:** regresión visual. Mitigación: tokens existentes, `npx vitest run src/design`.
- **Pruebas:** tokens test + visual manual.
- **Criterio:** cero literales CSS, contraste AA.

### Fase 3 — Métricas y visualizaciones
- **Archivos:** `WeeklyVolumeCoverage.tsx`, nuevo `PRChart`, `ConsistencyHeatmap`.
- **Riesgo:** rendimiento (listas largas). Mitigación: virtualización si >100 items.
- **Pruebas:** tests de modelo + componente.
- **Criterio:** métricas reales, sin datos ficticios.

### Fase 4 — Integración de coach
- **Archivos:** `CoachFloatingButton`, `AthleteDetailView`, RLS verification.
- **Riesgo:** seguridad. Mitigación: verificar RLS antes.
- **Pruebas:** tests de permisos (coach vs athlete).
- **Criterio:** aislamiento por usuario confirmado.

### Fase 5 — Notificaciones y anuncios (solo si hay soporte real)
- **Condición:** verificar existencia de tabla/endpoint de anuncios.
- **Riesgo:** funcionalidad ficticia. No implementar sin soporte.

## 5. Criterios de aceptación
- Typecheck 0 errores.
- Tests del área en verde.
- Sin cambios en catálogo, mapeo biomecánico ni diseño visual (solo uso de tokens).
- Sin commits ni push hasta aprobación.
- RLS verificado para datos de coach/athlete.

## 6. Notas finales
- Esta tarea es exclusivamente de preparación y auditoría. No se implementó ni refactorizó código de aplicación.
- Los cambios P0 (ActiveSessionContext, useDashboardSessions, DashboardPage) permanecen en working tree sin commit.
- Archivos ajenos (imágenes, documentación de mapeo) no se tocaron.