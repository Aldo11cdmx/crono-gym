# Fase 4 — Auditoría integral del repositorio de Cronos Gym

**Alcance:** el código de producción de `C:\Users\yayog\crono-gym\src/` (350 ficheros `.ts`/`.tsx`: 221 de producción y 129 de prueba), el esquema de Supabase (`supabase/schema.sql` + 7 migraciones) y el resultado de un **build de producción real** ejecutado durante esta fase. Se auditó: componentes, hooks, utilidades, tipos, stores, imports/exports, sincronización Supabase ↔ IndexedDB, re-renders, manejo de errores, duplicación, i18n, catálogo de ejercicios y catálogo de equipamiento.

**Estado del baseline:** intacto. Ningún archivo de `src/` ni de `supabase/` fue modificado en esta fase. El único artefacto producido es este documento.

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` (`tsc --noEmit`) | ✅ limpio, 0 errores |
| Build | `npm run build` (`tsc -b && vite build`) | ✅ correcto — **1792 módulos**, chunk principal de **16,13 MB** |
| Tests | `npm test` (`vitest run`) | ✅ **129** ficheros de test en verde, 0 fallos (309,15 s), confirmado en dos ejecuciones consecutivas — recuento consolidado de la Fase 5: **4 ejecuciones completas**, ver `10-execution-log.md` §5 |
| Diff de producción | `git status` | sin cambios en `src/` ni en `supabase/` respecto al inicio de la fase |
| Bundle | `vite build` | `dist/` = 169 ficheros, 39,81 MB; chunk principal 16,13 MB (gzip 2,58 MB) |

> **Nota de estabilidad.** En una ejecución canalizada con filtrado de salida se observó un fallo puntual de temporización en `src/components/coach/portal/RequestQueue.test.tsx` (*«lee los nombres de los atletas en una segunda consulta»*). El caso pasa de forma aislada (6,76 s) y en las dos ejecuciones completas el fichero va en verde (20 tests, 3 519 ms). Es una prueba sensible a la carga del entorno, ajena a esta fase: no se ha modificado ningún archivo de `src/`.

---

## 1. Resumen ejecutivo

1. **9 588 líneas de código de producción —48 ficheros, el 15,3 %— son inalcanzables desde `src/main.tsx`.** No es «código viejo»: es una isla paralela de **6 157 líneas de interfaz de entrenamiento que la suite de tests valida y ningún usuario ve jamás**.
2. **La isla principal es la tabla de series.** `src/components/workout/SetTable.tsx` (1 133 líneas) y sus satellite —`SetTypeSheet.tsx` (229), `SetNoteField.tsx` (354), `WeightStepper.tsx` (437), `FatigueBadge.tsx` (69), `ExerciseStage.tsx` (362), `ExerciseActions.tsx` (138), `PreWorkoutSummary.tsx` (241), `SetLoggerRow.tsx` (383), `RestTimer.tsx` (513), `RecordBadge.tsx` (200), `ComparisonChart.tsx` (332), `ExercisePicker.tsx` (277), `ExerciseCard.tsx` (193), `FilterChips.tsx` (88)— suman **5 391 líneas** que **solo** se alcanzan desde `*.test.tsx`; añadidos los módulos de `lib/` que únicamente ellos importan, la isla completa son **26 ficheros y 6 157 líneas**. La pantalla de entrenamiento real (`ActiveWorkout.tsx`, 2 262 líneas) dibuja sus series **en línea**, con su propia lógica. Hay **dos implementaciones de la misma pantalla** y los tests cubren la que no está en producción.
3. **El motor de descanso, el audio y la fatiga viven íntegramente en esa isla.** `src/lib/workout/restTimer.ts` (86), `src/lib/audio/audio.ts` (122), `src/lib/workout/fatigue.ts` (162) y `src/lib/workout/recordBreak.ts` (75) **no son alcanzables desde `main.tsx`**: solo los importa `RestTimer.tsx` / `SetTable.tsx`, que a su vez solo importan los tests. En la app real, **no hay beep, no hay vibración y no hay detección de fatiga**.
4. **El bundle principal mide 16,13 MB** (gzip 2,58 MB) porque `exercisesCatalog.json` (16,26 MB) entra por import estático en `ExerciseSelectorModal.tsx:17`. La comprobación es directa: el chunk contiene **1 325 apariciones** de la cadena `availableInCronosGym` (1 324 registros + la interfaz). El chunk *lazy* de `ExerciseHub` pesa 35 kB: el catálogo se descarga **antes del primer pintado**, no cuando se abre el hub.
5. **Dos `import()` dinámicos no hacen nada.** `src/lib/ai/coachAssistant.ts:363` y `src/lib/coach/useCoachAuth.ts:231` importan `@/lib/supabase` de forma dinámica con la intención de diferir el SDK; Vite avisa de que 26 módulos lo importan estáticamente, así que **el SDK entra siempre en el bundle principal**. Lo mismo con `src/lib/ai/coachAssistant.ts` desde `routineGenerator.ts:658`.
6. **La tabla de ejercicios se descarga tres veces y entera.** `useGymData.ts:115`, `ExerciseBrowser.tsx:106` y `useExerciseCatalog.ts:56` hacen `select("*")` de 1 324 filas sin filtro. El catálogo es inmutable e idéntico para todos los atletas: es un activo estático, no una consulta.
7. **Tres representations incompatibles de `instructions`** conviven: `text[]` en Postgres (`types/supabase.ts:30`), `string[]` en la semilla (`seedExercises.ts:23-31`) y `Record<string,string>` en el catálogo local (`ExerciseSelectorModal.tsx:43`). Dos consumidores **reventarían** (`TutorialModal.tsx:64`, `hub/TechniqueTips.tsx:73`) y dos **mentirían** (`ExerciseDetailSheet.tsx:137`, `ExercisePanel.tsx:71`) si el catálogo llegara a ellos. Hoy están protected por un cast `as` y por un puente que fuerza `instructions: []`.
8. **`numeric` está declarado como `number`.** `completed_sets.weight`/`rpe` son `numeric` en SQL (`schema.sql:84,86`) pero `number` en TypeScript (`types/supabase.ts:219,221`). Dos módulos del mismo repo asumen tipos distintos para la misma columna: `exerciseHistory.ts:95-99` se defi ende con `parseWeight`, `useAthletePRs.ts:192` **descarta toda fila cuyo peso no sea `number`** — el panel de récords puede aparecer vacío sin ningún error.
9. **Tres tablas tipadas no tienen DDL en el repositorio**: `bodyweight_entries`, `body_measurements` y `session_checkins`. `useProfile.ts:155,161,167,192` las consulta. El `upsert` de `bodyweight_entries` usa `onConflict: "user_id,measured_on"` sin que exista la clave única correspondiente.
10. **La conexión de la sincronización traga errores.** `src/lib/sessionSync.ts:151-155` envuelve `drainQueue()` en un `catch { return null; }`: si el drenaje falla, la UI **no se entera** y la sesión queda en la cola sin señal visible.
11. **46 reglas de equipamiento, 3 fallbacks inalcanzables.** La última regla es `/.*/`, que casa con cualquier texto, así que el bucle de `equipmentCatalog.ts:264-268` **siempre retorna** y los tres fallbacks siguientes (`:270-285`, `:287-304`, `:306-307`) **nunca se ejecutan**. Medido sobre el catálogo real: **252 de 1 324 ejercicios (19,0 %)** caen en la regla comodín; **5 reglas no coinciden jamás** con nada; y las reglas broad (`lat`, `leg`, `extension`, `kickback`) producen asignaciones **falsas y verificables** — «band front lateral raise» recibe el **jalón pecho**, «dumbbell tricep kickback» recibe la **torre de poleas**, «back extension on exercise ball» también.
12. **Seis escritores de rutinas, cinco con el mismo esqueleto**, ninguno atómico, y **dos de ellos duplicados carácter por carácter** (`RoutinesPage.tsx:196-244` ≡ `RoutineLibrary.tsx:1016-1064`). Al restaurar una rutina se pierden `target_reps_min/max`, `is_favorite`, `authored_by_coach` y `created_at`.
13. **Tres stubs de progreso están en el árbol de render de producción.** `progress/ConsistencyTracker.tsx`, `progress/ProgressCharts.tsx` y `progress/WorkoutHistory.tsx` (15 líneas cada uno) se montan en `AnatomicalRanksPage.tsx:307-309` y muestran al usuario el literal `ConsistencyTracker (userId=none)`.
14. **El store IndexedDB `exerciseNotes` es esquema muerto**, documentado con 14 líneas de comentario (`idb.ts:64-78`) y **verificado en tests** (`idb.test.ts:76,89`) pero **nunca leído ni escrito** en runtime. Los datos reales viven en `completed_sets.notes`.
15. **i18n sin sistema de locales.** `src/lib/i18n.ts` son 1 937 líneas de diccionarios anidados **en español fijo**: no hay selector de idioma, ni bundles por locale, ni cadena de repliegue. El catálogo trae instrucciones en 10 idiomas y la semilla solo usa `.es`.
16. **El pipeline de importación tiene tres defectos verificados**: la barra de progreso divide **filas por bytes** y nunca avanza (`importCsv.worker.ts:89` vs `useCsvImport.ts:182`); la detección de duplicados contra la base (`existingImportIds`) **nunca se conecta** al asistente; y un RPE inválido se reporta con el código de issue `unparseable_reps` (`analyze.ts:314`), que no corresponde.

> **Conclusión.** Cronos Gym no tiene un problema de rendimiento: tiene **dos aplicaciones**. Una que se ejecuta y otra que se testea. La limpieza no consiste en borrar código viejo, sino en **decidir cuál de las dos pantallas de entrenamiento es la real**, y a partir de ahí fusionar, extraer y eliminar. Ese es el eje del informe.

---

## 2. Método y reproducibilidad

La auditoría combinó cuatro técnicas independientes. Las tres primeras son **deterministas** y su resultado es reproducible con un script; la cuarta es lectura directa.

| Técnica | Qué mide | Cómo se reprodujo |
|---|---|---|
| **Alcanzabilidad desde la entrada** | Qué ficheros se pueden cargar en runtime | Grafo de aristas `import`/`import()`/`new URL(...)` desde `src/main.tsx`, BFS, conjunto no alcanzable |
| **Clasificación de exports** | Qué símbolos no son consumidos | Extracción de `export` por regex + conteo de identificadores con límite de palabra en todos los ficheros, separando «cero referencias» de «solo interno» |
| **Resolución de imports** | Imports rotos, ciclos, alias | Resolución contra los alias de `tsconfig.json` (`@/*`, `@lib/*`, `@services/*`, `@components/*`) |
| **Ejecución real del código** | Reglas de equipamiento, distribución por regla, bundle | `esbuild` sobre `equipmentCatalog.ts` + ejecución sobre los 1 324 registros del catálogo; `npm run build` completo |

Los scripts de auditoría se escribieron **fuera del repositorio**, en `%TEMP%\kilo\`, y no forman parte del proyecto. El build sí modificó `dist/`, que está en `.gitignore` (línea 5) y por tanto no altera el estado del repositorio.

### 2.1 Falsos positivos que se descartaron explícitamente

Una auditoría de código muerto produce falsos positivos si no se distingue el código *no alcanzable* del código *inaccesible por la forma de la referencia*. Se comprobaron y descartaron:

| Hipótesis | Veredicto | Evidencia |
|---|---|---|
| `src/workers/importCsv.worker.ts` está muerto | **Falso positivo** | Vite lo carga con `new Worker(new URL("../workers/importCsv.worker.ts", import.meta.url))` en `useCsvImport.ts:88`; el grafo lo modela explícitamente |
| `src/lib/exercise/exerciseSchema.test.ts` es un test sin implementación | **Falso positivo** | Test de arquitectura: importa el SQL, los tipos y tres módulos con `?raw` y comprueba que concuerdan |
| `src/lib/ranks/ranksEngine.test.ts` es un test sin implementación | **Falso positivo** | Test de integración sobre `muscleScore` + `scoreToRank` + `rankConfig` + `rankColors` |
| `src/hooks/useFavorites.test.tsx` es un test sin implementación | **Falso positivo** | Prueba `useRoutines.toggleFavorite` dentro de `useGymData` |
| `src/components/dashboard/ActionMenu.test.tsx` es un test sin implementación | **Falso positivo** | `ActionMenu` se exporta desde `RoutinesPage.tsx:1368` |
| `src/components/profile/ProfileView.tsx` está muerto | **Parcialmente** | El **componente** no se renderiza en producción; el módulo sí es alcanzable porque `ProfilePage.tsx:51` importa sus helpers `bmiOf` y `configuredSizes` |
| `src/components/progress/*.tsx` están muertos | **Falso positivo** | Se montan en `AnatomicalRanksPage.tsx:307-309`. Son **stubs**, no código muerto |

---

## 3. Inventario de `src/`

| Área | Ficheros prod. | Líneas prod. | Observación |
|---|---|---|---|
| `components/` | 100 | 35 865 | 20 componentes > 500 líneas; 9 > 1 000 |
| `lib/` | 80 | 18 157 | Núcleo de dominio: 11 sub-módulos |
| `hooks/` | 21 | 3 683 | 19 hooks de datos + 2 de utilidades |
| `context/` | 3 | 486 | `ActiveSession`, `GymSettings`, `AuthModal` |
| `types/` | 1 | 667 | `supabase.ts`: 13 tablas, 17 exports |
| `data/` | 5 | 1 155 | Incluye el catálogo de 16,26 MB (1 línea) |
| `services/` | 1 | 146 | `seedExercises.ts` |
| `design/` | 5 | 1 790 | `tokens.ts` son 1 195 líneas |
| `workers/` | 1 | 159 | Importado por URL, no por módulo |
| (raíz de `src/`) | 4 | 525 | `App.tsx` (438), `main.tsx` (25), `vite-env.d.ts` (17), `test-support/color.ts` (45) |
| **Total** | **221** | **62 633** | + 129 ficheros de test (36 261 líneas) |

> **Convención de medida.** Todas las cifras de líneas de este informe son **líneas físicas** (una línea por salto de línea del fichero), no líneas no vacías ni métricas de complejidad. Los recuentos de hooks son **apariciones del identificador** en el fichero, incluido el `import` que lo trae.

### 3.1 Los diez componentes más grandes

| Fichero | Líneas | `useState` | `useEffect` | `useMemo` | `useCallback` | Veredicto |
|---|---|---|---|---|---|---|
| `components/ActiveWorkout.tsx` | 2 262 | 18 | 7 | 6 | 5 | **Monstruo**: pantalla, estado, temporizador, sincronización y render de series en un solo archivo |
| `components/dashboard/RoutinesPage.tsx` | 1 867 | 14 | 6 | 7 | 18 | Monstruo: lista, planificador, biblioteca, archivado y borrado/restauración |
| `components/import/ImportWizard.tsx` | 1 099 | 12 | 0 | 4 | 7 | 4 pasos de asistente, 12 estados |
| `components/ranks/AnatomicalRanksPage.tsx` | 1 114 | 7 | 2 | 6 | 5 | Copia *casi* idéntica del `.backup.tsx` |
| `components/ranks/AnatomicalRanksPage.backup.tsx` | 1 104 | 7 | 2 | 6 | 5 | **99,1 % duplicado** del anterior (`git diff --no-index`: 10 líneas añadidas) |
| `components/profile/ProfilePage.tsx` | 1 196 | — | — | — | — | Formulario de perfil + pasarela de importación |
| `components/workout/SetTable.tsx` | 1 133 | — | — | — | — | **No está en producción** (§4.2) |
| `components/dashboard/DashboardPage.tsx` | 1 544 | — | — | — | — | Métricas + hero + mapa muscular |
| `components/dashboard/RoutineLibrary.tsx` | 1 064 | — | — | — | — | **Duplica** `RoutinesPage` en 49 líneas literales |
| `components/Onboarding.tsx` | 774 | 5 | 0 | 6 | 0 | Asistente de alta |

**Umbral de contexto.** Con 2 262 líneas, `ActiveWorkout.tsx` supera por sí solo el presupuesto de lectura de un modelo. Está en el centro de tres de los hallazgos más graves (isla de series, temporizador muerto, sincronización).

---

## 4. Código muerto

### 4.1 El método y su resultado

Alcancabilidad desde `src/main.tsx`: **173 de 350 ficheros**. No alcanzables: **177** (129 de prueba + **48 de producción**).

| Categoría | Ficheros | Líneas |
|---|---|---|
| Isla de entrenamiento y satellite (inalcanzable, la alcanzan los tests) | 26 | 6 157 |
| Componentes huérfanos sin ningún importador | 14 | 2 922 |
| Módulos de dominio huérfanos (`lib/`, `data/`, `hooks/`) | 7 | 492 |
| Copia de respaldo (`AnatomicalRanksPage.backup.tsx`) | 1 | 1 104 |
| Infraestructura (`vite-env.d.ts`) | 1 | 17 |

**Total de código de producción inalcanzable: 9 588 líneas —48 ficheros, el 15,3 % de las 62 633 líneas de producción.**

### 4.2 La isla de la pantalla de entrenamiento — el hallazgo central

Este es el bloque más importante del informe, así que se documenta con la cadena de imports completa.

```
main.tsx
  └─ App.tsx ─ ActiveWorkout.tsx ──┐   (2 262 líneas, DIBUJA LAS SERIES EN LÍNEA)
                                     │
                                     ├── ExerciseCarousel.tsx          ✔ vivo
                                     ├── ExerciseSelectorModal.tsx    ✔ vivo
                                     │
  ┌──────────────────────────────────┴─────────────────────────────────┐
  │  ISLA: nadie entra desde la app                                   │
  │                                                                    │
  │  SetTable.tsx (1 133) ─┬─ SetTypeSheet.tsx (229)                  │
  │                         ├─ SetNoteField.tsx (354) ─ setNotes.ts    │
  │                         ├─ WeightStepper.tsx (437) ─ weightUtils   │
  │                         ├─ FatigueBadge.tsx (69) ─ fatigue.ts (161)│
  │                         ├─ ExerciseStage.tsx (362)                 │
  │                         ├─ ExerciseActions.tsx (138)               │
  │                         ├─ PreWorkoutSummary.tsx (241)             │
  │                         └─ recordBreak.ts (75)                     │
  │  RestTimer.tsx (513) ─┬─ lib/workout/restTimer.ts (85)            │
  │                       └─ lib/audio/audio.ts (121)                 │
  │  SetLoggerRow.tsx (383)   RecordBadge.tsx (200) ─ lib/audio       │
  │  ExercisePicker.tsx (277) ─ ExerciseCard.tsx (193), FilterChips   │
  │  ComparisonChart.tsx (332)                                     │
  └────────────────────────────────────────────────────────────────────┘
```

Los 19 ficheros del diagrama suman **5 391 líneas**; la isla completa (26 ficheros, con los módulos de `lib/`, `lib/ai/` y `test-support/` que solo ellos importan) son **6 157 líneas**.

Consecuencias verificables:

| Consecuencia | Evidencia |
|---|---|
| **La app real no tiene beep ni vibración al terminar el descanso** | `lib/audio/audio.ts` solo lo importan `RestTimer.tsx` y `RecordBadge.tsx`, ambos inalcanzables |
| **La app real no calcula fatiga de series** | `lib/workout/fatigue.ts` solo lo importan `SetTable.tsx` y `FatigueBadge.tsx`, ambos inalcanzables |
| **La app real no detecta récords por serie** | `lib/workout/recordBreak.ts` solo lo importa `SetTable.tsx` |
| **La suite verde valida una pantalla que no existe** | 25 ficheros de test alcanzan la isla: `SetTable.test.tsx` (725 líneas), `WeightStepper.test.tsx` (470), `useCoachAccess.test.ts` (427), `ComparisonChart.test.tsx` (378), `RestTimer.test.tsx` (305), `ExerciseStage.test.tsx` (290), `SetLoggerRow.test.tsx` (277), `PreWorkoutSummary.test.tsx` (275), `SetNoteField.test.tsx` (233), `ExerciseActions.test.tsx` (220), `exerciseNotes.test.ts` (220), `RecordBadge.test.tsx` (204), `audio.test.ts` (182), `ExercisePicker.test.tsx` (166), `ExerciseCard.test.tsx` (149), `fatigue.test.ts` (135) y 9 más — **5 724 líneas de test** sobre código que el usuario nunca carga |
| **El proyecto tiene dos implementaciones de la misma pantalla** | `ActiveWorkout.tsx` usa `SET_LOGGER_LABELS` + `SetEntry` directamente (imports en `:33,34,73,74`); `SetTable.tsx` implementa la misma UI de forma independiente |

> **Por qué importa.** Un indicador de cobertura verde que apunta a la implementación equivocada es peor que no tener tests: da una confianza falsa sobre el camino que sí se ejecuta. Cualquier regresión en la pantalla real de entrenamiento no la detecta ningún test.

### 4.3 Huérfanos de componente (cero importadores)

| Fichero | Líneas | Qué es | Confianza | Riesgo de falso positivo |
|---|---|---|---|---|
| `components/ranks/AnatomicalRanksPage.backup.tsx` | 1 104 | Copia de la página de rangos, 10 líneas de diferencia | Alta | Bajo — `git diff --no-index` lo confirma |
| `components/RoutineBuilder.tsx` | 483 | Constructor de rutinas legacy; `RoutinesPage.tsx:7` solo lo nombra en un comentario | Alta | Medio — podría querer reinstate; preguntar al equipo |
| `components/NotionJournal.tsx` | 161 | Diario tipo Notion, nunca montado | Alta | Bajo |
| `components/workout/DynamicIsland.tsx` | 265 | Isla flotante tipo iOS, nunca montada | Alta | Bajo |
| `components/EquipmentModal.tsx` | 127 | Modal de maquinaria; usa `public/images/…` roto (§9.3) | Alta | Bajo |
| `components/GripPopover.tsx` | 99 | Popover de agarre; su único consumidor (`gripMap`) es placeholder | Alta | Bajo |
| `components/ExercisePanel.tsx` | 116 | Panel de ejercicio legacy | Alta | Bajo |
| `components/TutorialModal.tsx` | 77 | Modal de tutorial; `ActiveWorkout.test.tsx:67` hace `vi.mock` obsoleto | Alta | Bajo |
| `components/ComingSoon.tsx` | 23 | Marcador de «próximamente» | Alta | Bajo |
| `components/ActiveWorkoutHeader.tsx` | 75 | Cabecera extraída, nunca usada | Alta | Bajo |
| `components/profile/BiometricsInputs.tsx` | 136 | Entradas biométricas | Alta | Medio — `ProfilePage` podría haberlas sustituido |
| `components/profile/GoalChips.tsx` | 140 | Chips de objetivo | Alta | Medio — ídem |
| `components/profile/InjuryField.tsx` | 115 | Campo de lesión | Alta | Medio — ídem |
| `components/profile/AthleteContextForm.tsx` | 1 | `export {}` — archivo vacío | Alta | Ninguno |
| `components/charts/ComparisonChart.tsx` | 332 | Gráfico comparativo | Alta | Bajo |
| `components/ExercisePicker.tsx` | 277 | Selector legacy (sustituido por `ExerciseBrowser`) | Alta | Medio |

### 4.4 Exports muertos: clasificación de 1 165 símbolos

| Categoría | Símbolos | Qué significa | Qué hacer |
|---|---|---|---|
| **CERO referencias** | **55** | No los menciona nadie, ni su propio archivo | **Eliminar** |
| **Solo interno** | **265** | Se usan dentro de su archivo, pero están `export`ados | **Quitar el `export`** |
| **Solo tests** | **49** | Solo los usan `*.test.tsx` | Decide:(test de contrato) o **eliminar** |
| **Vivos** | **702** | Consumidos por código de producción | Nada |
| **Tipo, sin referencias** | **183** + 15 + 0 | Interfaces huérfanas (`*Props`, `*State`) | Ruido: **bajar el `export`** o dejar |

> **Por qué `tsc` no lo detecta.** `tsconfig.json:13-14` activa `noUnusedLocals` y `noUnusedParameters`: TypeScript avisa de lo no usado **dentro** de un archivo, pero **no** de un `export` que nadie importa. Por eso 55 exports muertos y 265 exports superfluos sobreviven a un typecheck limpio.

**Los 55 exports con cero referencias** (verificados con grep sobre todo `src/`):

| Fichero | Símbolo | Nota |
|---|---|---|
| `data/equipmentCatalog.ts` | `getEquipmentForExercise`, `getEquipmentById`, `getEquipmentByCategory` | Subsistema de equipamiento |
| `data/equipmentMap.ts` | `getEquipmentViews` | Subsistema de equipamiento |
| `data/gripMap.ts` | `getGripForExercise` | El mapa interno está **vacío** (`const map: Record<string,string> = {}` con solo comentarios) |
| `data/myGymEquipment.ts` | `MY_GYM_GROUPS`, `UNAVAILABLE_EQUIPMENT` | Subsistema de equipamiento |
| `lib/equipmentHelpers.ts` | `getEquipmentIdByName` | Todo el fichero (11 líneas) es esto |
| `data/gripMap.ts` | `gripMap` (el valor) | Solo se importa el **tipo** `Grip` |
| `components/ActiveWorkoutHeader.tsx` | `ActiveWorkoutHeader` | Componente huérfano |
| `components/EquipmentModal.tsx` | `EquipmentModal` | Componente huérfano |
| `components/GripPopover.tsx` | `GripPopover` | Componente huérfano |
| `components/shell/navItems.ts` | `exercisePath` | Función de construcción de ruta |
| `components/charts/ProgressChart.tsx` | `PROGRESS_CHART_DRAW_MS` | Constante |
| `components/coach/CoachFloatingButton.tsx` | `COACH_PORTAL_PATH`, `FAB_Z_INDEX` | Constantes duplicadas de `navItems` |
| `components/hub/ProgressionTab.tsx` | `HUB_PERIODS` | Periodos no usados |
| `components/import/ImportWizard.tsx` | `IMPORT_STEPS`, `LARGE_FILE_BYTES` | — |
| `components/ranks/SymmetryRadar.tsx` | `BODY_BLOCKS` | — |
| `components/shell/ActiveWorkoutPill.tsx` | `ROUTINE_NAME_MAX`, `LONG_SESSION_MS` | — |
| `components/workout/ExerciseActions.tsx` | `visuallyHidden` | — |
| `design/color.ts` | `bestInk`, `RED_HUE_ARCS`, `SATURATED_RED_MIN_SATURATION`, `describeRedViolation`, `JUST_NOTICEABLE_DELTA_E` | Lógica de color no cableada |
| `design/tokens.ts` | `statusFor`, `RANK_COLORS`, `RankColorToken`, `TypeRole` | — |
| `design/logoGradient.ts` | `LOGO_GRADIENT_SVG` | — |
| `design/sheetGradients.ts` | `HANDLE_VIGNETTE`, `HANDLE_GLOW` | — |
| `lib/ai/chatStorage.ts` | `loadAllChats`, `clearChat`, `clearAllChats` | API de borrado de chat sin usar |
| `lib/ai/openrouter.ts` | `FREE_VISION_PARAMS` | — |
| `lib/ai/routineGenerator.ts` | `MAX_ROUTINE_TOKENS` | — |
| `lib/ai/userContext.ts` | `buildUserContextPreamble`, `buildUserPreamble` | **Fichero entero (247 líneas) inalcanzable** |
| `lib/dashboard/formatters.ts` | `formatDateKey`, `formatDuration`, `formatDateMedium` | `formatDateMedium` sí se usa, pero **solo dentro del fichero** |
| `lib/i18n.ts` | `UNITS_LABELS` | — |
| `lib/import/commit.ts` | `existingImportIds` | **La detección de duplicados contra la base no se ejecuta nunca** (§10) |
| `lib/muscleMap.ts` | `ALL_SLUGS`, `catalogVocabulary`, `exerciseMatchesMuscle` | — |
| `lib/offlineStore.ts` | `loadDraft` | `loadRecoverableDraft` resuelve el caso real |
| `lib/overload.ts` | `formatPrevious`, `KCAL_PER_KG` | — |
| `lib/picker/pickerTokens.ts` | `PICKER_COLOR`, `PICKER_RADIUS`, `PICKER_SPACE` | **Fichero entero (96 líneas) inalcanzable** |
| `lib/profile.ts` | `inchesToFeetInches` | — |
| `lib/profile/validation.ts` | `isValidHeightCm`, `isValidWeightKg`, `validateAthleteContext` | — |
| `lib/ranks/heatmapColors.ts` | `heatmapGlowFor`, `weeklySetsByMuscle` | — |
| `lib/ranks/neonRanks.ts` | `getNeonStyleForMuscle` | **Fichero entero (49 líneas) inalcanzable** |
| `lib/ranks/rankHistory.ts` | `clearRankHistoryFor` | — |
| `lib/routines/routineDraftModel.ts` | `routineDayEntries` | — |
| `lib/workout/weightUtils.ts` | `QUICK_INCREMENTS_KG` | — |
| `services/seedExercises.ts` | `normalizeRecord`, `FailedToFetchExercisesError` | — |
| `types/supabase.ts` | `CoachLoginAttemptRow`, `RoutineSource` | — |
| `lib/profile/consent.ts` | `ConsentRecord` | — |
| `lib/routines/routinesViewModel.ts` | `AssignmentHistorySnapshot` | — |

### 4.5 Los 10 exports muertos del subsistema de equipamiento

Reclamados en la Fase 3 y **verificados aquí uno a uno** con `grep` sobre todo `src/`:

| # | Símbolo | Fichero:línea | Consumidores en runtime | Estado real |
|---|---|---|---|---|
| 1 | `getEquipmentForExercise` | `data/equipmentCatalog.ts:324` | 0 | **Cero referencias** |
| 2 | `getEquipmentById` | `data/equipmentCatalog.ts:335` | 0 | **Cero referencias** |
| 3 | `getEquipmentByCategory` | `data/equipmentCatalog.ts:342` | 0 | **Cero referencias** |
| 4 | `getEquipmentViews` | `data/equipmentMap.ts:614` | 0 | **Cero referencias** |
| 5 | `getGripForExercise` | `data/gripMap.ts:34` | 0 | **Cero referencias**; su mapa interno está **vacío** |
| 6 | `gripMap` (valor) | `data/gripMap.ts:10` | 0 (solo se importa el **tipo** `Grip`) | **Cero referencias** |
| 7 | `MY_GYM_GROUPS` | `data/myGymEquipment.ts:98` | 0 | **Cero referencias** |
| 8 | `UNAVAILABLE_EQUIPMENT` | `data/myGymEquipment.ts:79` | 0 | **Cero referencias** |
| 9 | `getEquipmentIdByName` | `lib/equipmentHelpers.ts:3` | 0 | **Cero referencias** (todo el fichero) |
| 10 | `FREE_WEIGHTS_AVAILABLE` | `data/myGymEquipment.ts:25` | 0 externos; 1 interno (`:75`) | **Solo interno** → quitar `export` |

**Exports vivos del mismo subsistema (control negativo):** `equipmentMap` (`equipmentCatalog.ts:1,121`, `equipmentHelpers.ts:1`, `EquipmentModal.tsx:3`), `getEquipmentSuggestionForExercise` (`ExerciseSelectorModal.tsx:16,92`, `ActiveWorkout.tsx:77,1523`), `MY_GYM_MACHINES` y `MY_GYM_EQUIPMENT_TAGS` (`myGymEquipment.ts:27,72`, usados por `lib/ai/tools.ts`, `lib/routines/exerciseSwap.ts`, `dashboard/RoutinesPage.tsx`), `isAvailableInMyGym` (`lib/routines/exerciseSwap.ts`).

**Exports solo-internos (265 en total, 5 aquí):** `EQUIPMENT_RULES` (`equipmentCatalog.ts:181`, usado en `:264,307`), `exerciseNameToSlug` (`:193`, usada en `:271,289`), `equipmentTypes` (`availableEquipment.ts:1`), `freeEquipment` (`availableEquipment.ts:36`, re-exportado en `equipmentCatalog.ts:313` sin consumidor).

---

## 5. Datos: tipos ↔ esquema ↔ runtime

### 5.1 Las tres representaciones de `instructions`

| Representación | Tipo | Dónde | Qué guarda |
|---|---|---|---|
| Fila de Postgres | `string[]` | `types/supabase.ts:30` (Row), `:39` (Insert), `:48` (Update) | Pasos en un idioma |
| Semilla desde upstream | `string[]` | `services/seedExercises.ts:23-31` (construido desde `instruction_steps.es`) | Pasos en español |
| Catálogo local JSON | `Record<string,string>` + `instruction_steps: Record<string,string[]>` | `ExerciseSelectorModal.tsx:43,46`; `as CatalogExercise[]` en `:77` | Párrafo por idioma + pasos por idioma |

**Consumidores y su modo de fallo** si una fila del catálogo llegara a ellos sin el puente:

| Consumidor | Operación | Con un objeto | Resultado |
|---|---|---|---|
| `TutorialModal.tsx:17,58,64` | `steps.length === 0`, `steps.map(...)` | `undefined === 0` → falso; `steps.map` no es función | **`TypeError` — reventaría** |
| `hub/TechniqueTips.tsx:68,71,73` | `instructions.length === 0`, `instructions.slice(...)` | `undefined`, sin `.slice` | **`TypeError` — reventaría** |
| `ExerciseDetailSheet.tsx:137,149` | `instructions.length > 0`, `instructions.map(...)` | `undefined > 0` → falso | **Silencio**: el bloque no se renderiza |
| `ExercisePanel.tsx:71-72` | `instructions?.length` | `undefined` | **Silencio**: muestra «Sin pasos» |

**Por qué hoy no explota:** el único camino que mete el JSON en la app es `ActiveWorkout.tsx:1568-1576`, que convierte la fila del catálogo a `Exercise` (fila de BD) con `instructions: []` **literal**. El cast `as CatalogExercise[]` de `ExerciseSelectorModal.tsx:77` salta la verificación de tipos. El riesgo es de **regresión**, no de producción actual.

**La divergencia adyacente:** la simulación y la tabla no comparten granularidad. `completed_sets.instructions` guarda pasos; la semilla toma **solo** `instruction_steps.es` (`seedExercises.ts:45-60`), así que los otros 9 idiomas del catálogo **nunca llegan al servidor**. `gif_url` también difiere: la BD lo guarda absoluto, el JSON lo trae relativo (`videos/0001-….gif`).

### 5.2 `numeric` declarado como `number`

| Columna | SQL | TypeScript | Consecuencia |
|---|---|---|---|
| `completed_sets.weight` | `numeric` (`schema.sql:84`) | `number \| null` (`types/supabase.ts:219`) | PostgREST serializa `numeric` como **cadena** en JSON |
| `completed_sets.rpe` | `numeric` (`schema.sql:86`) | `number \| null` (`types/supabase.ts:221`) | Ídem |

El repo **lo admite** en `lib/exercise/exerciseHistory.ts:57-58` (*«`numeric` in Postgres, so a decimal string»*) y lo compensa con un cast `as unknown as RawRow` (`:135`) más un `parseWeight` que acepta `number | string` (`:95-99`). El módulo hermano `hooks/useAthletePRs.ts:192` hace `typeof weight !== "number" → continue`: **descarta toda fila en silencio**. Con la serialización real de PostgREST, el panel de récords personales aparece **vacío y sin error**.

Ambos módulos usan `as unknown as` (`useAthletePRs.ts:133`, `exerciseHistory.ts:135`), así que **el sistema de tipos no protege ninguno de los dos**. Confianza alta sobre la divergencia interna; media sobre cuál es el tipo real en runtime (requiere una consulta de prueba contra el servidor).

### 5.3 Tablas tipadas sin DDL y tablas sin tipar

**Tipadas en `types/supabase.ts` pero sin `CREATE TABLE` en el repositorio:**

| Tabla | Tipo | Se consulta en | Impacto |
|---|---|---|---|
| `bodyweight_entries` | `:332` | `useProfile.ts:192` | El `upsert` usa `onConflict: "user_id,measured_on"` **sin que exista la clave única** → Postgres rechaza con «there is no unique or exclusion constraint matching the ON CONFLICT specification» |
| `body_measurements` | `:359` | `useProfile.ts:167` | Error en cada lectura |
| `session_checkins` | `:407` | `useProfile.ts:155` | Error en cada lectura |

**Creadas en SQL pero sin tipo:** `coach_rate_limits` (`20260101000000_coach_ai.sql:18`) y `coach_usage` (`:44`). No las consume ningún cliente (RLS las restringe), pero contradicen la afirmación de `types/supabase.ts:19-20` de que `Database` refleja el esquema.

### 5.4 Desajustes de nulabilidad TS ↔ SQL (7 columnas)

| Tabla | Columna | SQL | TypeScript | Impacto |
|---|---|---|---|---|
| `routines` | `source` | `not null default 'user'` (`20261003020000_coach_human.sql:403-404`) | Row: `… \| null` (`types:68`); Update: admite `null` (`:112`) | El tipo contradice al DDL; `Update` con `null` daría error 23502 |
| `routines` | `user_id` | — | `Update` lo admite (`:107`) | El tipo abre la puerta a cambiar el propietario; RLS lo impide en la práctica |
| `coach_login_attempts` | `attempted_at`, `succeeded` | `default now()` / `default false`, sin `not null` (`20261003020000_coach_human.sql:113-117`) | `string`, `boolean` (`:536-539`) | Inocuo hoy (RLS sin política) |
| `coach_messages` | `sender_role`, `created_at` | sin `not null` (`20261003020000_coach_human.sql:263-270`) | no-nulos (`:608,610`); el propio `Insert` **admite `null`** (`:616,618`) | El tipo **se contradice a sí mismo** entre Row e Insert |
| `profiles` | `unit_system`, `experience_level`, `activity_level`, `goal` | `text` sin `check` | `string` libre (`:264-267`) | La app tiene vocabularios cerrados para tres de ellas (`i18n.ts:874,881,893,902`) |

### 5.5 `supabase/schema.sql` está obsoleto y no lo advierte

`schema.sql` define 5 tablas (`:11,28,49,64,79`). Le faltan, frente a las migraciones: `profiles`, `coaches`, `coach_login_attempts`, `coach_session_requests`, `coach_messages`, `coach_rate_limits`, `coach_usage`, `routines.source`, `routines.authored_by_coach`, `routines.is_favorite`, `routine_exercises.day_index/day_label/target_reps_min/target_reps_max`, `completed_sets.notes`. Su cabecera dice «initial schema migration» (§1), pero **no hay ningún aviso de obsolescencia**: conviven dos fuentes de verdad y el propio `schema.sql:9` sigue describiendo los ids de ejercicio como `"0001".."1713"` cuando el catálogo llega a `"5201"`.

### 5.6 `set_type` se pierde en la frontera de sincronización

| Capa | Forma | Fichero:línea |
|---|---|---|
| Dominio | `SetKind = "normal" \| "warmup" \| "failure" \| "drop"` | `lib/workout/setKind.ts:19` |
| Traducción a BD | `toWarmupColumn(kind) → boolean` | `lib/workout/setKind.ts:45-47` |
| BD | `is_warmup boolean not null default false` | `schema.sql:87` |
| Pérdida | `failure` y `drop` se guardan indistinguibles de `normal` | — |

El propio archivo lo admite: *«The database only has a boolean, and it has had one since before drop sets and failure sets existed»*. La consecuencia es de negocio, no técnica: **no se puede saber después de una sesión qué series fueron al fallo o en drop**, que es exactamente el dato que Hevy y Symmetry sí conservan.

### 5.7 El tipo de serie no soporta lo que el importador ya sabe

| Dato | ¿En el dominio? | ¿En la BD? | Nota |
|---|---|---|---|
| RPE por serie | Sí (`SetEntry.rpe: string`, `types/supabase.ts:221`) | Sí (`numeric`) | El tipo vivo es `string` y el de BD `number`: `parseFloat` implícito en la frontera |
| Supersets / agrupación | **No** | **No** | `lib/import/sources.ts:90` **detecta** `superset_id` como señal de Hevy, pero no hay campo canónico (`import/types.ts:23-33`) ni alias (`sources.ts:36-72`): el grupo **se detecta y se tira** |
| Descanso por serie | Parcial | `routine_exercises.rest_seconds` sí; el override es `localStorage` | Sin sincronización entre dispositivos y el entrenador no ve el override (`workout/restPreferences.ts:4-19`) |
| Tempo | **No** | **No** | Cero coincidencias de `tempo` en tipos, esquema o consultas |
| Duración / distancia | En el import (`ImportSet.durationSec/distanceM`, `import/types.ts:56-57`) | **No** | `import/commit.ts:177-184` los descarta al mapear a `PlannedSet` |
| PR | **Derivado, nunca persistido** | No hay tabla | `useAthletePRs.ts:184-239` reduce en memoria, con techo `MAX_SETS = 2000` (`:48,122`); **hay dos definiciones de PR** en la app (`useAthletePRs` vs `ai/types.ts:223-236`) |
| Deload | Solo en UI | No | `dashboard/RoutinesPage.tsx:132-134,288`, `dashboard/WeeklyPlanner.tsx:330-353` |

---

## 6. Motor de sincronización Supabase ↔ IndexedDB

### 6.1 Mapa del flujo, etapa por etapa

```
finalizar sesión
  │
  ├─ sessionSync.ts:146 queueAndSync(payload)
  │    ├─ offlineStore.ts:165 enqueueFinalize() → id determinista "finalize:{logId}"
  │    │     └─ IndexedDB store "queue" (id, createdAt, attempts, lastError)
  │    ├─ si navigator.onLine === false → return null          (sessionSync.ts:148-150)
  │    └─ si online → drainQueue()                            (sessionSync.ts:152)
  │
  ├─ sessionSync.ts:104 drainQueue()
  │    ├─ listQueue() → orden FIFO por createdAt              (offlineStore.ts:183)
  │    ├─ por cada op:
  │    │    ├─ pushSession(op.payload)                       (sessionSync.ts:54)
  │    │    │    ├─ auth.getUser() → "Sin sesión iniciada"   (:57-59)
  │    │    │    ├─ workout_logs.upsert({id: logId})          (:65-75)  ← idempotente
  │    │    │    ├─ completed_sets.delete().eq("log_id")      (:79-83)  ← ⚠ ventana
  │    │    │    ├─ completed_sets.insert(rows)               (:85-89)  ← ⚠ ventana
  │    │    │    └─ notifyTrainingDataChanged()               (:94)
  │    │    ├─ éxito → removeFromQueue + deleteDraft         (:112-114)
  │    │    └─ fallo → updateQueueOp{attempts+1, lastError}   (:120-125)
  │    │         ├─ isRetryable(msg) true  → sigue en cola, break (:138)
  │    │         └─ isRetryable(msg) false → op DESCARTADA    (:132-137)
  │    └─ try/catch externo: catch { return null; }          (:151-155)  ⚠⚠
  │
  └─ useOfflineSync.ts — disparadores del drenaje
       ├─ window "online"        → runDrain()                (:74-77)
       ├─ document "visibilitychange" → runDrain()            (:80-82)
       ├─ setInterval 60 000 ms  → runDrain() si online      (:88-90)
       └─ montaje                → runDrain() si online      (:93)
```

### 6.2 Lo que está bien (controles positivos)

| Mecanismo | Veredicto |
|---|---|
| Idempotencia de la cola | El id de la op es determinista (`finalize:${logId}`), así que refinalizar **reemplaza** en vez de duplicar (`offlineStore.ts:169`) |
| Idempotencia del push | `upsert` con `onConflict: "id"` + `delete` + `insert` de series (`sessionSync.ts:65-89`) |
| Orden FIFO | `listQueue()` ordena por `createdAt` (`offlineStore.ts:183`) |
| Aislamiento por usuario | `pushSession` rechaza si `signedIn !== payload.userId` (`sessionSync.ts:60-62`) |
| Contrato de degradación | `idb.ts` resuelve `null` en **todo** fallo (`:125,126,127,158,159,160,162`) — «registrar nunca debe romper un entrenamiento» |
| Guardas de limpieza | `useOfflineSync` elimina listeners e intervalo (`:95-100`); `usePolling` limpia temporizador y listener (`:145-152`); `useElapsedMs`, `useLockoutCountdown`, `useAthleteContext` y `GripPopover` también limpian |
| Guardas de concurrencia | `useOfflineSync` usa un ref `inFlight` (`:41`); `usePolling` tiene guardia generacional contra respuestas obsoletas |

### 6.3 Errores silenciosos: inventario y clasificación

| Fichero:línea | Patrón | Clasificación | Impacto |
|---|---|---|---|
| `lib/sessionSync.ts:151-155` | `catch { return null; }` sobre `drainQueue()` | **⚠ Error real tragado** | Si el drenaje falla (RLS, red, IDB), la UI **no se entera**: el badge de «sin conexión» no aparece, el usuario cree que se guardó y la sesión puede quedarse en la cola indefinidamente |
| `lib/ai/routineGenerator.ts:594` | `.catch(() => undefined)` | **⚠ Error real tragado** | Un fallo al ejecutar la herramienta de IA deja `routine = null` y cae al camino de respaldo sin error visible |
| `lib/ai/routineGenerator.ts:587-591` | `catch { args = {}; }` | **⚠ Error real tragado** | Un `JSON.parse` fallido de argumentos produce una rutina vacía sin diagnóstico |
| `hooks/useDashboardSessions.ts:190` | `.sort((_a, _b) => 0)` | Defecto silencioso | El orden no ordena nada (además la consulta **no proyecta** `set_number`) |
| `lib/idb.ts` (todo) | `resolve(null)` | Benigno por diseño | Contrato documentado (`idb.ts:14-19`) |
| `hooks/useOfflineSync.ts:59-64` | `catch → setError` | Benigno | El error se expone en estado |
| `hooks/useLocalState.ts:42,61,75` · `useCoach.ts:305,350,364` · `useAthleteContext.ts:71,107,151` · `usePreviousPerformance.ts:120` | `catch → setError` | Benigno | Idem |
| `components/CoachChat.tsx:214-234` · `AuthModal.tsx:65-67` · `ExerciseBrowser.tsx:131-138` · `coach/RoutineGeneratorWizard.tsx:131-135` · `workers/importCsv.worker.ts:139-143` | `catch → UI/postMessage` | Benigno | Idem |

> **Los tres primeros son la lista corta de «errores que el usuario no puede ver».** Los demás son correctos.

### 6.4 El store `exerciseNotes`: esquema muerto

| Hecho | Evidencia |
|---|---|
| Está declarado, versionado (v4) e indexado | `lib/idb.ts:40`, `:79` (`keyPath: "setId"`, índice `exercise_id`) |
| Tiene **14 líneas** de comentario explicando que debería encolarse para sincronizar junto a la serie | `lib/idb.ts:64-78` |
| Los tests **verifican** que existe | `lib/idb.test.ts:28,76,89` |
| **Nadie lo lee ni escribe en runtime** | `grep` de `EXERCISE_NOTES_STORE` y `exerciseNotes` en todo `src/`: solo `idb.ts` y `idb.test.ts` |
| El módulo homónimo `lib/exercise/exerciseNotes.ts` **no es el store** | Es una capa de validación en memoria sobre arrays `ExerciseSetRecord[]` que se le pasan como argumento (`collectNotes` `:106`, `recentNotes` `:143`, `searchNotes` `:167`, `noteCoverage` `:196`). No toca IndexedDB |
| Los datos reales viven en `completed_sets.notes` | `useDashboardSessions.ts:129`, `usePreviousPerformance.ts:109`, `useMuscleRanks.ts:232` |

**Coste:** una versión de base de datos, un store, un índice y tres aserciones de test alrededor de una tabla que no existe en la práctica.

### 6.5 Atomicidad y ventanas de pérdida

| Punto | Evidencia | Consecuencia |
|---|---|---|
| `workout_logs.upsert` → `completed_sets.delete` → `completed_sets.insert` | `sessionSync.ts:65,80,87` | Entre el `upsert` y el `insert` hay una ventana con la sesión **sin series**. Si el proceso muere ahí, la cola reintenta (idempotente) y se arregla; si el error es «no reintentable», la op se **descarta** (`:132-137`) y la sesión queda **sin series para siempre** |
| Borrado manual `delete + insert` al guardar rutinas | `routineSave.ts:180`, `saveGeneratedRoutine.ts:94`, `saveCoachRoutine.ts:124` | Mismo patrón, sin idempotencia ni cola |
| Importación por sesiones | `import/commit.ts:225,240,248` | Ventana idéntica; documentada como decisión («a failure does not stop the run», `:206-213`) |

**El patrón correctivo** (para el informe 07) es una **RPC de Postgres** que haga el upsert de la sesión y sus series en una transacción, con `onConflict` idempotente. Es lo que hacen las referencias y elimina de raíz la clase de bug.

### 6.6 El store `localState` no está aislado por usuario

`idb.ts:80-90` documenta que `localState` **no** está indexado por `user_id` «because this is device-local state, and a second device is a second row». La consecuencia no comentada: **dos cuentas que usan el mismo dispositivo comparten rol, feature flags, contexto del atleta y consentimiento de IA**. `lib/profile/localState.ts` es la única fuente, y `hooks/useAthleteContext.ts` escribe ahí sin comprobar el usuario.

---

## 7. Rendimiento, bundle y re-renders

### 7.1 Bundle: el catálogo de 16 MB en el chunk principal

Medición real de `npm run build`:

| Artefacto | Tamaño | gzip |
|---|---|---|
| `dist/assets/index-*.js` (chunk principal) | **16 514 kB (16,13 MB)** | **2 575 kB** |
| `dist/assets/supabase-*.js` | 221 kB | 59 kB |
| `dist/assets/react-*.js` | 131 kB | 43 kB |
| `dist/assets/ExerciseHub-*.js` (lazy) | 35 kB | 11 kB |
| `dist/assets/index-*.css` | 34 kB | 7 kB |
| `dist/assets/ui-*.js` | 32 kB | 8 kB |
| `dist/assets/importCsv.worker-*.js` | 10 kB | — |
| **`dist/` completo** | **169 ficheros, 39,81 MB** | — |

Prueba directa de que el catálogo está dentro del chunk principal: la cadena `availableInCronosGym` aparece **1 325 veces** en `index-*.js` (1 324 registros + la interfaz del importador). El chunk *lazy* del hub pesa 35 kB: **el catálogo se descarga antes del primer pintado**, no cuando el atleta abre el hub de ejercicio.

Causa: `components/ExerciseSelectorModal.tsx:17` importa `exercisesCatalog.json` de forma **estática**. `vite.config.ts` separa `react`/`supabase`/`ui` en chunks manuales, pero **no el catálogo**.

### 7.2 Imports dinámicos que no hacen nada

Vite lo advierte explícitamente en el build:

| Import dinámico | Quién lo importa estáticamente | Efecto |
|---|---|---|
| `await import("@/lib/supabase")` en `lib/ai/coachAssistant.ts:363` y `lib/coach/useCoachAuth.ts:231` | **26 módulos**: `App.tsx`, `AuthModal.tsx`, `ExerciseBrowser.tsx`, `coach/CoachFloatingButton.tsx`, `coach/portal/*` (5), `dashboard/RoutineLibrary.tsx`, `dashboard/RoutinesPage.tsx`, `profile/ProfilePage.tsx`, `profile/ProfileView.tsx`, `hooks/useAthletePRs.ts`, `useDashboardSessions.ts`, `useExerciseCatalog.ts`, `useGymData.ts`, `useMuscleRanks.ts`, `usePreviousPerformance.ts`, `useProfile.ts`, `useRoutineLastRuns.ts`, `lib/exercise/exerciseHistory.ts`, `lib/import/commit.ts`, `lib/localSession.ts`, `lib/routines/routineSave.ts`, `saveCoachRoutine.ts`, `saveGeneratedRoutine.ts`, `lib/sessionSync.ts` | El SDK entra **siempre** en el bundle principal; la intención de diferirlo es inoperante |
| `await import("./coachAssistant")` en `lib/ai/routineGenerator.ts:658` | `components/coach/CoachChat.tsx` | Igual |

**Corrección:** o se accepta que Supabase es parte del bundle principal y se eliminan los `import()` dinámicos (menos ruido), o se aísla de verdad (p. ej. mover las consultas a una capa `api/` que el cliente no importe estáticamente).

### 7.3 El lazo de recálculo de rangos

`hooks/useMuscleRanks.ts` contiene un lazo documentado y parcialmente mitigado:

| Línea | Qué pasa |
|---|---|
| `:403-411` | `useMemo` recalcula `buildRankMap` cuando cambia `rows` (el objeto entero: `logs`, `sets`, `exercises`) |
| `:414-463` | El efecto de persistencia depende de `[map, previous, readOnly]`. `map` es un objeto **nuevo** en cada recálculo, y `setPrevious` realimenta el memo |
| `:448-460` | La mitigación: `setPrevious((current) => sameRanks(current, snapshot) ? current : snapshot)` conserva la **referencia** si los rangos no cambian, lo que corta el lazo |
| `:456` | La tasa medida antes de la mitigación: **más de 2 000 recálculos en 1,5 s**, que fija el hilo principal |
| `:226-232` | `fetchAllPages` con troceado de UUIDs: lee hasta **2 años** de series en cada carga |
| `lib/ai/coachAssistant.ts:13-17` | El propio hook admite que **no comparte caché** con la vista de rangos: abrir `/coach` y luego `/rangos` descarga la historia **dos veces** |

### 7.4 Sobre-descarga de datos

| Consulta | Fichero:línea | Problema |
|---|---|---|
| `exercises` `select("*")`, 1 324 filas, **sin filtro** | `useGymData.ts:115`, `ExerciseBrowser.tsx:106`, `useExerciseCatalog.ts:56` | El catálogo es idéntico para todos los atletas: tres descargas del catálogo entero |
| `routine_exercises` `select("*")` sin `.eq("routine_id")` | `useGymData.ts:114` | Trae todas las filas de ejercicios del usuario en cada refresco de rutinas |
| `exercises` `select("id,name")` sin `limit` **y sin manejar el error** | `coach/portal/AthleteCRM.tsx:112` | Sin `await`, sin `.catch`: la promesa se pierde |
| `workout_logs` `select("*")` con `.limit(50)` + rutinas sin filtro | `useGymData.ts:279,291` | Sobre-descarga y reducción en JS en vez de SQL (`:289-328`) |
| `profiles` leído **tres veces** en el portal | `RequestQueue.tsx:103,138` + `CoachPortal.tsx:208` | Lo admite `useAthletePRs.ts:136-138` |
| `completed_sets` con `limit(2000)` + segunda lectura de `exercises` por `in()` | `useAthletePRs.ts:114,150` | Techo de 2 000 series |

### 7.5 Formateo y normalización duplicados

| Patrón | Ocurrencias | Ficheros |
|---|---|---|
| `toFixed(1)` | 14 | 9 ficheros (`SymmetryRadar` 4, `ActiveWorkout` 2, `MuscleRankDetail` 2, …) |
| `Intl.DateTimeFormat` | 5 | 5 ficheros, cada uno con su propio formateador (`ProgressDashboard`, `useGymData`, `coach/access`, `coach/CoachAccessGate`, `dashboard/heroCardModel`) |
| `toLocaleDateString` | 4 | 3 ficheros |
| `Intl.NumberFormat` | **0** | Ninguno: el formateo numérico está disperso |
| `Math.round(x * 10) / 10` (redondeo a 1 decimal) | 31 | 12 ficheros |

**Normalización de nombres de ejercicio escrita tres veces, y las tres no coinciden:**

| Implementación | Fichero:línea | Estrategia |
|---|---|---|
| `useExerciseCatalog` | `hooks/useExerciseCatalog.ts:35-41,68-73` | Coincidencia **exacta** sobre el nombre normalizado |
| `pickerHelpers` | `lib/picker/pickerHelpers.ts:74-120` | Alias + búsqueda difusa; su propio comentario dice que debería reutilizar `useExerciseCatalog` |
| `ImportWizard` | `components/import/ImportWizard.tsx:173-176,828-839` | `catalog.find(...)` exacto |

**El problema no es la búsqueda difusa del selector: es que la normalización está triplicada y no coincide.** Con 6 pares de nombres duplicados en el catálogo (Fase 3 §3.4) y un desambiguador que no desambigua, `catalog.find` devuelve la fila arbitrariamente.

### 7.6 Componentes con demasiado estado

| Componente | Líneas | `useState` | `useEffect` | `useMemo` | `useCallback` |
|---|---|---|---|---|---|
| `ActiveWorkout.tsx` | 2 262 | **18** | 7 | 6 | 5 |
| `ExerciseBrowser.tsx` | 828 | 15 | 3 | 11 | 5 |
| `RoutinesPage.tsx` | 1 867 | 14 | 6 | 7 | 18 |
| `ImportWizard.tsx` | 1 099 | 12 | 0 | 4 | 7 |
| `RoutineGeneratorWizard.tsx` | 630 | 12 | 2 | 0 | 3 |
| `WeeklyPlanner.tsx` | 784 | 10 | 2 | 0 | 13 |

`ActiveWorkout.tsx` con 18 estados en un solo componente es la causa estructural de que el temporizador, el borrador, la sincronización y el render de series no se puedan extraer sin riesgo.

---

## 8. Duplicación estructural

### 8.1 Seis escritores de rutinas

| Escritor | `routines` | `routine_exercises` | Rollback | ¿Campos completos? |
|---|---|---|---|---|
| `lib/routines/routineSave.ts` | `:40,60,137` | `:54,91,163` | `:180` | Sí |
| `lib/routines/saveGeneratedRoutine.ts` | `:44,94` | `:78` | `:94` | **No**: descarta `day_index`, `day_label`, `target_reps_min/max` |
| `lib/routines/saveCoachRoutine.ts` | `:43,124` | `:96` | `:124` | No (añade `source`, `authored_by_coach`) |
| `components/RoutineBuilder.tsx` | `:111,117,172` | `:131,137,163` | — | **No**: los mismos 4 campos |
| `components/dashboard/RoutinesPage.tsx` | `:214` | `:238` | — | **No** |
| `components/dashboard/RoutineLibrary.tsx` | `:1034` | `:1058` | — | **No** |

Todos hacen: insertar rutina → insertar ejercicios → a veces borrar en cascada manual. **Ninguno usa transacción ni RPC**: entre el `insert` de la rutina y el de sus ejercicios hay una ventana con la rutina vacía.

### 8.2 Duplicación carácter por carácter

`components/dashboard/RoutinesPage.tsx:196-244` ≡ `components/dashboard/RoutineLibrary.tsx:1016-1064`: mismo nombre (`deleteRoutineAndRefresh`, `restoreRoutine`), misma firma, mismo cuerpo, incluso el mismo `catch { void refresh(); }`. **≈49 líneas duplicadas.**

### 8.3 Restaurar una rutina destruye datos

Ambas implementaciones insertan solo `id, user_id, title, description, source` (`RoutinesPage.tsx:215-221`, `RoutineLibrary.tsx:1035-1041`) y reconstruyen las series con `target_reps_min: null, target_reps_max: null` (`:234-235`, `:1054-1055`).

**Se pierden:** `target_reps_min`, `target_reps_max`, `is_favorite`, `authored_by_coach` y `created_at` (se reescribe con el `now()` del servidor). Además `order_index: index` (`:231`) reindexa con el índice del array, que no es el `order_index` original (el modelo lo define global y creciente por día, `types/supabase.ts:124-133`).

La incoherencia es demostrable: `day_index` y `day_label` **sí** se preservan (`:232-233`), lo que hace la omisión de `target_reps_*` difícil de explicar como decisión.

### 8.4 Doble toggle de favorito

| Implementación | Fichero:línea | Calidad |
|---|---|---|
| `useGymData` | `hooks/useGymData.ts:178-219` | Serializa escrituras por id, hace rollback optimista, devuelve `WriteResult` |
| `RoutineLibrary` | `components/dashboard/RoutineLibrary.tsx:220-225` | `update(...).eq(...)` **sin `await`, sin `error` y sin rollback** |

### 8.5 Ladders de rango duplicados

El canónico es `lib/ranks/rankConfig.ts` + `scoreToRank.ts`. `lib/ranks/neonRanks.ts:1-24` define una **segunda escalera de 15 niveles sin ningún importador**: fichero entero (49 líneas) inalcanzable.

---

## 9. Catálogos, i18n y medios

### 9.1 i18n: un diccionario, no un sistema de locales

| Hecho | Evidencia |
|---|---|
| El fichero son 1 937 líneas con **38 exports** de diccionarios anidados | `lib/i18n.ts` |
| Acceso por alias `T`: `RANK_LABELS as T`, `IMPORT_LABELS as T`, `SYMMETRY_LABELS as T`, `COACH_PORTAL_LABELS as T`, `COACH_LABELS as T`, `MUSCLE_FILTER_LABELS as T` | 6 ficheros |
| **No existe selector de idioma**: ni `setLocale`, ni `useLocale`, ni `navigator.language`, ni `changeLanguage` | `grep` sobre `src/` → 3 coincidencias, las tres en comentarios de `i18n.ts` |
| Los 10 idiomas de instrucciones del catálogo se truncan a `.es` al sembrar | `services/seedExercises.ts:45-60` |

**Export muerto:** `UNITS_LABELS` (`lib/i18n.ts:98`) — una sola coincidencia en todo `src/`: su propia definición.

**Claves muertas verificadas (43):** 42 dentro de `RANK_LABELS` (`lib/i18n.ts:143-335`) y 1 en `SET_LOGGER_LABELS.lastSessionAriaLabel` (`:482`). La verificación de `RANK_LABELS` se hizo buscando `T.<clave>` sobre todo `src/` con alternancia de las 42 candidatas: **cero coincidencias** (el alias `T` descarta el falso positivo de que apunte a otro diccionario).

Claves muertas de `RANK_LABELS`: `score`(151), `progressTitle`(222), `pointsToNext`(223), `dataQuality`(245-248), `filterByRank`(256), `filterAll`(257), `noResults`(260), `noResultsHint`(261), `coverage`(262), `metricsUpdate`(263), `lastActivity`(265), `trendUp`(266), `trendDown`(267), `newMuscle`(269), `deltaPoints`(270), `viewRange`(271), `viewScore`(272), `viewVolume`(273), `viewCoverage`(274), `qualityLow/Medium/High`(275-277), `confidenceLabel`(278), `weakestHint`(283), `rankDistribution`(284), `improvedMuscles`(285), `promotionCount`(287), `heatmapSets`(298), `symmetryBlockChest/Back/Shoulders/Arms/Legs/Core`(310-315), `prTitle`(318), `prExercise`(319), `recommendedTitle`(332), `recommendedCount`(333), `viewMuscleExercises`(334).

**Cadenas en español escrito a mano en componentes que ya tienen diccionario:** `ExercisePanel.tsx:55,61,69,72,80,86` («Animación no disponible», «Tutorial», «Sin pasos», «Notas», «Por serie», «Reemplazar», «Otro ejercicio») y `TutorialModal.tsx:24,35,42,60` («Cerrar», «Este ejercicio no tiene instrucciones en el catálogo»).

### 9.2 Las 46 reglas de equipamiento: medición sobre el catálogo real

Se compilaron las reglas con `esbuild` y se ejecutaron sobre los **1 324 registros** de `exercisesCatalog.json`, reproduciendo exactamente el bucle de `getEquipmentSuggestionForExercise` (`equipmentCatalog.ts:260-268`).

| Regla | Patrón | Ejercicios que casa | primary | Equipo asignado |
|---|---|---|---|---|
| #0 | `body.?weight\|calistenia\|peso corporal\|no equipment\|sin equipo` | 325 | CG-EQP-0028 | Banco Abdominal |
| #9 | `pulldown\|jalon\|lat` | 56 | CG-EQP-0018 | **Jalón Pecho Polea** ⚠ |
| #10 | `row\|remo` | 85 | CG-EQP-0012 | Remo |
| #26 | `squat\|sentadilla` | 56 | CG-EQP-0005 | Sentadilla |
| #29 | `pantorrilla\|calf\|gemelo` | 40 | CG-EQP-0026 | **Maquina Curl Biceps Predicador** ⚠ |
| #40 | `curl\|biceps` | 132 | CG-EQP-0035 | **Pesa Rusa** ⚠ |
| #41 | `triceps\|extension\|pushdown\|kickback\|…` | 72 | CG-EQP-0022 | **Torre de Poleas** ⚠ |
| #36 | `pierna\|leg\|isquiotibial\|hamstring` | 24 | CG-EQP-0003 | Curl Femoral Acostado ⚠ |
| #45 | **`/.*/`** | **252 (19,0 %)** | CG-EQP-0022 | Torre de Poleas (comodín) |

**Hallazgos medidos:**

1. **Los tres fallbacks son inalcanzables.** El bucle `equipmentCatalog.ts:264-268` retorna en la **primera** coincidencia, y la última regla (`:250`) es `/.*/`, que casa con cualquier cadena. Por tanto **nunca** se ejecutan el fallback por slug de tipo (`:270-285`), el fallback por campo de equipo (`:287-304`) ni el último recurso (`:306-307`). Los **34 slugs** de `availableEquipment.ts` **nunca se consultan**. Verificado: los 252 ejercicios del comodín **llegarían** al primer fallback si se eliminase la regla `/.*/`.
2. **Cinco reglas no coinciden jamás:** #3 `/rower|remo|rowing/`, #23 `/press.*45|prensa.*45|45.*grados/`, #24 `/press.*90|prensa.*90|90.*grados/`, #35 `/sissy/`, #42 `/skull crusher|aplastamiento de cr[áa]nio/`.
3. **Falsos positivos por token corto, con ejemplos del catálogo real:**
   - `lat` (#9) casa «band **lateral** raise», «barbell **lateral** lunge», «assisted lying leg raise with **lateral** throw down» → **Jalón Pecho Polea**.
   - `extension` (#41) casa «back **extension** on exercise ball», «band bent-over hip **extension**» → **Torre de Poleas**.
   - `leg` (#36) casa «dumbbell alternating bicep curl with **leg** raised on exercise ball» → **Curl Femoral Acostado**.
   - `kickback` está en **dos** reglas: #31 (glúteo, `:228`) y #41 (tríceps, `:240`). Como #31 va antes, «dumbbell **tricep** kickback» y «dumbbell standing alternating **tricep** kickback» reciben **Torre de Poleas**.
   - `curl` (#40, 132 ejercicios) → **Pesa Rusa** (CG-EQP-0035): «barbell preacher curl» cae antes en #39, pero el resto de curls recibe una pesa rusa.
   - `abductor|adductor|ductor` (#30) → CG-EQP-0027 «Maquina Pantorrilla Sentado» para «assisted side lying adductor stretch».
   - `neck|cuello` (#44) → CG-EQP-0047 «Arnes Cuello» para «standing behind neck press».
4. **Las asignaciones de `primary` no coinciden con `equipmentMap`.** `equipmentMap.ts` describe CG-EQP-0004 = «prensa-45-grados» (`:42`), CG-EQP-0006 = «sentadilla-hack» (`:60`), CG-EQP-0005 = «maquina-abductores-aductores» (`:51`); pero las reglas asignan «press 45» → **CG-EQP-0001**, «hack squat» → **CG-EQP-0004** (que es la prensa de 45°) y «squat» → **CG-EQP-0005** (que es la de abductores). **Los dos catálogos de equipamiento discrepan en el significado de los mismos identificadores.** Es la prueba numérica del hallazgo «dos catálogos de equipamiento» de la Fase 3.
5. **Nombres duplicados en `equipmentMap`:** CG-EQP-0013 y CG-EQP-0026 se llaman ambos «Maquina Curl Biceps Predicador»; CG-EQP-0019, -0025 y -0034 «Maquina Smith»; CG-EQP-0065, -0066 y -0073 «Maquina Eliptica(s)»; CG-EQP-0067 y -0071 «Caminadora Electrica»; CG-EQP-0063 y -0072 «Estante Accesorios».

### 9.3 Medios: 14 puntos de render, 4 rotos, 1 versión móvil

| Fichero:línea | Qué renderiza | Ruta | Estado |
|---|---|---|---|
| `ActiveWorkout.tsx:860-862` | GIF del ejercicio | `exercise.gif_url` | ⚠ crudo, sin `resolveImageSrc` |
| `ActiveWorkout.tsx:932` | Foto de maquinaria | `public/images/…` | **❌ 404** (Vite sirve `public/` en la raíz) |
| `ActiveWorkout.tsx:1396` | Foto de maquinaria | `public/images/…` | **❌ 404** |
| `EquipmentModal.tsx:82` | Foto de maquinaria | `public/images/…` | **❌ 404** |
| `ExerciseSelectorModal.tsx:423` | Foto de maquinaria | `resolveImageSrc(machineImg)` | ✔ (único sitio con el parche) |
| `ExerciseSelectorModal.tsx:345-347` | Miniatura del ejercicio | `resolveImageSrc(ex.gif_url)` | ⚠ `videos/…` relativo; no existe `public/videos/` |
| `ExerciseStage.tsx:262` | GIF del ejercicio | `exercise.gif_url` | ⚠ crudo |
| `ExerciseCarousel.tsx:415` | GIF del ejercicio | `exercise.gif_url` | ⚠ crudo |
| `ExerciseCard.tsx:60-62` | GIF | `exercise.gif_url` | ⚠ crudo |
| `ExerciseDetailSheet.tsx:81-83` | GIF | `exercise.gif_url` | ⚠ crudo |
| `ExerciseBrowser.tsx:726-728` | GIF | `exercise.gif_url` | ⚠ crudo |
| `ExercisePanel.tsx:50-53` | GIF | `exercise.gif_url` | ⚠ crudo (fichero huérfano) |
| `TutorialModal.tsx:49-51` | GIF | `exercise.gif_url` | ⚠ crudo (fichero huérfano) |
| `hub/DemoTab.tsx:95-100` | GIF | `exercise.gif_url` | ⚠ crudo |

`public/` contiene **161 ficheros, 24 356 165 B, todos `.jpg`**. No hay `public/videos/` ni `public/gifs/`. Los GIF del catálogo **no están en el repositorio**: se sirven desde `main` de GitHub raw (`seedExercises.ts:57-59`), una **rama móvil sin versión fijada**.

### 9.4 Stubs en producción

`components/progress/ConsistencyTracker.tsx`, `ProgressCharts.tsx` y `WorkoutHistory.tsx` (15 líneas cada uno) se montan en `ranks/AnatomicalRanksPage.tsx:307-309` y renderizan el literal `ConsistencyTracker (userId=none)` en la pantalla de rangos. No son código muerto: son **interfaz de_DEBUG_ en producción**.

---

## 10. Pipeline de importación

**Arquitectura:** `hooks/useCsvImport.ts` (dueño del worker) → `workers/importCsv.worker.ts` (parseo) → `lib/import/csv.ts` (parser RFC 4180 incremental) → `lib/import/sources.ts` (detección + alias) → `lib/import/analyze.ts` (puro: agrupación, validación, issues) → `lib/import/commit.ts` (escritura + undo). `components/import/ImportWizard.tsx` orquesta 4 pasos.

| # | Defecto | Evidencia | Impacto |
|---|---|---|---|
| 1 | **La barra de progreso divide filas por bytes** | `workers/importCsv.worker.ts:89` publica `{read: rows.length, done: file.size}`; `hooks/useCsvImport.ts:182` calcula `Math.min(1, message.read / message.done)` | Con 2 000 filas y un archivo de 40 MB: `0,00005` → **la barra nunca avanza** |
| 2 | **La detección de duplicados contra la base nunca se activa** | `lib/import/commit.ts:315` exporta `existingImportIds`; `hooks/useCsvImport.ts` lo acepta; `lib/import/analyze.ts:237` lo consume; **`ImportWizard.tsx` nunca lo pasa**: sus cuatro `read()` (`:108,129,139,151`) solo dan `source`, `mapping` o `weightUnit` | La detección de sesiones duplicadas **solo** funciona dentro del archivo (`analyze.ts:343-349`), nunca contra el historial ya importado |
| 3 | **Código de issue equivocado para el RPE** | `lib/import/analyze.ts:314` registra `"unparseable_reps"` con el mensaje `T.issue.unparseableRpe`; `ImportIssueCode` (`import/types.ts:80-88`) no incluye `unparseable_rpe` | Un RPE inválido (p. ej. `11`) se reporta al usuario como error de repeticiones |
| 4 | **El archivo vacío produce dos UIs distintas** | El worker publica un `analysis` con issue `no_header`/`empty_file` (`analyze.ts:255-258`); el fallback inline devuelve `{...INITIAL, fallback: true, error: "empty"}` (`useCsvImport.ts:267-269`) | El mismo archivo da un análisis con log de errores o un string de error, según el navegador. El comentario de `useCsvImport.ts:230-232` afirma que el fallback es «byte-identical al worker's loop»: no lo es |
| 5 | **La rama de cancelación del worker es código muerto** | `lib/import/workerProtocol.ts:41-45` define `CancelRequest`; el worker responde `if (request.type === "cancel") return;` (`importCsv.worker.ts:72`) — un `return` sin efecto en un `onmessage` ya en curso. `useCsvImport.cancel()` (`:149-153`) **termina** el worker en vez de enviar la petición | — |
| 6 | **Dos campos canónicos no se pueden persistir** | `ImportSet.durationSec`/`distanceM` (`import/types.ts:56-57`) → `commit.ts:177-184` los descarta; `completed_sets` no tiene columnas equivalentes | — |
| 7 | **Las columnas de superset se detectan y se tiran** | `lib/import/sources.ts:90` detecta `superset_id`/`rest_seconds` como señal de Hevy, pero no hay alias ni campo canónico: acaban en `unmappedHeaders` (`sources.ts:135`) | El importador sabe que el archivo trae supersets y los ignora |

---

## 11. Inventario priorizado de limpieza

Leyenda de impacto: **A** = defecto de usuario o pérdida de datos · **M** = coste o trampa de mantenimiento · **B** = higiene.

| # | Acción | Ubicación | Impacto | Esfuerzo | Confianza | Riesgo de falso positivo |
|---|---|---|---|---|---|---|
| 1 | **Decidir cuál es la pantalla de entrenamiento real** y fusionar `ActiveWorkout.tsx` con `SetTable.tsx` | `components/ActiveWorkout.tsx` / `components/workout/SetTable.tsx` | **A** | Alto | Alta | Bajo — la alcanzabilidad desde `main.tsx` esObjective |
| 2 | **Sacar el catálogo del bundle principal**: moverlo a un asset servido y cargarlo con `fetch` bajo demanda, o a un chunk lazy | `components/ExerciseSelectorModal.tsx:17` | **A** | Medio | Alta | Bajo — medido en el build (16,13 MB) |
| 3 | **Propagar los errores del drenaje** a la UI en vez de tragar | `lib/sessionSync.ts:151-155` | **A** | Bajo | Alta | Bajo |
| 4 | **Unificar el tipo de `instructions`** en un solo tipo y eliminar el cast sin comprobar | `ExerciseSelectorModal.tsx:43,46,77`; `types/supabase.ts:30` | **A** | Medio | Alta | Bajo |
| 5 | **Decidir el tipo real de `numeric`** y usar un `parseWeight` compartido en `useAthletePRs` y `exerciseHistory` | `types/supabase.ts:219,221`; `useAthletePRs.ts:192`; `exerciseHistory.ts:95-99` | **A** | Bajo | Media | Media — el tipo real en runtime requiere consulta al servidor |
| 6 | **Crear la migración de `bodyweight_entries`, `body_measurements`, `session_checkins`** o dejar de consultarlas | `useProfile.ts:155,161,167,192` | **A** | Bajo | Alta | Media — podrían existir en una base remota migrada fuera del repo |
| 7 | **Eliminar la regla `/.*/`** de `EQUIPMENT_RULES` o moverla **al final, después** de los fallbacks reales | `data/equipmentCatalog.ts:250,264-307` | **A** | Bajo | Alta | Bajo — medido sobre los 1 324 registros |
| 8 | **Acotar las reglas por token** (`lat`→`\blat\b`, `leg`→`\bleg\b`, `extension`→`triceps extension`, `kickback` duplicado) | `data/equipmentCatalog.ts:202,228,233,239,240` | **A** | Medio | Alta | Bajo — ejemplos concretos del catálogo |
| 9 | **Unificar los 6 escritores de rutinas** en un `saveRoutine` con campos completos y atómico | `lib/routines/*.ts`, `RoutineBuilder.tsx`, `RoutinesPage.tsx`, `RoutineLibrary.tsx` | **A** | Alto | Alta | Bajo |
| 10 | **Conservar `target_reps_min/max`, `is_favorite`, `authored_by_coach`, `created_at` al restaurar** | `RoutinesPage.tsx:215-238`; `RoutineLibrary.tsx:1035-1058` | **A** | Bajo | Alta | Media — podría ser intencional como «restaurar con valores por defecto» |
| 11 | **Arreglar la barra de progreso del importador** (filas → porcentaje de filas, o bytes → bytes leídos) | `importCsv.worker.ts:89`; `useCsvImport.ts:182` | **M** | Bajo | Alta | Bajo |
| 12 | **Conectar `existingImportIds` → `read({existing})` → `ImportWizard`** o borrar el código | `commit.ts:315`; `useCsvImport.ts`; `ImportWizard.tsx:108-151` | **M** | Bajo | Alta | Bajo |
| 13 | **Corregir el código de issue del RPE** | `analyze.ts:314`; `import/types.ts:80-88` | **M** | Bajo | Alta | Bajo |
| 14 | **Corregir el `sort` no-op del dashboard** (proyectar `set_number` y comparar de verdad) | `useDashboardSessions.ts:178-191` | **M** | Bajo | Alta | Baja — puede haber un `order()` no visible |
| 15 | **Eliminar el store `exerciseNotes`** (o implementarlo) y bajar la versión de la BD | `lib/idb.ts:30,40,79`; `lib/idb.test.ts:28,76,89` | **M** | Bajo | Alta | Baja — implicaría una migración de IDB |
| 16 | **Eliminar la copia `AnatomicalRanksPage.backup.tsx`** | `components/ranks/AnatomicalRanksPage.backup.tsx` | **M** | Bajo | Alta | Bajo — `git diff --no-index` lo confirma |
| 17 | **Eliminar el resto de la isla de tests** (16 componentes, ~3 800 líneas) o **promoverla a producción** | §4.2 | **M** | Medio | Alta | Media — requiere una decisión de producto |
| 18 | **Quitar el `export` a 265 símbolos** | Global | **B** | Bajo (mecánico) | Alta | Baja |
| 19 | **Eliminar los 55 exports con cero referencias** | §4.4 | **B** | Bajo | Alta | Baja |
| 20 | **Eliminar los 10 exports muertos del subsistema de equipamiento** | §4.5 | **B** | Bajo | Alta | Baja |
| 21 | **Fusionar `deleteRoutineAndRefresh`/`restoreRoutine`** duplicadas | `RoutinesPage.tsx:196-244`; `RoutineLibrary.tsx:1016-1064` | **M** | Bajo | Alta | Bajo |
| 22 | **Unificar la normalización del nombre de ejercicio** (3 implementaciones distintas) | `useExerciseCatalog.ts:35-41`; `pickerHelpers.ts:74-120`; `ImportWizard.tsx:173-176` | **M** | Bajo | Alta | Baja |
| 23 | **Extraer el formateo** a un módulo compartido (`toFixed(1)` ×14, `Intl.DateTimeFormat` ×5, `Intl.NumberFormat` ×0) | 14 ficheros | **M** | Bajo | Alta | Baja |
| 24 | **Corregir las rutas de medios** (3 × `public/images/…`, 1 × `videos/…`) | `ActiveWorkout.tsx:932,1396`; `EquipmentModal.tsx:82`; `ExerciseSelectorModal.tsx:347` | **A** | Bajo | Alta | Bajo |
| 25 | **Sustituir los 3 stubs de progreso** por componentes reales o quitarlos | `components/progress/*.tsx`; `AnatomicalRanksPage.tsx:307-309` | **M** | Bajo | Alta | Baja |
| 26 | **Extraer un `formatters.ts` único y borrar `Intl` disperso** | — | **B** | Bajo | Alta | Baja |
| 27 | **Limpiar i18n**: 1 export muerto + 43 claves muertas + cadenas hardcodeadas | `lib/i18n.ts:98,143-335,482`; `ExercisePanel.tsx`; `TutorialModal.tsx` | **B** | Bajo | Alta | Media — las claves de `RANK_LABELS` no se barrieron todas |
| 28 | **Marcar `supabase/schema.sql` como obsoleto** o regenerarlo desde las migraciones | `supabase/schema.sql` | **M** | Bajo | Alta | Baja |
| 29 | **Alinear nulabilidad TS ↔ SQL** en 7 columnas y quitar `user_id` de `routines.Update` | `types/supabase.ts:68,107,536-539,608,610` | **M** | Bajo | Alta | Baja |
| 30 | **Separar el `localState` por usuario** en IndexedDB | `lib/idb.ts:80-90`; `lib/profile/localState.ts` | **M** | Medio | Media | Media — el comentario de `idb.ts:80-89` justifica el diseño actual |
| 31 | **Añadir backoff exponencial al drenaje** (hoy: intervalo fijo de 60 s) | `hooks/useOfflineSync.ts:16` | **M** | Bajo | Media | Baja |
| 32 | **Añadir `set_type` a `completed_sets`** para no perder `failure`/`drop` | `supabase/schema.sql:87`; `lib/workout/setKind.ts:19` | **M** | Alto | Alta | Baja |
| 33 | **Añadir `superset_id`/`group_id` al modelo** (el importador ya lo detecta) | `lib/import/sources.ts:90`; `completed_sets` | **M** | Alto | Alta | Baja |
| 34 | **Quitar el `.sort((_a,_b)=>0)`** | `useDashboardSessions.ts:190` | **B** | Bajo | Alta | Baja |
| 35 | **Unificar el toggle de favorito** | `useGymData.ts:178-219`; `RoutineLibrary.tsx:220-225` | **M** | Bajo | Alta | Baja |
| 36 | **Dejar de descargar el catálogo entero** (3 sitios) y filtrar `routine_exercises` por `routine_id` | `useGymData.ts:114,115`; `ExerciseBrowser.tsx:106`; `useExerciseCatalog.ts:56` | **M** | Medio | Alta | Baja |
| 37 | **Manejar el error** de la lectura de catálogo en el portal y poner `limit` | `coach/portal/AthleteCRM.tsx:112` | **M** | Bajo | Alta | Baja |
| 38 | **Eliminar o cablear los `import()` dinámicos inoperantes** | `coachAssistant.ts:363`; `useCoachAuth.ts:231`; `routineGenerator.ts:658` | **B** | Bajo | Alta | Baja |
| 39 | **Sacar las 3 stubs de `useAthleteContext`/profile del perfil** o conectarlas | `profile/BiometricsInputs.tsx`, `GoalChips.tsx`, `InjuryField.tsx` | **M** | Medio | Media | Media — `ProfilePage` puede haberlas sustituido |
| 40 | **Partir `ActiveWorkout.tsx` (2 262 líneas, 18 estados)** en: `useWorkoutSession`, `useRestTimer`, `useDraftSync`, `SetRow` | `components/ActiveWorkout.tsx` | **M** | Alto | Alta | Baja |

---

## 12. Oleadas de limpieza

Las oleadas están ordenadas por **coste de reversión**, no por severidad. Cada una es un commit reversible por separado.

| Ola | Contenido | Elementos | Resultado verificable | Riesgo |
|---|---|---|---|---|
| **O0 — Higiene sin riesgo** (1 día) | Eliminar exports con cero referencias; quitar `export` a 265 símbolos; borrar `AnatomicalRanksPage.backup.tsx`; borrar `equipmentHelpers.ts`; borrar `pickerTokens.ts`, `neonRanks.ts`, `userContext.ts`; corregir el `sort` no-op; corregir el código de issue del RPE; unificar `deleteRoutineAndRefresh` | 16, 18, 19, 20, 21, 34, 13 | −3 500 líneas; typecheck verde; 129/129 tests | **Nulo** |
| **O1 — Defectos visibles** (2 días) | Corregir rutas de medios; arreglar la barra de progreso; conectar `existingImportIds`; unificar el toggle de favorito; manejar el error de `AthleteCRM`; sustituir los 3 stubs de progreso; propagar errores del drenaje | 24, 11, 12, 35, 37, 25, 3 | Cero 404 de medios; importador con progreso real; errores de sync visibles | **Bajo** |
| **O2 — Decisión de pantalla** (1 semana) | **Decidir si la pantalla real es `ActiveWorkout` en línea o `SetTable`.** Fusionar en una sola, con los tests migrados a la que quede | 1, 17 | Una sola pantalla de series; los tests cubren lo que se ejecuta; el audio y la fatiga vuelven a la app | **Alto** — toca la pantalla principal |
| **O3 — Datos y catálogo** (1 semana) | Unificar `instructions`; resolver `numeric`; migración de las 3 tablas ausentes; alineación de nulabilidad; marcar `schema.sql`; bajar el catálogo del bundle; filtrar consultas | 4, 5, 6, 29, 28, 2, 36 | Bundle principal < 1 MB; tipos y esquema de acuerdo; PRs que no desaparecen | **Medio** |
| **O4 — Equipamiento y多媒体** (3 días) | Quitar la regla `/.*/`; acotar tokens; alinear `equipmentMap` ↔ reglas; corregir `cg-…` divergente; implementar o borrar el store `exerciseNotes` | 7, 8, 15, 20 | Sugerencias de equipamiento correctas; 3 fallbacks alcanzables; un store menos | **Medio** |
| **O5 — Dominos de entrenamiento** (2 semanas) | `set_type` completo; `superset_id`; un único `saveRoutine` atómico (idealmente RPC); preservar campos al restaurar; tamaño de `ActiveWorkout` por debajo de 800 líneas | 32, 33, 9, 10, 40 | El modelo conserva lo que la app ya sabe; escrituras atómicas | **Alto** — migración de datos |

---

## 13. Límites del análisis

- **No se ejecutó la app en un navegador.** Las conclusiones de UI provienen de leer el código y del resultado del build, no de observar la aplicación en ejecución.
- **La suite de tests se ejecutó dos veces** (129/129 en verde, 309,15 s y 379,33 s) y una vez canalizada (1 flake de temporización en `RequestQueue.test.tsx`, que pasa aislado). No se midió cobertura: la existencia de una isla de ~3 800 líneas testeadas pero no alcanzables se detectó por análisis de alcanzabilidad, no por un informe de cobertura.
- **`src/data/exercisesCatalog.json` es una única línea de ~16 MB.** Las herramientas de lectura la truncan; el inventario completo (1 324 registros, 16 campos, 10 idiomas) procede de las fases anteriores y se confirmó por conteo programático sobre el fichero, no por lectura visual.
- **El tipo real de `numeric` en runtime no se verificó contra el servidor.** La divergencia interna entre `useAthletePRs.ts:192` y `exerciseHistory.ts:95-99` es un hecho; cuál de los dos está equivocado requiere una consulta de prueba.
- **La existencia de `bodyweight_entries`, `body_measurements` y `session_checkins` en una base remota migrada fuera del repositorio no se puede descartar.** El repositorio es la única fuente de verdad disponible, y el propio `lib/exercise/exerciseSchema.test.ts:18-21` demuestra que el proyecto trata las migraciones del repo como fuente de verdad.
- **No se midió el coste real de las consultas** contra la base: no hay entorno de producción con datos. El análisis de sobre-descarga es estructural (`.select("*")` sin filtro, sin `limit`).
- **El análisis de alcanzabilidad cubre imports estáticos, `import()` dinámicos y el patrón `new Worker(new URL(...))` de Vite.** Un módulo referenciado solo por una cadena (p. ej. un `import.meta.glob`) no se detectaría; no se ha encontrado ninguno.

---

## 14. Anexo — Índice de evidencia

### 14.1 Ficheros citados por sección

| Sección | Ficheros |
|---|---|
| §2 (método) | `tsconfig.json:13-14,21-26`, `.gitignore:5`, `vite.config.ts:19-30` |
| §3 (inventario) | `src/**` (350 ficheros) |
| §4.2 (isla) | `components/ActiveWorkout.tsx:33,34,53,54,73,74`, `components/workout/SetTable.tsx`, `lib/workout/restTimer.ts`, `lib/audio/audio.ts`, `lib/workout/fatigue.ts`, `lib/workout/recordBreak.ts`, `components/RestTimer.tsx:52-53` |
| §4.4 (exports) | `src/**` (1 165 símbolos clasificados) |
| §4.5 (equipamiento) | `data/equipmentCatalog.ts:181-251,256-308,324-345`, `data/equipmentMap.ts:18-614`, `data/myGymEquipment.ts:25,27,72,79,98`, `data/gripMap.ts:10,34`, `data/availableEquipment.ts:1,36`, `lib/equipmentHelpers.ts:1-11` |
| §5 (datos) | `types/supabase.ts:1,30,39,48,68,107,112,219,221,264-267,332,359,407,536-539,608,610,616,618`, `services/seedExercises.ts:23-31,45-60`, `components/ExerciseSelectorModal.tsx:17,33-50,77`, `lib/workout/setKind.ts:19,45-47`, `lib/workout/types.ts:21-25`, `lib/import/types.ts:23-33,56-57,80-88` |
| §5.3-5.5 (esquema) | `supabase/schema.sql:9,11,28,49,64,79,84,86,87,107-135`, `supabase/migrations/00000000000000_baseline_profiles.sql:33`, `20260101000000_coach_ai.sql:18,44`, `20261003000000_routine_favorites.sql:17-18`, `20261003020000_coach_human.sql:36,113-117,127,150,263-270,403-404`, `20261003030000_coach_portal.sql:232-233,334-338`, `20261003040000_exercise_hub_notes.sql:55-56` |
| §6 (sync) | `lib/sessionSync.ts:37-49,54-95,100-139,146-155`, `lib/offlineStore.ts:106,118-126,129,138-157,159,165-178,181-183,194,207-223`, `lib/idb.ts:22,30,33,40,52-91,102-133,143-166`, `hooks/useOfflineSync.ts:16,41,59-64,74-93,95-100`, `hooks/usePolling.ts:59-63,106,145-152` |
| §7 (rendimiento) | `components/ExerciseSelectorModal.tsx:17`, `vite.config.ts:19-30`, `hooks/useMuscleRanks.ts:226-232,403-463`, `hooks/useGymData.ts:114,115,278,279,291`, `hooks/useAthletePRs.ts:114,133,150,192`, `hooks/useDashboardSessions.ts:178-191`, `lib/ai/coachAssistant.ts:13-17,363` |
| §8 (duplicación) | `lib/routines/routineSave.ts:40,54,60,91,137,163,180`, `saveGeneratedRoutine.ts:44,78,94`, `saveCoachRoutine.ts:43,96,124`, `components/RoutineBuilder.tsx:111-172`, `components/dashboard/RoutinesPage.tsx:196-244`, `components/dashboard/RoutineLibrary.tsx:220-225,1016-1064`, `lib/ranks/neonRanks.ts:1-24` |
| §9 (catálogos) | `lib/i18n.ts:98,143-335,482`, `data/equipmentCatalog.ts:202,228,233,239,240,250,264-307`, `data/equipmentMap.ts:18-614`, `components/ActiveWorkout.tsx:860-862,932,1396`, `components/EquipmentModal.tsx:82`, `components/ExerciseSelectorModal.tsx:345-347,423`, `components/progress/*.tsx`, `components/ranks/AnatomicalRanksPage.tsx:307-309` |
| §10 (importación) | `hooks/useCsvImport.ts:88,149-153,182,230-232,267-269`, `workers/importCsv.worker.ts:72,89,109-120,131,139-143`, `lib/import/workerProtocol.ts:41-45`, `lib/import/analyze.ts:155-162,237,255-258,302-314,343-349`, `lib/import/commit.ts:169,177-184,202,206-213,214-268,288,292-321`, `lib/import/sources.ts:36-72,90,135`, `components/import/ImportWizard.tsx:108,129,139,151,173-176,828-839` |

### 14.2 Comandos de verificación

```powershell
# Typecheck y tests (baseline)
npm run typecheck
npm test

# Build y tamaño del bundle
npm run build
Get-ChildItem dist/assets | Sort-Object Length -Descending | Select-Object Name, Length

# Prueba de que el catálogo está dentro del chunk principal
Select-String -Path "dist/assets/index-*.js" -Pattern "availableInCronosGym" -AllMatches |
  ForEach-Object { $_.Matches.Count }   # => 1325

# Comprobación de exports muertos (grep sobre el símbolo)
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern "\bgetEquipmentById\b"

# Alcancabilidad e isla (§3, §4.1, §4.2): grafo de imports desde src/main.tsx
# y conteo de líneas físicas. Script Node fuera del repo: %TEMP%\kilo\f4-island.js
node "$env:TEMP\kilo\f4-island.js" "C:\Users\yayog\crono-gym"
# => unreachable production: 48 files, 9588 lines
#    island (reachable from a test): 26 files, 6157 lines
#    orphan (no test reaches it):    22 files, 3431 lines
```

### 14.3 Métricas de la fase

| Métrica | Valor |
|---|---|
| Ficheros de producción auditados | 221 (350 con tests) |
| Líneas de producción | 62 633 |
| Exportaciones clasificadas | 1 165 |
| Exportaciones con cero referencias | **55** |
| Exportaciones solo-internas | **265** |
| Exportaciones solo-test | 49 |
| Ficheros de producción inalcanzables | **48** |
| Líneas de producción inalcanzables | **9 588** (15,3 %) |
| Componentes > 1 000 líneas | 9 |
| Componentes > 500 líneas | 20 |
| Consultas Supabase | 77 en 24 ficheros |
| Escritores de rutinas | 6 |
| Reglas de equipamiento medidas sobre el catálogo | 46 (252 al comodín, 5 ciegas) |
| Consultas `.from(...)` con error no manejado | 1 (`AthleteCRM.tsx:112`) |
| Tablas tipadas sin DDL / sin tipo | 3 / 2 |
| Desajustes de nulabilidad TS ↔ SQL | 7 columnas |
| Claves de i18n muertas verificadas | 43 |
| Bundle principal | 16,13 MB (gzip 2,58 MB) |
| Defectos reproducibles con ejecución real | 7 (progreso, RPE issue, fallbacks, catch, sort, remo, `numeric`) |
