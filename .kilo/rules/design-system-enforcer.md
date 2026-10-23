# Design System Enforcer
> Se activa cuando: aparece un color, tamaño de fuente, radio, espaciado, sombra, blur, duración o curva; cambios en `src/design/**`, `tailwind.config.ts`, `src/index.css`.

## Misión
Guardián absoluto de los tokens. Un valor, un lugar: `src/design/tokens.ts`.

## Framework de Decisión
1. ¿Este valor existe en los tokens? Si sí, úsalo.
2. ¿Es un literal (`#hex`, `rgba()`, `fontSize: 13`, `150ms`, `cubic-bezier`)? Entonces falla `tokens.test.ts`.
3. ¿Se repite 3+ veces? Propón un token nuevo (con test de contraste) antes de usarlo.
4. ¿La animación usa `MOTION` (duración + curva del sistema)?

## Tokens disponibles (verifica nombres en `tokens.ts` antes de citar)
`SURFACE`, `SURFACE_ROLE`, `GLASS`, `SOLID`, `TEXT`, `ACCENT` (`base` rojo = la acción; `secondary` ámbar = solo advertencia), `COPPER` (deload), `DANGER` (vino, nunca rojo saturado), `STATUS`, `FOCUS`, `SCRIM`, `GRADIENTS`, `HEATMAP`, `DIAGRAM`, `SUPERSET`, `TYPE`, `NUMERIC`, `SPACE`, `RADIUS`, `MOTION` (`instant/fast/normal/slow`, `spring`, `easeOut`, `easeIn`, `standard`, `minTouchTarget`), `Z_INDEX`, `cssVars()`, `stateRules()`.

## Patrones Obligatorios
- `TYPE.x` es objeto `{ size, lineHeight, weight, tracking }`: `fontSize: TYPE.body.size`, etc.
- `tailwind.config.ts` espeja algunos tokens (`neutral`, `accent`, `amber`) y `tokens.test.ts` verifica que coinciden: al cambiar uno, cambia el otro y el test.
- Los alias (`SURFACE.elevated`=`raised`, `TEXT.inverse`=`onAccent`, `TYPE.title`=`title2`) resuelven al mismo valor; el test lo pina. No crees alias nuevos sin test.
- Un acento rojo saturado, una sola vez, como acento; el ámbar jamás es acción primaria.
- Nuevo token = valor + comentario del porqué + test (contraste AA 4.5:1 texto / 3:1 no-texto; distinguible bajo deuteranopia/protanopia si es de estado).
- Estados `hover/pressed/focus-visible` en CSS (`index.css`, `stateRules()`), no inline.

## Cómo debe responder Kilo
Lista cada literal reemplazado (`antes → token`). Si propone un token nuevo, muestra su valor, uso y el test que añade.

## Comportamiento Proactivo
- Reemplaza literales por tokens en las líneas que toca; propone tokens cuando un valor se repite.
- Corre `npx vitest run src/design` tras cualquier cambio visual.
- Prevalece sobre `apple-ui-architect`/`button-and-ui-craftsman` cuando chocan (un `rounded-2xl` suelto vs `RADIUS.card`).

## Anti-patrones
- `#fff`, `rgba(255,255,255,.06)`, `fontSize: 13`, `transition: 200ms ease`.
- Un segundo rojo (error) parecido al acento; usar `DANGER`/`STATUS.error`.
- Duplicar la paleta en CSS y TS a mano (`cssVars()` proyecta).
- Tokens sin test.

## Checklist
- [ ] Cero literales de color, tamaño o motion en producción
- [ ] Token nuevo con comentario y test
- [ ] `tailwind.config.ts` y `tokens.ts` en sincronía
- [ ] `npx vitest run src/design` en verde
