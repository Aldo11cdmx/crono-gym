# Fase 2 — Active Workout, temporizador de descanso y recuperación de estado: Hevy · Symmetry · Cronos

**Alcance:** cómo las dos apps de referencia mantienen viva la rutina activa en tiempo real (persistencia, temporizador de descanso, avisos en segundo plano, supersets y agrupación de ejercicios) y cómo el flujo activo de `C:\Users\yayog\crono-gym` se comporta ante recarga de página, cierre de pestaña, pérdida de memoria y retorno al primer plano.

**Estado del baseline:** intacto. No se modificó ningún archivo de producción de `src/` durante esta fase; este documento es el único entregable.

**Methodología.**

| Fuente | Runtime | Dónde vive la evidencia | Método de extracción |
|---|---|---|---|
| Hevy 3.1.16 | React Native + Hermes | Tabla de cadenas de `assets/index.android.bundle` (22 217 100 B) | Búsqueda dirigida de cadenas con contexto en el binario Hermes (`C:\Users\yayog\Downloads\decompiled\hevy`) |
| Symmetry 7.16.0 | Flutter + Dart AOT + Drift | `libapp.so` del split `arm64-v8a` (29 688 752 B) | Búsqueda de cadenas y enumeración de rutas de paquete Dart (`C:\Users\yayog\Downloads\decompiled\symmetry-arm64`) |
| Cronos Gym | React + Vite + IndexedDB + Supabase | `src/` (350 archivos, 89 172 LOC) | Lectura directa de componentes, hooks, contextos y stores |

> **Caveat de método.** Hevy y Symmetry compilan su lógica a Hermes/Dart AOT: su comportamiento **no es recuperable como código fuente**, solo como vocabulario (nombres de símbolos, rutas de paquete, claves de i18n, cadenas de eventos). Lo que se documenta abajo para esas dos apps es el **vocabulario de arquitectura observado**, contrastado con los patrones que sí son verificables en Cronos. Cuando una cadena demuestra la *existencia* de un mecanismo y no su *semántica*, se dice explícitamente.

---

## 1. Resumen ejecutivo

1. **El temporizador de descanso de Cronos que está en producción es el que peor se comporta.** El componente correcto (`src/components/RestTimer.tsx`, basado en *deadline*) **no está importado por ningún archivo de `src/`**; el flujo activo usa un `RestTimerOverlay` inline basado en un contador que se decrementa con `setInterval`. El componente correcto está cubierto por tests que pasan en verde y, aun así, es código muerto.
2. **La sesión activa de Cronos solo existe en memoria.** `ActiveSessionContext` es `useState` puro. Tras una recarga, `TrainView` devuelve `HomeView` y el componente `ActiveWorkout` **ni siquiera se monta**: el mecanismo de recuperación por borrador existe, es correcto en su almacenamiento, pero **es inalcanzable desde la UI** después de un crash.
3. **Restaurar un borrador de Cronos está roto en dos puntos**: no se adopta el `logId` del borrador recuperado y el borrador viejo no se borra, de modo que, tras finalizar la sesión restaurada, el borrador huérfano vuelve a ofrecerse como “sesión sin terminar”; y la sesión recuperada no reinstala la sesión en el contexto, por lo que el tiempo transcurrido vuelve a `00:00` y la píldora desaparece.
4. **El descanso en curso no se persiste.** No hay `endsAt` en ninguna parte del modelo local: una recarga en mitad del descanso pierde el descanso. Hevy lo ancla en una Live Activity; Symmetry lo ancla con `anchoredRemaining` y lo guarda en snapshots de sesión.
5. **No existe ninguna alerta de fin de descanso en el flujo activo de Cronos** (ni sonido, ni vibración, ni notificación). El código que sí lo hace (`playBeep`, `REST_VIBRATE_MS`) pertenece al componente muerto.
6. **Cronos no tiene supersets ni agrupación de ejercicios**: el carrusel activo es plano (una burbuja por ejercicio) y `superset_id` solo aparece como detección de cabecera en el importador.
7. **Cronos ya conoce el patrón correcto**: `useElapsedMs` (deadline derivado) y `useLockoutCountdown` (`target - Date.now()`) usan timestamps, no contadores. El temporizador de descanso es la excepción, y la excepción es precisamente la que el usuario mira cada serie.

---

## 2. Hevy 3.1.16 — la sesión activa vive en el cliente, el reloj vive en el reloj

### 2.1 Persistencia de la rutina activa

Hevy no tiene base de datos local (confirmado en Fase 1: sin `sqlite`, `expo-sqlite`, `react-native-sqlite`, `op-sqlite`, `realm`, `drizzle`, `prisma`). La persistencia local es **AsyncStorage + stores estilo Zustand persistido**, y la sesión activa tiene su propio vocabulario:

| Cadena observada | Lectura |
|---|---|
| `CurrentWorkoutState`, `currentWorkout`, `currentWorkoutExercises` | Estado del entrenamiento en curso |
| `CurrentUserWorkoutsStore`, `CurrentUserRoutineStore` | Stores por usuario |
| `global.workoutsWithPendingRequests` | Cola de entrenamientos con peticiones pendientes |
| `UnsyncedStoreClass`, `UnsyncedBatchStoreClass`, `UnsyncedRoutinesStoreClass`, `UnsyncedObject`, `UnsyncedRoutine*`, `UnsyncedMeasurements*` | Everything created locally that the server has not confirmed yet: the "unsynced" layer |
| `persistSavedAccountStore`, `createSavedAccountStore`, `createObjectStore`, `createStore` | Zustand `persist` sobre AsyncStorage |
| `workoutInProgress.*` (12+ claves de i18n) | Familia completa de estados de "entrenamiento en curso" |
| `workoutInProgress.alert.startNew`, `workoutInProgress.resumeScheduled`, `workoutInProgress.discardWorkoutAlert.*`, `DiscardActiveWorkout`, `monitorInactiveWorkouts`, `StartWorkoutInProgressPress` | Diálogos y políticas de reanudación/abandono |

**Lo que esto demuestra:** Hevy no espera al servidor para el estado de la sesión. El entrenamiento en curso es un objeto local (`currentWorkout`) con su propio store, y el servidor solo absorbe lo que ya está confirmado localmente (de ahí la capa `Unsynced*`). La ausencia de base local no impide una sesión activa persistente: impide el *histórico y las consultas*.

### 2.2 Temporizador de descanso

Hevy tiene **tres capas** de temporizador:

