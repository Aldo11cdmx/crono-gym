# Fase 5 — Matriz de riesgos y preguntas abiertas

**Alcance:** lo que **no** se debe tocar todavía, los riesgos de las migraciones de datos que sí se van a hacer, y las preguntas que nadie ha respondido todavía. Este documento existe para que la primera ola de refactorización no se lance sobre supuestos no verificados.

**Estado del baseline:** intacto. `src/` y `supabase/` no han sido modificados. Este documento no ejecuta nada: delimita.

**Documentos relacionados:** `08-refactor-roadmap.md` (qué se va a cambiar y en qué orden) · `06-cronos-code-audit.md` (evidencia) · `07-target-architecture.md` (arquitectura objetivo) · `09` (este documento) · `10-execution-log.md` (bitácora).

---

## 1. Cómo usar este documento

| Si estás a punto de… | Lee primero |
|---|---|
| Borrar un fichero «que no se usa» | §2.1 (fugas en imports) |
| Añadir `user_exercises` o permitir escribir ejercicios | §2.2 |
| Tocar `offlineStore`, `idb`, `sessionSync` o `useOfflineSync` | §2.3 y §1.2 |
| Cambiar el esquema de Postgres | §2.4 y §3 |
| Empezar por el motor de progresión o por la taxonomía | §1.1 y §1.4 |
| Bloquearse porque «no está claro» | §3 (preguntas) y §4 (pruebas) |

**Regla general:** una pregunta sin resolver se resuelve con un **supuesto explícito y escrito**, nunca con un silencio. La columna «supuesto por defecto» de §3 es ese registro.

---

## 2. Módulos que NO se deben tocar todavía

La lista es corta a propósito. «No tocar» no significa «nunca»: significa **hasta que se cumpla la condición de la columna «ventana»**, y la levanta una persona, no un merge.

### 2.1 `src/lib/overload.ts` — el motor de progresión por RPE

| | |
|---|---|
| **Estado** | 575 líneas · **sin un solo test** |
| **Por qué no** | Es **el diferencial de Cronos** frente a las cuatro referencias: RIR = 10 − RPE decide la subida de carga y el deload. Ni JEFIT, ni Hevy, ni FitNotes, ni Symmetry tienen un gobernador de progresión comparable. Es también el módulo con **más superficie de reglas por línea** de todo el repositorio. |
| **El riesgo concreto** | Un cambio «pequeño» en la tabla de umbrales no rompe ningún test (no hay ninguno) y degrada en silencio la progresión de **todos** los usuarios. El síntoma es «la app carga más rápido que antes», que no se detecta hasta meses después. |
| **Ventana** | Se abre cuando exista un **test de caracterización** del motor: una tabla de casos (peso, repeticiones, RPE, RIR) con el resultado esperado, fijada contra la implementación actual. Sin ese test, cualquier cambio en este fichero está prohibido. |
| **Quién la levanta** | La persona responsable del modelo de entrenamiento, con la tabla de caracterización en el PR. |

### 2.2 `src/lib/idb.ts` · `src/lib/offlineStore.ts` — la persistencia local

| | |
|---|---|
| **Estado** | `idb.ts` v5 con 7 stores · `offlineStore.ts` 223 líneas **sin test propio** (`idb.test.ts` cubre la capa IDB, no el store) |
| **Por qué no** | El store `drafts` es **la única copia** del trabajo en curso de un usuario en su dispositivo. Un borrado accidental no se recupera: no está en el servidor hasta que la sesión se finaliza y sincroniza. |
| **El riesgo concreto** | Tres trampas: (a) subir `DB_VERSION` por debajo de la versión real **degrada** la base en algunos navegadores; (b) eliminar un store en la misma subida en que se crea otro deja datos huérfanos sin ruta de migración; (c) `exerciseNotes` (v4) es un store **muerto** pero su eliminación **igual exige** subida de versión. |
| **Ventana** | Los ítems **P0.3** y **P1.2** son precisamente las ventanas: P0.3 toca `offlineStore` de forma mínima (borrar un borrador ya adoptado) y P1.2 sube la versión a 6 de forma aditiva. **Cualquier otro cambio en `idb.ts` queda fuera de alcance hasta que P1.2 esté fusionado y probado.** |
| **Quién la levanta** | El autor de P1.2, con la copia del store `drafts` verificada antes de la subida de versión. |

