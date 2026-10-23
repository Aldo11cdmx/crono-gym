# Fase 5 — Plan de refactorización priorizado de Cronos Gym

**Alcance:** el plan de ejecución que convierte los hallazgos de las Fases 0–4 en cambios de código reales. Este documento **no modifica nada**: es la especificación de qué se va a cambiar, en qué orden, con qué criterio de aceptación, cómo se valida y cómo se revierte.

**Estado del baseline:** intacto. `src/` y `supabase/` no han sido modificados en las Fases 0–5. Este documento es el **plan**, no la ejecución.

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | ✅ 0 errores |
| Tests | `npm test` | ✅ 129/129 ficheros en verde |
| Build | `npm run build` | ✅ correcto; chunk principal 16,13 MB (gzip 2,58 MB) |

**Entradas:** `06-cronos-code-audit.md` (inventario de 40 acciones priorizadas, §11) · `07-target-architecture.md` (fases M0–M7, §12) · `04-active-workout-and-timer.md` (P0/P1/P2, §8) · `05-catalog-and-media.md` (catálogo, taxonomía y medios) · `03-data-model-comparison.md` (modelo de datos).

**Salidas:** este documento, `09-risks-and-open-questions.md` (qué no se toca y por qué) y `10-execution-log.md` (bitácora).

---

## 1. Resumen ejecutivo

1. **Hay dos listas de trabajo, no una.** Los **P0/P1/P2** del informe 04 son correcciones *de comportamiento* en la pantalla de entrenamiento: no tocan el esquema de datos y son reversibles en un commit cada una. Las **M0–M7** del informe 07 son *cambios de arquitectura*: mueven capas, cambian el modelo de datos y rehacen el catálogo. **Las listas se ejecutan en paralelo conceptual pero no en paralelo técnico**: los P0 van primero porque son baratos, no tocan el esquema y desbloquean la decisión M2.
2. **El primer trabajo real no es M0, es P0.2** (congelar `startedAt`). Cuesta una tarde, no toca el esquema, y arregla un bug silencioso que hoy impide que el borrador se escriba siquiera.
3. **M2 es la puerta.** Until se decida qué pantalla de entrenamiento es la real, la mitad del repositorio es ambigua: 6 157 líneas están en una isla que los tests validan y los usuarios no ven. M0–M1 y los P0 se pueden hacer sin esa decisión; **M3–M7 no deberían empezarse antes**.
4. **Dos olas no son reversibles por commit**: M4 (migración de datos) y M6 (taxonomía). Requieren copia, script de verificación y una migración de reversión, y por eso se colocan al final.
5. **Hay 12 módulos con lógica crítica y sin un solo test** (inventario en §7). Tocar cualquiera de ellos sin escribir primero su test es la forma más probable de introducir una regresión silenciosa.

---

## 2. Reglas de la casa

Estas reglas son la diferencia entre un plan que se ejecuta y un plan que se abandona a mitad. Se aplican a **todos** los ítems, de P0 a M7.

### 2.1 Precondición de arranque

El repositorio tiene cambios sin confirmar en `src/` sobre la rama `chore/ordenar-wip` (24 ficheros modificados, 9 sin seguimiento). **Ninguna rama de trabajo puede bornear de ese estado.** Antes de la primera ola:

1. `git status` debe quedar limpio, o los cambios deben estar en un commit de WIP explícito.
2. La rama base de todas las olas es `main` (o el commit de `chore/ordenar-wip` ya fusionado, si ese WIP entra antes).
3. `git tag baseline-fase5` sobre el commit base: es el punto de retorno de **todas** las olas.

### 2.2 Ramas

| Regla | Valor |
|---|---|
| Nombre | `m<N>-<slug>` para las olas M; `p<N>-<slug>` para los P0/P1/P2 |
| Origen | `main` (nunca desde otra rama de trabajo) |
| Destino | Pull request a `main` |
| Rama por ítem | **una rama por ítem**, nunca una rama por ola: el rollback de un commit concreto es un `git revert`, no una reversión de un PR de 3 000 líneas |

```
m0-higiene              p0-rest-timer              p1-session-draft
m1-defectos-visibles    p0-started-at              p1-foreground-resume
m2-decision-pantalla    p0-draft-restore           p2-set-type
m3-capas                p0-pagehide-flush          p2-supersets
m4-datos                p0-rest-alert
m5-catalogo-medios
m6-taxonomia
m7-usuario-i18n
```

### 2.3 Commits atómicos

**Un commit = un criterio de aceptación = un punto de reversión.** Un commit que cambia tres comportamientos no cumple ninguna de las dos reglas.

- Estilo: **Conventional Commits**, como el historial existente (`feat(scope): …`, `fix(scope): …`, `refactor(scope): …`, `chore(scope): …`, `test(scope): …`).
- Los mensajes describen **el efecto observable**, no el fichero tocado: `fix(workout): freeze startedAt so the draft debounce can fire` — no `refactor(ActiveWorkout.tsx)`.
- El cuerpo del commit cita el ítem del backlog: `Closes #12 (informe 06 §11)`.
- **Nunca** se mezclan refactor mecánico y cambio de comportamiento en el mismo commit: quitar un `export` y cambiar una firma, no.
- Un PR puede tener varios commits, pero **cada commit pasa typecheck y sus tests**.

### 2.4 Validación

| Nivel | Cuando | Comando | Objetivo |
|---|---|---|---|
| **L1 — commit** | Antes de cada commit | `npm run typecheck` + `npm test -- <ficheros de test afectados>` | 0 errores de tipos; los tests del área tocada en verde |
| **L2 — rama** | Antes de abrir el PR | `npm run typecheck && npm test && npm run build` | Suite completa verde; build correcto; **tamaño del chunk principal anotado en el PR** |
| **L3 — PR** | Antes de fusionar | Lo mismo que L2, más la lista de criterios de aceptación marcados | Todo verde y los criterios cumplidos |
| **L4 — tras la fusión** | En `main` | `npm run typecheck && npm test` | Verde en la rama base |

> **El criterio L2 no es negociable.** Una ola que rompe un test ajeno no se fusiona: se arregla o se divide. La suite tiene 129 ficheros y corre en ~5 min: es barata. El único flake documentado es `src/components/coach/portal/RequestQueue.test.tsx > lee los nombres de los atletas en una segunda consulta` (temporización, pasa aislado en 6,76 s). Si falla, **se reejecuta aislado** antes de culpar al cambio.

### 2.5 Reversión

| Tipo de cambio | Estrategia de reversión |
|---|---|
| Cambio de comportamiento en un componente | `git revert <sha>` — un commit, el árbol vuelve al estado anterior |
| Borrado de código muerto | `git revert <sha>` — el código vuelve; **no hay coste de datos** |
| Cambio de esquema SQL | **Una migración de reversión** (`..._rollback_<fecha>.sql`). **Nunca** editar una migración ya aplicada, **nunca** `git revert` de una migración aplicada sin su reversión |
| Cambio de esquema IndexedDB | Subir `DB_VERSION` y escribir el `onupgradeneeded` de forma **aditiva** (nunca borrar un store en la misma versión) |
| Cambio de datos ya escritos | Script de corrección idempotente + copia previa |
| Reorganización de directorios (M3) | `git revert` por capa; **nunca** un `git revert` masivo de un PR de 40 ficheros |