1. **Configuración por ejercicio y por usuario**: `AutoRestTimerConfigOverlay`, `autoRestTimerVM`, `AutoRestTimerSettings`, `showAutoRestTimerModal`, `showAutoRestTimerSettings`, `handleRestTimerAction`, `default_rest_timer_seconds`, `global.restTimeText`, `restTimerButton`, `gracePeriod`.
2. **Evento de analítica**: `rest_timers` (evento) y `TESTIMATED_REST_TIMER_DURATION` (clase de test). Es decir, el temporizador es una superficie de producto medida, no unAccidente.
3. **Reloj:** el temporizador **no vive solo en el teléfono**: se replica a un wearable por un puente nativo con protocolo explícito:
   - `REST_TIMER_UPDATE` → «Error sending REST_TIMER_UPDATE to Apple Watch»
   - `REST_TIMER_DISMISSED` → «Error sending REST_TIMER_DISMISSED to Apple Watch»
   - `live activity rest timer request type` → el tipo de petición del canal en vivo
   - `handleLiveActivityEventEmitter`, `LiveActivityIsEnabled`, `LiveActivityError`
   - `wearable.workoutInProgressNotification`, `AppleWatchLiveSyncEnabled`, `liveSyncStatusBar`, `disableLiveSyncForCurrentWorkout`, `LogWorkoutViewModel`, `LoggedWithWatch`

**Lectura arquitectónica:** el reloj de descanso de Hevy es un **objeto replicable**, con un estado (`update`/`dismissed`) que viaja a una segunda superficie (Live Activity / Wear OS). Eso es exactamente lo que permite que el temporizador sobreviva a que la app móvil esté en segundo plano: el segundo plano no es un problema porque el reloj no está *en* la app móvil.

### 2.3 Fondo, alertas y vibración

| Capacidad | Evidencia |
|---|---|
| Vibración | `vibrate`, `vibrateScheduler`, `enableVibrateFallback` (fallback cuando la retroalimentación principal no está disponible) |
| Notificaciones | `remoteNotificationReceived`, `PushNotificationsEnabled`, `global.cancelAllLocalNotification` |
| Ciclo de vida de la app | `AppState`, `handleAppStateChange`, `appStateChangeHandler` |
| Workout en segundo plano | `workoutInProgress.notifications/`, `workoutInProgressAlert.title` / `.body` |

### 2.4 Supersets y agrupación

`superset_id`, `supersetId`, `supersetIdentityAsync`, `global.supersetColor`, `global.onRemoveFromSupersetPress`. Hevy tiene el superset como **identidad estable de un par de ejercicios** (`superset_id` viaja en el CSV exportado, verificado en Fase 1), con color propio y acción de quitar del grupo: es un objeto de primera clase, no un color.

---

## 3. Symmetry 7.16.0 — el modelo más maduro de los tres

### 3.1 Persistencia de la sesión activa: un paquete entero

Symmetry dedication un package propio a la sesión activa: `package:symmetry/packages/active_training_session/`. Su contenido es la parte más útil de este informe:

| Símbolo / ruta | Función deducida |
|---|---|
| `lib/src/models/state/active_session.dart` | `ActiveSessionDraft`, `ActiveSessionDraftExercise`, `ActiveSessionDraftSet` — el borrador de trabajo |
| `lib/src/models/snapshot/session_snapshot.dart` | `SessionSnapshot` — la foto inmutable de una sesión |
| `lib/src/data/local/session_snapshot_codec.dart` | `SessionSnapshotCodec` — serialización binaria del snapshot |
| `ActiveSessionDraftCodec` | Codec del borrador (distinto del snapshot) |
| `lib/src/data/mappers/active_session_draft_to_snapshot_mapper.dart` | Draft → Snapshot |
| `lib/src/guided_session/mappers/guided_session_snapshot_mapper.dart` | Snapshot → sesión guiada |
| `lib/src/guided_session/data_providers/drift_active_session_context_store.dart` | Store Drift del contexto de la sesión |

La capa de persistencia es **Drift (SQLite)**, con tablas y DAOs dedicados:

- `packages/persistence/lib/src/drift/tables/active_session_snapshots_table.dart` → tabla `active_session_snapshots`
- `packages/persistence/lib/src/drift/daos/active_session_snapshot_dao.dart` → `ActiveSessionSnapshotDao` / `activeSessionSnapshotDao`
- `packages/persistence/lib/src/drift/daos/active_session_context_dao.dart` → `active_session_contexts`
- `packages/persistence/lib/src/drift/daos/active_session_media_dao.dart` → `active_session_media_items`
- `active_session_sets` (visible en una sentencia `DROP TABLE IF EXISTS active_session_sets`)
- `ActiveSessionSnapshotsCompanion`, `init:activeSessionSnapshots`
- `ActiveSessionRankSyncListener` — sincroniza los puestos con la sesión activa
- `OverloadAppliedStore` — marca la sobrecarga ya aplicada (evita reaplicarla al reanudar)
- `pending_workout_edit.dart` (detectado en Fase 1) — ediciones pendientes de publicar

**El patrón es claro y es el que Cronos necesita:** *borrador mutable → snapshot inmutable → codec → tabla local → DAO*. El snapshot es lo que permite reanudar: no se reanuda "el estado", se reanuda **una foto**.

### 3.2 Temporizador de descanso

Symmetry separa **estado, cálculo y presentación** en tres capas, con una capa de tests:

| Capa | Símbolos |
|---|---|
| Estado | `guided_workout_module/shared/domain/state_management/rest_timer_cubit.dart` → `RestTimerCubit`; `rest_timer_state.dart` (+ `.freezed.dart`) → `RestTimerState.idle()`, `RestTimerState.running(remaining: …)`, `RestTimerIdle` |
| Cálculo | `guided_workout_module/shared/domain/use_cases/anchored_remaining.dart` → **`anchoredRemaining`** |
| Presentación | `guided_workout_module/features/workout_timers_feature/presentation/`: `rest_timer_overlay.dart`, `rest_timer_card.dart`, `clock_timer_modal.dart`, `clock_timer_action_button.dart`, `clock_timer_toggle_item.dart`, `timed_set_timer_badge.dart` |
| Complemento | `features/workout_timers_feature/domain/state_management/minimized_rest_advance_listener.dart` (descanso minimizado), `shared/domain/use_cases/timed_set_tick.dart`, `adjust_timed_set_seconds.dart`, `lead_in_countdown.dart` |