### 2.3 `src/lib/sessionSync.ts` · `src/hooks/useOfflineSync.ts` — la sincronización

| | |
|---|---|
| **Estado** | 156 + 114 líneas · **sin test** en ninguno de los dos |
| **Por qué no** | Es el camino que lleva una sesión offline al servidor. Sus **contratos** (qué se encola, en qué orden, qué se reintenta, qué se descarta) **no están escritos en ningún sitio**: están implícitos en el código. |
| **El riesgo concreto** | El drenaje usa `drainQueue()` desde tres sitios distintos (`queueAndSync`, el evento `online`, el evento `visibilitychange` y el intervalo de 60 s). Un cambio en el orden o en la idempotencia puede **duplicar series en el servidor** sin ningún error visible: la cola no tiene clave de idempotencia por `logId`. |
| **Ventana** | El ítem **M1, commit 7** (propagar el error del drenaje) es la primera ventana, y es pequeña: no cambia el orden ni la idempotencia, solo deja de tragar el error. **Reordenar, reintentar o paralelizar la cola queda congelado** hasta que exista un test de la cola con un doble drenaje simulado. |
| **Quién la levanta** | La persona que implemente M1-7, con un test que dispare dos drenajes concurrentes y compruebe que la cola no se duplica. |

### 2.4 `src/lib/muscleMap.ts` y la taxonomía muscular

| | |
|---|---|
| **Estado** | 319 líneas · `npm run verify:mapping` como verificador |
| **Por qué no** | Es la **única** fuente de verdad del mapeo muscular actual, y la taxonomic objetivo (M6) la reemplaza por 7 tablas canónicas. Cambiarla antes de M6 significa migrar la taxonomía dos veces. |
| **El riesgo concreto** | La cadena de reglas del mapeo muscular es la que produce los rangos anatómicos. Un cambio sin el script de verificación rompe los rangos de usuarios que llevan meses entrenando, y **el daño es acumulativo**: los rangos se recalculan sobre el historial. |
| **Ventana** | M6 (commits 4–6), y solo después de que el script de mapeo con informe de discrepancias esté escrito. **Antes de M6, `verify:mapping` debe seguir en verde en cada commit.** |
| **Quién la levanta** | El implementador de M6, con el informe de discrepancias revisado una por una. |

### 2.5 `src/data/exercisesCatalog.json`

| | |
|---|---|
| **Estado** | 16 265 338 B · 1 324 registros · 16 campos · **una sola línea** |
| **Por qué no** | Es la **semilla** del catálogo: la copia de la que se derivan el catálogo del servidor y, más adelante, el activo comprimido. M5 lo convierte en un activo servido, pero **hasta entonces, este fichero es la única fuente de verdad** del catálogo completo. |
| **El riesgo concreto** | Si se edita el JSON antes de que exista el pipeline de carga (M5), cualquier error de formato se propaga a 1 324 filas a la vez, y **las herramientas de lectura lo truncan**: nadie lo revisa a ojo. |
| **Ventana** | M5, commit 1 (sacarlo del bundle). Antes de eso, el JSON **no se toca**. Si hay que corregir un ejercicio concreto, se corrige **en el servidor** y se regenera el JSON con el script de la semilla, nunca a mano. |
| **Quién la levanta** | El implementador de M5, con el checksum del fichero registrado antes y después. |

### 2.6 `supabase/schema.sql`

| | |
|---|---|
| **Estado** | Obsoleto: no incluye 3 tablas que el cliente consulta, y sus políticas RLS no reflejan las migraciones |
| **Por qué no** | Es un **segundo** esquema, y el repositorio trata las migraciones como fuente de verdad (lo demuestra el propio `src/lib/exercise/exerciseSchema.test.ts:18-21`). Editar `schema.sql` a mano **empeora** el problema: crea un tercer estado divergente. |
| **El riesgo concreto** | Un desarrollador que lea `schema.sql` creerá que `bodyweight_entries` no existe y "arreglará" el cliente, mientras que la tabla sí existe en la base real. |
| **Ventana** | M4, commit 8: **marcarlo como obsoleto** y apuntar a las migraciones. Hasta entonces, la regla es: **cualquier cambio del esquema se escribe en `supabase/migrations/`, nunca en `schema.sql`**. |
| **Quién la levanta** | El implementador de M4. |

