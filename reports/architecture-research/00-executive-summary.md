# Resumen ejecutivo

**Alcance de esta auditoría:** cinco fases de investigación sobre el repositorio de Cronos Gym (`C:\Users\yayog\crono-gym`), contrastadas con cuatro aplicaciones de referencia descompiladas (**JEFIT 17.0.1**, **Hevy 3.1.16**, **FitNotes 25.1**, **Symmetry 7.16.0**).

**Estado del baseline:** intacto. **Ningún archivo de `src/` ni de `supabase/` fue modificado en ninguna fase.** Los únicos artefactos producidos son los diez documentos de `reports/architecture-research/`.

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | ✅ limpio, 0 errores |
| Build | `npm run build` | ✅ correcto — 1 792 módulos, chunk principal 16,13 MB |
| Tests | `npm test` | ✅ 129/129 ficheros en verde, 0 fallos (2 494 tests, 393,32 s), confirmado en cuatro ejecuciones completas |

---

## Fase 0 — Entorno e inventario

- El servidor MCP REA está **activo y verificado**; las tres herramientas (`decompile_apk`, `inspect_manifest`, `list_sources`) respondieron correctamente. La afirmación anterior de que "MCP REA no disponible y sin JADX/Apktool/Java" era incorrecta y queda corregida en `01-environment-and-inventory.md`.
- **Cuatro apps descompiladas** a `C:\Users\yayog\Downloads\decompiled\`: Hevy 3.1.16, FitNotes 25.1, JEFIT 17.0.1, Symmetry 7.16.0 (base + split arm64). Ningún APK ni archivo de producción fue modificado.
- **Repositorio activo:** React 18 + Vite 5 + TS 5.6 estricto, 350 ficheros / 89 172 LOC, **35 % tests**, Supabase (Postgres + RLS) como servidor e IndexedDB (`cronos-offline` v5) como caché offline.

## Fase 1 — Modelo de datos comparativo (`03`)

- **Cronos ya tiene lo que ninguna de las cuatro referencias tiene:** RPE como *gobernador* de la progresión (`overload.ts`: RIR = 10 − RPE decide la subida de carga y el deload) y un contrato de degradación total en la capa de persistencia (todo falla a `null`; registrar una serie nunca rompe un entrenamiento).
- **Tres huecos concretos y acotados en el modelo actual**, no un déficit de diseño:
  1. `SetKind` (`drop`/`failure`) **no se persiste** — `completed_sets` solo tiene `is_warmup boolean`.
  2. El store `exerciseNotes` de IndexedDB (v4) es **esquema muerto**: ningún código de producción lo usa, y su `keyPath` (`setId`) no puede corresponder a una fila del servidor, porque `completed_sets.id` lo genera Postgres.
  3. `bodyweight_entries`, `body_measurements` y `session_checkins` están **tipadas en `src/types/supabase.ts` pero no tienen DDL** en `supabase/schema.sql` ni en las migraciones.
- **Un hueco de integración con el exterior:** el import CSV mapea `setType`, `durationSec` y `distanceM`, pero `completed_sets` no tiene columna donde caigan. Un export de Hevy con `set_type = "drop"` se importa **sin error y pierde el dato** — el mismo modo de fallo que `sources.ts` dice querer evitar.

## Fase 2 — Active Workout, temporizador y recuperación (`04`)

Tres hallazgos que no son de diseño sino de integración:

1. El temporizador de descanso correcto (`src/components/RestTimer.tsx`, anclado a un *deadline*, con re-sincronización al primer plano, beep y vibración) **no está importado por ningún archivo de `src/`**: el flujo activo usa un contador inline (`ActiveWorkout.tsx:690-712`) que deriva con la pestaña en segundo plano y no avisa al terminar. El componente correcto tiene tests en verde y, aun así, es código muerto.
2. **La recuperación por borrador es inalcanzable tras una recarga**: `ActiveSessionContext` es memoria pura y `App.tsx:325` devuelve `HomeView` sin sesión, de modo que `ActiveWorkout` —y con él `loadRecoverableDraft`— nunca se monta. El borrador sí está en IndexedDB; lo que falta es la puerta.
3. **Restaurar está roto en dos puntos**: no se adopta el `logId` del borrador recuperado ni se borra el huérfano (que vuelve a ofrecerse tras finalizar), y no se reinstala la sesión en el contexto (el tiempo transcurrido vuelve a `00:00`).

## Fase 3 — Catálogo de ejercicios, taxonomía y medios (`05`)

1. **Cronos tiene dos catálogos que no son el mismo catálogo.** El del servidor (`public.exercises`, 7 columnas) y el local (`src/data/exercisesCatalog.json`, 16 campos, 16,3 MB). El local tiene **9 campos que el servidor no tiene** y el servidor **pierde 9 de los 10 idiomas** de las instrucciones.
2. **El catálogo local de 16,3 MB entra entero en el bundle** por import estático (`ExerciseSelectorModal.tsx:17`), aunque el modal se abra una vez por sesión.
3. **Taxonomía: un campo redundante y tres vocabularios musculares superpuestos.** `category` es **idéntico** a `body_part` en los 1 324 registros; `target` (19 valores), `muscle_group` (29) y `secondary_muscles` (40) nombran los mismos músculos de tres maneras.
4. **Cronos no tiene ninguna dimensión de taxonomía que las referencias sí tienen** (implicación muscular con rol y %, patrones de movimiento, tipos de entrenamiento, jerarquía de grupos, ponderación de series, compuesto/aislamiento).
5. **Cronos no soporta ejercicios creados por el usuario.** Es **la brecha funcional más grande de la Fase 3**: no hay tabla, ni columna `is_custom`, ni política de escritura, ni ruta de UI.
6. **Los 6 nombres duplicados del catálogo no se pueden desambiguar**: comparten `target`, `equipment`, `body_part` **y** `muscle_group`; el desambiguador que el importador promete devuelve la fila arbitrariamente.
7. **La estrategia de medios de Hevy es la referencia a copiar**: demostraciones en **MP4** desde CDN (672 URLs) + thumbnails (826 URLs); Cronos sirve **GIF** desde `main` de GitHub raw.
8. **Las fotos de maquinaria no cargan en 3 de 4 puntos de uso y las miniaturas de ejercicio en ninguno** → 404 silenciosos.
9. **El almacenamiento offline no cubre el catálogo**: ni service worker, ni `CacheStorage`, ni plugin PWA. Un arranque en frío sin red deja la app **sin catálogo y sin demos**.

## Fase 4 — Auditoría integral del código (`06`)

**Hallazgo central: Cronos Gym no tiene un problema de rendimiento — tiene dos aplicaciones.** Una que se ejecuta y otra que se testea.

1. **9 588 líneas de producción (48 ficheros, el 15,3 % del código de producción) son inalcanzables desde `src/main.tsx`**, y encierran **una pantalla de entrenamiento completa** —tabla de series, temporizador, audio, fatiga— que **solo los tests ven**.
2. **Dos implementaciones de la misma pantalla.** `src/components/workout/SetTable.tsx` (1 133 líneas) y sus 14 satellites (5 391 líneas; **6 157** con los módulos de `lib/` que solo ellos importan) dibujan las series de la manera correcta; `ActiveWorkout.tsx` (2 262 líneas) las dibuja en línea. **La suite de tests cubre la que no está en producción.**
3. **El motor de descanso, el audio y la fatiga viven íntegramente en esa isla**: en la app real **no hay beep, no hay vibración y no hay detección de fatiga**.
4. **El bundle principal mide 16,13 MB** (gzip 2,58 MB) por el catálogo embebido; dos `import()` dinámicos no hacen nada (el SDK de Supabase entra siempre).
5. **La tabla de ejercicios se descarga tres veces y entera** (`select("*")` de 1 324 filas en tres sitios).
6. **Tres representaciones incompatibles de `instructions`**, dos de ellas reventarían y dos mentirían si el catálogo llegara a ellas.
7. **`numeric` declarado como `number`**: `useAthletePRs.ts:192` **descarta toda fila cuyo peso no sea `number`** → el panel de récords puede aparecer vacío sin ningún error.
8. **Seis escritores de rutinas**, cinco con el mismo esqueleto, ninguno atómico, dos duplicados carácter por carácter; al restaurar se pierden `target_reps_min/max`, `is_favorite`, `authored_by_coach` y `created_at`.
9. **46 reglas de equipamiento**: la última es `/.*/`, así que **252 de 1 324 ejercicios (19 %) caen en la regla comodín**, 5 reglas no coinciden jamás y las reglas broad producen asignaciones **falsas y verificables**.
10. **Tres stubs de progreso** en el árbol de render muestran al usuario el literal `ConsistencyTracker (userId=none)`.
11. **El pipeline de importación tiene tres defectos verificados**: la barra de progreso divide filas por bytes, la detección de duplicados nunca se conecta, y un RPE inválido se reporta con el código de issue equivocado.

## Fase 4 — Arquitectura objetivo (`07`)

- **Cinco capas y una sola fuente de verdad por dato:** `domain` (modelo puro, sin React ni Supabase), `data` (Supabase + caché), `features` (pantallas y hooks), `app` (shell, rutas, providers) y `platform` (IndexedDB, medios, i18n, telemetría).
- **Diez principios** (P1–P10), cada uno con su referencia: una sola implementación por pantalla, un solo dueño por dato, el reloj vive en el reloj, escribir es atómico o no es escribir, el estado derivado no se guarda, la degradación es explícita y observable, un solo vocabulario por concepto, el bundle es un presupuesto, el tipo de datos es el contrato, el usuario es dueño de sus datos.
- **Modelo de datos unificado** que añade lo que las referencias tienen y Cronos no: implicación muscular con rol y porcentaje, grupo muscular a dos niveles, tipo de serie completo (`normal|warmup|drop|failure`), supersets, patrón de movimiento, tipo de entrenamiento primario/secundario y ejercicios creados por el usuario.
- **Motor de entrenamiento activo reescrito** sobre una máquina de estados explícita, con temporizador anclado y persistido (`endsAt` en epoch ms), resincronización al primer plano, recuperación de borrador en el arranque y escritura por **RPC transaccional** que elimina de raíz la ventana «sesión sin series».
- **Medios como recurso con clave, variantes y caché LRU con cuota**, catálogo comprimido persistido y **service worker** que deja la app utilizable sin red.
- **Presupuesto de rendimiento explícito:** chunk principal < 300 kB gzip, 0 filas del catálogo descargadas, ≤ 8 `useState` por componente, ≤ 600 líneas por componente, 0 `import()` que no divida bundle, 0 `catch` sin telemetría.
- **Plan de migración de 8 fases (M0–M7)** con criterios de entrada y salida verificables; M0 y M1 no tocan el esquema de datos y son reversibles en un commit cada una.
- **Riesgos identificados:** el más probable es que **M2 (decidir qué pantalla de entrenamiento es la real) se posponga**, y con ella el resto.

## Fase 5 — Plan, riesgos y bitácora (`08`, `09`, `10`)

- **Plan de refactorización priorizado (`08`):** reglas de la casa (una rama por ítem, un commit = un criterio de aceptación = un punto de reversión, cuatro niveles de validación, estrategia de reversión por tipo de cambio) y el detalle de **los 5 ítems P0** —conectar el `RestTimer` anclado, congelar `startedAt`, corregir el borrador recuperado, hacer flush en `pagehide` y avisar al final del descanso—, los **P1** (rehidratación, `SessionDraft` v2, reanudación al primer plano, shell offline) y los **P2** (`set_type` completo, supersets, snapshot de servidor), más las **8 olas M0–M7** con rama, commits, criterios de aceptación, validación y reversión.
- **Matriz de riesgos y preguntas abiertas (`09`):** ocho módulos **congelados** con su motivo y su ventana (`overload.ts` sin test, la persistencia local, la cola de sincronización, la taxonomía, el JSON del catálogo, `schema.sql`, `ActiveWorkout.tsx`, la tabla de alias del importador), los riesgos de migración (fugas en imports, esquema de ejercicios de usuario, sincronización Supabase ↔ IndexedDB), **12 preguntas abiertas** con su supuesto por defecto y **12 pruebas de estrés** pendientes, de las cuales 5 bloquean el primer refactor en producción.
- **Registro consolidado de ejecución (`10`):** inventario de herramientas (MCP REA, JADX, Node, esbuild), los **22 scripts de análisis** con su propósito, bitácora por fase, artefactos generados, advertencias (3 timeouts del cliente MCP, 1 flake de temporización, el error de métrica de líneas corregido) y estado final.

---

## Veredicto

Cronos Gym **no carece de capacidades**: tiene un motor de progresión por RPE que las cuatro referencias no tienen, una degradación offline total bien diseñada y un catálogo de 1 324 ejercicios con taxonomía que ninguna otra app expone. Lo que le falta es **coherencia**: una única implementación por pantalla, un único vocabulario por concepto, un único dueño por dato y un presupuesto de bundle que se respete.

La secuencia de trabajo que se desprende de la auditoría es: **decidir** qué pantalla de entrenamiento es la real (M2) → **fusionar** la isla de 9 588 líneas (M0, M3) → **arreglar** los defectos visibles (M1) → **corregir el modelo de datos** (M4) → **extraer el catálogo del bundle** (M5) → **unificar la taxonomía** (M6) → **exercises de usuario e i18n** (M7). Ninguna de esas fases se ha aplicado: `src/` y `supabase/` están intactos.

**Siguiente paso recomendado:** el plan de `08-refactor-roadmap.md` fija el orden real de ejecución, que no es M0–M7 sino los **5 ítems P0** —en el orden **P0.2 → P0.1 → P0.5 → P0.3 → P0.4**, unos 2 días, sin tocar el esquema— y después M1. Antes de tocar nada, `09-risks-and-open-questions.md` exige resolver la **pregunta Q1** (qué pantalla de entrenamiento es la canónica) y ejecutar las **pruebas de estrés E1–E5**, que bloquean el primer refactor en producción.

---

*Índice: `00-executive-summary.md` · `01-environment-and-inventory.md` · `03-data-model-comparison.md` · `04-active-workout-and-timer.md` · `05-catalog-and-media.md` · `06-cronos-code-audit.md` · `07-target-architecture.md` · `08-refactor-roadmap.md` · `09-risks-and-open-questions.md` · `10-execution-log.md`*