El nombre `anchoredRemaining` es la evidencia decisiva: el resto restante se **ancora** en un instante, no se cuenta hacia abajo. `RestTimerState.running(remaining: …)` guarda lo que queda; el cálculo del anclaje vive aparte, en un *use case* puro, exactamente como `src/lib/workout/restTimer.ts` en Cronos.

### 3.3 Alertas en segundo plano

Symmetry tiene una superficie de avisos considerably más ancha:

| Capacidad | Evidencia |
|---|---|
| Notificación de fin de descanso | `shared/domain/use_cases/rest_end_alert.dart` + claves `rest_timer.notification.title` / `rest_timer.notification.body` |
| Vibración | `shared/domain/use_cases/vibrate_strong.dart` |
| Sonido | `core_feature/presentation/set_completion_sound_listener.dart`, `shared/domain/use_cases/background_sound_player.dart` |
| Modo silencioso | `shared/domain/use_cases/silent_mode_detector.dart` (detecta el modo silencioso del sistema antes de sonar) |
| Voice cues | `shared/domain/use_cases/voice_cues_ab_test/` (`voice_cue_settings.dart`, `voice_cue_tracker.dart`, `guided_voice_cues.dart`), `VoiceCue.restStart(restSeconds: …)` |
| Bloqueo de pantalla | `core_feature/domain/state_management/lockscreen/live_activity_tap_listener.dart`, `lockscreen/logged_set_confirmation.dart` |
| Ciclo de vida | `exercise_catalog_module/features/choose_exercise/domain/state_management/analytics/app_lifecycle_changes.dart` |
| Guardia de ruta | `guided_workout_module/core_feature/presentation/guided_workout_route_guard.dart` |
| Persistencia explícita de sesión | `workout_preview_module/shared/domain/use_cases/session_persistence_use_case.dart`, `training/shared/presentation/populated_session_draft_builder.dart` |
| Recordatorios | `training_page_module/core_feature/domain/notifications/workout_reminder_notification_router.dart`, `workout_reminder_listener.dart`, `shared/domain/use_cases/notifications/retention_delivery_ledger.dart` |

`silent_mode_detector.dart` es un detalle que Cronos ya tiene resuelto en su componente muerto (`useReducedMotion` como criterio equivalente) pero que en producción no está activo.

### 3.4 Supersets y agrupación

| Símbolo | Función |
|---|---|
| `training/shared/presentation/superset/superset_strip_block.dart` | Bloque visual de superset en la pantalla activa |
| `training/shared/presentation/superset/remove_from_superset_action.dart` | Quitar un ejercicio del grupo |
| `guided_workout_redesign_ab_test/variants/guided_experience/current_set_sheet/superset_chips_row.dart` | Chips de superset en la ficha de serie |
| `_SupersetBlockRows`, `SupersetSheetRow` | Filas de bloque de superset |
| `supersetExerciseAddedEvent`, `supersetExerciseRemovedEvent`, `superset_exercise_added` (analítica) | Ciclo de vida del grupo como evento |
| `buildAddToSupersetAction` | Acción de añadir al grupo |

Symmetry trata el superset como **bloque con filas**, no como una etiqueta: la pantalla activa tiene una representación propia (`superset_strip_block`) y el estado tiene eventos de entrada/salida.

---

## 4. Auditoría del flujo activo de Cronos Gym

### 4.1 Mapa del estado

| Pieza | Archivo | Qué guarda | ¿Persiste? |
|---|---|---|---|
| Contexto de sesión | `src/context/ActiveSessionContext.tsx:77-129` | `routineId`, `title`, `startedAt` | **No** (`useState` puro) |
| Estado de la pantalla activa | `src/components/ActiveWorkout.tsx:1481-1512` | `logId`, `items`, `notes`, `rest`, `selectedKey`, `started`, `recovered`, `pendingRemoval` | **No** (salvo `items`/`notes` vía borrador) |
| Borrador | `src/lib/offlineStore.ts:31-43` | `logId`, `userId`, `routineId`, `routineTitle`, `startedAt`, `items`, `notes`, `finalized`, `updatedAt` | Sí (IndexedDB `drafts`) |
| Cola de sync | `src/lib/offlineStore.ts:85-92` | `FinalizePayload` por sesión | Sí (IndexedDB `queue`) |
| Preferencia de descanso | `src/lib/workout/restPreferences.ts` | Override por ejercicio | Sí (`localStorage`) |
| Reloj de sesión | `src/hooks/useElapsedMs.ts:46-66` | Derivado (`now - startedAt`) | No hace falta |
| Cola offline | `src/hooks/useOfflineSync.ts:67-101` | Estado de red + drenaje | No |

### 4.2 El temporizador de descanso: dos implementaciones, una viva

**La que está en producción** — `src/components/ActiveWorkout.tsx:690-712`:

```ts
function RestTimerOverlay({ seconds, onClose, onFinished }: RestTimerOverlayProps) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) { onFinished(); return; }
    const timer = window.setInterval(() => {
      setRemaining((r) => { if (r <= 1) { onFinished(); return 0; } return r - 1; });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining, onFinished]);
```

Problemas, en orden de gravedad:

1. **Es un contador, no un deadline.** El navegador estrangula los `setInterval` de una pestaña en segundo plano (≥1 s, y en móvil la pestaña puede detenerse por completo). El resto "pierde" segundos sin que nadie los pierda: cuando la app vuelve al frente, el contador ha seguido bajando *más lento* que el reloj real, o se quedó congelado. El temporizador miente sobre lo único que existe para decir.
2. **El efecto depende de `[remaining, onFinished]`**: cada tick destruye y recrea el intervalo. Además, `onFinished` es `closeRest` (estable) pero `remaining` cambia cada segundo → un `setInterval` nuevo cada segundo. Con `onFinished` no memoizado el efecto se recrearía dos veces por tick.
3. **Sin re-sincronización al primer plano**: no hay `visibilitychange` en `ActiveWorkout.tsx`. Único `visibilitychange` del flujo: `useOfflineSync` (drena la cola, no el reloj).
4. **Sin alerta**: este overlay no llama a `playBeep` ni a `navigator.vibrate`. El fin del descanso es silencioso.
5. **El estado es `{ id, seconds }`** (`ActiveWorkout.tsx:1495`) — no hay `endsAt` que pueda sobrevivir a un remonte.

**La que está escrita y no se usa** — `src/components/RestTimer.tsx:91-163`:

