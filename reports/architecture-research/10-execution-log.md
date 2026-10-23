# Fase 5 — Registro consolidado de ejecución

**Alcance:** la bitácora completa de la auditoría: qué herramientas se usaron, con qué objetivo, qué evidencia produjo cada una, qué advertencias aparecieron y en qué estado queda el repositorio.

**Período:** 19 de octubre de 2026 (Fases 0–4) y 20 de octubre de 2026 (Fase 5), con tres sesiones previas de apoyo (16–17 de octubre) que aportaron la captura de la suite de tests y el volcado de una fuente de datos externa.

**Estado del baseline:** intacto. **Ningún archivo de `src/` ni de `supabase/` fue modificado en ninguna de las cinco fases.** Los 18 ficheros modificados y los 9 sin seguimiento que aparecen en `git status` son **preexistentes** a la auditoría (rama `chore/ordenar-wip`).

---

## 1. Resumen

| Fase | Objetivo | Herramientas dominantes | Entregable | Estado |
|---|---|---|---|---|
| **0** | Verificar el entorno y el inventario | MCP REA, JADX, PowerShell | `01-environment-and-inventory.md` | ✅ |
| **1** | Modelo de datos comparativo | REA (`inspect_manifest`, `list_sources`), Node | `03-data-model-comparison.md` | ✅ |
| **2** | Active Workout, temporizador y recuperación | Lectura de código, Node | `04-active-workout-and-timer.md` | ✅ |
| **3** | Catálogo, taxonomía y medios | Node, esbuild, PowerShell | `05-catalog-and-media.md` | ✅ |
| **4** | Auditoría integral del código | Node (7 scripts de análisis estático), `npm run build` | `06-cronos-code-audit.md`, `07-target-architecture.md` | ✅ |
| **5** | Síntesis, plan y riesgos | Lectura de código, verificación de métricas | `08-refactor-roadmap.md`, `09-risks-and-open-questions.md`, `10-execution-log.md` (este) | ✅ |

**Volumen de evidencia generada:** 60 453 ficheros descompilados (844 MB) fuera del repositorio, 22 scripts de análisis en `%TEMP%\kilo\`, 10 documentos (481 KB) en `reports/architecture-research/`.

---

## 2. Inventario de herramientas

### 2.1 MCP REA (servidor de ingeniería inversa)

Servidor accesible por el transporte MCP de Kilo en `http://localhost:8000/sse`. **El puerto no está abierto desde el shell, pero el servidor responde**: la afirmación inicial de la Fase 0 (que lo declaraba inalcanzable) quedó deshecha con evidencia de disco.

