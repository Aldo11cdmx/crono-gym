# Motion & Haptics Guardian
> Se activa cuando: creas o modificas animaciones, transiciones, keyframes (`index.css`), microinteracciones, feedback háptico (`navigator.vibrate`), sonidos de alerta o interacción (`Web Audio API`), bottom sheets y transiciones de ruta.

## Misión
Garantizar que Cronos se sienta con la fluidez táctil y la respuesta física instantánea de una aplicación nativa de iOS (60/120 fps constantes), sin añadir dependencias pesadas como Framer Motion y respetando estrictamente el presupuesto de movimiento y accesibilidad.

## Framework de Decisión
1. ¿La animación utiliza **únicamente** `transform` y `opacity`? (Cero cambios de `top`, `left`, `width`, `height` o `margin` que provoquen layout thrashing).
2. ¿Usa una de las 4 curvas oficiales de `MOTION` (`spring`, `easeOut`, `easeIn`, `standard`) y duraciones (`instant`: 80ms, `fast`: 150ms, `normal`: 250ms, `slow`: 400ms)?
3. ¿Está protegida detrás de `useReducedMotion()` / `@media (prefers-reduced-motion: reduce)`?
4. ¿El feedback háptico o de audio es oportuno y no intrusivo? (Haptic feedback en gym: confirmación de serie completada, fin del timer de descanso, detección de PR).

## Patrones Obligatorios
- **Cero Framer Motion:** Todas las animaciones se orquestan mediante CSS Transitions, CSS Keyframes (`index.css`) o la Web Animations API nativa.
- **Tokens de Movimiento (`src/design/tokens.ts`):**
  ```tsx
  // Transición estándar en CSSProperties inline:
  transition: `transform ${MOTION.fast} ${MOTION.spring}, opacity ${MOTION.fast} ${MOTION.easeOut}`,
  ```
- **Catálogo de Keyframes Canónicos (`index.css`):**
  - `cronos-set-check`: Rebote de confirmación física de serie (scale 0.6 -> 1.18 -> 1.0 en 250ms `spring`).
  - `cronos-record-pop`: Entrada con pop para badges de PR personal.
  - `cronos-sheet-up`: Entrada de hoja inferior (translateY 100% -> 0 en 200ms `easeOut`).
  - `cronos-route-in`: Transición sutil de pantalla (translateY 4px -> 0 + fade-in en 150ms).
  - `cronos-undo-drain`: Drenaje visual de la barra de deshacer (scaleX 1 -> 0 en 5s linear).
- **Háptica Nativa (`navigator.vibrate`):**
  - Patrón de tick ligero para botones/sets: `[15]` ms.
  - Patrón de éxito / fin de descanso: `[40, 60, 80]` ms.
  - Patrón de PR / Hito: `[50, 50, 50, 50, 100]` ms.
  - Siempre verificar disponibilidad: `if (typeof navigator !== "undefined" && "vibrate" in navigator)`.
- **Audio Sintético (`Web Audio API`):**
  - Beep de temporizador mediante oscilador senoidal (`AudioContext`), evitando cargar archivos de audio `.mp3`/`.wav` por red en el camino crítico.
- **Accesibilidad y Rendimiento:**
  - Todo componente animado debe consultar `useReducedMotion()`. Si es verdadero, duración = 0ms o salto inmediato sin rebote.

## Cómo debe responder Kilo
1. Indica qué propiedad física se anima (`transform`/`opacity`).
2. Muestra la curva y duración exacta de `tokens.ts`.
3. Valida que no existan layout shifts (CLS = 0).
4. Verifica la degradación con `prefers-reduced-motion`.

## Comportamiento Proactivo
- Detecta animaciones de `height`/`width` o `margin` y las refactoriza inmediatamente a `scaleY`, `scaleX` o `translate`.
- Detecta intentos de instalar `framer-motion` o `react-spring` y los rechaza proponiendo la solución nativa con tokens.
- Propone micro-vibración (`vibrate([15])`) al marcar una serie como completada o al presionar botones principales (`GlassButton`).

## Anti-patrones
- Instalar librerías de animación externas.
- Modificar colores con transiciones de movimiento (el color no se anima con spring).
- Animaciones infinitas innecesarias que drenan la batería en segundo plano (salvo el pulso sutil del skeleton o la sesión activa).
- Ignorar `prefers-reduced-motion`.

## Checklist
- [ ] Anima exclusivamente `transform` y `opacity`
- [ ] Usa tokens `MOTION.duration` y `MOTION.spring` / `easeOut` / `standard`
- [ ] Probado con `prefers-reduced-motion` activo
- [ ] Háptica encapsulada y con verificación de soporte en el navegador
- [ ] `npx vitest run src/design` pasa sin errores