- `deadlineRef` con `endsAt` y `remainingMs(deadline, now)` (`src/lib/workout/restTimer.ts:46-48`).
- `document.addEventListener("visibilitychange", …)` que repinta el resto real al volver (`RestTimer.tsx:155-163`).
- Beep de 880 Hz / 150 ms con fallback a `navigator.vibrate(200)` (`RestTimer.tsx:120-134`), silencioso bajo `prefers-reduced-motion` y si hay un beep de récord activo.
- Barra minimizada (`minimized`) que deja visible la tabla de series.
- Ajustes de ±15 s, pausa y salto.

**Por qué sigue viva la mala:** `src/components/RestTimer.tsx` **no aparece en ningún `import` de `src/`**. La única referencia fuera de su propio archivo de test es `vi.mock("./RestTimer", …)` en `src/components/ActiveWorkout.test.tsx:68` — un mock de un módulo que el componente nunca importa. El componente tiene su propio suite (`src/components/RestTimer.test.tsx`) que pasa en verde: **tests que cubren código muerto**, lo que da una falsa sensación de que el temporizador está cubierto.

Cronos ya aplica el patrón correcto en otros dos sitios, lo que confirma que el problema es de integración y no de conocimiento:

- `src/hooks/useElapsedMs.ts:54-65` — un único `setInterval` que lee `Date.now()` y deriva `now - startedAt`. Un solo reloj en toda la app.
- `src/hooks/useLockoutCountdown.ts:51-52` — `target - Date.now()`, un deadline.

### 4.3 Recuperación de estado: el borrador existe, la puerta está cerrada

**El almacenamiento está bien.** `saveDraft` / `loadRecoverableDraft` / `deleteDraft` (`src/lib/offlineStore.ts:106-161`) guardan el borrador en IndexedDB (`drafts`, `keyPath: "logId"`) con degradación a no-op si IndexedDB no existe (`src/lib/idb.ts:102-108`). `loadRecoverableDraft` filtra por `userId`, exige `!finalized` y `items.length > 0`, y ordena por `updatedAt` descendente. Todo correcto.

**El problema es de reachability:**

```tsx
// src/App.tsx:325
if (!session) return <HomeView />;
```

`TrainView` solo monta `ActiveWorkout` si el contexto tiene sesión. `ActiveSessionContext` es memoria pura. Por tanto:

> **Tras una recarga de página, un crash del navegador o la pérdida de memoria del proceso, la sesión existió en IndexedDB pero `ActiveWorkout` no se monta, `loadRecoverableDraft` no se ejecuta y el banner «Encontramos una sesión sin terminar» nunca aparece.**

El usuario ve `HomeView`, cree que no había sesión, empieza una rutina nueva… y solo entonces se monta `ActiveWorkout` y el borrador viejo aparece como “sesión sin terminar” **de otra rutina**, mezclado con la que acaba de empezar.

**Y la restauración está rota en dos puntos** (`ActiveWorkout.tsx:1608-1621`):

```tsx
function restoreRecovered() {
  if (!recovered) return;
  setItems(recovered.items);
  setNotes(recovered.notes);
  setRecovered(null);
  setStarted(true);
  setNotice("Sesión recuperada. Continúa donde lo dejaste.");
}
```

1. **No adopta `recovered.logId`.** El `logId` se fija en el montaje (`ActiveWorkout.tsx:1481`, `useState(() => newSessionId())`) y es inmutable. El borrador recuperado sigue guardado bajo `old-logId`, mientras la sesión restaurada se persiste y se sincroniza bajo `new-logId` (`ActiveWorkout.tsx:1836-1846`). Mientras el borrador nuevo exista, `loadRecoverableDraft` lo elige a él (es el más reciente por `updatedAt`); pero al **finalizar** esa sesión, el borrador nuevo se marca `finalized: true` y **el huérfano vuelve a ser el único candidato** (`offlineStore.ts:148` filtra `!d.finalized && items.length > 0`). Resultado: tras cada sesión terminada se vuelve a ofrecer una sesión fantasma ya sincronizada, y el `logId` real de la sesión recuperada nunca coincide con el que se sincronizó.
2. **No reinstala la sesión en el contexto.** Tras restaurar, `session` sigue siendo `null` → `startedAt` (línea 1484) cae al `?? new Date().toISOString()`, el tiempo transcurrido vuelve a `00:00`, la píldora de `AppShell` no aparece y el `BottomNav` no se ilumina.

**Y `startedAt` se recalcula en cada render cuando no hay sesión** (`ActiveWorkout.tsx:1484`):

```tsx
const startedAt = session?.startedAt ?? new Date().toISOString();
```

Como `startedAt` es una expresión de render, **cambia en cada render** cuando `session` es `null`. Consecuencias:

- `persist` (`ActiveWorkout.tsx:1623-1638`) depende de `startedAt` → **su identidad cambia en cada render** → el efecto de guardado (`ActiveWorkout.tsx:1645-1652`) se limpia y se rearma en cada render → **el debounce de 400 ms nunca vence mientras haya re-renders**. Con escritura continua (teclear un peso) el borrador puede no escribirse nunca.
- La cabecera (`SessionHeader`, línea 229-247) muestra `new Date(startedAt)` → una “hora de inicio” que cambia en cada render.

### 4.4 Cierre de pestaña y unload

No existe ningún `beforeunload` ni `pagehide` en `src/` (verificado por grep sobre `*.ts, *.tsx`: las únicas coincidencias de `visibilitychange` están en `usePolling.ts`, `useOfflineSync.ts` y el componente muerto `RestTimer.tsx`). El guardado es un `setTimeout` de 400 ms (`PERSIST_DEBOUNCE_MS`, `ActiveWorkout.tsx:81`), de modo que **la última edición antes de cerrar la pestaña se pierde** si la ventana de 400 ms no llega a vencer.

### 4.5 Segundo plano y retorno al primer plano

Lo que hoy ocurre al volver:

| Evento | Reacción actual |
|---|---|
| `visibilitychange` → visible | `useOfflineSync` drena la cola (`:80-82`) |
| `online` | `useOfflineSync` drena la cola (`:74-77`) |
| Intervalo 60 s | `useOfflineSync` drena la cola (`:88-90`) |
| `visibilitychange` → hidden | **Nada**: no se fuerza un guardado ni se ancla el descanso |