### 2.7 `src/components/ActiveWorkout.tsx` — fuera de los P0

| | |
|---|---|
| **Estado** | 2 262 líneas · 18 `useState` · la pantalla principal |
| **Por qué no** | Es el fichero con más riesgo de regresión visual del repositorio, y su tamaño hace que cualquier cambio sea difícil de revisar. |
| **El riesgo concreto** | Un refactor grande y mezclado con un cambio funcional hace imposible saber qué rompió la pantalla. |
| **Ventana** | Solo se toca en los **cinco ítems P0** (cada uno con su rama y su commit atómico) y, después, en **M2** (la decisión de pantalla). **Nada más.** La partición en hooks (`useWorkoutSession`, `useRestTimer`, `useDraftSync`, `SetRow`) es el ítem 40 del backlog y pertenece a M2/M3, no antes. |
| **Quién la levanta** | El implementador de P0, con un criterio de aceptación por commit. |

### 2.8 `src/lib/import/*` — el pipeline de importación

| | |
|---|---|
| **Estado** | `csv.ts`, `sources.ts`, `analyze.ts`, `commit.ts`, `types.ts` + worker |
| **Por qué no** | Es el único módulo que **escribe datos en el servidor en bloque**, y su tabla de alias (`sources.ts`) es la que define cómo se interpreta cada formato de origen. |
| **El riesgo concreto** | Un cambio en `sources.ts` reinterpreta silenciosamente los archivos ya importados: un usuario que importó de Hevy puede ver sus Muscle Groups cambiados de golpe. Y el importador **ya pierde información** (`set_type`, `durationSec`, `distanceM`, `superset_id`): añadir otro campo a ciegas agrava el problema. |
| **Ventana** | M1 (commits 2 y 3) para los defectos de progreso y duplicados, que son de **visualización**, no de interpretación. Cualquier cambio en la **tabla de alias** o en el mapeo de columnas queda congelado hasta que M4 haya definido el modelo de destino (P2.1). |
| **Quién la levanta** | El implementador de M1 para los commits 2–3; el de M4 para el resto. |

### 2.9 Resumen de la congelación

| Módulo | Congelado hasta | Congela |
|---|---|---|
| `src/lib/overload.ts` | Test de caracterización | M4 (no tocar progresión) |
| `src/lib/idb.ts`, `offlineStore.ts` | P1.2 fusionado y probado | P1.2, M4 |
| `sessionSync.ts`, `useOfflineSync.ts` | Test de idempotencia de la cola | M1-7, M4 |
| `src/lib/muscleMap.ts` | M6 | M6 |
| `src/data/exercisesCatalog.json` | M5 | M5, M6 |
| `supabase/schema.sql` | M4 (marcarlo obsoleto) | M4 |
| `src/components/ActiveWorkout.tsx` | Solo P0 y M2 | M2, M3 |
| `src/lib/import/*` (alias) | M4 | M4 |

---

## 3. Riesgos de migración de datos

### 3.1 Fugas en imports — al eliminar código muerto

**El riesgo.** Borrar o dejar de exportar un símbolo que **alguien usa** no rompe el typecheck si el símbolo es un tipo, y rompe la suite de tests en un fichero que nadie mira. Hay tres variantes:

| Variante | Síntoma | Detección |
|---|---|---|
| **Fuga silenciosa** | Un módulo que se importaba con `import type` o por *namespace* (`import * as X`) no aparece en el conteo de identificadores | Typecheck: `import type` sí se comprueba, el *namespace* también. Riesgo bajo pero real con `export *` |
| **Fuga por test** | Un test importa un símbolo que solo el test usa (los 49 "solo-test") | La suite lo detecta… **si el test se ejecuta**. Un test con `describe.skip` no |
| **Fuga por consumer externo** | Un símbolo se usa desde la app web, desde un script de `scripts/` o desde un flujo que no está en `src/` (p. ej. una *Edge Function* que llame a la API) | **No la detecta nada del repositorio** |

**El caso concreto de Cronos.** `src/lib/ai/openrouter.ts` y `src/lib/ai/systemPrompt.ts` (87 + 99 líneas) están en la isla de pruebas y **no son alcanzables desde `main.tsx`**. Si M0 los borra junto con el resto de la isla, y hay un flujo de IA que se dispare desde otro punto (una *Edge Function* o un script), se rompe **sin que ningún test de este repositorio lo note**.