| Herramienta | Invocaciones | Resultado | Advertencia |
|---|---|---|---|
| `rea_decompile_apk` | 5 (4 apps + 1 split) | 5 árboles completos en `Downloads\decompiled\` | **3 de 5 devolvieron `MCP error -32001: Request timed out`**: es el tiempo de espera del cliente, no un fallo del servidor. Verificado por inspección de disco (`sources/` + `resources/` poblados, manifiesto presente) |
| `rea_inspect_manifest` | 2+ | Manifiesto completo de FitNotes (10 624 B) y de Hevy (versionCode 3 289 237) | — |
| `rea_list_sources` | 1+ | 175 paquetes de primer nivel de FitNotes | El primer uso devolvió `No se encontró la carpeta sources` (directorio inexistente): **confirma que la herramienta valida su entrada** |

**JADX CLI.** No está en `PATH`, pero **REA lo empaqueta y lo invoca internamente** con el JRE de Zulu OpenJDK 11.0.32.1 (`openjdk version "11.0.32.1" 2026-08-18 LTS`). No fue un bloqueo. **Apktool** y **adb** no se necesitaron: análisis estático puro, sin dispositivo.

### 2.2 Cadena de ejecución del repositorio

| Herramienta | Versión | Uso en la auditoría |
|---|---|---|
| Node.js | v24.18.0 | Los 13 scripts de análisis estático; el `package.json` exige `>=20.0.0` |
| npm | 11.16.0 | `typecheck`, `build`, `test` |
| TypeScript | 5.6.3 | `tsc --noEmit` (L1 de validación) y `tsc -b` dentro del build |
| Vite | 5.4.10 | `vite build`: تولдуjo la medida del chunk principal (16,13 MB) |
| Vitest | 2.1.9 | 129 ficheros de test, 2 494 tests |
| esbuild | (transitivo) | `npm run verify:mapping`: empaqueta `src/lib/muscleMap.ts` para ejecutarlo fuera de Vite; también se usó para compilar `equipmentCatalog.ts` y medir las 46 reglas sobre los 1 324 registros reales |
| TypeScript strict | `strict` + `noUnusedLocals` + `noUnusedParameters` | Base de la clasificación de exports muertos: el typecheck **no** detecta un `export` que nadie importa |

### 2.3 Scripts de análisis

**Todos viven fuera del repositorio**, en `C:\Users\yayog\AppData\Local\Temp\kilo\`, y por tanto **no forman parte del proyecto**. Este es el mismo criterio que se aplicó a la salida de JADX: lo que sirve para investigar no se mezcla con lo que se entrega.

#### Node — análisis del catálogo (Fase 3)

| Script | Objetivo | Salida |
|---|---|---|
| `ex.js` | Volcado de un dataset público de ejercicios a un formato plano | JSON en stdout (fuente de datos secundaria, **no** la del producto) |
| `phase3-probe.js` | Recorrido de `src/` buscando los puntos de uso del catálogo | Inventario de consumidores |
| `phase3-validate.js` | Comprobación de las cifras afirmadas en `05-catalog-and-media.md` contra el JSON real | Validación de 1 324 registros, 16 campos, 10 idiomas |
| `phase3-validate2.js` | Segunda pasada: числа de las tablas del informe (contenedor de tablas Markdown mal partido) | Validación de frecuencias y solapamientos |

#### Node — análisis estático (Fase 4)

| Script | Objetivo | Salida |
|---|---|---|
| `f4-static.js` | Clasificación de exports (cero referencias / solo interno / solo test / vivos), imports rotos, ciclos | `f4-static.json` (110 777 B) + `f4-static.txt` (83 120 B) |
| `f4-orphans.js` | Huérfanos de componente: ficheros con **cero** importadores | Listado con riesgo de falso positivo por fichero |
| `f4-refined.js` | Segunda clasificación de huérfanos, separando componentes de módulos de dominio | Listado refinado |
| `f4-smells.js` | Olores de código: `catch` vacíos, `select("*")`, `Intl` disperso, `toFixed` repetido, contadores de hooks | Inventario de 7 categorías |
| `f4-equip.js` | **Ejecución real** de `equipmentCatalog.ts` sobre los 1 324 registros | Distribución por regla de equipamiento |
| `f4-equip2.js` | Reglas que nunca coinciden y asignaciones del comodín | 5 reglas ciegas; 252 asignaciones al comodín |
| `f4-equip3.js` | Contraste con `equipmentMap.ts`: Machine Divider divergente | Casos concretos de asignación falsa |
| `f4-reach.js` | Grafo de alcanzabilidad desde `src/main.tsx` (imports estáticos, `import()` y `new Worker(new URL(...))`) | 173 de 350 ficheros alcanzables |
| `f4-lines.js` | Recuento de líneas **físicas** por fichero y por directorio | Corrección de la métrica (ver §6.3) |
| `f4-linecheck.js` | Verificador automático de que **todas** las cifras de línea citadas en los informes coinciden con el código | Sin discrepancias (verificación final) |
| `f4-inv.js` | Inventario por directorio y tabla de los componentes más grandes | Tablas §3 y §3.1 del informe 06 |
| `f4-island.js` | isla de código inalcanzable: qué la alcanzan los tests y qué no | 26 ficheros / 6 157 líneas de isla; 22 huérfanos / 3 431 líneas |
| `f4-thresholds.js` | Umbrales (>500, >1 000 líneas) y conteo de hooks por componente | 20 componentes > 500; 9 > 1 000 |

#### PowerShell

| Script | Objetivo |
|---|---|
| `catalog-analysis.ps1` | Recuento de campos, valores distintos y solapamientos del catálogo (1 324 registros) |
| `encoding-check.ps1` / `encoding-bytes.ps1` | Verificación del **encoding y de los bytes** del JSON del catálogo: el fichero es una única línea de 16 MB y las herramientas de lectura lo truncan |
| `stringscan.ps1` | Extracción de cadenas de los binarios: `index.android.bundle` de Hevy (22 217 100 B) y `libapp.so` de Symmetry (arm64) |
| `paths.ps1` | Resolución de rutas y de los alias de `tsconfig.json` (`@/*`, `@lib/*`, `@services/*`, `@components/*`) |

#### Capturas

| Fichero | Contenido |
|---|---|
| `vitest.txt` (86 536 B) | Salida íntegra de una ejecución de la suite, 17/10 |
| `fitnotes_files.txt` / `fitnotes_files2.txt` | Inventarios del árbol descompilado de FitNotes (2 707 ficheros), para acotar la búsqueda de entidades Room |
| `rea-out.txt` / `rea-err.txt` | Redirecciones de la salida del servidor REA (vacías: el resultado llega por el transporte MCP, no por stdout) |

---

## 3. Bitácora por fase

### Fase 0 — Entorno e inventario (19/10, 01:22–04:40)

| Paso | Acción | Evidencia | Resultado |
|---|---|---|---|
| 0.1 | Comprobación del servidor MCP REA | 3 herramientas invocadas | ✅ Activo. **Corrección** de la afirmación previa de que estaba caído |
| 0.2 | Inventario de APK en `Downloads\` | 6 entradas + 4 APK ajenos excluidos | Tabla con tamaños y SHA-256 |
| 0.3 | Descompilación de 4 apps | 5 árboles, 60 453 ficheros, 844 MB | ✅ 3 timeouts del cliente, 0 fallos reales |
| 0.4 | Identidades de app | `rea_inspect_manifest` | 4 paquetes, versiones y SDK confirmados |
| 0.5 | Baseline del repositorio | `npm run typecheck` + `npm test` | 0 errores; 129 ficheros / 2 494 tests verdes (279 s) |
| 0.6 | Informe | `01-environment-and-inventory.md` | ✅ |

**Advertencia registrada:** el informe previo declaraba la ingeniería inversa bloqueada. Quedó **deshecha**, no suavizada.

### Fase 1 — Modelo de datos comparativo (19/10, 01:22–02:59)

| Paso | Acción | Evidencia | Resultado |
|---|---|---|---|
| 1.1 | Lectura de entidades Room de JEFIT | `decompiled\jefit\sources\je\fit\data\room\entity\` | 7 entidades de taxonomía mapeadas |
| 1.2 | Lectura del esquema de FitNotes | `CREATE TABLE` en `X\C0284w.java` etc. | `database.db` v22, 8 categorías |
| 1.3 | Extracción de claves de Hevy | `stringscan.ps1` sobre el bundle Hermes | 1 498 URLs de CloudFront; 19+6 grupos musculares |
| 1.4 | Lectura de los modelos Dart de Symmetry | Cadenas en `libapp.so` | `active_session_snapshots`, `anchoredRemaining`, `rest_end_alert` |
| 1.5 | Contraste con el esquema de Cronos | `supabase/schema.sql` + 7 migraciones | 3 tablas tipadas sin DDL; `set_type` perdido; `numeric` divergente |
| 1.6 | Informe | `03-data-model-comparison.md` (43 952 B) | ✅ |

### Fase 2 — Active Workout, temporizador y recuperación (19/10, 04:44–04:51)

| Paso | Acción | Evidencia | Resultado |
|---|---|---|---|
| 2.1 | Lectura completa del flujo activo | 14 ficheros citados en el anexo | 3 brechas críticas (B1, B2, B3) y 5 altas |
| 2.2 | Contraste con Hevy y Symmetry | Cadenas y símbolos | Matriz comparativa de 13 capacidades |
| 2.3 | Catálogo de 12 casos de falla | F1–F12 | Delays: temporizador que deriva, borrador huérfano, debounce que nunca vence |
| 2.4 | Propuesta P0/P1/P2 | 5 P0, 4 P1, 3 P2 | Base del roadmap 08 |
| 2.5 | Informe | `04-active-workout-and-timer.md` (45 834 B) | ✅ |

**Advertencia registrada:** el análisis de Hevy y Symmetry se hizo sobre **binarios ofuscados**. Se afirma **la forma del modelo**, no la semántica de su servidor. Queda escrito en el informe.

### Fase 3 — Catálogo, taxonomía y medios (19/10, 04:54–06:08)

| Paso | Acción | Evidencia | Resultado |
|---|---|---|---|
| 3.1 | Análisis byte a byte del catálogo | `catalog-analysis.ps1`, `encoding-bytes.ps1` | 16 265 338 B; 1 324 registros; 16 campos; 10 idiomas |
| 3.2 | Verificación de las cifras del informe | `phase3-validate.js`, `phase3-validate2.js` | Cifras confirmadas contra el fichero real |
| 3.3 | Taxonomía: solapamientos | 3 vocabularios musculares, `category` ≡ `body_part` | 19 / 29 / 40 valores distintos para los mismos músculos |
| 3.4 | Medios: 10 puntos de render | `resolveImageSrc` frente a rutas crudas | 4 rotos; 161 JPG (24,4 MB); sin `public/videos/` |
| 3.5 | Offline | 7 stores de IndexedDB | El catálogo **no** está en el almacenamiento local |
| 3.6 | Informe | `05-catalog-and-media.md` (111 569 B) | ✅ |

### Fase 4 — Auditoría integral del código (19/10, 06:17–06:54)

| Paso | Acción | Evidencia | Resultado |
|---|---|---|---|
| 4.1 | Clasificación de exports | `f4-static.js` → JSON + TXT | 1 165 símbolos: 55 muertos, 265 solo-internos, 49 solo-test, 702 vivos, 183 tipos huérfanos |
| 4.2 | Huérfanos | `f4-orphans.js`, `f4-refined.js` | Componentes sin importador y módulos de dominio |
| 4.3 | Olores | `f4-smells.js` | 7 categorías medidas |
| 4.4 | Equipamiento | `f4-equip*.js` con esbuild | 46 reglas; comodín `/.*/`; 252 asignaciones; 5 reglas ciegas |
| 4.5 | Alcanzabilidad | `f4-reach.js` | 48 ficheros de producción inalcanzables |
| 4.6 | Build real | `npm run build` | 1 792 módulos; chunk principal 16,13 MB (gzip 2,58 MB) |
| 4.7 | Suite completa | `npm test` × 2 | 129/129 en verde (309,15 s y 379,33 s) |
| 4.8 | Informes | `06-cronos-code-audit.md` (81 457 B), `07-target-architecture.md` (62 673 B) | ✅ |
| 4.9 | **Corrección de métricas** | `f4-lines.js`, `f4-inv.js`, `f4-island.js`, `f4-thresholds.js`, `f4-linecheck.js` | Ver §6.3 |

### Fase 5 — Síntesis, plan y riesgos (20/10, 00:57–)

| Paso | Acción | Entregable |
|---|---|---|
| 5.1 | Consolidación del índice de las Fases 0–4 | `00-executive-summary.md` actualizado (11 447 B) |
| 5.2 | Verificación de la evidencia de los 5 ítems P0 en el código actual | `ActiveWorkout.tsx:690-712, 1481-1496, 1608-1652`; `App.tsx:325`; `RestTimer.tsx:91`; `audio.ts`; `restTimer.ts`; `offlineStore.ts` |
| 5.3 | Plan de refactorización | `08-refactor-roadmap.md` |
| 5.4 | Matriz de riesgos y preguntas abiertas | `09-risks-and-open-questions.md` |
| 5.5 | Bitácora consolidada | `10-execution-log.md` (este documento) |
| 5.6 | Validación final | `npm run typecheck` → 0 errores; `npm test` → **129/129 ficheros, 2 494 tests, 393,32 s** |
| 5.7 | Barrido de coherencia final | `f4-linecheck.js` sobre los 10 documentos → 0 discrepancias de líneas; recuento de ficheros descompilados corregido (65 453 → **60 453**); totales de la serie ajustados a **10 ficheros / 481 237 B**; `git status` confirma que `src/` y `supabase/` solo contienen el WIP preexistente de `chore/ordenar-wip` |

---

## 4. Artefactos generados

### 4.1 Dentro del repositorio — solo documentación

| Fichero | Bytes | Fase |
|---|---|---|
| `reports/architecture-research/00-executive-summary.md` | 13 687 | 0–5 |
| `reports/architecture-research/01-environment-and-inventory.md` | 7 738 | 0 |
| `reports/architecture-research/03-data-model-comparison.md` | 43 952 | 1 |
| `reports/architecture-research/04-active-workout-and-timer.md` | 45 834 | 2 |
| `reports/architecture-research/05-catalog-and-media.md` | 111 667 | 3 |
| `reports/architecture-research/06-cronos-code-audit.md` | 81 555 | 4 |
| `reports/architecture-research/07-target-architecture.md` | 62 771 | 4 |
| `reports/architecture-research/08-refactor-roadmap.md` | 55 175 | 5 |
| `reports/architecture-research/09-risks-and-open-questions.md` | 32 243 | 5 |
| `reports/architecture-research/10-execution-log.md` | 26 615 | 5 |
| **Total** | **481 237 B en 10 ficheros** | |

`reports/` es la **única** ruta del repositorio que la auditoría ha creado. Está sin seguimiento en git (`?? reports/`) porque **no se ha hecho ningún commit**: la auditoría no modifica el repositorio, lo describe.

> **Nota sobre la numeración.** No existe un `02-*.md`. El número de la Fase 1 pasó a ser `03` porque el `02` quedó reservado desde el principio para un informe de datos que se absorbió en el `03`. No es un fichero perdido: la serie es `00, 01, 03, 04, 05, 06, 07, 08, 09, 10`.

### 4.2 Fuera del repositorio — evidencia de trabajo

| Ubicación | Contenido | Volumen |
|---|---|---|
| `C:\Users\yayog\Downloads\decompiled\fitnotes\` | FitNotes 25.1 | 2 707 ficheros · 9,7 MB |
| `C:\Users\yayog\Downloads\decompiled\hevy\` | Hevy 3.1.16 | 11 739 ficheros · 197,6 MB |
| `C:\Users\yayog\Downloads\decompiled\jefit\` | JEFIT 17.0.1 | 37 630 ficheros · 504,3 MB |
| `C:\Users\yayog\Downloads\decompiled\symmetry\` | Symmetry 7.16.0 (base) | 8 361 ficheros · 80,0 MB |
| `C:\Users\yayog\Downloads\decompiled\symmetry-arm64\` | Split arm64 (`libapp.so`) | 16 ficheros · 52,8 MB |
| `C:\Users\yayog\AppData\Local\Temp\kilo\` | 22 scripts de análisis + capturas | ~600 KB |

**Total: 60 453 ficheros de evidencia, 844 MB.** Todo fuera del repositorio, por diseño: lo que sirve para investigar no se mezcla con lo que se entrega.

### 4.3 Efectos colaterales aceptados

| Efecto | Por qué | Reversión |
|---|---|---|
| `dist/` regenerado por `npm run build` | La medida del bundle **requiere** un build real | `dist/` está en `.gitignore` (línea 5): no altera el estado del repositorio |
| `node_modules/.cache/equip.cjs` y `muscleMap.cjs` | Artefactos de esbuild para ejecutar código de `src/` fuera de Vite | Caché; se regenera con `npm run verify:mapping` |
| `tsconfig.tsbuildinfo` | Actualizado por `tsc -b` | Artefacto de compilación; fuera del control de versiones |

---

## 5. Baseline verificado

| Comprobación | Comando | Resultado | Ejecuciones |
|---|---|---|---|
| Tipos | `npm run typecheck` | ✅ 0 errores | 4 (uno por fase + el final) |
| Tests | `npm test` | ✅ 129/129 ficheros, 2 494 tests | **4 completas** (279 s, 309,15 s, 379,33 s, 393,32 s) + 1 canalizada |
| Build | `npm run build` | ✅ 1 792 módulos; chunk principal 16,13 MB (gzip 2,58 MB) | 1 |
| Mapeo muscular | `npm run verify:mapping` | ✅ en verde | — |
| Flujos | Playwright | **no ejecutado** | 0 |

---

## 6. Advertencias y anomalías

### 6.1 Timeouts del cliente MCP (3 de 5 descompilaciones)

**Síntoma:** `MCP error -32001: Request timed out` en `rea_decompile_apk`.
**Diagnóstico:** tiempo de espera del cliente, **no** fallo del servidor. Los 5 árboles se materializaron completos (verificado por conteo de ficheros y presencia de `sources/`, `resources/` y `AndroidManifest.xml`).
**Mitigación aplicada:** reintento y verificación por disco antes de dar por buena una salida.

### 6.2 Flake de temporización en la suite

**Síntoma:** `src/components/coach/portal/RequestQueue.test.tsx > RequestQueue · qué pide al servidor > lee los nombres de los atletas en una segunda consulta` falla en la ejecución canalizada con filtrado de salida.
**Diagnóstico:** prueba sensible a la carga del entorno. **Pasa de forma aislada (6,76 s)** y el fichero completo va en verde (20 tests, 3 519 ms) en las tres ejecuciones completas. En la cuarta ejecución completa (Fase 5, 393,32 s) el caso problemático tardó **636 ms** y el fichero **1 697 ms**: el flake no se reprodujo.
**Estado:** **no resuelto, no causado por la auditoría** (no se modificó ningún fichero de `src/`). Queda documentado en los informes 04, 05 y 06 con la instrucción de reejecutar aislado antes de culpar a un cambio.

### 6.3 Error de métrica en el recuento de líneas (corregido)

**Síntoma:** el script de auditoría counting —con `contenido.split('\n').length`— cuenta **una línea fantasma** en los ficheros que terminan en salto de línea, y el informe mezclaba dos convenciones (líneas físicas en producción, líneas no vacías en tests).
**Alcance del error:** 13 recuentos de fichero y **3 cifras aggregates** (producción, inalcanzable, isla) estaban desviadas en un valor o en un porcentaje.
**Corrección:** recálculo con `f4-lines.js`, `f4-inv.js`, `f4-island.js` y `f4-thresholds.js`; corrección de los informes 00, 06 y 07; verificación final con `f4-linecheck.js` (sin discrepancias).
**Cifras corregidas:** producción 232 ficheros / ~52 000 líneas → **221 ficheros / 62 633 líneas**; inalcanzable 9 620 (27 %) → **9 588 (15,3 %)**; isla ~4 800 → **6 157 líneas en 26 ficheros**.
**Lección registrada:** *un número sin convención declarada es un número que se citará mal*.

### 6.4 `schema.sql` obsoleto y 3 tablas sin DDL

**Síntoma:** `bodyweight_entries`, `body_measurements` y `session_checkins` se consultan (`useProfile.ts:155,161,167,192`) pero no tienen DDL en el repositorio.
**Salvedad explícita:** **no se puede descartar que existan en una base remota migrada fuera del repositorio**. El repositorio es la única fuente de verdad disponible, y el propio `src/lib/exercise/exerciseSchema.test.ts:18-21` demuestra que el proyecto trata las migraciones del repo como fuente de verdad. Queda como **pregunta abierta Q7** del informe 09.

### 6.5 `numeric` sin verificar contra el servidor

**Síntoma:** `useAthletePRs.ts:192` **descarta** toda fila cuyo peso no sea `number`; `exerciseHistory.ts:95-99` usa `parseWeight`. El panel de récords puede aparecer vacío sin ningún error.
**Salvedad:** la **divergencia interna** es un hecho verificado; **cuál de los dos está equivocado** requiere una consulta al servidor. Queda como **pregunta abierta Q6** y como **prueba de estrés E11**.

### 6.6 Ruido de codificación en la consola

**Síntoma:** PowerShell 5.1 muestra los UTF-8 de los informes como `Ã¡`, `â€”`, `MÃ³dulo`.
**Diagnóstico:** es la consola, no los ficheros. Verificado con lectura binaria y con `Get-Content -Encoding UTF8`: los 10 documentos están en UTF-8 correcto.

### 6.7 Estado del árbol de trabajo

**Síntoma:** `git status` muestra 18 ficheros modificados y 9 sin seguimiento en `src/`.
**Diagnóstico:** son **preexistentes** a la auditoría (rama `chore/ordenar-wip`). **No fueron tocados** en ninguna fase: el diff es idéntico al del inicio.
**Consecuencia para el plan:** el informe 08 exige un árbol limpio (`git tag baseline-fase5`) antes de la primera ola.

---

## 7. Estado final

### 7.1 Repositorio

```
Rama:      chore/ordenar-wip (base: main)
Estado:    18 modificados + 9 sin seguimiento en src/  →  PREEXISTENTES, NO TOCADOS
           ?? reports/  →  ÚNICO artefacto de la auditoría