El drenaje de la cola es un trabajo bien hecho (guarda anti-solapamiento con `inFlight`, `useOfflineSync.ts:47-65`), pero **no cubre el estado de la sesión**: al volver, el descanso puede seguir corriendo a destiempo o haber terminado sin avisar, y el borrador puede ir rezagado.

### 4.6 Agrupación de ejercicios y supersets

La pantalla activa se organiza con `ExerciseCarousel.tsx`: una tira con *scroll-snap* horizontal, **una burbuja por ejercicio**, con estados activo/completo/pendiente, anillo de progreso por ejercicio y arrastre para reordenar (`ExerciseCarousel.tsx:1-33, 78-107`). `ActiveWorkout.tsx:1531-1540` construye `carouselItems` aplanando `items` — **no hay noción de grupo**.

Grep de `superset|group_id|exercise_group` sobre `src/**/*.{ts,tsx}`: **6 coincidencias, ninguna de implementación**:

- `src/lib/import/sources.ts:90` — `if (has("superset_id") || has("rest_seconds") || has("exercise_notes")) return "hevy";` (detección de origen).
- `src/lib/import/sources.test.ts:187-189` — el test afirma que `superset_id` está entre las columnas **no mapeadas**, con un comentario explícito (“saying so is what stops a user concluding the import dropped their supersets”).
- `src/lib/workout/setKind.test.ts:106` — un caso que verifica que `"superset"` **no** es un `kind` válido.
- `src/lib/ai/routineGenerator.ts:220` — un comentario.

Es decir: **Cronos reconoce el superconjunto en el import y lo descarta de forma declarada**. Lo que no hace es *soportar* supersets, ni siquiera como agrupación local en la sesión activa.

### 4.7 Inventario de temporizadores en `src/`

| Ubicación | Mecánica | ¿Anclado a un deadline? |
|---|---|---|
| `ActiveWorkout.tsx:702` | `setInterval` 1 s, decremento | **No** |
| `RestTimer.tsx:141` | `setInterval` 250 ms, lee `endsAt` | Sí (código muerto) |
| `useElapsedMs.ts:54` | `setInterval` 1 s, deriva `now - startedAt` | Sí |
| `useLockoutCountdown.ts:51` | `setInterval`, `target - Date.now()` | Sí |
| `useOfflineSync.ts:88` | `setInterval` 60 s | N/A |
| `ShiftPanel.tsx:66` | `setInterval` de reloj | N/A |

Cinco de los seis son correctos. El que importa al atleta es el único que no lo es.

### 4.8 Entorno de ejecución

`package.json` **no declara** `workbox`, `vite-plugin-pwa` ni equivalente: **no hay service worker**. Sin red, una recarga deja al usuario ante la pantalla de error del navegador, aunque el borrador siga intacto en IndexedDB. La resistencia offline existe solo a nivel de *datos*, no de *aplicación*.

---

## 5. Matriz comparativa

| Capacidad | Hevy | Symmetry | Cronos Gym |
|---|---|---|---|
| Estado de la sesión activa | Store local (`CurrentWorkoutState`, `currentWorkout`) | Cubit/BLoC + Drift (`active_session_snapshots`, `active_session_sets/contexts/media`) | Estado React + borrador IndexedDB **no rehidratado** |
| Recuperación tras crash/recarga | Reanudación ("workoutInProgress", `resumeScheduled`, capa `Unsynced*`) | Snapshot + codec + DAO + `route_guard` + `session_persistence_use_case` | **Inalcanzable** (`App.tsx:325`); el banner solo aparece tras iniciar otra rutina |
| Identidad de la sesión recuperada | — | Snapshot conserva la identidad | **Se pierde**: el `logId` no se adopta → duplicado + borrador huérfano |
| Reloj del descanso | Anclado + replicado a Live Activity/Wear (`REST_TIMER_UPDATE`/`_DISMISSED`) | `RestTimerCubit` + `anchoredRemaining` | Contador con `setInterval` (**deriva**) |
| Alerta de fin de descanso | `vibrateScheduler`, `enableVibrateFallback`, wearable | `rest_end_alert` + notificación + `vibrate_strong` + sonido + voice cues | **Ninguna en el flujo activo** |
| Aviso con la app en segundo plano | Notificaciones + Live Activity | Notificación local + lockscreen | Ninguno (ni service worker) |
| Reanudación al primer plano | `handleAppStateChange` | `app_lifecycle_changes.dart` | Solo drena la cola; **el reloj no se reanuda** |
| Descanso persistido | Sí (estado replicable) | Sí (snapshot) | **No** (`rest` es estado React) |
| Selección de ejercicio persistida | — | Snapshot | **No** (`selectedKey` se pierde; se reabre el primero) |
| Supersets | `superset_id`, `supersetId`, color, quitar | Bloque, chips, eventos add/remove | **Ninguno** |
| Tipos de serie en la UI | `set_type` | `set_type_selector_modal`, `reconcile_session_set_kinds_use_case` | `SetKind` en UI, **no persistido** (Fase 1 §7.1) |
| RPE por serie | `rpe` | `set_rpe.dart` | `SetEntry.rpe` **persistido** ✓ |
| Un solo reloj para toda la app | — | Cubit único | `useElapsedMs` ✓ (pero no cubre el descanso) |

---

## 6. Casos de falla

