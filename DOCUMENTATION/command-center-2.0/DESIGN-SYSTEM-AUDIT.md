# Design System Audit

## Tokens reutilizables
- SURFACE, SURFACE_ROLE, GLASS, SOLID, TEXT, ACCENT, COPPER, DANGER, STATUS, FOCUS, SCRIM, GRADIENTS, HEATMAP, DIAGRAM, SUPERSET, TYPE, NUMERIC, SPACE, RADIUS, MOTION, Z_INDEX.

## Componentes reutilizables
- GlassCard (raised/flush/as/reducedTransparency).
- GlassButton (primary/secondary/ghost/destructive).
- MuscleReadonlyMap.
- WeeklyProgressSection, TipSection, TrainingHeroSection (extraídos).

## Patrones visuales existentes
- Glassmorphic cards sobre SURFACE.base (#000).
- Un solo acento rojo (ACCENT.base) para acción primaria.
- Ámbar (ACCENT.secondary) solo advertencia.
- TYPE.mono + tabular-nums para números.

## Limitaciones de accesibilidad
- Foco visible via tokens (no verificado exhaustivamente).
- Botones solo-icono en BottomNav requieren verificación de aria-label.
- Contraste AA validado por tokens.test.ts (no verificado en componentes nuevos).

## Componentes a crear (futuro)
- PRSection, HistorySection (cuando se diseñe UI con datos reales).