**Mitigación obligatoria antes de M0.**

1. **Prueba de caracterización de la isla**: antes de borrar, mover o promover la isla, escribir un test que importe **todo** lo que se va a eliminar y afirme que el módulo sigue resolviendo lo que la app espera. Si ese test pasa antes de la eliminación y falla después, la eliminación era incorrecta.
2. **Barrido por commits pequeños** (uno por subsistema), con la suite completa entre commit y commit.
3. **Verificación deScripts y hooks de git**: `grep -rn "<símbolo>" scripts/ supabase/ .github/ 2>/null` antes de cada borrado. `scripts/` contiene `runSeed.js` y `verifyMuscleMap.js`, que **consumen** `src/lib/muscleMap.ts` compilado con esbuild: es un consumidor que un análisis de `src/` no ve.
4. **No borrar `src/lib/ai/*` dentro de M0**: la IA es un sistema con consumidores externos probables. Se mueve a M2, donde se cablea o se retira con decisión explícita.

**Probabilidad:** media · **Impacto:** medio (alto si afecta a la IA o a `scripts/`) · **Mitigación:** prueba de caracterización + barrido granular.

### 3.2 Esquema de ejercicios de usuario

**El riesgo.** La brecha funcional más grande de la Fase 3: Cronos no soporta ejercicios creados por el usuario, y Hevy, Symmetry y FitNotes sí. El plan de M7 propone `user_exercises` + una vista `resolvable_exercises`. Cinco riesgos concretos:

| # | Riesgo | Detalle | Mitigación |
|---|---|---|---|
| **R1** | **La vista rompe las tres consultas `select("*")` actuales** | `useGymData.ts:115`, `ExerciseBrowser.tsx:106` y `useExerciseCatalog.ts:56` consultan `exercises` con `select("*")`. Una vista `resolvable_exercises` que cambia la forma de las filas (añade `source`, `owner_id`) **rompe esas tres** en cuanto alguien cambie una de ellas a `resolvable_exercises` | La vista se crea **con los mismos campos** que `exercises` más los adicionales; las tres consultas se migran **una a una**, cada una con su propio commit, y `select("*")` se sustituye por `select` explícito en la misma migración |
| **R2** | **RLS insuficiente** | Hoy `exercises` tiene **solo** `exercises_select_authenticated` (no hay política de escritura). Si `user_exercises` no tiene su propia política de `insert`/`update`/`delete` con `auth.uid() = user_id`, el usuario **no puede crear** su ejercicio; y si la política se escribe demasiado laxa, un usuario puede **editar el catálogo global** | `user_exercises` con RLS propio: `select`, `insert`, `update` y `delete` todos filtrados por `auth.uid() = user_id`. **`exercises` no recibe ninguna política de escritura nueva**: es inmutable por diseño |
| **R3** | **Duplicados en el momento de crear** | Los 6 nombres duplicados del catálogo son indistinguibles por `target`+`equipment`+`body_part`+`muscle_group`. El desambiguador que el importador promete **no desambigua ninguno** (`useExerciseCatalog.ts:69-73`): devuelve la fila arbitrariamente | Al crear, buscar por `name_normalized` en **el catálogo y entre los ejercicios del usuario**; si hay coincidencia, **ofrecer usar el existente** (patrón de Hevy: `duplicateResolver`). El motor de normalización debe ser **uno solo** (el ítem 22 del backlog) |
| **R4** | **El límite de 7 se implementa en cliente y se puede saltar** | Hevy limita a 7 ejercicios propios en plan gratuito. Si el límite se comprueba en la UI, la API lo ignora | La comprobación va **en el servidor** (una función o una política), no en el cliente. Si es un límite de producto, que la base lo imponga |
| **R5** | **La foto del ejercicio propio se cuelga de la infraestructura de medios** | Symmetry tiene un `CustomExercisePhotoStore`. En Cronos no hay bucket, ni subida, ni `media_key` todavía: esa infraestructura **se crea en M5** | M7 **no empieza antes que M5**. Si se adelanta, la foto del ejercicio propio no tiene dónde vivir, y se acaba guardando una URL cruda en una columna `text` |

**Probabilidad:** alta (R1 y R3 casi seguro si se implementa sin cuidado) · **Impacto:** medio-alto (R2 es una fuga de datos entre usuarios).

