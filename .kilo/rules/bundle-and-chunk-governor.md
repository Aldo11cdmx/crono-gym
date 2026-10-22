# Bundle & Chunk Governor
> Se activa cuando: tocas `vite.config.ts`, `package.json` (nuevas dependencias), `router.tsx`, imports de datos (`exercisesCatalog.json`), carga de fuentes, medios pesados, o cuando el build advierte sobre chunks mayores a 500 kB.

## Misión
Proteger el rendimiento de arranque en frío y la huella en memoria de la aplicación: el chunk principal de JavaScript debe mantenerse estrictamente por debajo de **300 kB gzip**, la carga diferida (lazy loading) debe funcionar por ruta, y ningún archivo de datos estáticos masivo debe colarse en el bundle inicial.

## Presupuesto de Rendimiento (Límites Innegociables)
- **Entry Chunk:** < 300 kB comprimido en gzip.
- **Catálogo de Ejercicios:** 0 bytes en el chunk inicial. El catálogo de 1.300+ ejercicios (16 MB sin comprimir) debe cargarse bajo demanda mediante `catalogLoader.ts` (usando asset con sufijo `?url` y caché en IndexedDB).
- **Vendor Chunks:** Divididos en `manualChunks` coherentes (`react-core`, `supabase`, `ui-icons`).
- **Nuevas dependencias:** Prohibido agregar paquetes de más de 20 kB sin justificación técnica y benchmarking de alternativas.

## Framework de Decisión
1. ¿Este import estático puede ser dinámico (`React.lazy` / `await import(...)`)?
2. ¿Se agregó una dependencia pesada cuando existe una API nativa del navegador (ej. Framer Motion vs Web Animations API / CSS keyframes, Lodash vs JS nativo, Moment/Dayjs vs `Intl`)?
3. ¿El catálogo de ejercicios entra en este archivo? Si es así: ¿se importó `exercisesCatalog.json` directamente? (¡Violación crítica!). Debe usarse `src/lib/catalog/catalogLoader.ts`.
4. ¿Las rutas principales en `router.tsx` están divididas con `lazy()`?

## Patrones Obligatorios
- **Carga de Catálogo Bajo Demanda:**
  ```ts
  // CORRECTO:
  import { loadCatalog } from "@/lib/catalog/catalogLoader";
  const catalog = await loadCatalog();

  // PROHIBIDO:
  import catalog from "@/data/exercisesCatalog.json"; // Introduce 16MB en el chunk
  ```
- **Code-Splitting en `router.tsx`:**
  - Todas las vistas pesadas (`ActiveWorkoutView`, `RoutinesPage`, `HistoryPage`, `CoachDashboard`) deben estar envueltas en `React.lazy()` y montadas dentro de un `<Suspense fallback={<Skeleton ... />}>`.
- **Estrategia de Chunks en `vite.config.ts`:**
  - Configurar `output.manualChunks` en Rollup para agrupar librerías estables de terceros separadas del código de la aplicación.
- **Verificación Obligatoria Post-Build:**
  - Cada vez que se toque la configuración de empaquetado o se agregue una librería, ejecutar `npm run build` e inspeccionar la tabla de salida de Rollup (pesos y nombres de chunks).

## Cómo debe responder Kilo
Siempre que se modifique un import o dependencia, Kilo debe reportar:
1. Tamaño del chunk principal antes vs después.
2. Comprobación de que `exercisesCatalog.json` no aparece en los chunks de la ruta inicial.
3. El resultado del comando `npm run build`.

## Comportamiento Proactivo
- Detecta imports estáticos accidentales de JSONs grandes y los convierte automáticamente a carga asíncrona diferida.
- Revisa el árbol de dependencias (`package.json`) y propone eliminar paquetes redundantes o muertos.
- Configura compresión moderna (Brotli / Gzip) y cache-control inmutable para assets con hash.
- **Sin dependencias innecesarias**: No añadas librerías para micro-utilidades nativas del navegador (fechas, animaciones, validación trivial). Justifica con tamaño y alternativa nativa.

## Anti-patrones
- `import catalog from "@/data/exercisesCatalog.json"` en cualquier archivo que se ejecute en el arranque.
- Añadir librerías utilitarias gigantescas para funciones que ocupan 5 líneas de JavaScript moderno.
- Usar `React.lazy` sin un fallback apropiado con `Skeleton` de `@/components/ui/Skeleton`.
- Desactivar las advertencias de tamaño de chunk en Vite (`chunkSizeWarningLimit`) en lugar de solucionar el problema de división.

## Checklist
- [ ] `npm run build` ejecutado y validado
- [ ] Chunk principal < 300 kB gzip
- [ ] Sin imports estáticos de JSONs mayores a 50 kB
- [ ] Vistas principales con `React.lazy()`
- [ ] Cero dependencias superfluas en `package.json`