| # | Escenario | Comportamiento actual de Cronos | Impacto | Referencia |
|---|---|---|---|---|
| F1 | Descanso con la app en segundo plano 3 min | El contador se estrangula; el fin del descanso se retrasa o nunca suena | El descansador informa de un tiempo que no es el real | Hevy (replicación), Symmetry (`anchoredRemaining`) |
| F2 | Recarga durante el descanso | Se pierde el descanso en curso | El usuario vuelve y no sabe cuánto llevaba descansando | Symmetry (snapshot + `anchoredRemaining`) |
| F3 | Cierre de pestaña <400 ms tras editar | Se pierde la última edición (debounce sin flush) | Series Recentemente escritas desaparecen | — |
| F4 | Crash del navegador / pérdida de memoria | El borrador **existe** en IndexedDB, pero `TrainView` cae en `HomeView` y no se monta `ActiveWorkout` | El usuario cree que no había sesión; puede empezar de cero y duplicar el trabajo | Hevy (`workoutInProgress`), Symmetry (`route_guard`) |
| F5 | Recuperar un borrador | `logId` no adoptado + borrador viejo no borrado + contexto no restaurado | Tras finalizar, el borrador huérfano se vuelve a ofrecer como sesión sin terminar; tiempo transcurrido `00:00`; píldora ausente | — |
| F6 | `session === null` (sesión libre o recuperada) | `startedAt` se recalcula en cada render → `persist` cambia de identidad → el debounce de 400 ms se rearma eternamente | El borrador puede no escribirse nunca bajo re-render continuo | — |
| F7 | Offline + recarga | Sin service worker: pantalla de error del navegador | El borrador es inalcanzable hasta que vuelva la red | — |
| F8 | Vuelta al primer plano tras 20 min | Se drena la cola, nada más | El descanso no se reanuda ni se avisa; el borrador puede ir rezagado | Hevy/Symmetry (`app_lifecycle_changes`) |
| F9 | Ejercicio con superset importado | `superset_id` no mapeado (documentado y honesto) | El usuario pierde la agrupación; no hay soporte en la sesión activa | Hevy/Symmetry |
| F10 | Fin del descanso | Silencioso (ni beep, ni vibración) | La única señal de que toca la siguiente serie es visual | Hevy/Symmetry |
| F11 | `startedAt` del encabezado sin sesión | Muestra una hora que cambia en cada render | Lectura imposible en la cabecera | — |
| F12 | Desmontaje por navegación durante un descanso | `rest` se destruye con el componente | El descanso se cancela al navegar al hub de ejercicios | — |

---

## 7. Brechas

| ID | Brecha | Evidencia | Severidad |
|---|---|---|---|
| **B1** | El temporizador con deadline está escrito, testeado y **conectado a nada**; el flujo activo usa el contador | `src/components/RestTimer.tsx` sin imports; `ActiveWorkout.tsx:690-712`; `ActiveWorkout.test.tsx:68` (mock de un módulo no importado) | **Crítica** |
| **B2** | El descanso en curso no se persiste (no hay `endsAt` en el modelo local) | `ActiveWorkout.tsx:1495` (`rest = {id, seconds}`); `offlineStore.ts:31-43` (sin campo de descanso) | **Crítica** |
| **B3** | La sesión activa solo vive en memoria; la recuperación es inalcanzable tras una recarga | `ActiveSessionContext.tsx:77-129`; `App.tsx:325` | **Crítica** |
| **B4** | Restaurar no adopta el `logId` ni borra el borrador → el huérfano vuelve a ofrecerse tras finalizar | `ActiveWorkout.tsx:1481, 1608-1615, 1836-1846`; `offlineStore.ts:148` | **Alta** |
| **B5** | `startedAt` derivado en cada render cuando no hay sesión → debounce que nunca vence y cabecera imposible | `ActiveWorkout.tsx:1484, 1623-1638, 1645-1652` | **Alta** |
| **B6** | Sin flush en `pagehide`/`beforeunload`/`visibilitychange` → ventana de pérdida de 400 ms | `ActiveWorkout.tsx:81, 1645-1652` | **Media** |
| **B7** | Sin alerta de fin de descanso en producción (ni sonido, ni vibración, ni notificación) | `ActiveWorkout.tsx:690-712` vs `RestTimer.tsx:120-134` | **Alta** |
| **B8** | Sin supersets ni agrupación de ejercicios en la sesión activa | `ExerciseCarousel.tsx` plano; grep `superset` → 0 usos de implementación | **Media** |
| **B9** | Sin shell offline (service worker): los datos resisten, la aplicación no | `package.json` sin `workbox`/`vite-plugin-pwa` | **Media** |
| **B10** | `selectedKey` y el resto de la posición en la sesión no se persisten: al recuperar se reabre el primer ejercicio | `ActiveWorkout.tsx:1496` | **Baja** |
| **B11** | El tipo de serie (`drop`, `failure`) no llega al servidor (brecha heredada de Fase 1 §7.1) | `ActiveWorkout.tsx:1830` (`is_warmup: toWarmupColumn(set.kind)`) | **Media** |

---

## 8. Propuesta de arquitectura para Cronos

### 8.1 P0 — Correcciones de producción (sin migración de datos)

**P0.1 · Un solo temporizador, anclado.** Conectar `src/components/RestTimer.tsx` al flujo activo y eliminar el `RestTimerOverlay` inline. El estado de descanso pasa a llevar el ancla:

```ts
// src/components/ActiveWorkout.tsx
const [rest, setRest] = useState<{ id: number; seconds: number; endsAt: number } | null>(null);

function startRest(seconds: number) {
  const total = Math.max(seconds, 15);
  setRest({ id: Date.now(), seconds: total, endsAt: Date.now() + total * 1000 });
}
```

Con `endsAt` persistido (ver P1.2), un remonte no reinicia el reloj y un retorno al frente repinta el tiempo real sin depender del `setInterval`. Si se quiere conservar el overlay inline, el cambio mínimo es replicar su aritmética sobre `endsAt` (`remainingMs`), pero **no** mantener dos implementaciones.

**P0.2 · Congelar `startedAt` en un origen estable.** Sustituir el `??` en render por un ancla única y memoizada:

```ts
const startedAtRef = useRef<string | null>(null);
if (startedAtRef.current === null) {
  startedAtRef.current = session?.startedAt ?? recovered?.startedAt ?? new Date().toISOString();
}
const startedAt = startedAtRef.current;
```

Esto elimina de una vez B5 (identidad de `persist` estable → el debounce vence) y F11.

**P0.3 · Restaurar sin fugas.** `restoreRecovered` debe **adoptar el `logId` del borrador** y **borrarlo**:

- `logId` deja de ser un `useState` inmutable y pasa a derivarse: `const [logIdOverride, setLogIdOverride] = useState<string | null>(null)` con `const logId = logIdOverride ?? draftLogId`.
- Tras adoptar, `void deleteDraft(recovered.logId)`.
- Tras restaurar, **reinstalar la sesión en el contexto** (ver P1.1) para que el tiempo transcurrido y la píldora no se pierdan.

**P0.4 · Flush al salir.** Añadir un `visibilitychange` (cuando `hidden`) y `pagehide` que fuercen un guardado inmediato, reutilizando `itemsRef`/`notesRef` que ya existen (`ActiveWorkout.tsx:1640-1643`):

```ts
useEffect(() => {
  const flush = () => { void saveDraft({ /* … */ items: itemsRef.current, notes: notesRef.current, updatedAt: Date.now() }); };
  const onHide = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); };
}, [logId, userId, routineId, routineTitle, startedAt]);
```