### 3.3 Sincronización Supabase ↔ IndexedDB

El motor de sincronización es la parte del sistema con **menos tests** y con la **ventana de pérdida** más amplia. Los riesgos, ordenados por gravedad:

| # | Riesgo | Evidencia | Impacto | Mitigación |
|---|---|---|---|---|
| **S1** | **La cola no es idempotente** | `offlineStore.ts:165-200`: la cola se indexa por `id` (un id generado), no por `logId`. `drainQueue` se llama desde `queueAndSync` (`sessionSync.ts:146`), desde `online` y desde `visibilitychange` (`useOfflineSync.ts:74-82`) y desde un intervalo de 60 s (`:88-90`) | Un doble drenaje concurrente **puede duplicar** `workout_logs` y `completed_sets` en el servidor | Test de doble drenaje concurrente **antes** de tocar el orden de la cola (§2.3). Hasta entonces, la cola no se reordena |
| **S2** | **Los errores del drenaje se tragan** | `sessionSync.ts:151-155`: `catch { return null; }` | La UI no se entera de que la sesión no se sincronizó; el usuario cree que está guardado | **M1, commit 7**: propagar el error a la UI. Es el primer cambio y el más barato de la lista |
| **S3** | **El tipo de serie se pierde en la frontera** | `ActiveWorkout.tsx:1830` mapea `is_warmup: toWarmupColumn(set.kind)`; `completed_sets` no tiene columna `set_type` | Un `drop` o un `failure` se registra como serie normal, **sin error** | **M4 / P2.1**: columna `set_type` + RPC de finalización. Hasta entonces, el dato se pierde de forma conocida y documentada |
| **S4** | **`numeric` declarado como `number` descarta filas** | `useAthletePRs.ts:192` descarta toda fila cuyo `weight` no sea `number`; `exerciseHistory.ts:95-99` usa `parseWeight`. Postgres devuelve `numeric` como **string** | El panel de récords **puede aparecer vacío sin ningún error** | La pregunta Q3 (ver §4) lo zanja con una consulta real. **Until entonces, `useAthletePRs` no se toca**: un arreglo a ciegas puede ser el correcto o puede enmascarar el problema real |
| **S5** | **La ventana «sesión sin series»** | `workout_logs` y `completed_sets` se escriben por separado; si el drenaje falla a mitad, queda una sesión sin series | El histórico muestra una sesión vacía | **RPC transaccional** `finish_session` (M4, commit 7), con `security invoker` para heredar las políticas RLS, probada con un usuario real |
| **S6** | **`localState` no está aislado por usuario** | `localState.ts` guarda **una fila** con `LOCAL_STATE_KEY` constante: rol, flags, contexto del atleta y consentimiento de IA | En un dispositivo compartido, el usuario B hereda el rol, los flags y **el consentimiento de IA** del usuario A | Separar por `userId` (el `keyPath` pasa a `[userId, key]` o el store se indexa por usuario). **Coste:** migración de IDB ⇒ pertenece a P1.2, no antes |
| **S7** | **El store `exerciseNotes` es esquema muerto** | `idb.ts:40,79` lo declara; `lib/exercise/exerciseNotes.ts` es un módulo de validación **en memoria**, no el store | Confusión: el nombre del módulo sugiere que usa el store | **M0, con subida de versión de IDB** (que ya hace falta para P1.2): se elimina el store y su versión, o se implementa de verdad. **No se puede eliminar sin tocar `idb.ts`**, que está congelado (§2.2) |
| **S8** | **La cola crece sin límite** | `useOfflineSync.ts:88` drena cada 60 s; offline prolongado encripta | Un usuario offline una semana acumula cientos de operaciones | Backoff exponencial (ítem 31 del backlog) + tope de cola. **M1 o posterior**: no es urgente y la cola no se toca hasta que S1 esté resuelto |
| **S9** | **El último segundo de trabajo se pierde** | Debounce de 400 ms sin `pagehide` | La última edición se pierde al cerrar | **P0.4**: flush en `pagehide` y `visibilitychange`. Es de la tanda P0 |

**Regla que resume la sección:** *la sincronización no se reordena, no se paraleliza y no se cambia de clave hasta que tenga un test de concurrencia*. Todo lo demás (errores visibles, backoff, tope de cola) es posterior.

### 3.4 Otras migraciones con riesgo

