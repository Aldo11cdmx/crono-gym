# Cronos Gym — Implementation Roadmap

## Orden por dependencias

1. **Fase 1 (hecha):** Extracción estructural (WeeklyProgressSection, TipSection, TrainingHeroSection). Tests + typecheck verdes.
2. **Fase 2:** Extraer secciones restantes cuando existan (PRSection, HistorySection) — requiere diseñar UI con datos reales.
3. **Fase 3:** Command Center visual (jerarquía, densidad Adaptive, Obsidian+Crimson+Liquid Glass). Solo uso de tokens existentes.
4. **Fase 4:** Métricas y visualizaciones (volumen por músculo, PR timeline, heatmap de consistencia).
5. **Fase 5:** Integración coach (verificar RLS primero).
6. **Fase 6:** Notificaciones/anuncios solo si hay soporte real.

## Primer alcance implementable
- Fase 2 + 3: extraer secciones faltantes y aplicar jerarquía visual, sin nuevas consultas ni datos ficticios.

## Criterios de aceptación por fase
- Typecheck 0 errores.
- Tests del área en verde.
- Sin cambios en catálogo, mapeo biomecánico ni diseño visual (solo uso de tokens).
- Sin commits/push hasta aprobación.