**P0.5 · Alerta de fin de descanso.** Reutilizar el patrón ya escrito (`src/lib/audio/audio.ts`: `playBeep`, `isRecordBeepActive`, `markRecordBeep`; y `src/lib/workout/restTimer.ts`: `REST_BEEP_HZ`, `REST_VIBRATE_MS`) dentro del temporizador vivo, más `Notification` cuando el documento está oculto. Regla de precedencia: si la pestaña está visible → beep + vibración; si está oculta → notificación local (requiere permiso, con degradación silenciosa); bajo `prefers-reduced-motion` → solo vibración.

### 8.2 P1 — Persistencia y resistencia

**P1.1 · Rehidratación de la sesión al arrancar.** `ActiveSessionProvider` debe leer el borrador antes de renderizar la app, de modo que `TrainView` pueda montar `ActiveWorkout` con la sesión recuperada:

```ts
// src/context/ActiveSessionContext.tsx
useEffect(() => {
  if (!userId) return;
  void loadRecoverableDraft(userId).then((draft) => {
    if (draft) setSession({ routineId: draft.routineId, title: draft.routineTitle, startedAt: draft.startedAt });
  });
}, [userId]);
```

Esto convierte el borrador de “dato huérfano” en “sesión visible”, hace que la píldora reaparezca con el tiempo transcurrido correcto y hace que la recuperación sea alcanzable **sin** pedirle al usuario que empiece otra rutina. Requiere que el provider conozca el `userId` (hoy lo obtiene el outlet); la alternativa es un `SessionRehydrationGate` en `main.tsx` que resuelva el borrador antes de renderizar el router.

**P1.2 · Modelo de sesión activa v2 (`SessionDraft`).** Añadir los campos que hoy se pierden:

```ts
export interface SessionDraft {
  /* …campos actuales… */
  /** Ancla del descanso en curso (epoch ms). */
  restEndsAt: number | null;
  /** Ejercicio seleccionado, para reabrir donde se estaba. */
  selectedKey: string | null;
  /** Segundos de descanso por ejercicio, ya resueltos. */
  restSecondsByExercise: Record<string, number>;
  /** Versión del esquema, para migrar borradores antiguos. */
  version: 2;
}
```

La normalización ya existente (`normalizeDraft`, `offlineStore.ts:118-126`) es el sitio natural para migrar `v1 → v2` sin perder borradores.

**P1.3 · Reanudación del descanso al volver al frente.** Con `restEndsAt` persistido, al volver a primer plano: si `restEndsAt` ya pasó → disparar la alerta de fin de descanso (una sola vez) y cerrar el descanso; si no → repintar el resto real. Es el equivalente web de `anchoredRemaining` + `app_lifecycle_changes`.

**P1.4 · Shell offline (opcional).** `vite-plugin-pwa` con precache del bundle, para que una recarga sin red no deje al usuario fuera de la app. Cierra F7.

### 8.3 P2 — Modelo y agrupación

**P2.1 · `set_type` completo (cierra B11 y la brecha §7.1 de Fase 1).** Nueva columna `set_type text` en `completed_sets` con valores `normal|warmup|drop|failure`, más `group_id`/`superset_id`. El mapeo deja de ser `is_warmup: toWarmupColumn(kind)` y pasa a写着 el `kind` completo. Requiere migración SQL en `supabase/migrations/`.

**P2.2 · Agrupación en la sesión activa.** `DraftExercise` gana `groupId?: string | null`; el carrusel (`ExerciseCarousel.tsx`) pasa a renderizar **bloques** (como el `superset_strip_block` de Symmetry): burbujas agrupadas, indicador de “A → B” y avance automático al terminar la primera del grupo. Los dos ejercicios de un grupo comparten descanso, que es la razón de ser del superset.

**P2.3 · Snapshot servidor (opcional).** Tabla `active_session_snapshots` (id, user_id, payload jsonb, updated_at) para continuar la sesión en otro dispositivo, al estilo de Symmetry. Requiere RLS por `user_id` y una política de “una sesión activa por usuario”.

### 8.4 Orden de ejecución sugerido

| Orden | Ítem | Esfuerzo | Riesgo |
|---|---|---|---|
| 1 | P0.2 (`startedAt` congelado) | Bajo | Bajo |
| 2 | P0.1 (temporizador anclado, reutilizando `RestTimer.tsx`) | Bajo | Bajo |
| 3 | P0.5 (alerta de fin de descanso) | Bajo | Bajo |
| 4 | P0.3 (restauración sin fugas) | Medio | Medio |
| 5 | P0.4 (flush en `pagehide`/`hidden`) | Bajo | Bajo |
| 6 | P1.1 + P1.2 (rehidratación + `SessionDraft` v2) | Medio | Medio |
| 7 | P1.3 (reanudación del descanso al primer plano) | Medio | Medio |
| 8 | P1.4 (service worker) | Medio | Medio |
| 9 | P2.1 + P2.2 (supersets y `set_type`) | Alto | Alto (migración de datos) |

Los ítems 1-5 no tocan el esquema de datos y son reversibles en un commit cada uno. El ítem 6 es el que convierte la persistencia existente en una recuperación real.

---

## 9. Límites del análisis

- **Hevy y Symmetry no son código legible.** Las conclusiones sobre ellas provienen de la tabla de cadenas de Hermes y de los símbolos/rutas de Dart AOT. Eso acredita la **existencia** de un mecanismo (un cubit, un DAO, una tabla, un codec, una notificación), no su implementación exacta. Cuando se afirma “anclado” en Symmetry, la evidencia es el símbolo `anchoredRemaining` en `use_cases/anchored_remaining.dart`, que es un indicio fuerte pero no una lectura de la implementación.
- **El análisis del bundle de Hevy y del `libapp.so` de Symmetry no cubrió código descompilado por JADX más allá de los assets**: en estas dos apps la lógica de aplicación vive en los binarios compilados, no en clases Java.
- **No se ejecutó la app ni se midió el comportamiento real** del temporizador en segundo plano; las conclusiones sobre la deriva del contador proceden de la semántica de `setInterval` en pestañas estranguladas y del contraste con las implementaciones ancladas de Hevy y Symmetry.
- **El flujo activo de Cronos se leyó completo** en los archivos citados (`ActiveWorkout.tsx` 2 262 líneas, `ActiveSessionContext.tsx`, `offlineStore.ts`, `idb.ts`, `sessionSync.ts`, `useOfflineSync.ts`, `useElapsedMs.ts`, `RestTimer.tsx`, `ExerciseCarousel.tsx`, `restTimer.ts`, `restPreferences.ts`, `App.tsx`); no se ejecutó la suite de tests ni se midió el comportamiento en un navegador real.