Sin commit: la auditoría no versiona nada.
```

| Comprobación | Estado |
|---|---|
| `src/` modificado por la auditoría | **No** |
| `supabase/` modificado por la auditoría | **No** |
| `npm run typecheck` | ✅ 0 errores |
| `npm test` | ✅ 129/129 |
| `npm run build` | ✅ correcto |
| Commits creados | **0** |
| Ramas creadas | **0** |

### 7.2 Métricas consolidadas de la auditoría

| Métrica | Valor |
|---|---|
| Ficheros `.ts`/`.tsx` auditados | 350 (221 de producción, 129 de prueba) |
| Líneas de producción | 62 633 |
| Líneas de test | 36 261 |
| Ficheros de producción inalcanzables | 48 (15,3 %) |
| Líneas de producción inalcanzables | 9 588 |
| Isla alcanzable solo desde tests | 26 ficheros · 6 157 líneas |
| Exportaciones clasificadas | 1 165 (55 muertas, 265 solo-internas, 49 solo-test, 702 vivas, 183 tipos huérfanos) |
| Reglas de equipamiento medidas sobre el catálogo real | 46 (252 al comodín, 5 ciegas) |
| Consultas Supabase | 77 en 24 ficheros |
| Bundle principal | 16,13 MB (gzip 2,58 MB) |
| Evidencia descompilada | 4 apps, 60 453 ficheros, 844 MB |
| Scripts de análisis | 22 (fuera del repositorio) |
| Documentos entregados | 10 (481 237 B) |
| Cambios en código de producción | **0** |

### 7.3 Lo que la auditoría **no** hizo

- **No ejecutó la aplicación en un navegador.** Ninguna conclusión de UI viene de observar la app: vienen de leer el código y del resultado del build. Es el límite que impide cerrar con evidencia las 12 pruebas de estrés del informe 09.
- **No midió cobertura.** La isla de código muerto se detectó por **alcanzabilidad**, no por un informe de cobertura: no hay cobertura instrumentada en el repositorio.
- **No se conectó a la base de datos.** No hay consultas reales, ni entorno de staging, ni verificación de `numeric`, ni volumen real de `completed_sets`.
- **No midió el coste de las consultas** ni el rendimiento en un dispositivo real.
- **No creó commits ni ramas.** El plan del informe 08 está escrito, no ejecutado.
- **No resolvió las 12 preguntas abiertas** del informe 09: las dejó con un supuesto por defecto explícito para que el trabajo no se bloquee.

---

## 8. Reproducción

### 8.1 Verificar el baseline

```powershell
cd C:\Users\yayog\crono-gym
npm run typecheck      # 0 errores
npm test               # 129/129 en verde (~5 min)
npm run build          # 1 792 módulos, chunk principal 16,13 MB
```

### 8.2 Reproducir las métricas del informe 06

```powershell
# Alcancabilidad e isla
node "$env:TEMP\kilo\f4-island.js" "C:\Users\yayog\crono-gym"
# => unreachable production: 48 files, 9588 lines
#    island (reachable from a test): 26 files, 6157 lines
#    orphan (no test reaches it):    22 files, 3431 lines

