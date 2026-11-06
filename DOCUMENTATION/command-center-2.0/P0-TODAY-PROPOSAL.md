# Cronos Gym — P0 Today Command Center Proposal (corregida)

## 1. Borrador recuperable (visible y seguro)
- ActiveSessionContext expone `recoverableDraft`, `restoreDraft()`, `discardDraft()`.
- Presentación contextual: cuando `recoverableDraft !== null`, mostrar tarjeta "Sesión interrumpida" con botón "Continuar" (restoreDraft) y "Descartar" (discardDraft).
- Usar exclusivamente métodos existentes. No crear lógica nueva de descarte.
- ActiveWorkoutPill (navegación) consume la misma fuente (`useActiveSession().session`). No duplicar estado.

## 2. ActiveWorkoutPill
- Navegación: indicador compacto (ya existe).
- Today: presentación contextual completa (tarjeta de borrador).
- Ambos consumen `useActiveSession()`. Sin estados paralelos.

## 3. Rediseño visual (criterio actualizado)
El P0 debe mejorar la experiencia visual de Today:
- Nueva jerarquía: Hero → Sesión activa/recuperación → Progreso semanal → PRs → Historial → Cobertura muscular → Tips/anuncios → Coach.
- Obsidian + Crimson + Liquid Glass (tokens existentes).
- Responsive: móvil (columna), tablet (2 cols), escritorio (2 cols + fila inferior).
- Sin emojis, solo Lucide.
- Sin cambios en lógica de negocio.

## 4. Contratos de datos (verificados en código)

### PRs
- Campo: `data.recentPRs: RecentPR[]` (en DashboardHomeData, línea 108).
- Tipo RecentPR: verificar en modelo. Fuente: `useAthletePRs` (max peso por ejercicio).
- NO es `data.prs`. Corregido.

### Historial reciente
- NO existe `data.recentSessions` en DashboardHomeData.
- Fuente real: `useDashboardSessions(userId)` → `sessions: DashboardSession[]`.
- Para Today, consumir `useDashboardSessions` directamente (ya existente, sin nuevas consultas) y tomar los primeros 3-5.
- Tipos: `DashboardSession` (id, startedAt, completedAt, routineId, routineTitle, sets[]).

### Progreso semanal
- `data.weeklyProgress: WeeklyProgress`, `data.weeklyPlan: WeeklyPlanDay[]`.

### Cobertura muscular
- `data.muscleCounts: Map<Slug, number> | null`.

### Sesión activa
- `data.activeSession`, `data.isSessionActive`, `data.rehydrating`, `data.completedToday`.

### Hero
- `data.greeting`, `data.heroRoutineSummary`, `data.suggestedRoutine`, `data.dailyFocus`, `data.muscleCounts`.

### Tip/anuncios
- `TIP_CATALOG`, `tipIndex`, `nextTip`, `announcements`.

## 5. Acciones y navegación (verificadas)
- `handlePrimary`: si rehydrating → return; si completed → navigate(PROGRESS_PATH); si in-progress → navigate(TRAIN_PATH); si suggested → startSession + navigate(TRAIN_PATH).
- `data.startSession`: delega a ActiveSessionContext.start.
- Rutas: PROGRESS_PATH, TRAIN_PATH en navItems.ts (verificado).
- No duplicar startSession.

## 6. Criterios de aceptación (actualizados)
- Hero contextual funcional.
- Sesión activa protegida (guards de start()).
- Borrador recuperable visible y seguro (restoreDraft/discardDraft).
- PRs reales (data.recentPRs).
- Historial real (useDashboardSessions, primeros N).
- Progreso semanal.
- Cobertura muscular basada en datos reales.
- Sin consultas duplicadas (reutilizar hooks existentes).
- Sin regresiones de sesión ni persistencia.
- Responsive real (móvil/tablet/escritorio).
- Typecheck 0 errores.
- Tests del área en verde.

## 7. Archivos a modificar en P0
- `src/components/dashboard/DashboardPage.tsx` (composición + nuevas secciones).
- `src/components/dashboard/sections/PRSection.tsx` (nuevo, presentacional).
- `src/components/dashboard/sections/HistorySection.tsx` (nuevo, presentacional).
- `src/components/dashboard/sections/RecoverableDraftSection.tsx` (nuevo, presentacional).
- Tests correspondientes.

NO modificar: hooks, modelos, ActiveSessionContext, catálogo, mapeo, navegación.

## 8. Riesgos
- RLS coach no auditado.
- Fallos preexistentes AppShell (2) y ShiftPanel (role mismatch).
- PRs/historial son nuevas secciones (no extracción).
- No duplicar consultas: reutilizar useDashboardSessions y dashboardHomeModel.
- ActiveWorkoutPill y tarjeta de borrador comparten fuente (useActiveSession) — sin estados paralelos.