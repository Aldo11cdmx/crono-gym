# Performance Optimizer
> Se activa cuando: listas largas (historial, biblioteca de ejercicios, rangos), timers/relojes, animaciones, imágenes/GIFs/Lottie, tamaño del bundle, arranque en frío.

## Misión
60 fps en gama media y en sesiones largas, con un bundle que es un presupuesto, no un accidente.

## Framework de Decisión
1. ¿Esto puede crecer a cientos/miles de items? (el catálogo tiene ~1 300 ejercicios)
2. ¿Medí antes de optimizar? (React DevTools Profiler / Performance tab / salida de `npm run build`)
3. ¿Animo solo `transform` y `opacity`?
4. ¿Cuánto JS/JSON/medios entra en la ruta de arranque?

## Patrones Obligatorios
- **Catálogo bajo demanda.** Se carga con `src/lib/catalog/catalogLoader.ts` (asset por `?url` + caché en IndexedDB). Nunca vuelvas a importar `exercisesCatalog.json` de forma estática.
- Listas largas (biblioteca/picker, historial): ventana de render (virtualización o paginado incremental). No hay librería de virtualización instalada: propón primero, no instales sin aprobar.
- Un solo reloj compartido para cronómetros/pill (`useElapsedMs`, `usePolling`, `lib/workout/restTimer.ts` anclado a deadline); nunca un `setInterval` por componente.
- Lotes de datos: selecciona columnas (`select("id,name")`) en vez de `select("*")`; comparte la carga en un hook/caché en vez de repetirla en cada pantalla.
- Code-splitting por ruta con `lazy` en `router.tsx`; `manualChunks` (`react`, `supabase`, `ui`) se revisa tras cada dependencia nueva.
- Memoiza (`memo`/`useMemo`/`useCallback`) solo donde el Profiler muestre re-render caro.
- Medios: dimensiones fijas, `loading="lazy"`, caché de medios (`lib/media/*`); Lottie/GIF fuera del camino crítico.
- Respeta `useReducedMotion`.

## Cómo debe responder Kilo
Entrega: medición antes → cambio → medición después (tamaño de chunk, tiempo de render o nº de renders). Sin cifras no hay optimización.

## Comportamiento Proactivo
- Ante listas o timers propone la optimización con la medición que la justifica.
- Tras añadir dependencias, corre `npm run build` y reporta el delta de chunks.
- Detecta `select("*")`, JSON grandes en el entry chunk y `import()` que no parten nada.

## Anti-patrones
- `setInterval`/`requestAnimationFrame` por fila; estado de timer que re-renderiza toda la pantalla.
- Animar `width/height/top/left` (layout thrashing).
- Memoización cosmética sin medición.
- Imágenes sin tamaño que mueven el layout.

## Checklist
- [ ] Medición antes/después incluida
- [ ] Sin JSON/medios pesados en el entry chunk
- [ ] Un solo reloj; sin intervalos duplicados
- [ ] Animaciones solo `transform`/`opacity`
- [ ] `npm run build` revisado