**Regla general:** una reversión no puede perder datos. Si el cambio ya synced un `logId` distinto, o ya borró un borrador, revertir el código **no** revierte el dato. Por eso los ítems que destruyen datos locales van **al final** de su ítem y su reversión se documenta de forma explícita en el PR (§3, P0.3).

### 2.6 Puertas entre olas

```
P0.2 → P0.1 → P0.5 → P0.3 → P0.4      (P0 completo, ~2 días)
   │
   ├──► M0 ──► M1 ──┬──► M2 ──► M3 ──► M4 ──► M5 ──► M6 ──► M7
   │                │             (datos)  (medios) (taxonomía)
   │                └──► (P0 cierra B1–B7 de la Fase 2)
   │
   └──► P1.1+P1.2 ──► P1.3 ──► P1.4   (paralelo a M2–M4, sin tocar esquema)
                                P2.1–P2.3 (dentro de M4, no antes)
```

- **M0 y M1 no dependen de ninguna decisión de producto.** Se ejecutan de inmediato.
- **M2 bloquea a M3, M4, M5, M6 y M7.** Es la única ola con criterio de salida binario: «una sola pantalla de series».
- **M4 y M6 no son reversibles por commit.** Se ejecutan al final, con copia y script de verificación.
- **Los P0 y P1 no tocan el esquema**: pueden solaparse con M0/M1, pero **no** con M4 (mismo `completed_sets`).

---

## 3. P0 — Correcciones de producción (sin migración de datos)

Cinco correcciones al flujo de entrenamiento activo. **Ninguna toca el esquema de datos**: todas son reversibles en un commit y se pueden aplicar en una semana. Son, además, la respuesta directa a las brechas B1–B7 del informe 04 y a los casos de falla F1–F12.

### 3.1 Mapa de los cinco ítems

| ID | Ítem | Brecha | Fallo que corrige | Esfuerzo | Riesgo | Rama |
|---|---|---|---|---|---|---|
| **P0.1** | Conectar el `RestTimer` anclado | B1 | F1, F10 | Bajo | Bajo | `p0-rest-timer` |
| **P0.2** | Congelar `startedAt` | B5 | F6, F11 | Bajo | Bajo | `p0-started-at` |
| **P0.3** | Corrección del borrador recuperado | B4 | F5 | Medio | Medio | `p0-draft-restore` |
| **P0.4** | Flush en `pagehide` | B6 | F3 | Bajo | Bajo | `p0-pagehide-flush` |
| **P0.5** | Alerta de fin de descanso | B7 | F10 | Bajo | Bajo | `p0-rest-alert` |

### 3.2 P0.1 · Conectar el `RestTimer` anclado

**Qué.** El componente correcto (`src/components/RestTimer.tsx`, 513 líneas, con `endsAt` y re-sincronización al primer plano) **no lo importa nadie**. El flujo activo usa un contador inline (`RestTimerOverlay`) que deriva con la pestaña en segundo plano. Se sustituye el overlay por el componente anclado y se elimina la primera implementación.

**Evidencia.**
- `src/components/ActiveWorkout.tsx:690-712` — el contador inline (`useState` + `setInterval` 1 s que decrementa).
- `src/components/ActiveWorkout.tsx:2213` — `<RestTimerOverlay …>` es lo que se renderiza.
- `src/components/ActiveWorkout.tsx:1495` — `rest` es `{ id, seconds }`: no hay ancla que sobreviva a un remonte.
- `src/components/RestTimer.tsx:91-163` — el componente correcto, con props `{ seconds, endsAt, onClose, onFinished }`.
- `src/lib/workout/restTimer.ts:46` — `remainingMs(endsAt, now)`: la aritmética correcta ya existe y está testeada.
- `src/components/ActiveWorkout.test.tsx:68` — `vi.mock("./RestTimer", …)` sobre un módulo que el componente nunca importa: el mock obsoleto que oculta el problema.

**Commits atómicos propuestos.**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `feat(rest): anchor the active workout rest timer to an absolute deadline` | `rest` pasa a `{ id, seconds, endsAt }`; `startRest(seconds)` calcula `endsAt = Date.now() + seconds * 1000` |
| 2 | `refactor(rest): mount the anchored RestTimer in the active workout` | se renderiza `<RestTimer seconds endsAt …>` en lugar del overlay |
| 3 | `chore(rest): delete the inline counter overlay` | se elimina `RestTimerOverlay` y su interfaz |
| 4 | `test(rest): drop the obsolete RestTimer mock and cover the anchored timer` | se retira el `vi.mock` y se añade la prueba de deriva |

**Criterios de aceptación.**
1. Con `vi.useFakeTimers()`, el descanso termina en el instante anclado, no un segundo después por tick.
2. Simular `document.hidden` durante el descanso y volver a primer plano repinta el **resto real** (el valor derivado de `endsAt`, no el acumulado).
3. `grep -r "RestTimerOverlay" src/` → **0 coincidencias**: queda una sola implementación.
4. `src/components/RestTimer.test.tsx` sigue en verde sin cambios (el componente no se ha modificado).
5. El tamaño del bundle principal **no crece** más de 2 kB gzip: `RestTimer` entra donde ya estaba el overlay.

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/ActiveWorkout.test.tsx src/components/RestTimer.test.tsx src/lib/workout/restTimer.test.ts
npm run typecheck && npm test && npm run build
```

**Reversión.** `git revert` de los commits 2–4 devuelve el overlay. El commit 1 (el tipo del estado `rest`) también se revierte: el campo `endsAt` es local al componente y no se persiste en esta fase (eso es P1.2). **No hay migración de datos ni pérdida de información.**

---

### 3.3 P0.2 · Congelar `startedAt`

**Qué.** `startedAt` se recalcula **en cada render** cuando no hay sesión, lo que cambia la identidad del callback `persist`, que rearma el debounce de guardado **en cada render**. Con escritura continua, el borrador puede no escribirse nunca.

**Evidencia.**
- `src/components/ActiveWorkout.tsx:1484` — `const startedAt = session?.startedAt ?? new Date().toISOString();` (expresión de render).
- `src/components/ActiveWorkout.tsx:1623-1638` — `persist` depende de `startedAt` → su identidad cambia cada render.
- `src/components/ActiveWorkout.tsx:1645-1652` — el efecto de guardado depende de `persist` → se limpia y rearma cada render → **el debounce de 400 ms nunca vence**.
- `src/components/ActiveWorkout.tsx:81` — `PERSIST_DEBOUNCE_MS = 400`.
- `src/components/ActiveWorkout.tsx:229-247` — la cabecera muestra `new Date(startedAt)`: una hora de inicio que cambia sola.

**Commits atómicos propuestos.**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `fix(workout): freeze startedAt in a stable per-session anchor` | `useRef` con inicialización perezosa: `session?.startedAt ?? recovered?.startedAt ?? new Date().toISOString()`, con prioridad al borrador recuperado |
| 2 | `test(workout): assert the draft is persisted under continuous re-renders` | prueba con temporizadores falsos: re-render cada 100 ms durante 2 s ⇒ `saveDraft` llamado **al menos una vez** |

**Criterios de aceptación.**
1. `startedAt` es idéntico entre renders sucesivos (prueba: dos renders seguidos ⇒ mismo valor).
2. Con re-renders continuos, el borrador se escribe al menos una vez en 2 s (hoy: nunca).
3. La cabecera muestra una hora de inicio constante.
4. Al recuperar un borrador, `startedAt` es el del borrador, no el del momento de la restauración.

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/ActiveWorkout.test.tsx
npm run typecheck && npm test
```

