# Cronos Gym — Consolidation Note

## Documentos actualizados (alineados con Product Vision)
- COMMAND-CENTER-VISION.md (rector)
- EXPERIENCE-BLUEPRINT.md
- FEATURE-KEEP-IMPROVE-REPLACE.md
- NAVIGATION-ARCHITECTURE.md
- SHARED-DATA-ARCHITECTURE.md
- TODAY-DASHBOARD-DESIGN.md
- RESPONSIVE-EXPERIENCE.md
- IMPLEMENTATION-PLAN.md
- ARCHITECTURE-REVIEW.md
- DATA-CONTRACTS-AUDIT.md, PR-DATA-AUDIT.md, HISTORY-DATA-AUDIT.md
- SESSION-RECOVERY-AUDIT.md, NAVIGATION-AND-ROUTES-AUDIT.md
- COACH-RLS-AUDIT.md, DESIGN-SYSTEM-AUDIT.md
- INTEGRATION-MATRIX.md, FINAL-IMPLEMENTATION-ROADMAP.md
- COMMAND-CENTER-BLUEPRINT.md

## Decisiones consolidadas
- Identidad: Obsidian + Crimson + Liquid Glass, tokens de src/design/tokens.ts, solo Lucide, cero emojis.
- Seis áreas: Today, Train, Plan, Progress, Coach, Profile.
- No duplicar fuentes de verdad, temporizadores ni lógica de persistencia.
- Offline-first, atomicidad (finalize_session), estado derivado no guardado.
- Bundle < 300 kB gzip.

## Contradicciones encontradas
- Anuncios: RLS no verificado (marcado pendiente).
- PRs/historial: funcionalidades nuevas (no extracción).
- AppShell/ShiftPanel fallos preexistentes documentados.

## Decisiones pendientes de aprobación
- Verificar RLS de coach antes de implementar Coach.
- Confirmar soporte de notificaciones push.
- Definir si PRs/historial se renderizan en Today o Progress.

## Primer alcance P0 recomendado
Diseñar UI de PRs e historial con datos reales + aplicar jerarquía visual Command Center, sin nuevas consultas ni datos ficticios.