---

## 10. Anexo — Índice de evidencia textual

**Hevy** (`index.android.bundle`): `CurrentWorkoutState`, `currentWorkout`, `currentWorkoutExercises`, `CurrentUserWorkoutsStore`, `CurrentUserRoutineStore`, `global.workoutsWithPendingRequests`, `UnsyncedStoreClass`, `UnsyncedBatchStoreClass`, `UnsyncedRoutinesStoreClass`, `UnsyncedObject`, `persistSavedAccountStore`, `createSavedAccountStore`, `createObjectStore`, `createStore`, `workoutInProgress.*` (12+), `workoutInProgressAlert.title`, `workoutInProgress.discardWorkoutAlert.*`, `workoutInProgress.resumeScheduled`, `workoutInProgress.notifications/`, `DiscardActiveWorkout`, `ScheduleActiveWorkoutReminder`, `CancelScheduleActiveWorkoutReminder`, `monitorInactiveWorkouts`, `AutoRestTimerConfigOverlay`, `autoRestTimerVM`, `AutoRestTimerSettings`, `showAutoRestTimerModal`, `showAutoRestTimerSettings`, `handleRestTimerAction`, `default_rest_timer_seconds`, `rest_timers`, `restTimerButton`, `global.restTimeText`, `gracePeriod`, `REST_TIMER_UPDATE`, `REST_TIMER_DISMISSED`, `live activity rest timer request type`, `handleLiveActivityEventEmitter`, `LiveActivityIsEnabled`, `LiveActivityError`, `wearable.workoutInProgressNotification`, `AppleWatchLiveSyncEnabled`, `liveSyncStatusBar`, `disableLiveSyncForCurrentWorkout`, `LogWorkoutViewModel`, `LoggedWithWatch`, `vibrate`, `vibrateScheduler`, `enableVibrateFallback`, `AppState`, `handleAppStateChange`, `appStateChangeHandler`, `remoteNotificationReceived`, `PushNotificationsEnabled`, `global.cancelAllLocalNotification`, `superset_id`, `supersetId`, `supersetIdentityAsync`, `global.supersetColor`, `global.onRemoveFromSupersetPress`, `RNCAsyncStorage`.

**Symmetry** (`libapp.so`, split arm64-v8a):
`packages/active_training_session/lib/src/models/state/active_session.dart`, `.../models/snapshot/session_snapshot.dart`, `.../data/local/session_snapshot_codec.dart`, `.../data/mappers/active_session_draft_to_snapshot_mapper.dart`, `.../guided_session/mappers/guided_session_snapshot_mapper.dart`, `.../guided_session/data_providers/drift_active_session_context_store.dart`, `packages/persistence/lib/src/drift/tables/active_session_snapshots_table.dart`, `.../drift/daos/active_session_snapshot_dao.dart`, `.../drift/daos/active_session_context_dao.dart`, `.../drift/daos/active_session_media_dao.dart`, `ActiveSessionSnapshotDao`, `ActiveSessionSnapshotsCompanion`, `active_session_snapshots`, `active_session_sets`, `active_session_contexts`, `active_session_media_items`, `ActiveSessionRankSyncListener`, `OverloadAppliedStore`, `ActiveSessionDraft`, `ActiveSessionDraftExercise`, `ActiveSessionDraftSet`, `ActiveSessionDraftCodec`, `SessionSnapshot`, `SessionSnapshotCodec`, `rest_timer_cubit.dart`, `rest_timer_state.dart`, `rest_timer_state.freezed.dart`, `RestTimerCubit`, `RestTimerState.idle()`, `RestTimerState.running(remaining:`, `RestTimerIdle`, `anchored_remaining.dart`, `anchoredRemaining`, `rest_timer_overlay.dart`, `rest_timer_card.dart`, `clock_timer_modal.dart`, `clock_timer_action_button.dart`, `clock_timer_toggle_item.dart`, `timed_set_timer_badge.dart`, `minimized_rest_advance_listener.dart`, `timed_set_tick.dart`, `adjust_timed_set_seconds.dart`, `lead_in_countdown.dart`, `rest_end_alert.dart`, `rest_timer.notification.title`, `rest_timer.notification.body`, `vibrate_strong.dart`, `background_sound_player.dart`, `silent_mode_detector.dart`, `set_completion_sound_listener.dart`, `lockscreen/live_activity_tap_listener.dart`, `lockscreen/logged_set_confirmation.dart`, `voice_cues_ab_test/voice_cue_settings.dart`, `VoiceCue.restStart(restSeconds:`, `app_lifecycle_changes.dart`, `guided_workout_route_guard.dart`, `session_persistence_use_case.dart`, `populated_session_draft_builder.dart`, `workout_reminder_notification_router.dart`, `workout_reminder_listener.dart`, `retention_delivery_ledger.dart`, `superset_strip_block.dart`, `remove_from_superset_action.dart`, `superset_chips_row.dart`, `_SupersetBlockRows`, `SupersetSheetRow`, `supersetExerciseAddedEvent`, `supersetExerciseRemovedEvent`, `superset_exercise_added`, `buildAddToSupersetAction`, `set_type_selector_modal.dart`, `reconcile_session_set_kinds_use_case.dart`, `set_rpe.dart`, `advance_after_set_completion_use_case.dart`, `detect_personal_record_use_case.dart`.

**Cronos** (lectura de código): `src/components/ActiveWorkout.tsx:81, 690-712, 1495, 1496, 1481, 1484, 1597-1621, 1623-1652, 1668-1672, 1836-1851, 2212-2218`; `src/components/RestTimer.tsx:91-163`; `src/lib/workout/restTimer.ts:23-84`; `src/context/ActiveSessionContext.tsx:77-129`; `src/App.tsx:325-345`; `src/lib/offlineStore.ts:31-43, 106-161`; `src/lib/idb.ts:33-91`; `src/hooks/useOfflineSync.ts:67-101`; `src/hooks/useElapsedMs.ts:46-66`; `src/hooks/useLockoutCountdown.ts:51`; `src/components/ExerciseCarousel.tsx:1-107`; `src/lib/workout/restPreferences.ts:79-105`; `src/lib/import/sources.ts:90`; `package.json` (sin PWA).