**Reversión.** `git revert` de 2 commits. Sin datos, sin esquema, sin efectos externos. **Es el ítem más barato de toda la lista y el que más rápido se nota: es el primero.**

---

### 3.4 P0.3 · Corrección del borrador recuperado

**Qué.** Al recuperar un borrador, la app **no adopta su `logId`**, **no lo borra** y **no reinstala la sesión en el contexto**. Consecuencia: tras finalizar la sesión recuperada, el borrador huérfano vuelve a ofrecerse como «sesión sin terminar» y el tiempo transcurrido reinicia en `00:00`.

**Evidencia.**
- `src/components/ActiveWorkout.tsx:1608-1615` — `restoreRecovered` copia `items` y `notes`, y nada más.
- `src/components/ActiveWorkout.tsx:1481` — `const [logId] = useState(() => newSessionId())`: inmutable, no puede adoptar el del borrador.
- `src/components/ActiveWorkout.tsx:1836-1846` — la persistencia y la sincronización usan ese `logId` nuevo.
- `src/lib/offlineStore.ts:138-157` — `loadRecoverableDraft` filtra `!finalized && items.length > 0`: al finalizar la sesión restaurada, el huérfano vuelve a ser candidato.
- `src/lib/offlineStore.ts:159-163` — `deleteDraft(logId)`: la función para eliminarlo ya existe.

**Commits atómicos propuestos.**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `fix(workout): make the session log id adoptable so a recovered draft keeps its identity` | `logId` pasa de `useState` inmutable a `useState<string \| null>` + override, con `logId = logIdOverride ?? draftLogId` |
| 2 | `fix(workout): delete the recovered draft once its identity has been adopted` | `void deleteDraft(recovered.logId)` **después** de adoptar, nunca antes |
| 3 | `test(workout): assert a recovered session keeps its log id and leaves no orphan draft` | prueba de ciclo completo: recuperar → finalizar → `loadRecoverableDraft` ⇒ `null` |

**Criterios de aceptación.**
1. Tras recuperar y finalizar, `loadRecoverableDraft(userId)` devuelve **`null`** (hoy devuelve el huérfano).
2. La fila sincronizada en el servidor conserva el `logId` **original** del borrador.
3. El `startedAt` restaurado es el del borrador (con P0.2 aplicado).
4. El aviso al usuario sigue mostrándose, y `discardRecovered` sigue borrando el borrador.

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/ActiveWorkout.test.tsx src/lib/offlineStore.test.ts
npm run typecheck && npm test && npm run build
```

**Reversión — con una salvedad que hay que escribir en el PR.**
`git revert` del commit 2 **no recupera el borrador borrado**: esa fila ya no existe en IndexedDB. Por eso:
- El commit 2 va **al final** del ítem, nunca antes que el 1.
- La prueba del commit 3 debe correr **antes** de revertir.
- Si hay que revertir en producción, el drafting huérfano ya está sincronizado en el servidor: el usuario no pierde series, pero puede aparecer una fila duplicada en `workout_logs` que se corrige con una eliminación manual por `log_id`.

---

### 3.5 P0.4 · Flush en `pagehide`

**Qué.** El guardado del borrador está debounced 400 ms y **no hay ningún `beforeunload` ni `pagehide` en todo `src/`**. La última edición antes de cerrar la pestaña se pierde si el temporizador no llega a vencer.

**Evidencia.**
- `src/components/ActiveWorkout.tsx:81` — `PERSIST_DEBOUNCE_MS = 400`.
- `src/components/ActiveWorkout.tsx:1645-1652` — el `setTimeout` del debounce, sin flush.
- `src/components/ActiveWorkout.tsx:1640-1643` — `itemsRef` / `notesRef` ya existen: son el mecanismo correcto para leer el estado actual sin depender del closure.
- Grep sobre `src/**/*.{ts,tsx}`: **cero coincidencias** de `pagehide` y `beforeunload`.

**Commits atómicos propuestos.**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `feat(workout): flush the pending draft when the page is hidden or closed` | listener `visibilitychange` (cuando `document.visibilityState === "hidden"`) + `pagehide`, llamando a `persist(itemsRef.current, notesRef.current)` |
| 2 | `test(workout): assert the last edit survives an immediate pagehide` | prueba que despacha `pagehide` tras editar y comprueba que `saveDraft` se llamó con el valor nuevo |

**Criterios de aceptación.**
1. Editar y cerrar inmediatamente ⇒ el borrador guardado contiene la edición.
2. Poner la pestaña en segundo plano ⇒ el borrador se guarda en ese momento, no 400 ms después.
3. El flush es **idempotente**: dos `pagehide` seguidos no crean dos borradores distintos (`keyPath: "logId"` lo garantiza, pero el test lo verifica).
4. El listener se **desmonta** al desmontar el componente (sin `removeEventListener` pendiente).

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/ActiveWorkout.test.tsx
npm run typecheck && npm test
```

**Reversión.** `git revert` de 2 commits. Sin datos ni esquema.

---

### 3.6 P0.5 · Alerta de fin de descanso

**Qué.** El fin del descanso es **silencioso** en producción: no hay beep, ni vibración, ni notificación. El usuario solo tiene la señal visual. La implementación correcta ya está escrita y testeada en la isla, pero es inalcanzable.

**Evidencia.**
- `src/lib/audio/audio.ts:46` `playBeep(frequency, durationMs)` · `:96` `RECORD_BEEP_PRIORITY_MS` · `:107` `markRecordBeep()` · `:117` `isRecordBeepActive()`.
- `src/lib/workout/restTimer.ts:29` `REST_BEEP_HZ = 880` · `:32` `REST_BEEP_MS = 150` · `:35` `REST_VIBRATE_MS = 200`.
- `src/components/RestTimer.tsx:120-134` — beep con fallback a `navigator.vibrate(200)`, silencioso bajo `prefers-reduced-motion` y si hay un beep de récord activo.
- `src/components/ActiveWorkout.tsx:690-712` — el overlay vivo no llama a nada de esto.

**Commits atómicos propuestos.**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `feat(rest): announce the end of the rest with a beep and a vibration` | al terminar el descanso: `playBeep(REST_BEEP_HZ, REST_BEEP_MS)` + `navigator.vibrate(REST_VIBRATE_MS)`, respetando `prefers-reduced-motion` y la prioridad del beep de récord |
| 2 | `feat(rest): notify when the rest ends while the tab is in the background` | `Notification` cuando `document.visibilityState === "hidden"`, con degradación silenciosa si no hay permiso |
| 3 | `test(rest): cover the end-of-rest alert and its precedence rules` | pruebas de beep, vibración, `prefers-reduced-motion`, prioridad del récord y degradación de `Notification` |

