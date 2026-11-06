# Cronos Gym — Architecture Review (Command Center 2.0)

## Hallazgos confirmados
- ActiveSessionContext implementa rehidratación con requestIdRef, retryRehydrate, guards. Verificado por 25 tests.
- useDashboardSessions carga hasta 30 sesiones con invalidación por requestId. Verificado por 11 tests.
- DashboardPage orquesta hero, progreso semanal, coach banner, anuncios/tips. Verificado por 14 tests.
- Catálogo de ejercicios se carga bajo demanda (catalogLoader). Verificado en código.
- Temporizador por deadline (restTimer.ts). Verificado.
- Offline-first con IndexedDB drafts + cola finalize_session. Verificado.

## Afirmaciones sin evidencia
- RLS de coach/athlete: NO verificado en esta auditoría. Marcado como sospecha.
- Notificaciones push: soporte no verificado. Marcado como no existente.
- Anuncios: tabla `announcements` existe en código, RLS no auditado.

## Contradicciones detectadas
- `FEATURE-MATRIX.md` marcaba "Anuncios" como parcialmente real; código confirma lectura desde Supabase pero RLS no auditado. Ajustar a "Pendiente de verificar RLS".
- Roadmap mencionaba Fase 2 (extraer PRs/Historial) pero DashboardPage no renderiza esos bloques. Ajustar: son funcionalidades nuevas, no extracción.

## Dependencias omitidas
- `useDashboardHome` requiere `ActiveSessionProvider` por encima del router.
- Coach features requieren verificación RLS antes de implementar.
- `dashboardHomeModel` depende de `useDashboardSessions` internamente.

## Riesgos técnicos
- 2 fallos preexistentes en AppShell (pill render en jsdom).
- ShiftPanel tests fallan por role mismatch (checkbox vs switch) — preexistente.
- Bundle entry chunk 270.87 kB gzip (bajo límite 300 kB).

## Correcciones recomendadas a los documentos
- FEATURE-MATRIX: anuncios → "Pendiente de verificar RLS".
- IMPLEMENTATION-ROADMAP: Fase 2 → "Diseñar UI de PRs/Historial con datos reales" (no extracción).
- RISKS: agregar fallos preexistentes de AppShell y ShiftPanel.

## Roadmap definitivo por fases
1. Fase 1 (hecha): extracción estructural (WeeklyProgress, Tip, TrainingHero).
2. Fase 2: diseñar UI de PRs e historial con datos reales del modelo.
3. Fase 3: Command Center visual (jerarquía, densidad, tokens).
4. Fase 4: métricas y visualizaciones (volumen por músculo, PR timeline, heatmap).
5. Fase 5: integración coach (verificar RLS primero).
6. Fase 6: notificaciones solo si hay soporte real.

## Primer alcance P0 implementable
- Fase 2 + 3: diseñar UI de PRs/historial y aplicar jerarquía visual, sin nuevas consultas ni datos ficticios.

## Resumen ejecutivo
El diagnóstico es mayormente fiel al código. Los principales ajustes son: anuncios RLS no verificado, PRs/historial son funcionalidades nuevas (no extracción), y coach requiere auditoría RLS antes. El roadmap es viable si se respeta el orden por dependencias. No se implementó nada.