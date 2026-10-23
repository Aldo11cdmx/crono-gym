# Button and UI Craftsman
> Se activa cuando: creas o editas botones, tarjetas clicables, chips, steppers, sheets de acción, estados de carga/éxito/error.

## Misión
Componentes táctiles premium, medidos para el uso real en el gym. `GlassButton` es LA receta de botón: se extiende, no se duplica.

## Framework de Decisión
1. ¿Hay más de 1 `primary` en la vista? → error, degrada uno a `secondary`/`ghost`.
2. ¿El target mide ≥ `MOTION.minTouchTarget` (44px)? Obligatorio.
3. ¿La tarjeta completa es clickeable, con acción secundaria separada y sin burbujeo?
4. ¿Están todos los estados: reposo, pressed, loading, success, disabled, error, `focus-visible`?

## Patrones Obligatorios
- Variantes de `GlassButton`: `primary` (relleno `ACCENT.base`, tinta `TEXT.onAccent`), `secondary`, `ghost`, `destructive` (vino `DANGER`, nunca un rojo saturado). La elección expresa importancia, no color.
- Hover/pressed/focus viven en `src/index.css` bajo `.gbtn` (no en JS inline).
- Micro-interacción de pulsación con duración y curva de `MOTION` (`fast`/`standard`), p. ej. escala 0.98. No literales `150ms`/`cubic-bezier(...)` en componentes (`tokens.test.ts` los detecta).
- Solo animar `transform` y `opacity`. Nunca animar `width/height/margin/padding` que provoquen layout shift.
- Tarjeta de rutina 100% clickeable + botón `ghost` "Entrenar" con icono `Play`; el botón secundario hace `stopPropagation`.
- Estados asíncronos: `loading` deshabilita y conserva el ancho (sin salto de layout); `success` breve (≤ `MOTION.slow`); `error` con texto en español y reintento.
- **Feedback táctil opcional**: Usa `navigator.vibrate` con verificación de soporte para acciones confirmatorias (completar serie). Sin dependencia nueva.
- **Resiliencia**: Etiquetas largas con truncado + `title` o wrapping controlado. Sin romper targets táctiles.

## Cómo debe responder Kilo
Muestra el componente con sus variantes de estado y di qué primario eligió la pantalla. Si falta una variante, propón añadirla a `GlassButton` (con test) en vez de un botón nuevo.

## Comportamiento Proactivo
- Reemplaza `<button>` con colores propios por `GlassButton`.
- Detecta `div onClick` y propone `button`/`as` con rol y teclado.
- Propone un set de estados reutilizable si ve el mismo spinner/éxito repetido.

## Anti-patrones
- Dos CTAs `primary`; `primary` para acciones destructivas.
- Botón anidado en tarjeta clickeable sin `stopPropagation`.
- Targets < 44px aunque "se vea mejor".
- Estados solo por color (añade icono/texto).

## Checklist
- [ ] ≤ 1 `primary` por vista
- [ ] ≥ 44×44 y `focus-visible` visible
- [ ] Estados loading/success/disabled/error resueltos
- [ ] Sin literales de color ni motion
- [ ] Test del componente actualizado (`*.test.tsx`)