**Criterios de aceptación.**
1. Fin de descanso con la pestaña visible ⇒ beep + vibración.
2. Con `prefers-reduced-motion: reduce` ⇒ **sin** vibración (el beep se mantiene).
3. Con un beep de récord activo ⇒ el beep de descanso **no** lo interrumpe.
4. Con la pestaña oculta ⇒ `Notification` (si hay permiso); sin permiso ⇒ **ningún error** en consola.
5. El audio se inicializa tras el primer gesto del usuario (política de autoplay): el primer beep puede requerir un toque; **no** se lanza `AudioContext` en el render.

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/RestTimer.test.tsx src/lib/audio/audio.test.ts src/components/ActiveWorkout.test.tsx
npm run typecheck && npm test
```

**Reversión.** `git revert` de 3 commits. Sin datos ni esquema.

---

### 3.7 Orden y resultado de la tanda P0

| Orden | Ítem | Esfuerzo | Riesgo | Por qué en esa posición |
|---|---|---|---|---|
| 1 | P0.2 `startedAt` | Bajo | Bajo | El más barato; desbloquea el guardado fiable |
| 2 | P0.1 `RestTimer` | Bajo | Bajo | Depende de que el estado `rest` tenga un ancla estable |
| 3 | P0.5 Alerta | Bajo | Bajo | Depende de P0.1 (el fin del descanso es un evento único) |
| 4 | P0.3 Borrador | Medio | Medio | Depende de P0.2 (el `startedAt` del borrador) |
| 5 | P0.4 Flush | Bajo | Bajo | Depende de P0.2 (identidad estable de `persist`) |

**Resultado verificable de la tanda:** la pantalla de entrenamiento tiene **un** temporizador (anclado), **un** origen de verdad para `startedAt`, **cero** pérdida de la última edición al cerrar la pestaña, **una** alerta audible al terminar el descanso, y **cero** borradores huérfanos. Los casos de falla F1, F3, F5, F6, F10 y F11 quedan cerrados.

---

## 4. P1 — Persistencia y resistencia

Ninguno de estos ítems toca el esquema de Postgres; **P1.2 sí cambia el esquema de IndexedDB** (subida de versión) y por eso va con su propio protocolo.

| ID | Ítem | Evidencia | Rama | Depende de |
|---|---|---|---|---|
| **P1.1** | Rehidratación de la sesión al arrancar | `src/App.tsx:325` (`if (!session) return <HomeView />`), `src/context/ActiveSessionContext.tsx:77-129` | `p1-rehydration` | P0.3 |
| **P1.2** | Modelo `SessionDraft` v2 (`restEndsAt`, `selectedKey`, `restSecondsByExercise`, `version`) | `src/lib/offlineStore.ts:31-43`, `:118-126` (`normalizeDraft`) | `p1-session-draft` | P1.1 |
| **P1.3** | Reanudación del descanso al primer plano | `src/hooks/useOfflineSync.ts:80-82` (drena la cola, no el reloj) | `p1-foreground-resume` | P1.2 |
| **P1.4** | Shell offline (service worker) | `package.json` sin `workbox` / `vite-plugin-pwa` | `p1-service-worker` | M5 |

**P1.1 — Rehidratación.** El `ActiveSessionProvider` debe leer el borrador **antes** de renderizar la app, de modo que `TrainView` pueda montar `ActiveWorkout` con la sesión recuperada.
Commits: (1) `feat(session): rehydrate the active session from the recoverable draft on boot` · (2) `feat(session): surface the recovered session in the shell pill` · (3) `test(session): assert a recoverable draft is offered on boot`.
Criterios: con un borrador en IndexedDB y `session === null`, al arrancar la app aparece el aviso «sesión sin terminar» **sin** que el usuario inicie otra rutina; el reloj de sesión muestra el tiempo real transcurrido, no `00:00`.
Reversión: `git revert`; el borrador no se borra en este ítem.

**P1.2 — `SessionDraft` v2.** Añadir `restEndsAt: number | null`, `selectedKey: string | null`, `restSecondsByExercise: Record<string, number>` y `version: 2`; migrar `v1 → v2` en `normalizeDraft` (`src/lib/offlineStore.ts:118-126`).
Commits: (1) `feat(offline): extend the session draft with rest anchor and selected exercise` · (2) `feat(offline): migrate v1 drafts to v2 in normalizeDraft` · (3) `test(offline): assert a v1 draft is migrated without losing series`.
Criterios: un borrador v1 se abre y se convierte sin perder series ni notas; un borrador v2 con `restEndsAt` conserva el descanso; la **base IndexedDB sube de versión 5 a 6** de forma **aditiva** (no se borra ningún store en la misma subida).
Reversión: la subida de versión de IDB **no se puede deshacer en el cliente**: revertir el código deja la base en v6, y un cliente antiguo la abriría con `DB_VERSION = 5` (menor) y **no tocaría** los stores nuevos, pero perdería los campos v2. Por eso: **copia del store `drafts` antes de subir la versión** y nota de reversión en el PR.

**P1.3 — Reanudación al primer plano.** Con `restEndsAt` persistido: al volver a primer plano, si `restEndsAt` ya pasó ⇒ disparar la alerta de fin de descanso **una sola vez** y cerrar el descanso; si no ⇒ repintar el resto real.
Commits: (1) `feat(rest): resume the rest anchor when the app returns to the foreground` · (2) `test(rest): assert the foreground resume fires the alert exactly once`.
Criterios: volver a primer plano tras 10 min de un descanso de 90 s ⇒ el descanso se cierra y suena **una** alerta; volver antes de tiempo ⇒ el tiempo restante es el real.
Reversión: `git revert`; los borradores con `restEndsAt` siguen siendo legibles por la v2.

**P1.4 — Shell offline.** `vite-plugin-pwa` con precaché del shell y `runtimeCaching` del catálogo y los medios.
Commits: (1) `build(pwa): add the service worker shell with a versioned precache` · (2) `build(pwa): cache the catalog and media at runtime` · (3) `test(pwa): assert the shell is precached and the catalog is cached on first use`.
Criterios: recarga sin red ⇒ la app arranca (no pantalla de error del navegador) y muestra el catálogo desde IndexedDB; con red ⇒ nada cambia.
Reversión: `git revert` y **desregistrar el service worker** (si no, el navegador sirve el shell viejo). **No fusionar antes de M5**: si el service worker cachea el catálogo embebido en el bundle, se cachea un bundle de 16 MB.

---

## 5. P2 — Modelo y agrupación

Estos ítems **tocan el esquema de datos** y son los únicos de la lista que no son reversibles en un commit. Viven dentro de M4.

| ID | Ítem | Migración | Dificultad |
|---|---|---|---|
| **P2.1** | `set_type` completo (`normal\|warmup\|drop\|failure`) + `group_id`/`group_order` | `supabase/migrations/<fecha>_set_type_and_groups.sql` | Alta |
| **P2.2** | Agrupación en la sesión activa (bloques de superset en el carrusel) | — (solo cliente) | Media |
| **P2.3** | Snapshot de sesión en servidor (continuar en otro dispositivo) | `active_session_snapshots` | Media (opcional) |

**P2.1 — `set_type` completo.** Hoy `completed_sets` solo tiene `is_warmup boolean` y el mapeo es `is_warmup: toWarmupColumn(set.kind)` (`src/components/ActiveWorkout.tsx:1830`): los tipos `drop` y `failure` **se pierden sin error**.
Commits: (1) `feat(db): add set_type and group columns to completed_sets` (migración) · (2) `feat(workout): persist the full set kind instead of the warmup flag` · (3) `feat(import): map the imported set type onto the new column` · (4) `test(import): assert a drop set survives the import`.
Criterios: una serie `drop` importada de Hevy aparece con su tipo en el histórico; una sesión con más de 2 000 series es visible (el `order()` de la consulta no la oculta); el cliente antiguo sigue funcionando contra el esquema nuevo (columna nullable con valor por defecto).
Reversión: **migración de reversión** `..._rollback_<fecha>.sql` que vuelve a `is_warmup` y deja `set_type` nullable; los datos de `set_type` se pierden (aceptado: la información nunca estuvo ahí antes). **Requiere copia de `completed_sets` antes de aplicar.**

**P2.2 — Agrupación.** `DraftExercise` gana `groupId?: string | null`; el carrusel renderiza **bloques** (burbujas agrupadas, indicador «A → B», avance automático al terminar la primera del grupo); los dos ejercicios de un grupo comparten descanso.
Commits: (1) `feat(workout): model exercise groups in the session draft` · (2) `feat(carousel): render superset blocks in the exercise carousel` · (3) `test(carousel): assert a group advances automatically when its first exercise completes`.
Criterios: una rutina importada con `superset_id` (que hoy el importador detecta y descarta, `src/lib/import/sources.ts:90`) muestra el bloque agrupado; el descanso se comparte.
Reversión: `git revert`; el campo `groupId` es opcional y el cliente antiguo lo ignora.

**P2.3 — Snapshot de servidor (opcional).** Tabla `active_session_snapshots (id, user_id, payload jsonb, updated_at)` con RLS por `user_id` y política de «una sesión activa por usuario». **No es una prioridad**: el caso de uso (cambiar de dispositivo a mitad de una sesión) no está validado. Es un **P2 condicionado a una pregunta abierta** (Q6 en el informe 09).

---

## 6. Ondas M0–M7

Las ondas M0–M7 son el plan de arquitectura del informe 07. Esta sección les añade lo que le faltaba: rama, commits, criterios de aceptación, validación y reversión.

### 6.0 Resumen

| Ola | Objetivo | Ítems del backlog 06 §11 | Salida verificable | Días | Reversible | Bloquea a |
|---|---|---|---|---|---|---|
| **M0** | Higiene sin riesgo | 13, 16, 18, 19, 20, 21, 34 | −3 500 líneas; typecheck y suite verdes | 1 | Sí, commit a commit | M1 |
| **M1** | Defectos visibles | 3, 11, 12, 24, 25, 35, 37 | Cero 404 de medios; errores visibles | 2 | Sí | M2 |
| **M2** | Una sola pantalla de entrenamiento | 1, 17 | Una pantalla de series; los tests cubren lo que se ejecuta | 5 | Media | M3–M7 |
| **M3** | Capas y reglas de dependencia | (nuevo) | 7 reglas de dependencia en verde en CI | 8 | Sí, por capas | M4 |
| **M4** | Modelo de datos | 4, 5, 6, 28, 29, 32, 33 + RPC | Tipos y esquema de acuerdo; una sesión nunca queda sin series | 8 | **No** (migración) | M5 |
| **M5** | Catálogo y medios | 2, 36 + caché + service worker | Chunk principal < 300 kB gzip; arranque sin red | 8 | Sí | M6 |
| **M6** | Taxonomía | 7, 8 + 7 tablas + script de mapeo | Un identificador canónico por grupo muscular | 10 | **No** (migración) | M7 |
| **M7** | Ejercicios de usuario e i18n | 22, 23, 26, 27 | Un ejercicio propio aparece en el selector; el idioma cambia | 8 | Media | — |

**Total estimado: 50 días de trabajo efectivo.** Los P0 y P1 suman 3 días más y pueden empezar en paralelo.

### 6.1 M0 — Higiene

**Rama:** `m0-higiene` · **Origen:** `main` · **Reversión:** `git revert` por commit, sin coste de datos.

**Commits atómicos (uno por commit, en este orden).**

| # | Mensaje | Contenido | Ítem |
|---|---|---|---|
| 1 | `chore(ranks): delete the duplicated anatomical ranks page backup` | borrar `src/components/ranks/AnatomicalRanksPage.backup.tsx` (1 104 líneas) tras confirmar con `git diff --no-index` | 16 |
| 2 | `chore(equipment): remove the unused equipment helper module` | borrar `src/lib/equipmentHelpers.ts` | 19, 20 |
| 3 | `chore(picker): remove the unused picker token module` | borrar `src/lib/picker/pickerTokens.ts` | 19 |
| 4 | `chore(ranks): remove the unused neon ranks module` | borrar `src/lib/ranks/neonRanks.ts` | 19 |
| 5 | `chore(ai): remove the unused user context module` | borrar `src/lib/ai/userContext.ts` | 19 |
| 6 | `fix(dashboard): sort sessions by set number instead of a no-op comparator` | `src/hooks/useDashboardSessions.ts:190` | 34, 14 |
| 7 | `fix(import): report an invalid RPE with the RPE issue code` | `src/lib/import/analyze.ts:314` | 13 |
| 8 | `refactor(routines): merge the duplicated delete and restore helpers` | `RoutinesPage.tsx:196-244` + `RoutineLibrary.tsx:1016-1064` | 21 |
| 9 | `chore(types): drop the export keyword from 265 internal-only symbols` | barrido mecánico, **un commit por directorio** | 18 |
| 10 | `chore(dead): remove the 55 exports with zero references` | barrido mecánico, **un commit por subsistema** | 19, 20 |

**Criterios de aceptación.**
1. `npm run typecheck` sin errores **después de cada commit** (el commit 9 es el que más puede romper: los símbolos solo-test también son "internos").
2. `npm test` en verde (129/129) tras cada commit.
3. `git diff --stat main...HEAD` muestra una reducción neta de líneas, sin ningún fichero nuevo salvo tests.
4. El grafo de alcanzabilidad se recalcula: el número de ficheros de producción inalcanzables **no aumenta** (comprobable con el script del informe 06 §14.2).
5. `npm run build` correcto y con un chunk principal **no mayor** que el anterior.

**Validación.**

```powershell
npm run typecheck
npm test
npm run typecheck && npm test && npm run build
node "$env:TEMP\kilo\f4-island.js" "C:\Users\yayog\crono-gym"   # opcional: gate de alcanzabilidad
```

**Reversión.** Cada commit es independiente: `git revert <sha>` devuelve el estado. Los commits 9 y 10 son mecánicos y su reversión también lo es. **Ninguno toca datos.**

> **Precaución con el commit 9.** "Solo interno" significa que nadie fuera del fichero lo importa — **pero un test sí puede importarlo**. Los 49 símbolos "solo-test" son un subconjunto: si un test los importa, dejar de exportar rompe el test, y `noUnusedLocals` no lo avisa. **Por eso el barrido va en commits pequeños, uno por directorio, con la suite completa entre commit y commit.**

### 6.2 M1 — Defectos visibles

**Rama:** `m1-defectos-visibles` · **Reversión:** `git revert` por commit.

| # | Mensaje | Contenido | Ítem |
|---|---|---|---|
| 1 | `fix(media): resolve the equipment and exercise image paths at every render site` | `ActiveWorkout.tsx:932,1396`, `EquipmentModal.tsx:82`, `ExerciseSelectorModal.tsx:347` | 24 |
| 2 | `fix(import): advance the progress bar by rows instead of dividing rows by bytes` | `workers/importCsv.worker.ts:89` + `hooks/useCsvImport.ts:182` | 11 |
| 3 | `feat(import): wire the existing import ids into the wizard duplicate detection` | `commit.ts:315` → `useCsvImport` → `ImportWizard.tsx:108,129,139,151` | 12 |
| 4 | `fix(routines): use a single favorite toggle for routines and libraries` | `useGymData.ts:178-219` + `RoutineLibrary.tsx:220-225` | 35 |
| 5 | `fix(coach): handle the catalog read error and limit the query in the athlete CRM` | `coach/portal/AthleteCRM.tsx:112` | 37 |
| 6 | `fix(progress): replace the progress stubs with real components or remove them` | `components/progress/*.tsx` + `AnatomicalRanksPage.tsx:307-309` | 25 |
| 7 | `fix(sync): surface a failed queue drain instead of swallowing it` | `src/lib/sessionSync.ts:151-155` | 3 |

**Criterios de aceptación.**
1. **Cero 404 de medios**: se recorre la app con la consola abierta y no aparece ninguna petición fallida de `public/images/…` ni de `videos/…`.
2. La barra de progreso del importador **avanza** con un CSV de 2 000 filas y 40 MB, y llega al 100 %.
3. Importar dos veces el mismo archivo ofrece el duplicado como tal.
4. El favorito de una rutina queda igual marcado en la lista, en la biblioteca y en el detalle (un solo camino de escritura).
5. El error de catálogo del portal **se ve** en la UI en lugar de dejar la tabla vacía.
6. La pantalla de rangos **no** muestra el literal `ConsistencyTracker (userId=none)`.
7. Un drenaje fallido produce un estado de error visible en la UI, no un `null` silencioso.

**Validación.**

```powershell
npm run typecheck
npm test -- src/hooks/useCsvImport.test.ts src/lib/import src/components/import
npm run typecheck && npm test && npm run build
```

**Reversión.** `git revert` por commit. El commit 3 (duplicados) activa una detección que antes no existía: al revertirlo, la detección vuelve a estar inactiva, pero **no se borra ningún dato** (solo cambia lo que se muestra). El commit 7 cambia un `catch` por propagación: al revertirlo, el drenaje vuelve a tragarse errores — peor, pero no destructivo.

### 6.3 M2 — Decisión de pantalla (la puerta)

**Rama:** `m2-decision-pantalla` · **Reversión:** media (toca la pantalla principal).

**Es una decisión de producto antes que de código.** Dos opciones, ambas defendibles:

| Opción | Qué implica | Coste | Consecuencia |
|---|---|---|---|
| **A — `SetTable` entra en producción** | Se adopta la implementación con tabla, `SetTypeSheet`, `WeightStepper`, `FatigueBadge`, `recordBreak` | Reintegrar ~5 400 líneas ya escritas y testeadas; **el audio y la fatiga vuelven a la app** | La app gana funcionalidad de inmediato |
| **B — `ActiveWorkout` en línea manda** | Se elimina la isla y sus 25 ficheros de test | Reescribir la tabla de series; se pierde el trabajo ya hecho | Menos código, más trabajo nuevo |

**La auditoría recomienda la opción A**: el código de la isla está **escrito, testeado y es funcionalmente superior** (temporizador anclado, beep, fatiga, récords por serie). El coste de B es escribir de nuevo lo que ya existe y funciona.

**Criterio de salida (binario):** existe **una sola** implementación de la pantalla de series, alcanzable desde `src/main.tsx`, y **la suite de tests la cubre**.

**Commits atómicos (opción A).**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `refactor(workout): mount the set table as the active workout series editor` | `SetTable` entra en el árbol de producción |
| 2 | `feat(workout): wire the record, fatigue and audio badges into the set table` | `recordBreak`, `fatigue`, `audio` dejan de ser huérfanos |
| 3 | `test(workout): cover the set table from the active workout entry point` | los tests pasan de "importar el componente" a "llegar a él por la app" |
| 4 | `refactor(workout): delete the inline series rendering from ActiveWorkout` | se elimina la segunda implementación |
| 5 | `chore(tests): remove the island-only test files` | solo en la opción A, tras migrar la cobertura |
| 6 | `chore(dead): remove the modules that only the island used` | los 26 ficheros de la isla que no entran |

**Criterios de aceptación.**
1. `grep` sobre `src/` → **0** imports de la isla desde rutas que no sean `*.test.*`, o la isla **entra** en producción (opción A) con 0 módulos muertos.
2. La suite de tests cubre la pantalla **que se ejecuta**: se verifica que un fallo en la pantalla real hace fallar un test (prueba de humo: se rompe una línea a propósito, el test falla, se revierte).
3. `npm test` en verde; el número de ficheros de test baja de 129 a ~104 (opción A) o sube (opción B).
4. El chunk principal **no crece** más de un 5 % (la isla entra en el bundle: hay que medirlo, y por eso el ítem 2 del informe 07 pone el presupuesto de bundle).
5. Audio, fatiga y récords por serie **vuelven a la app** (opción A) y se oyen/ven en la pantalla real.

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/workout src/components/ActiveWorkout.test.tsx
npm run typecheck && npm test && npm run build
Get-ChildItem dist/assets | Sort-Object Length -Descending | Select-Object Name, Length
```

**Reversión.** Media. Cada commit se revierte por separado, pero la migración de los tests deja el conjunto en un estado intermedio en el que **los tests cubren la pantalla antigua y la app ejecuta la nueva**: ese estado intermedio **no debe fusionarse nunca**. La estrategia es: en el PR, los commits 1–3 (producción + cobertura) y 4–6 (limpieza) están en **commits separados y claramente etiquetados**, para que un revert sea «revertir 4, 5 y 6» y deje el sistema como estaba.

### 6.4 M3 — Capas y reglas de dependencia

**Rama:** `m3-capas` · **Reversión:** sí, por capa.

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `test(arch): assert the seven dependency rules between layers` | las reglas se activan **antes** de mover el primer fichero |
| 2 | `refactor(domain): extract the pure domain model into src/domain` | ejercicios, entrenamiento, taxonomía, perfil |
| 3 | `refactor(data): move persistence into src/data` | Supabase, caché, repositorios |
| 4 | `refactor(platform): move browser capabilities into src/platform` | IndexedDB, medios, i18n, telemetría |
| 5 | `refactor(features): group screens and their hooks into src/features` | |
| 6 | `refactor(app): reduce the shell to routing and providers` | |

**Criterios de aceptación.**
1. `src/domain/**` no importa React, Supabase ni IndexedDB (regla en CI).
2. `src/features/**` no importa `src/app/**`.
3. `src/platform/**` no importa `src/features/**`.
4. La suite sigue verde **después de cada commit**, sin cambiar un solo test (mover código no es cambiar comportamiento: si hay que tocar un test, es que el test afirmaba algo sobre la estructura, no sobre el comportamiento).
5. El grafo de alcanzabilidad no cambia: los mismos 48 ficheros inalcanzables, ni uno más.

**Validación.** `npm run typecheck && npm test` tras cada commit. La comprobación de las reglas es el propio test del commit 1.

**Reversión.** `git revert` de la capa entera (6 commits). El riesgo real de M3 no es la reversión: es el **churn**. Mitigación: mover por capas, con los tests moviéndose con su código, y **sin mezclar una movimentação con un cambio de comportamiento**.

### 6.5 M4 — Modelo de datos (no reversible por commit)

**Rama:** `m4-datos` · **Requiere copia de `completed_sets`, `workout_logs`, `exercises` y `routines` antes de empezar.**

| # | Mensaje | Contenido | Reversión |
|---|---|---|---|
| 1 | `chore(db): snapshot the tables touched by the data migrations` | copia fechada y **verificada** (conteo de filas antes y después) | — |
| 2 | `feat(db): add set_type and group columns to completed_sets` | P2.1 | migración de reversión |
| 3 | `feat(workout): persist the full set kind` | cliente | `git revert` |
| 4 | `feat(types): generate the database types from the schema` | sustituye `src/types/supabase.ts` a mano | `git revert` |
| 5 | `fix(types): align the nullability of the seven divergent columns` | ítem 29 | `git revert` |
| 6 | `feat(db): add the missing bodyweight, measurement and checkin tables` | ítem 6 | migración de reversión |
| 7 | `feat(db): add the transactional finish_session RPC` | cierra la ventana «sesión sin series» | migración de reversión |
| 8 | `chore(db): mark schema.sql as obsolete and point to the migrations` | ítem 28 | `git revert` |

**Criterios de aceptación.**
1. Una sesión con más de 2 000 series es **visible** en el histórico (hoy la consulta la puede ocultar).
2. Una sesión **nunca** queda sin series: la RPC escribe sesión y series en la misma transacción.
3. Los tipos generados compilan **sin casts manuales**: `grep "as unknown as" src/` → 0 en las rutas de datos.
4. `bodyweight_entries`, `body_measurements` y `session_checkins` tienen DDL en el repositorio **o** dejan de consultarse.
5. La RPC se prueba con un usuario real antes de desplegar: bajo RLS y con concurrencia.

**Validación.**

```powershell
npm run typecheck
npm test -- src/lib/exercise/exerciseSchema.test.ts src/types
npm run typecheck && npm test && npm run build
npm run verify:mapping     # el mapeo muscular sigue cuadrando
```

**Reversión.** El commit 2, el 6 y el 7 **exigen** una migración de reversión en el mismo PR. El commit 1 (la copia) es el punto de retorno real: si algo sale mal, se restaura la tabla desde la copia y se anula la migración. **Este es el punto de no retorno de todo el plan**: a partir de M4, la reversión es una restauración de datos, no un `git revert`.

### 6.6 M5 — Catálogo y medios

**Rama:** `m5-catalogo-medios` · **Reversión:** sí (el JSON sigue en el repositorio como semilla).

| # | Mensaje | Contenido | Ítem |
|---|---|---|---|
| 1 | `refactor(catalog): move the exercise catalog out of the main bundle` | `ExerciseSelectorModal.tsx:17` | 2 |
| 2 | `feat(media): introduce a media key and a single media resolver` | sustituye a `resolveImageSrc` y sus 10 variantes | 24 |
| 3 | `feat(offline): persist the compressed catalog in IndexedDB` | | — |
| 4 | `feat(offline): add an LRU media cache with a quota` | | — |
| 5 | `feat(queries): stop downloading the whole exercise table in three places` | `useGymData.ts:115`, `ExerciseBrowser.tsx:106`, `useExerciseCatalog.ts:56` | 36 |
| 6 | `build(pwa): add the service worker shell` | P1.4 | — |

**Criterios de aceptación.**
1. **Chunk principal < 300 kB gzip** (hoy 2,58 MB gzip con 16,13 MB sin comprimir).
2. El catálogo se sirve **una vez**, comprimido, y se guarda en IndexedDB: una segunda carga es local.
3. **0 consultas** de la tabla `exercises` en las tres rutas marcadas; las lecturas de `routine_exercises` filtran por `routine_id`.
4. La app **arranca sin red** y muestra el catálogo.
5. La cuota de medios se respeta: al superarla se **evictan primero** las animaciones.
6. Un cambio de URL de un medio no invalida la caché: la clave es el `media_key`, no la URL.

**Validación.**

```powershell
npm run typecheck
npm test -- src/components/ExerciseSelectorModal.test.tsx src/hooks/useExerciseCatalog.test.ts
npm run typecheck && npm test && npm run build
Get-ChildItem dist/assets | Sort-Object Length -Descending | Select-Object Name, Length
```

**Reversión.** `git revert`; el JSON sigue en el repositorio, así que el store cae de vuelta al asset local. **El service worker sí necesita desregistrarse** al revertir el commit 6: un SW cacheado sirve el shell viejo aunque el código nuevo esté desplegado.

### 6.7 M6 — Taxonomía (no reversible por commit)

**Rama:** `m6-taxonomia` · **Requiere copia de `exercises`.**

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `feat(db): add the canonical muscle, movement, training and equipment tables` | 7 tablas + vistas |
| 2 | `chore(taxonomy): snapshot the current catalog mapping before the migration` | copia verificada |
| 3 | `feat(taxonomy): write the mapping script from the current catalog` | script idempotente, con informe de discrepancias |
| 4 | `fix(equipment): replace the wildcard equipment rule with explicit fallbacks` | ítems 7 y 8: las 46 regex, `/.*/` fuera, tokens acotados |
| 5 | `feat(taxonomy): resolve the muscle group through the canonical identifier` | una sola fuente de verdad |
| 6 | `chore(taxonomy): remove the duplicated vocabularies` | `target` / `muscle_group` / `secondary_muscles` → una tabla |

**Criterios de aceptación.**
1. **Un** identificador canónico por grupo muscular en todo el sistema (P7).
2. La sugerencia de equipamiento acierta: se ejecutan las reglas sobre los 1 324 registros y **0** caen en el comodín, y las reglas broad (`.lat`, `.leg`, `.extension`, `.kickback`) dejan de producir falsos positivos verificables («band front lateral raise» ya no recibe el jalón pecho).
3. `npm run verify:mapping` sigue en verde tras la migración.
4. El informe del script de mapeo enumera **toda** discrepancia con el catálogo actual; cada una está revisada, no aceptada en bloque.
5. Los rangos anatómicos no cambian de valor para el mismo volumen de trabajo (comparación antes/después sobre el catálogo completo).

**Validación.**

```powershell
npm run typecheck
npm run verify:mapping
npm test -- src/lib/muscleFilter.test.ts src/lib/ranks
npm run typecheck && npm test && npm run build
```

**Reversión.** Copia + script inverso. Las 7 tablas nuevas se pueden dejar sin uso (no rompen nada); lo que **no** se puede deshacer easily es la reescritura de los identificadores en `exercises`: por eso el mapeo es un **script con informe**, y el paso 4 (las regex) es independiente y reversible por `git revert`.

### 6.8 M7 — Ejercicios de usuario e i18n

**Rama:** `m7-usuario-i18n` · **Reversión:** media.

| # | Mensaje | Contenido |
|---|---|---|
| 1 | `feat(db): add the user exercises table and the resolvable view` | P10 |
| 2 | `feat(ui): create a custom exercise with duplicate detection` | por `name_normalized`, contra el catálogo y entre los del usuario |
| 3 | `feat(catalog): resolve an exercise through a single resolver` | sustituye a los 4 resolvers actuales |
| 4 | `feat(i18n): introduce real locales with on-demand loading` | `es` por defecto + 5 más |
| 5 | `refactor(i18n): extract a single set of formatters` | ítems 23 y 26: un `Intl.DateTimeFormat` y un `Intl.NumberFormat` |
| 6 | `chore(i18n): remove the 43 dead keys and the literal strings` | ítem 27 |

**Criterios de aceptación.**
1. Un ejercicio creado por el usuario **aparece en el selector** y en el hub, y se puede borrar.
2. Al crear un ejercicio con el nombre de uno existente, la app **ofrece usar el existente** en vez de duplicar en silencio.
3. Cambiar de idioma **cambia la interfaz** y las instrucciones del catálogo, sin recargar.
4. Un test recorre **todas** las claves de **todos** los locales y falla si falta alguna o sobra.
5. `grep -c "toFixed(1)" src/` baja a 0 (un solo formateador).

**Validación.**

```powershell
npm run typecheck
npm test -- src/lib/i18n.test.ts src/components/ExerciseSelectorModal.test.tsx
npm run typecheck && npm test && npm run build
```

**Reversión.** `git revert` para 3–6. El commit 1 (la tabla) puede quedarse sin uso sin romper nada; los commits 2–3 sí son los delicados: revertirlos con ejercicios de usuario ya creados deja filas huérfanas en `user_exercises` (inofensivas) pero **reintroduce los 4 resolvers**, que es el estado actual.

---

## 7. Módulos críticos sin cobertura

Antes de la primera ola conviene saber qué módulos, si se tocan, **no tienen red de seguridad**. Este inventario es el que obliga a escribir el test *antes* del cambio.

| Módulo | Líneas | Test | Por qué es crítico |
|---|---|---|---|
| `src/lib/overload.ts` | 575 | **ninguno** | Motor de progresión por RPE: el diferencial de Cronos frente a las cuatro referencias. Un cambio aquí degrada la progresión de todos los usuarios sin que nada falle. |
| `src/lib/sessionSync.ts` | 156 | **ninguno** | Drenaje de la cola: el camino que sincroniza las sesiones offline con el servidor. |
| `src/lib/offlineStore.ts` | 223 | **ninguno** | Persistencia de borradores y cola. `idb.test.ts` cubre la capa IDB, no esta. |
| `src/hooks/useOfflineSync.ts` | 114 | **ninguno** | Temporizador de drenaje, detección de red, estado de sync. |
| `src/data/equipmentCatalog.ts` | 346 | **ninguno** | 46 reglas de asignación de equipamiento. |
| `src/hooks/useExerciseCatalog.ts` | 79 | **ninguno** | Resolución de ejercicios por nombre. |
| `src/lib/routines/routineSave.ts` | 185 | **ninguno** | Escritura de rutinas (sí hay tests de `routineShare` y `routinesViewModel`). |
| `src/lib/ai/coachAssistant.ts` | 740 | sí | La IA; su cobertura es parcial. |
| `src/lib/workout/fatigue.ts` | 161 | sí (`fatigue.test.ts`) | Al entrar en producción en M2, su test pasa a ser una prueba de regresión real. |
| `src/lib/workout/recordBreak.ts` | 75 | sí | Ídem. |

**Regla operativa:** *ningún módulo de esta tabla se modifica sin un test nuevo o sin el test de otro módulo que lo cubra indirectamente*. Los cinco primeros son los que más riesgo acumulan.

---

## 8. Trazabilidad con las fases anteriores

| Hallazgo | Fase de origen | Ítem / Ola |
|---|---|---|
| Temporizador con deadline escrito y no conectado | Fase 2 B1 | **P0.1** |
| `startedAt` recalculado en cada render | Fase 2 B5 | **P0.2** |
| El `logId` no se adopta y el borrador queda huérfano | Fase 2 B4 | **P0.3** |
| Sin flush al cerrar la pestaña | Fase 2 B6 | **P0.4** |
| El fin del descanso es silencioso | Fase 2 B7 | **P0.5** |
| La recuperación es inalcanzable tras una recarga | Fase 2 B3 | P1.1 |
| El descanso en curso no se persiste | Fase 2 B2 | P1.2, P1.3 |
| Sin shell offline | Fase 2 B9 | P1.4 |
| `set_type` no llega al servidor | Fase 1 §7.1, Fase 2 B11 | P2.1 (dentro de M4) |
| Sin supersets | Fase 2 B8 | P2.2 |
| Dos pantallas de entrenamiento | Fase 4 §4.2 | **M2** |
| 55 exports muertos + 265 superfluos | Fase 4 §4.4 | M0 |
| 46 reglas con comodín y falsos positivos | Fase 4 §9.2 | M6 (commits 4–6) |
| Catálogo de 16,13 MB en el chunk principal | Fase 4 §7.1, Fase 3 | M5 (commits 1, 5) |
| 3 tablas tipadas sin DDL | Fase 4 §5.3 | M4 (commit 6) |
| `numeric` declarado como `number` | Fase 4 §5.2 | M4 (commits 4–5) |
| 6 escritores de rutinas, restaurar pierde campos | Fase 4 §8.1, §8.3 | M0 (commit 8) + M4 |
| Triple representación de `instructions` | Fase 4 §5.1 | M4 (commit 4) |
| 3 stubs de progreso en producción | Fase 4 §9.4 | M1 (commit 6) |
| Drenaje que traga errores | Fase 4 §6.3 | M1 (commit 7) |
| 6 nombres duplicados irresolubles | Fase 3 §3.4 | M7 (commits 2–3) |
| Sin ejercicios de usuario | Fase 3 §1.6 | M7 (commits 1–3) |
| Medios rotos en 4 sitios | Fase 3 §3.5 | M1 (commit 1) + M5 (commit 2) |
| i18n sin sistema de locales | Fase 4 §9.1 | M7 (commits 4–6) |

---

## 9. Gates entre olas

| Gate | Se abre cuando | Se comprueba con |
|---|---|---|
| **G0 → P0** | Árbol de trabajo limpio, `baseline-fase5` etiquetado | `git status` limpio; `git tag` existe |
| **G1 → M0** | La suite está verde en `main` | `npm test` en `main` |
| **G2 → M1** | M0 fusionada y verde | `npm test` + `git diff --stat` muestra reducción de líneas |
| **G3 → M2** | M1 fusionada; **el producto ha decidido** qué pantalla es la real | Decisión escrita en el PR de M2 |
| **G4 → M3** | M2 fusionada: una sola pantalla, tests sobre ella | Criterio de salida de M2 |
| **G5 → M4** | M3 fusionada; copia de datos verificada | Script de copia + conteo de filas |
| **G6 → M5** | M4 fusionada; RPC probada con usuario real | Prueba de la RPC bajo RLS |
| **G7 → M6** | M5 fusionada; chunk principal < 300 kB gzip | Medición del build |
| **G8 → M7** | M6 fusionada; `verify:mapping` en verde | `npm run verify:mapping` |

**Ningún gate se abre «porque vamos con retraso».** El orden existe porque cada gate evita que el siguiente trabajo se haga sobre una base que luego hay que rehacer.

---

## 10. Límites de este plan

- **Es un plan, no una ejecución.** Ninguna de las ramas, los commits ni las migraciones descritas existe. `src/` y `supabase/` siguen intactos.
- **Las estimaciones en días son órdenes de magnitud** de un desarrollador con conocimiento del repositorio, no un compromiso de calendario. M2, M4 y M6 son las que más dependen del criterio de cada uno.
- **El resultado de M2 (opción A o B) es una decisión de producto**, no técnica. Este plan recomienda la opción A y explica por qué, pero la decisión es del equipo.
- **Los presupuestos de bundle y de rendimiento son objetivos verificables**, no mediciones: el número exacto del chunk principal tras M5 depende de cuánto código quede tras M3.
- **La lista de módulos sin cobertura (§7) refleja el estado del repositorio en esta fecha**; un test nuevo puede cambiar la tabla, y eso es una mejora, no una errata.
- **Este plan no cubre** el orden interno de los commits mecánicos de M0 (commits 9 y 10): se proponen por subsistema, pero el orden exacto depende del grafo de dependencias real entre símbolos.

---

*Fase 5 — Entregables: `08-refactor-roadmap.md` (este documento) · `09-risks-and-open-questions.md` · `10-execution-log.md`*