| Migración | Riesgo | Reversión |
|---|---|---|
| `set_type` + `group_id` (M4) | Se escribe sobre `completed_sets`, la tabla con más filas | Copia + migración de reversión; el cliente antiguo lee `is_warmup`, que se sigue escribiendo |
| Tipos generados (M4) | Sustituye `src/types/supabase.ts` **a mano** por tipos generados: los casts `as unknown as` que hoy tapan errores desaparecen y **el typecheck puede fallar en sitios que hoy compilan** | `git revert` del commit; el fichero generado se regenera |
| 7 tablas de taxonomía (M6) | Reescribe identificadores sobre `exercises` (1 324 filas) | Script inverso + copia. El paso de las 46 regex **es independiente y reversible** |
| `user_exercises` (M7) | Ver §3.2 | La tabla se puede quedar sin uso; lo sensible son los commits 2–3 |

---

## 4. Preguntas abiertas

Cada pregunta tiene: por qué importa, quién puede responderla, qué evidencia la zanja y **el supuesto por defecto** si nadie responde. El supuesto por defecto es la parte importante: permite avanzar sin bloquearse, y deja constancia de lo que se asumió.

### 4.1 Producto y arquitectura

| # | Pregunta | Por qué importa | Quién responde | Evidencia que la zanja | Supuesto por defecto |
|---|---|---|---|---|---|
| **Q1** | **¿Cuál es la pantalla de entrenamiento real: `ActiveWorkout` en línea o `SetTable`?** | Es la **puerta** de M3–M7 y decide si se preservan o se reescriben 6 157 líneas | Producto | Una decisión escrita en el PR de M2 | **Opción A** (`SetTable` entra en producción): el código está escrito, testeado y es funcionalmente superior |
| **Q2** | ¿Se admite **continuar una sesión en otro dispositivo**? | Define si P2.3 (snapshot en servidor) existe | Producto | Uso real reportado por usuarios | **No**: no hay evidencia de necesidad y añade una tabla con RLS nueva |
| **Q3** | ¿El límite de ejercicios propios (7 en Hevy) es un requisito de Cronos? | Condiciona R4 en §3.2 | Producto | La política de suscripción | **Sin límite** hasta que se defina; el coste de un límite es una política de servidor |
| **Q4** | ¿Los ejercicios propios **tienen foto** en la primera versión? | Condiciona R5: sin bucket de medios, la foto no tiene dónde vivir | Producto + M5 | El diseño de M5 | **Sin foto en M7**: la subida llega cuando exista el pipeline de medios (M5) |
| **Q5** | ¿Qué idiomas se soportan de verdad? | El catálogo trae 10; la app tiene 1 (español) | Producto | Uso por locale | **`es` + `en`**: los dos que el producto necesita para salir al mercado |

### 4.2 Datos y servidor

| # | Pregunta | Por qué importa | Quién responde | Evidencia que la zanja | Supuesto por defecto |
|---|---|---|---|---|---|
| **Q6** | **¿Qué devuelve Postgres para una columna `numeric` en el cliente de Supabase: string o number?** | `useAthletePRs.ts:192` **descarta** toda fila cuyo peso no sea `number`; el panel de récords puede aparecer vacío sin error | Backend | Una consulta real contra la base: `select weight from completed_sets limit 1` y `typeof` en el cliente | **`string`**: es el comportamiento por defecto de `pg` y de `supabase-js` para `numeric`. Por tanto `useAthletePRs` es el que está mal, y el arreglo es(parsear, no descartar) |
| **Q7** | ¿`bodyweight_entries`, `body_measurements` y `session_checkins` **existen en la base real**? | El repositorio las consulta (`useProfile.ts:155,161,167,192`) pero no tiene DDL. Si existen fuera del repo, el DDL falta; si no, el cliente está roto | Backend | `information_schema.tables` en la base | **Existen**: el `upsert` de `useProfile.ts:192` usa `onConflict: "user_id,measured_on"`, lo que solo funciona si hay una clave única que en el repositorio no existe |
| **Q8** | ¿`exercises` es **inmutable** para todos, o debe admitir ejercicios de la comunidad en el futuro? | Determina si la política de escritura es un no deliberado o un olvido | Backend + producto | La política actual (`exercises_select_authenticated` y solo lectura) | **Inmutable**: los ejercicios propios van a `user_exercises` (P10) |
| **Q9** | ¿Cuánto volumen real hay en `completed_sets`? | Decide si la RPC `finish_session` (JSONB) es viable y si hace falta particionar | Backend | `select count(*) from completed_sets` | **Suficiente para que la consulta con `order()` trague filas**: el riesgo del ítem 14 ya está documentado |
| **Q10** | ¿Existe un entorno de **staging** con datos representativos? | Todas las pruebas de estrés de §5 lo necesitan | Backend + infraestructura | La URL y las credenciales | **No**: sin staging, las pruebas de estrés se hacen contra datos sintéticos y las migraciones se prueban en local |

