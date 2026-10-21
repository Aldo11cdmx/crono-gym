# Routines & Planner Craftsman
> Se activa cuando: tocas `RoutinesPage.tsx`, `WeeklyPlanner.tsx`, `WeeklyPlanEditor.tsx`, tarjetas de rutinas, carrusel semanal, selector o cambio de ejercicios en planes, o el sistema de deshacer/rehacer de planificación.

## Misión
Diseñar e implementar la pestaña de Rutinas y el Planificador Semanal con la elegancia, calma visual y precisión de Apple Fitness / Reminders. Cero ruido visual, jerarquía impecable, interacción táctil sin tropiezos a una sola mano y modularidad estricta para evitar monolitos de código.

## Estándares Visuales Apple (Clean & Minimalist)
1. **Un solo llamado a la acción primario por tarjeta:**
   - La acción "Entrenar" o "Iniciar" lleva `GlassButton` variante `primary` (`ACCENT.base`).
   - Acciones secundarias (Editar, Duplicar, Compartir, Borrar) viven dentro de un menú popover discreto (`ActionMenu`) con icono `MoreHorizontal` de Lucide, nunca saturando la tarjeta con múltiples botones coloridos.
2. **Carrusel Semanal de 7 Días (L - D):**
   - Pills de 44×44px mínimo (`MOTION.minTouchTarget`).
   - Día activo / seleccionado: borde `ACCENT.base` o fondo `ACCENT.subtle` con halo discreto (`ACCENT.glow`).
   - Estados de día claros y no saturados: `done` (icono check azul sutil `STATUS.success`), `rest` (texto atenuado `TEXT.tertiary`), `planned` (borde `GLASS.border`).
3. **Superficies y Tarjetas de Vidrio:**
   - Siempre envolver en `GlassCard` con `RADIUS.card` (24px) y relleno `GLASS.fill` / `GLASS.fillRaised`.
   - Borde sutil `GLASS.border` (10% blanco) que resalta sobre el fondo negro puro OLED (`SURFACE.base`).
   - Espaciado interior uniforme con `SPACE.card` (20px).
4. **Tipografía Calmada:**
   - Nombre de rutina: `TYPE.title2` (22px/600) en `TEXT.primary`.
   - Resumen del plan ("4 ejercicios · ~45 min"): `TYPE.subhead` (15px/500) en `TEXT.secondary`.
   - Microetiquetas de grupos musculares: `TYPE.label` (11px/600) en mayúsculas con `TEXT.tertiary`.

## Patrones Arquitectónicos Obligatorios
- **Anti-Monolito:** `RoutinesPage.tsx` y `WeeklyPlanner.tsx` no deben albergar toda la lógica en un solo archivo. Deben delegar en:
  - `RoutineCard.tsx`: presentación pura de cada rutina.
  - `DayCarousel.tsx`: navegación horizontal de días.
  - `DaySessionDetail.tsx`: rutina asignada al día seleccionado y resumen.
  - `ExercisePickerModal.tsx`: modal optimizado para seleccionar ejercicios.
  - `ExerciseSwapModal.tsx`: reemplazo equivalente de ejercicios.
  - `AssignmentHistory.ts`: máquina de deshacer/rehacer para asignaciones semanales.
- **Micro-Toasts de Deshacer (`UndoToast`):**
  - Al borrar o mover una rutina, la acción se aplica optimistamente y se muestra un toast flotante de 5 segundos con botón "Deshacer".
  - Barra de drenaje animada con `cronos-undo-drain` (scaleX de 1 a 0 en 5s).
- **Consistencia de Tokens:**
  - Prohibido cualquier estilo con hexadecimales directos (`#1f2937`) o clases genéricas de Tailwind (`bg-zinc-900`). Todo debe importar `GLASS, ACCENT, TEXT, TYPE, SPACE, RADIUS, SURFACE` de `@/design/tokens`.

## Cómo debe responder Kilo
1. Identifica qué elementos decorativos o botones redundantes se eliminan para ganar espacio negativo.
2. Si un archivo supera las 600 líneas, propone y ejecuta su descomposición en sub-componentes.
3. Asegura que el componente soporta tanto vista de lista como vista de plan semanal sin saltos de layout.

## Comportamiento Proactivo
- Si detecta que una tarjeta de rutina tiene más de un botón con color de acento, degrada los secundarios a `ghost` o los traslada al menú de tres puntos.
- Si detecta que el cambio de día en el carrusel causa re-renders de toda la página de rutinas, memoiza el selector o aísla el estado del día activo.
- Sugiere estados vacíos inspiradores ("No tienes rutinas para hoy. Descansa o programa una nueva") con un solo botón de acción.

## Anti-patrones
- Tarjetas sobrecargadas con badges de colores incompatibles o emojis.
- Diálogos modales pesados que bloquean la pantalla cuando una bottom sheet (`RADIUS.sheet`) es más ergonómica en móviles.
- Perder el historial de asignaciones al cambiar de pestaña.
- Saltarse el sistema de tokens para "hacerlo rápido".

## Checklist
- [ ] Tarjetas con `GlassCard` y radio `RADIUS.card`
- [ ] Touch targets del carrusel >= 44px
- [ ] Un solo botón de acento primario por tarjeta
- [ ] Menú de opciones secundarias colapsado en `ActionMenu`
- [ ] Acción de deshacer disponible para borrado o reasignación
- [ ] Cero valores mágicos de CSS en los componentes
