# Cronos Gym — Command Center Blueprint (Today)

## Composición de pantalla (Mobile-first)

### Móvil (base)
1. Hero (TrainingHeroSection): saludo + CTA contextual.
2. Estado de sesión activa (si aplica): pill + continuar.
3. Progreso semanal (WeeklyProgressSection).
4. Tip (TipSection) o anuncios.
5. Coach banner (si coachId).

### Tablet
- Hero a ancho completo.
- Dos columnas: progreso semanal + tip/anuncios.
- Coach banner ancho completo.

### Escritorio
- Hero a ancho completo (con mapa muscular a la derecha).
- Grid 2 columnas: progreso semanal | tip/anuncios.
- Fila inferior: (futuro) PRs + historial reciente (datos reales).
- Coach banner ancho completo.

## Jerarquía de secciones
1. Hero (P0) — siempre visible.
2. Sesión activa (P0) — condicional.
3. Progreso semanal (P0) — siempre visible.
4. Tip/anuncios (P1) — visible si no hay anuncios.
5. Coach (P1) — condicional (coachId).
6. PRs (P2) — futuro, datos reales.
7. Historial reciente (P2) — futuro, datos reales.

## Contratos de datos
- Hero: `data.greeting`, `data.heroRoutineSummary`, `data.suggestedRoutine`, `data.muscleCounts`, `data.rehydrating`, `data.isSessionActive`, `data.completedToday`, `data.dailyFocus`.
- Progreso semanal: `data.weeklyProgress`, `data.weeklyPlan`.
- Tip: `TIP_CATALOG[tipIndex]`, `nextTip`.
- Anuncios: `announcements` (Supabase `announcements`).
- Coach: `coachId` (Supabase `coaches`).
- PRs: calculados en `dashboardHomeModel` (max peso por ejercicio). Sin nuevas consultas.
- Historial: `useDashboardSessions` (ya cargado). Sin nuevas consultas.

## Estados contextuales
- Sin rutina: Hero muestra "Rutina del día" + CTA "Comenzar entrenamiento" (free session).
- Entrenamiento programado: Hero muestra rutina sugerida + CTA.
- Ya completó: CTA "Ver historial" → navigate PROGRESS_PATH.
- Sesión activa: CTA "Continuar entrenamiento" → navigate TRAIN_PATH; borde acento.
- Borrador pendiente: ActiveSessionContext.recoverableDraft; Hero no afectado.
- Rehidratando: CTA "Comprobando sesión..." deshabilitado.
- Sin historial: sección historial vacía (futuro).
- Sin PRs: sección PRs vacía (futuro).
- Sin conexión: datos cacheados; anuncios pueden fallar (error visible).

## Diseño responsive
- Mobile: columna única, BottomNav fijo.
- Tablet: hero full + 2 cols.
- Desktop: hero full + 2 cols + fila inferior.

## Sistema visual
- Jerarquía: TYPE.hero (una vez) → TYPE.subhead → TYPE.body → TYPE.caption.
- Espacios: SPACE.card (20), SPACE.section (32), SPACE.lg.
- Superficies: GlassCard (raised/flush), SURFACE.base (#000).
- Acento: ACCENT.base (rojo) solo acción primaria.
- Animaciones: MOTION.fast/normal, spring/easeOut, transform+opacity.
- Accesibilidad: contraste AA, foco visible, reduced motion.

## Interacciones
- CTA primario → handlePrimary (navega o inicia sesión).
- Siguiente tip → nextTip (rotación local).
- Coach banner → RequestRoutineModal.
- Anuncios → solo lectura.

## Componentes nuevos vs reutilizables
- Reutilizables: GlassCard, GlassButton, MuscleReadonlyMap, WeeklyProgressSection, TipSection, TrainingHeroSection.
- Nuevos (futuro): PRSection, HistorySection (cuando se diseñe UI con datos reales).

## Dependencias
- ActiveSessionContext (provider arriba del router).
- useDashboardHome, useDashboardSessions.
- dashboardHomeModel (puro, testeable).

## Plan de implementación incremental
1. Fase 1 (hecha): extracción estructural.
2. Fase 2: diseñar UI de PRs/historial con datos reales.
3. Fase 3: Command Center visual (jerarquía, densidad).
4. Fase 4: métricas y visualizaciones.
5. Fase 5: coach (verificar RLS).
6. Fase 6: notificaciones solo si hay soporte real.

## Criterios de aceptación
- Typecheck 0 errores.
- Tests del área en verde.
- Sin cambios en catálogo, mapeo biomecánico ni diseño visual (solo uso de tokens).
- Sin datos ficticios.
- RLS verificado para coach.

## Riesgos pendientes
- RLS de coach/athlete no auditado.
- Fallos preexistentes AppShell (2) y ShiftPanel (role mismatch).
- Notificaciones sin soporte verificado.