### 4.3 Proceso

| # | Pregunta | Por qué importa | Quién responde | Evidencia que la zanja | Supuesto por defecto |
|---|---|---|---|---|---|
| **Q11** | ¿El WIP sin confirmar de `chore/ordenar-wip` entra en `main` antes de las olas? | Todas las ramas de trabajo deben bornear de un árbol limpio | El equipo | Un PR o un commit de WIP | **Sí, antes de la primera ola**; si no, las ramas se birth de un estado que nadie ha revisado |
| **Q12** | ¿Quién es el **dueño** de cada módulo crítico sin test (§7 del informe 08)? | Sin dueño, ningún módulo crítico gana cobertura y la congelación es eterna | El equipo | Una tabla de responsables en el README del repositorio | **El autor de la última modificación de cada fichero**: `git log -1 --format=%an <fichero>` |

---

## 5. Pruebas de estrés pendientes

Ninguna de estas pruebas se ha ejecutado: **la auditoría fue estática**. Son las que deben pasar **antes del primer refactor en código de producción** (las marcadas como bloqueantes) o **antes de la ola que las indica**.

| # | Prueba | Objetivo | Cómo se hace | Resultado esperado | Bloquea |
|---|---|---|---|---|---|
| **E1** | **Descanso con la app en segundo plano** | Reproducir F1 (el contador deriva) y comprobar que el temporizador anclado no deriva | Playwright: arrancar el descanso, simular `document.hidden` con `page.evaluate` y esperar 2 min reales, o avanzar el reloj del sistema | Con el ancla, el resto real coincide con `endsAt` ± 1 s | **P0.1** |
| **E2** | **Cierre de pestaña con la última edición** | Reproducir F3 (pérdida de la última edición) | Playwright: escribir un peso y cerrar la página antes de 400 ms; reabrir y comprobar el borrador | El borrador contiene la última edición | **P0.4** |
| **E3** | **Crash del navegador con sesión en curso** | Reproducir F4 (el borrador existe pero no se ofrece) | Cerrar el proceso del navegador (no la pestaña) durante una sesión y reabrir | Aparece el aviso «sesión sin terminar» **sin** iniciar otra rutina | **P0.3** y **P1.1** |
| **E4** | **Recuperación completa de una sesión** | Reproducir F5 (logId no adoptado, borrador huérfano) | Recuperar, finalizar y consultar `loadRecoverableDraft` | Devuelve `null`; la fila del servidor conserva el `logId` original | **P0.3** |
| **E5** | **Doble drenaje concurrente** | Medir S1 (duplicación en la cola) | Con la app en línea, disparar el drenaje desde `online` y desde el intervalo a la vez, con 50 operaciones encoladas | Cero filas duplicadas en `workout_logs` | **M1-7** y cualquier cambio de orden en la cola |
| **E6** | **Sesión larga** | Medir el lazo de recálculo de rangos y la sobre-descarga | Sesión de 2 000 series; medir el tiempo hasta el primer pintado y el consumo de memoria | Sin crecimiento no lineal; la consulta de histórico devuelve todas las filas | **M4** (RPC) y **M5** (filtrado de consultas) |
| **E7** | **Carga en frío del bundle** | Medir el coste real de los 16,13 MB | `npm run build` + Lighthouse en un móvil de gama baja con red 3G simulada | Tiempo hasta el primer pintado interactivo y peso transferido, como línea base de M5 | **M5** |
| **E8** | **Importación de un CSV grande** | Reproducir el defecto 1 de §10 del informe 06 (la barra no avanza) | Importar un CSV de Hevy de 2 000 filas y 40 MB | La barra avanza de forma monótona y llega al 100 % | **M1-2** |
| **E9** | **Subida de versión de IndexedDB con datos** | Verificar que la migración v5→v6 no pierde borradores ni cola | Con un perfil real (borradores + cola + rangos), subir `DB_VERSION` y reabrir | Todos los stores sobreviven; los borradores se convierten a v2 sin perder series | **P1.2** |
| **E10** | **Dos pestañas con la misma sesión** | Medir la carrera sobre el mismo `logId` | Abrir la misma sesión en dos pestañas y editar en ambas | Una sola fila en el servidor; el `logId` no se duplica | **M4** (RPC transaccional) |
| **E11** | **Precisión de `numeric` en runtime** | Zanjar Q6 | `select weight from completed_sets limit 1` y comprobar `typeof` en el cliente | Un valor concreto, no una suposición | **M4** |
| **E12** | **Arranque sin red en frío** | Medir F7 (pantalla de error del navegador) | Desactivar la red, recargar | La app arranca con el shell y avisa; el catálogo viene de IndexedDB | **M5** (commit 6) |