# Inventario por directorio y componentes más grandes
node "$env:TEMP\kilo\f4-inv.js" "C:\Users\yayog\crono-gym"

# Umbrales y conteo de hooks
node "$env:TEMP\kilo\f4-thresholds.js" "C:\Users\yayog\crono-gym"

# Verificar que las cifras de línea de los informes coinciden con el código
node "$env:TEMP\kilo\f4-linecheck.js" "C:\Users\yayog\crono-gym" "C:\Users\yayog\crono-gym\reports\architecture-research\06-cronos-code-audit.md"
```

> Los scripts están **fuera del repositorio** y no se versionan. Si se pierden, se reconstruyen a partir de la descripción del método del informe 06 §2 y de los comandos del §14.2: son unos 150 líneas de Node cada uno.

### 8.3 Reproducir la evidencia de las aplicaciones de referencia

```powershell
# Las 4 apps ya están descompiladas; para rehacerlo:
#   1. extraer Symmetry.zip en C:\Users\yayog\Downloads\Symmetry\
#   2. invocar la herramienta MCP rea_decompile_apk por cada APK
#      (apkPath, outputDir) con un tiempo de espera amplio: 3 de 5 superaron
#      el timeout del cliente y el árbol se materializó igualmente
#   3. verificar por disco antes de usar la salida:
Get-ChildItem "C:\Users\yayog\Downloads\decompiled\*" -Directory | ForEach-Object {
  "$($_.Name): $((Get-ChildItem $_.FullName -Recurse -File).Count) ficheros"
}
```

---

## 9. Límites de esta bitácora

- **Es una reconstrucción por marcas de tiempo**, a partir de la fecha de modificación de los scripts, de los informes y de los directorios de salida. Las marcas son **al día, no al segundo**, y el paralelismo entre fases no es recuperable.
- **No registra el razonamiento descartado.** Los falsos positivos que se descartaron sí están en el informe 06 §2.1; el camino que no se siguió, no.
- **No es un registro de las conversaciones con el equipo**: no hubo decisiones humanas registradas más allá de lo que consta en los documentos. Las 12 preguntas abiertas del informe 09 son, de hecho, preguntas **sin** respuesta.
- **Las cifras de esta bitácora son las de la auditoría**, no las del producto: describen el repositorio tal como estaba el 19–20 de octubre de 2026. Cualquier cambio posterior las invalida, y `f4-linecheck.js` es la forma barata de detectarlo.

---

*Fase 5 — Entregables: `08-refactor-roadmap.md` · `09-risks-and-open-questions.md` · `10-execution-log.md` (este documento)*
