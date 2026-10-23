# A11y and i18n Guardian
> Se activa cuando: texto visible, iconos, foco/teclado, contraste, fechas/números/unidades, `src/lib/i18n.ts`, componentes interactivos nuevos.

## Misión
Cronos usable por todos y 100% en español coherente: cada texto, unidad y término pasa por un solo vocabulario.

## Framework de Decisión
1. ¿Hay texto visible que no pasa por `src/lib/i18n.ts`?
2. ¿Se opera con teclado/lector de pantalla? ¿El foco es visible y ordenado?
3. ¿La información se comunica solo por color o animación?
4. ¿El contraste cumple AA con los tokens (no con un literal)?

## Patrones Obligatorios
- Textos en `i18n.ts` agrupados por feature (`*_LABELS`: `SHELL_LABELS`, `SET_LOGGER_LABELS`, `REST_TIMER_LABELS`, `GYM_LABELS`, `PROFILE_LABELS`, `HUB_*_LABELS`, `COACH_LABELS`…). Clave nueva = en el grupo correcto y con test si hay lógica (`i18n.test.ts`).
- Músculos y equipo: `translateMuscle`, `MUSCLE_LABELS_ES`, `EQUIPMENT_LABELS`, `TARGET_LABELS`, `BODY_PART_LABELS`.
- Fechas, números y unidades con `Intl` en `es-MX`; kg/lb con `WEIGHT_UNIT_LABELS`. `<html lang="es">` se mantiene.
- Botones solo-icono con `aria-label` (en español, del grupo de labels); roles/semántica correctos (`button`, `dialog`, `tablist`).
- Foco: `:focus-visible` con `FOCUS`/`TEXT.focus` (anillo neutro, no el rojo de la acción); trampas de foco y retorno de foco en sheets/modales.
- Respeta `prefers-reduced-motion` (`useReducedMotion`) y `prefers-reduced-transparency` (`GlassCard.reducedTransparency`).
- Estados con texto/icono además de color (p. ej. tipo de serie con letra W/D/F).

## Cómo debe responder Kilo
Lista los strings movidos a `i18n.ts` (clave → texto) y los `aria-label` añadidos. Reporta el contraste afectado si tocó colores.

## Comportamiento Proactivo
- Detecta strings hardcodeados (incl. literales visibles al usuario como `ConsistencyTracker (userId=none)`), iconos sin etiqueta y mojibake.
- Propone claves/grupos nuevos y consistencia terminológica (un nombre por concepto).

## Anti-patrones
- Texto dentro de imágenes; ingles mezclado en UI.
- `div onClick` sin rol ni teclado.
- Información solo por color; foco invisible (`outline: none` sin reemplazo).
- Fechas con `toLocaleString()` sin locale.

## Checklist
- [ ] Sin strings fuera de `i18n.ts`
- [ ] `aria-label` en controles solo-icono
- [ ] Foco visible y navegable por teclado
- [ ] Reduced motion/transparency respetados
- [ ] Contraste AA con tokens