**Cómo registrarlas.** Cada prueba deja un artefacto en el PR de la ola que desbloquea: el comando, la salida y la captura. Una prueba de estrés **sin artefacto no cuenta**: no se puede discutir un resultado que nadie puede volver a ver.

---

## 6. Matriz de riesgo residual por ola

| Ola | Riesgo residual | Probabilidad | Impacto | Señal temprana | Respuesta |
|---|---|---|---|---|---|
| **P0** | Bajo | Baja | Medio | Un test de `ActiveWorkout` falla al azar | Cada P0 tiene su rama y su reversión; sin datos de por medio |
| **M0** | Medio | Media | Medio | Un test de un subsistema borrado falla | Barrido granular, un commit por subsistema, prueba de caracterización de la isla |
| **M1** | Bajo | Baja | Medio | Un 404 en la consola o un test de importación | Cada commit verificado con L2 |
| **M2** | **Alto** | Media | **Alto** | El conteo de series se duplica o desaparece | Decisión de producto escrita; commits de entrada y limpieza separados; criterio de salida binario |
| **M3** | Medio | Media | Medio | Un test hay que tocarlo para moverlo | Las reglas de dependencia se activan **antes** de mover; una capa por commit |
| **M4** | **Alto** | Media | **Alto** | Una migración falla en staging | Copia verificada + script de migración idempotente + migración de reversión + E5, E10, E11 |
| **M5** | Medio | Media | Medio | El chunk no baja o la app no arranca sin red | El JSON sigue en el repo como semilla; el SW se desregistra al revertir |
| **M6** | **Alto** | Media | **Alto** | `verify:mapping` falla o los rangos cambian | Script con informe de discrepancias; cada una revisada; copia de `exercises` |
| **M7** | Medio | Media | Medio | Un usuario no ve su ejercicio propio | La vista mantiene la forma de `exercises`; RLS por `auth.uid()`; una migración de consulta cada vez |

---

## 7. Límites de este documento

- **No se ha ejecutado ninguna de las pruebas de §5.** Son un plan de verificación, no resultados. Los riesgos de §3 están **derivados de la lectura del código**, no de una reproducción.
- **Las preguntas de §4 no tienen respuestas fechadas.** Los supuestos por defecto son la parte útil del documento: permiten empezar M0 y M1 hoy, sin bloquearse por una decisión de producto que puede tardar.
- **La lista de congelación (§2) es una recomendación, no una política.** En un repositorio real, un bloqueo se aplica con CODEOWNERS o con una regla de CI, no con un documento. **Si se quiere que sea real, hay que convertirla en una regla automatizada** (por ejemplo: «ningún PR puede tocar `src/lib/overload.ts` sin un test nuevo en el mismo PR») y esa automatización **no existe todavía**.
- **La lista de módulos sin cobertura (§7 del informe 08) refleja el estado de las pruebas, no la calidad del código.** `src/lib/offlineStore.ts` puede estar bien implementado y aun así no tener test: la ausencia de test es un **riesgo de cambio**, no un veredicto sobre el código.
- **Ninguna estimación de este documento se ha contrastado con el equipo.** Son los valores por defecto de quien écrire la auditoría, no un acuerdo.

---

*Fase 5 — Entregables: `08-refactor-roadmap.md` · `09-risks-and-open-questions.md` (este documento) · `10-execution-log.md`*
