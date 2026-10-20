# Fase 1 — Modelo de datos: comparación Hevy · FitNotes · JEFIT · Symmetry · Cronos

**Alcance:** modelo de datos descompilado de las cuatro apps de referencia, auditado contra la implementación actual de `C:\Users\yayog\crono-gym`.

**Methodología.** Las cuatro entradas se descompilaron con `rea_decompile_apk` hacia `C:\Users\yayog\Downloads\decompiled\`. Los manifiestos se leyeron con `rea_inspect_manifest`. La extracción del esquema sigue la ruta que cada app impone:

| App | Runtime | Dónde vive el modelo de datos | Método de extracción |
|---|---|---|---|
| FitNotes | Kotlin + Room | Clases Java/Kotlin decompiladas | Lectura directa de las sentencias `CREATE TABLE` y de los DAO |
| Hevy | React Native + Hermes | Tabla de cadenas de `assets/index.android.bundle` (22 217 100 B) | Búsqueda de cadenas en el binario Hermes |
| JEFIT | Nativo Kotlin + Room + SQLCipher | Clases Java/Kotlin decompiladas | Lectura de entidades, DAOs y DTOs de red |
| Symmetry | Flutter + Dart AOT + Drift | `libapp.so` (29 688 752 B, split `arm64-v8a`) | Búsqueda de cadenas en el binario Dart AOT |

> **Caveat de método.** Hevy y Symmetry compilan su lógica a Hermes/Dart AOT: su modelo de datos **no es recuperable como código fuente**, solo como conjunto de cadenas (nombres de campo, claves de i18n, rutas de paquetes). Lo que se documenta abajo para esas dos apps es el **vocabulario de datos observado**, no una especificación completa. FitNotes y JEFIT sí exponen su esquema de forma literal y verificable.

---

## 1. FitNotes 25.1 — el único con esquema SQL legible

### 1.1 Arquitectura de persistencia

FitNotes **embarca el runtime de Room** pero **no usa anotaciones `@Entity` / `@Dao` / `@Database`**: una búsqueda de esas anotaciones sobre los 1 172 archivos de la aplicación devuelve **cero** coincidencias. La cadena detectada es:

- `androidx.room` presente en el manifiesto (`androidx.room.MultiInstanceInvalidationService`).
- `E\b.java` = `FrameworkSQLiteOpenHelper` (Room) — el helper de `SQLiteOpenHelper` de Room, con `setWriteAheadLoggingEnabled`, `onConfigure/onCreate/onUpgrade/onDowngrade` y `DatabaseErrorHandler` propio.
- `A\b.java` = `RoomMasterTable` — el helper que Room usa para escribir `INSERT OR REPLACE INTO room_master_table (id,identity_hash) VALUES(42, '…')`.
- `A\a.java` = `EntityInsertionAdapter` — el adaptador generado por Room.

Es decir: **Room como andamiaje de conexión, DAOs escritos a mano**. La capa de datos real está en el paquete ofuscado `X`, donde cada clase es un `*Table.java` original (los nombres sobreviven en los comentarios `JADX INFO: compiled from:`):

| Clase ofuscada | Original | Tabla |
|---|---|---|
| `X\C0284w` | `ExerciseTable.java` | `exercise` |
| `X\J0` | `TrainingLogTable.java` | `training_log` |
| `X\C0259j` | `CategoryTable.java` | `Category` |
| `X\W0` | `WorkoutGroupTable.java` | `WorkoutGroup` |
| `X\P0` | `WorkoutGroupExerciseTable.java` | `WorkoutGroupExercise` |
| `X\C0268n0` | `RoutineTable.java` | `Routine` |
| `X\C0260j0` | `RoutineSectionTable.java` | `RoutineSection` |
| `X\C0250e0` | `RoutineSectionExerciseTable.java` | `RoutineSectionExercise` |
| `X\Z` | `RoutineSectionExerciseSetTable.java` | `RoutineSectionExerciseSet` |
| `X\C0265m` | `CommentTable.java` | `Comment` |
| `X\Y0` | `WorkoutTimeTable.java` | `WorkoutTime` |
| `X\B` | `GoalTable.java` | `Goal` |
| `X\Q` | `PlateTable.java` | `Plate` |
| `X\C0245c` | `BarbellTable.java` | `Barbell` |
| `X\K` | `MeasurementTable.java` | `Measurement` |
| `X\D` | `MeasurementRecordTable.java` | `MeasurementRecord` |
| `X\M` | `MeasurementUnitTable.java` | `MeasurementUnit` |
| `X\C0251f` | `BodyWeightTable.java` | `BodyWeight` |
| `X\C0273q` | `ExerciseGraphFavouriteTable.java` | `ExerciseGraphFavourite` |
| `X\X` | `RepMaxGridFavouriteTable.java` | `RepMaxGridFavourite` |
| `X\C0270o0` | `SettingsTable.java` | `settings` |

El DAO base es `X\AbstractC0249e<T>`, con el contrato: `B()` → nombre de tabla, `y()` → mapper `ContentValues`, `z()` → clase del modelo, y un envoltorio transaccional `x(callback)`.

### 1.2 Esquema SQL literal (verificado)

```sql
-- Catálogo de ejercicios
CREATE TABLE exercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  category_id INTEGER NOT NULL, exercise_type_id INTEGER NOT NULL DEFAULT 0,
  notes TEXT, weight_increment INTEGER, default_graph_id INTEGER,
  default_rest_time INTEGER, weight_unit_id INTEGER NOT NULL DEFAULT 0,
  is_favourite INTEGER NOT NULL DEFAULT 0);

-- Registro de series (el heart del modelo)
CREATE TABLE training_log(_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL,
  date DATE NOT NULL, metric_weight INTEGER NOT NULL, reps INTEGER NOT NULL,
  unit INTEGER NOT NULL DEFAULT 0, routine_section_exercise_set_id INTEGER NOT NULL DEFAULT 0,
  timer_auto_start INTEGER NOT NULL DEFAULT 0, is_personal_record INTEGER NOT NULL DEFAULT 0,
  is_personal_record_first INTEGER NOT NULL DEFAULT 0, is_complete INTEGER NOT NULL DEFAULT 0,
  is_pending_update INTEGER NOT NULL DEFAULT 0, distance INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0);

-- Plan (plantilla)
CREATE TABLE Routine(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, notes TEXT);
CREATE TABLE RoutineSection(_id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER NOT NULL,
  name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT '0');
CREATE TABLE RoutineSectionExercise(_id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_section_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0, populate_sets_type INTEGER NOT NULL DEFAULT 0);
CREATE TABLE RoutineSectionExerciseSet(_id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_section_exercise_id INTEGER NOT NULL, metric_weight INTEGER NOT NULL,
  reps INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  distance INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0,
  unit INTEGER NOT NULL DEFAULT 0);

-- Ejecución (sesión real)
CREATE TABLE WorkoutGroup(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  date TEXT NOT NULL, colour INTEGER NOT NULL, routine_section_id INTEGER,
  auto_jump_enabled INTEGER NOT NULL DEFAULT 1, rest_timer_auto_start_enabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE WorkoutGroupExercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL,
  date TEXT NOT NULL, routine_section_id INTEGER NOT NULL, workout_group_id INTEGER NOT NULL);

CREATE TABLE Category(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  colour INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE Comment(_id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL,
  owner_type_id INTEGER NOT NULL, owner_id INTEGER NOT NULL, comment TEXT NOT NULL);
CREATE TABLE WorkoutComment(_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, comment TEXT NOT NULL);
CREATE TABLE Goal(_id INTEGER PRIMARY KEY AUTOINCREMENT, type_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL, metric_weight INTEGER NOT NULL, reps INTEGER NOT NULL,
  unit INTEGER NOT NULL, title TEXT, target_date TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  distance INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0, start_date TEXT);
CREATE TABLE Barbell(_id INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL NOT NULL,
  unit INTEGER NOT NULL DEFAULT 0, exercise_id INTEGER NOT NULL DEFAULT 0);
CREATE TABLE Plate(_id INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL NOT NULL,
  unit INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0, colour INTEGER NOT NULL DEFAULT 0,
  width_ratio REAL NOT NULL DEFAULT 1, height_ratio REAL NOT NULL DEFAULT 1);
CREATE TABLE Measurement(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  unit_id INTEGER NOT NULL DEFAULT 0, goal_type INTEGER NOT NULL DEFAULT 0,
  goal_value REAL NOT NULL DEFAULT 0, custom INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE MeasurementRecord(_id INTEGER PRIMARY KEY AUTOINCREMENT, measurement_id INTEGER NOT NULL,
  date TEXT NOT NULL, time TEXT NOT NULL, value REAL NOT NULL, comment TEXT);
CREATE TABLE MeasurementUnit(_id INTEGER PRIMARY KEY AUTOINCREMENT, type INTEGER NOT NULL DEFAULT 0,
  long_name TEXT NOT NULL, short_name TEXT NOT NULL);
CREATE TABLE BodyWeight(_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  body_weight_metric REAL NOT NULL, body_fat REAL NOT NULL, comments TEXT);
CREATE TABLE ExerciseGraphFavourite(_id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL, graph_type_id INTEGER NOT NULL DEFAULT 0,
  time_period INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0);
CREATE TABLE RepMaxGridFavourite(_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_ids TEXT NOT NULL,
  rep_counts TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE WorkoutTime(_id INTEGER PRIMARY KEY AUTOINCREMENT, workout_date TEXT NOT NULL,
  start_date_time TEXT NOT NULL, end_date_time TEXT NOT NULL);
```

`settings` es una **tabla de una sola fila** con ~45 columnas (`metric`, `first_day_of_week`, `weight_increment`, `body_weight_increment`, `estimated_1rm_max_reps_to_include`, `estimated_1rm_max_apply_to_graph`, `track_personal_records`, `mark_sets_complete`, `auto_select_next_set`, `rest_timer_seconds`, `rest_timer_vibrate/sound/volume/auto_start`, `graph_*`, `analysis_*`, `workout_timer_auto_start/stop`, `home_screen_limit_*`, `app_theme_id`, …).

### 1.3 Rasgos de diseño de FitNotes

**a) Separación plan / ejecución.** Es la decisión estructural más importante y no la tiene Cronos. La *plantilla* es `Routine → RoutineSection → RoutineSectionExercise → RoutineSectionExerciseSet` (4 niveles). La *ejecución* es `WorkoutGroup → WorkoutGroupExercise → training_log` (3 niveles). El puente es `training_log.routine_section_exercise_set_id`: cada serie registrada apunta a la serie de la rutina que originó, y `WorkoutGroupExercise` conserva `routine_section_id`. Una rutina puede así tener varias secciones (días) y una sesión puede materializar una sección concreta.

**b) Sistema de tipos de ejercicio.** `exercise.exercise_type_id` + `ExerciseType` (`WEIGHT_AND_REPS`, `WEIGHT_AND_TIME`, `DISTANCE_AND_TIME`) y `ExerciseField` (`WEIGHT`, `REPS`, `DISTANCE`, `TIME`). Cambiar el tipo de un ejercicio **destruye los campos que ya no aplican**: `ExerciseTable.Y()` pone a cero `metric_weight`/`reps`/`distance`/`duration_seconds` en `training_log` y `RoutineSectionExerciseSet` para los campos perdidos. Es una decisión fuerte — el tipo de ejercicio es parte de la identidad del ejercicio, no una etiqueta mutable.

**c) Doble modelo de peso.** `metric_weight` (kg) + `unit` (0 = kg, 1 = lbs) por serie, con `exercise.weight_unit_id` como unidad preferida. La conversión ocurre **al escribir**, con factors literales `2.20462` (kg→lbs) y `0.45359290943563974` (lbs→kg), y propaga en cascada a `training_log`, `RoutineSectionExerciseSet` y `Goal`.

**d) PR desnormalizado y recalculado.** `training_log.is_personal_record` y `is_personal_record_first` son banderas que `TrainingLogTable.Q2(exerciseId)` recomputa en cada guardado de una serie de ese ejercicio, reevaluando `is_personal_record = 1 AND ROUND(metric_weight,2) <= newWeight AND reps <= newReps`. El PR es un valor materializado, no una vista.

**e) Analítica en SQL, no en la aplicación.** El DAO de `training_log` emite agregados con alias tipados: `TotalVolume` (`SUM(metric_weight*reps)`), `TotalReps`, `TotalSets` (`COUNT(*)`), `TotalWeight`, `TotalDistance` (con `CASE` sobre `unit` para metros/km/pies/millas), `TotalDuration` (`SUM(duration_seconds)`), `TotalWorkouts` (`COUNT(DISTINCT date)`), `TotalDistance` con velocidad derivada (`distance / (duration_seconds * 1.0)`). Los *breakdowns* por ejercicio y por categoría son `GROUP BY … HAVING value > 0 ORDER BY value DESC` con porcentaje calculado en el DAO.

**f) 1RM estimado (Epley) como expresión SQL.** `TrainingLogTable` construye `one_rep_max` como alias sobre `MAX(metric_weight / reps)`-equivalente (`R0.i.e(str + "metric_weight", str + "reps")`), y `E0()` devuelve la serie de máximo por fecha con ese 1RM calculado en SQL.

**g) Migraciones purely aditivas.** `V\c.java` contiene **29 sentencias `ALTER TABLE … ADD COLUMN`**, ninguna recreación de tabla. El esquema evoluciona por columnas nuevas.

**h) RPE: AUSENTE.** Búsqueda de `\brpe\b|\brir\b|exertion|perceivedEffort` sobre los 1 172 archivos de la aplicación: **cero coincidencias**. FitNotes no tiene concepto de esfuerzo percibido. Su noción de intensidad es exclusivamente el peso y las repeticiones.

**i) Comentarios polimórficos.** `Comment` con `owner_type_id` + `owner_id` (se observa `owner_type_id = 1` para `training_log`), lo que permite adjuntar comentarios a cualquier entidad sin una tabla puente por tipo.

---

## 2. Hevy 3.1.16 — React Native / Hermes

### 2.1 Arquitectura

Del manifiesto y del árbol de `lib/arm64-v8a`:

- **Motor JS:** React Native sobre Hermes (`libhermes.so`, `libhermes` + `libreactnative.so`, `libreanimated.so`, `libworklets.so`, `librnscreens.so`, `libgesturehandler.so`, `libjsi.so`, `libappmodules.so`).
- **Bundle:** `assets/index.android.bundle` — 22 217 100 bytes, bytecode Hermes.
- **Estado:** MobX (`mobx.array`, `MOBX_DEVTOOLS_GLOBAL_HOOK`, `mobx-configuration`).
- **Validación:** Zod (`ZodBoolean`, `ZodObject`, `applyZodErrorsToEvent`).
- **Persistencia local:** **AsyncStorage**. Sin base de datos SQL local: no hay `watermelon`, `drizzle`, `prisma`, `dexie`, `realm`, `nozbe`, `op-sqlite`, `expo-sqlite` ni `react-native-sqlite` en el bundle.
- **Sincronización:** servidor-autoritativo con cola de pendientes (`global.workoutsWithPendingRequests`, `UnsyncedRoutinesStore`, `CurrentUserRoutineStore`).
- **Superficie nativa:** 9 *widgets* Glance (streak, rest, calendar_stats, weekly_stats, day_routine, last_routines, last_workouts, calendar, quick_access, chart), Health Connect, Wear OS (`WearListenerService`, `wearable.log`), ML Kit (código de barras), VisionCamera, Imgly PESDK/VE.SDK, Sentry, Branch, Adjust, Firebase, RevenueCat, Facebook SDK.
- **Deep links:** `hevy://`, `hevyapp.app.link`, `hevy.com/routine|folder|workout|user|program|deeplink`.

### 2.2 Vocabulario de datos observado

| Grupo | Cadenas verificadas en el bundle |
|---|---|
| Sesión | `workout_id`, `workout_name`, `workout_title`, `workout_count`, `workout_duration_minutes`, `workout_start_seconds`, `workout_start_time_unix`, `workoutSource` |
| Resumen | `workoutSummary.distance`, `workoutSummary.reps`, `workoutSummary.volume`; `workoutSummaryCell.valueIndicator.calories`, `.valueIndicator.records`, `.exerciseSetCount.plural/singular`, `.comment.count.plural/singular`, `.like.plural/singular`, `.hiddenExercises.plural/singular` |
| Serie | `set_index`, `reps`, `weight_kg`, `rpe`, `superset_id`, `set_type` |
| Rutina | `exerciseTemplateIds`, `CurrentUserRoutineStore.routines`, `routineCategories`, `UnsyncedRoutinesStore` |
| Catálogo | `muscle_group`, `localized_muscle_group_name`, `simplifiedMuscleGroups`, `muscleGroupMap`, `machines`, `barbells` |
| Derivados | `workoutToHistoryWorkout`, `workoutToVolumeCalculableWorkout`, `workoutToCrunchableWorkout` |
| Visibilidad | `workoutVisibilityModal.option.everyone`, `.followers`, `.private`, `.private.coach` |
| PR | `exerciseDetail.personalRecords.repsOnly.totalReps.title` |
| Extras | `plate_calculator`, `migrate-trainer-equipments-to-granular_equipments`, `workoutSettings.option.warmupSets.*` |

### 2.3 Rasgos de diseño de Hevy

- **Per-set RPE (`rpe`) y per-set `set_type`**: Hevy persiste el tipo de serie y el esfuerzo percibido **en la serie**, no en la sesión.
- **`superset_id`**: agrupa series en super-series. Es un identificador *en la serie*, no una tabla aparte.
- **Unidad canónica: kg.** `weight_kg` — el prefijo de unidad está en el nombre del campo.
- **`set_index`**: la posición de la serie dentro del ejercicio empieza en 0 (a diferencia del `set_number` 1-based de Cronos).
- **Social de primer orden:** visibilidad (público / seguidores / privado / privado-con-entrenador), likes, comentarios,有线,"You followed/accepted my invite", contadores de seguidores, *leaderboards* (`ShareableLeaderboard`, `shareable.volumeCompare`).
- **Rutinas como plantillas con ejercicios reutilizables:** `exerciseTemplateIds` apunta a plantillas de ejercicio, no a identificadores de catálogo directo.

---

## 3. JEFIT 17.0.1 — nativo, Room cifrado con SQLCipher

### 3.1 Arquitectura

- **Room + SQLCipher.** `je.fit.data.room` contiene `ChaChaDecryptor`, `KeyDecryptor`, `KeyProvider`, `PassphraseManager` y `EncryptedDatabaseMigrationsKt` — la base local está **cifrada en reposo**.
- **Base de datos:** `MobileOnlyDatabase` (nombre real: **`jefit_prodRelease`**, leído del `@Metadata` de Kotlin), que expone **únicamente** `workoutReminderDao`. Es una base **de referencia**, no la de entrenamiento.
- **Red:** Retrofit + OkHttp; Firebase; AppsFlyer; Play Billing.
- **DTOs de red** en `je.fit.data.model.network` (~100 clases): `ExerciseLogsBodyPartDto`, `GenerateMesocyclePlanDataResponse`, `GenerateMixModeWorkoutResponse`, `AnalyticsReport`, `AccountInfoResponse`, `ContestRoutineResponse`, `ChallengeResponse`, `ShareableWorkoutResponse`, …

### 3.2 Entidades Room (paquete `je.fit.data.room.entity`)

`EquipmentTypesEntity`, `ExerciseEquipmentMapEntity`, `ExerciseFocusAreaJointMapEntity`, `ExerciseMovementPatternEntity`, `ExerciseMuscleInvolvementMapEntity`, `ExerciseTrainingTypeMapEntity`, `JointEntity`, `MovementPatternEntity`, `MuscleGroupsEntity`, `TrainingTypeEntity`, `WorkoutReminderEntity`.

DAOs correspondientes en `je.fit.data.room.dao`: `EquipmentTypesDao`, `ExerciseEquipmentMapDao`, `ExerciseFocusAreaJointMapDao`, `ExerciseMovementPatternDao`, `ExerciseMuscleInvolvementMapDao`, `ExerciseTrainingTypeMapDao`, `JointDao`, `MovementPatternMapDao`, `MuscleGroupsDao`, `TrainingTypeDao`, `WorkoutReminderDao`.

Migraciones verificadas:

```sql
CREATE TABLE IF NOT EXISTS `movement_patterns`(
  `id` INTEGER NOT NULL, `common_name` TEXT NOT NULL, `details` TEXT NOT NULL, PRIMARY KEY(`id`));
CREATE TABLE IF NOT EXISTS `exercise_movement_pattern`(
  `exercise_id` INTEGER NOT NULL, `movement_pattern_id` INTEGER NOT NULL,
  `involvement_percent` REAL NOT NULL, PRIMARY KEY(`exercise_id`, `movement_pattern_id`));
```

### 3.3 Modelo de datos de entrenamiento (sincronizado con el servidor, no Room)

`je.fit.data.model.local.ExerciseLogsDto`:

| Campo | Tipo | Nota |
|---|---|---|
| `id` | int | PK |
| `myDate` | String | fecha de la sesión |
| `exerciseId` / `exerciseName` | int / String | ejercicio |
| `logs` | String | **payload JSON** de las series |
| `setLogs` | `List<ExerciseSetLog>` | **series desnormalizadas en memoria** |
| `record` / `recordType` | double / int | **PR** con su tipo |
| `belongSession` / `belongSys` | int | pertenencia a sesión / al catálogo del sistema |
| `dayItemId` | int | ítem de día de la rutina |
| `logTime` | int | marca temporal |
| `editTime` | int | marca de edición (sync) |
| `intervalLogs` | String | logs de series |
| `exerciseLogsExtra` / `exerciseLogCardio` | DTO | extensions cardio y extras |

`ExerciseSetLog`:

| Campo | Tipo | Nota |
|---|---|---|
| `id` | int | PK |
| `exerciseLogId` | int | FK al log de ejercicio |
| `setIndex` | int | posición de la serie |
| `weightLbs` | Double | **unidad: libras** |
| `reps` | Integer | |
| `duration` | Integer | segundos (cardio) |
| `distanceMi` | Double | **millas** |
| `speedMph` | Double | |
| `laps` | Double | |
| `calories` | Double | |
| `setType` | String | **tipo de serie** |
| `logTime` | int | |

Otros modelos: `Routine` (`id`, `name`, `description`, `bannerCode`, `dayCount`, `dayType`, `difficulty`, `editTime`, `focus`, `routineDatabaseId`), `SupersetItem`, `Notes`, `ChartMetric`, `ChartTimeMode`, `FavoriteChart`, `ExerciseGoalAddModel`, `MovementPattern`, `InjuryModel`, `WorkoutReminder`, `AssessmentLog`, `Achievement`, `UserPoints`, `CustomExercise`, `Setting`, `Profile`, `SyncRecord`, `DeleteTracking`.

Mappers: `ExerciseLogsMapper`, `NotesMapper`, **`SetTypeMapper`**, `StrengthHistoryMapper`, `WorkoutDayExerciseMapper`, `SettingsMapper`.

### 3.4 Rasgos de diseño de JEFIT

- **Unidad imperial en el dato persistido:** `weightLbs`, `distanceMi`, `speedMph`. La conversión a métrico es responsabilidad de la capa superior.
- **`record` + `recordType` en la fila de ejercicio**, no en la serie: el PR vive a nivel de ejercicio-sesión, tipado.
- **Tipo de serie por serie** (`setType` con su mapper dedicado).
- **Modelo muscular porcentual:** `exercise_movement_pattern.involvement_percent` es un número real por (ejercicio, patrón de movimiento) — el único de las cuatro apps que cuantifica la implicación muscular en lugar de nombrarla.
- **Cifrado en reposo de la base local** — relevante para un producto que guarda historia de salud.
- **Sync con marcas de edición y borrado** (`editTime`, `DeleteTracking`, `SyncMode`, `SyncRecord`): un modelo de sincronización explícito, no un borrado en cascada.
- **RPE/esfuerzo presente pero calculado en el servidor:** `GetExertionScoreResponse` es un DTO de red, no una columna local — el usuario no captura esfuerzo por serie.

---

## 4. Symmetry 7.16.0 — Flutter + Dart AOT + Drift

### 4.1 Arquitectura

- **Flutter/Dart AOT:** `libapp.so` (29 688 752 B), `libflutter.so`, `libsqlite3.so`, `librive_native.so`, `libdartjni.so`, `libjnidispatch.so`, `libuniffi_cel.so`.
- **Persistencia:** **Drift** (ORM SQLite de Dart) + `sqflite_common` + `libsqlite3.so` nativo. `CREATE TABLE IF NOT EXISTS ` aparece en el binario, generado por Drift.
- **Licencia:** PairIP (`com.pairip.application.Application`, `com.pairip.licensecheck.LicenseActivity`).
- **Servicios:** Firebase (App Check, Crashlytics, Remote Config, Messaging, Storage, Sessions, Analytics, AB Testing), PostHog, Superwall (paywall), RevenueCat, Facebook/Apple Sign-In, Health Connect, Flutter Live Activities, camerawesome, wakelock_plus, Rive.
- **Estructura modular** (rutas de paquetes Dart en el binario): `package:symmetry/packages/active_training_session/`, `package:symmetry/packages/historic_training_data/`, `package:symmetry/packages/training_history/`, `package:symmetry/packages/exercise_catalog_module/`, `package:symmetry/packages/intelligence/`, `package:symmetry/packages/starting_load/`, `package:symmetry/packages/predefined_workout_plans/`, `package:symmetry/bodyscan/`, `package:symmetry/social_media/`, `package:symmetry/onboarding/`, `package:symmetry/auth/`, `package:symmetry/user/`, `package:symmetry/billing/`, `package:symmetry/training/`.

### 4.2 Vocabulario de datos observado

| Grupo | Cadenas verificadas en `libapp.so` |
|---|---|
| Serie | `exercise_set`, `set_type`, `rpe`, `superset`, `notes` |
| Entrada | `exercise_id`, `workout_id` |
| PR | `is_pr`, `personal_record`, `RankRevealNumbersEntity(bestSetWeightKg: …)` |
| Offline | `ActiveSessionDraftExercise`, `pending_workout_edit.dart`, `OverloadAppliedStore`, `NotifyTablesUpdated`, `RoutinesOfflineHandlersRegistrar`, `last_session_set_query.dart` |
| Carga | `oneRm`, `percentOfOneRepMax`, `heavyKgHundredths`, `starting_load` |
| UI de esfuerzo | `rpe_panel_next`, `updateSetTypeUseCase`, `sets_grid_header.dart` |
| Sesión | `complete_training_session_handler.dart`, `completed_session_media_item.dart` |
| Others | `ExerciseWithoutVolume`, `WeightEntriesTable`, `exercise_history`, `WriteWorkoutData` |

### 4.3 Rasgos de diseño de Symmetry

- **Offline-first de verdad:** el borrador de sesión activa es una entidad de primera clase (`ActiveSessionDraftExercise`), las ediciones pendientes se versionan aparte (`pending_workout_edit.dart`), y Drift notifica a los observadores (`NotifyTablesUpdated`).
- **Precisión de carga con centésimas:** `heavyKgHundredths` — el kilogramo con dos decimales se almacena como entero, evitando el error de coma flotante en pesas pesadas. **Cronos usa `numeric` en Postgres**, que ya es exacto, pero su capa local (`SetEntry.weight`) es un **string**, lo que es la versión de客户端 de la misma decisión.
- **PR por serie** (`is_pr`) y **ranking de la serie** (`RankRevealNumbersEntity` con `bestSetWeightKg`).
- **RPE con panel dedicado** (`rpe_panel_next`) y tipo de serie editable (`updateSetTypeUseCase`).
- **Super-series** (`superset`).
- **Catálogo analítico de fuerza** (`starting_load`, `percentOfOneRepMax`) con estimates de 1RM.

---

## 5. Cronos — implementación actual

### 5.1 Auditoría de `src/`

| Carpeta | Archivos | LOC |
|---|---:|---:|
| `components/` | 162 | 48 445 |
| `lib/` | 136 | 29 200 |
| `hooks/` | 30 | 5 272 |
| `design/` | 6 | 3 078 |
| `data/` | 5 | 1 108 |
| `context/` | 4 | 645 |
| `types/` | 1 | 662 |
| raíz (`App.tsx`, `main.tsx`, `index.css`) | 3 | 448 |
| `workers/` | 1 | 144 |
| `services/` | 1 | 128 |
| `test-support/` | 1 | 42 |
| **Total** | **350** | **89 172** |

De los 350 archivos, **129 son tests (31 357 LOC, 35 % del total)**. La densidad de pruebas es alta y está bien distribuida por módulo (`lib/**` es casi todo lógica pura testeada; `components/**` tiene tests junto a cada vista).

Distribución de conceptos clave en `src/` (conteo de coincidencias):

| Concepto | Ocurrencias | Concepto | Ocurrencias |
|---|---:|---|---:|
| `rpe` | 61 | `body_part` | 93 |
| `plate` | 87 | `volume` | 87 |
| `progression` | 42 | `estimated` (1RM Epley) | 19 |
| `RIR` | 12 | `Plateau` | 6 |
| `tempo` | 4 | **`superset`** | **0** |
| `muscle_group` | 1 | | |

### 5.2 Modelo de datos del servidor (Supabase / Postgres)

`supabase/schema.sql` (línea base) + 6 migraciones. Tablas effective:

| Tabla | Columnas | RLS |
|---|---|---|
| `exercises` | `id text PK`, `name`, `body_part`, `target`, `equipment`, `gif_url`, `instructions text[]` | `select` a `authenticated` |
| `routines` | `id uuid PK`, `user_id`, `title`, `description`, `created_at`, `is_favorite`, `source` (`user`\|`human_coach`\|`ai`), `authored_by_coach` | crud propio |
| `routine_exercises` | `id uuid PK`, `routine_id`, `exercise_id`, `target_sets`, `rest_seconds`, `order_index`, `day_index`, `day_label`, `target_reps_min`, `target_reps_max` | crud propio vía `routines` |
| `workout_logs` | `id uuid PK`, `user_id`, `routine_id`, `started_at`, `completed_at`, `journal_notes` | crud propio |
| `completed_sets` | `id uuid PK`, `log_id`, `exercise_id`, `set_number`, `weight numeric`, `reps int`, `rpe numeric`, `is_warmup bool`, `notes text` (≤2000) | crud propio vía `workout_logs` |
| `profiles` | `user_id PK`, `display_name`, `birth_date`, `sex`, `height_cm`, `weight_kg`, `unit_system`, `experience_level`, `activity_level`, `goal`, `guardian_consent_at`, `onboarding_completed_at`, `created_at`, `updated_at`, `is_premium`, `premium_since`, `premium_expires_at` | — |
| `bodyweight_entries` | `id`, `user_id`, `measured_on`, `weight_kg`, `note`, `created_at` | — ⚠️ **DDL ausente** |
| `body_measurements` | `id`, `user_id`, `measured_on`, `chest/waist/hips/arm/thigh/calf/shoulder_cm`, `body_fat_pct`, `note`, `created_at` | — ⚠️ **DDL ausente** |
| `session_checkins` | `id`, `user_id`, `workout_log_id`, `checked_on`, `energy`, `motivation`, `soreness`, `stress`, `sleep_hours`, `notes`, `created_at` | — ⚠️ **DDL ausente** |
| `coaches` | `id`, `user_id`, `display_name`, `pin_hash`, `is_provisional`, `is_active`, `is_available`, `specialties[]`, `created_at`, `updated_at` | solo `is_available` escribible |
| `coach_login_attempts` | `coach_id`, `attempted_at`, `succeeded` | RLS sin policy (service role) |
| `coach_session_requests` | `id`, `athlete_id`, `coach_id`, `status`, `athlete_notes`, `created_at`, `updated_at` | multi-actor |
| `coach_messages` | `id`, `request_id`, `sender_id`, `sender_role`, `content`, `created_at` | multi-actor |
| `coach_usage` / `coach_rate_limits` | cuotas de la Edge Function | propio |

**Migraciones:** `20261003000000_routine_favorites.sql` (índice parcial de favoritos), `20261003010000_profiles_premium.sql`, `20261003020000_coach_human.sql` (coaches + solicitudes + mensajes), `20261003030000_coach_portal.sql` (RLS de lectura de atleta por coach + `day_index`/`day_label`/`target_reps_min|max` + índices), `20261003040000_exercise_hub_notes.sql` (`completed_sets.notes` + índice parcial `idx_completed_sets_exercise_id … where is_warmup = false`).

### 5.3 Modelo de datos local (IndexedDB `cronos-offline`, v5)

| Store | keyPath | Índices | Uso |
|---|---|---|---|
| `drafts` | `logId` | — | borrador de sesión en curso |
| `queue` | `id` | `createdAt` | operaciones de sync pendientes |
| `rankHistory` | `id` | `day`, `slug` | línea temporal de rangos |
| `lastRanks` | `slug` | — | entrada de histéresis |
| `coachChats` | `id` | — | log diario del asistente |
| `exerciseNotes` | `setId` | `exercise_id` | ⚠️ **declarado y no usado** (ver §6) |
| `localState` | `key` | — | rol local, flags de feature, contexto, consentimiento |

Todo el acceso degrada a `null` en cualquier fallo (IndexedDB ausente, upgrade bloqueado, cuota agotada): registrar una serie nunca puede ser lo que rompe un entrenamiento.

### 5.4 Modelo en tiempo de ejecución y frontera de persistencia

`src/lib/workout/types.ts` → `SetEntry`:

```ts
interface SetEntry {
  set_number: number;
  weight: string;   // string, no number
  reps: string;     // string, no number
  rpe: string;      // string, no number
  kind: SetKind;    // "normal" | "warmup" | "failure" | "drop"
  completed: boolean;
  notes?: string | null;
}
```

`SetKind` es un **discriminante único** en lugar de banderas booleanas por especialización — decisión explícita y documentada: tres banderas independientes admitirían estados inexistentes (una serie a la vez de calentamiento *y* de drop) y nada lo detectaría.

`is_warmup` se **deriva** de `kind` en la frontera de persistencia (`setKind.ts:toWarmupColumn`), y el tipo rico se detiene ahí: la columna `is_warmup` es booleana y `drop`/`failure` **no tienen columna**.

El parsing ocurre **una sola vez**, en `ActiveWorkout.finish()`, y en ningún otro sitio.

### 5.5 Sincronización

`src/lib/sessionSync.ts` — operación `finalize_session`:

1. `upsert` de `workout_logs` sobre el **id generado por el cliente** → reintentar es idempotente por construcción.
2. `delete` de los `completed_sets` de ese `log_id`.
3. `insert` del payload completo de series.
4. `notifyTrainingDataChanged()` — se dispara al final, después de que los datos existen.

La cola es **de dispositivo, no de usuario**; cada payload lleva su `userId` y `pushSession` rechaza un payload cuyo `userId` no coincida con la sesión autenticada ("Esta sesión pertenece a otra cuenta"). El drenaje es de más antiguo a más reciente, una operación a la vez, con clasificación de errores reintentables (red/timeout/502/503/504) frente aterminales.

### 5.6 Adaptadores de importación

`src/lib/import/sources.ts` — `IMPORT_SOURCES = ["hevy", "strong", "generic"]`.

`CANONICAL_FIELDS = ["date", "title", "exercise", "weight", "reps", "rpe", "setNumber", "setType", "notes"]`.

Tablas de alias por fuente, con **coincidencia exacta** sobre el header normalizado (minúsculas, sin acentos, no-alfanuméricos colapsados a `_`). La razón está documentada en el archivo: `workout_rpe` *contiene* `rpe`, `weight_kg` contiene `weight`, `set_type` contiene `type`; una coincidencia por subcadena asignaría el RPE promedio de sesión de Strong a la columna de RPE por serie y el peso total de sesión a la de peso por serie, **sin que el import fallara y con cada serie equivocada**.

Detección de fuente: `superset_id` / `rest_seconds` / `exercise_notes` → Hevy; `set_order` / `workout_name` → Strong; `weight_kg` + `set_index` → Hevy; resto → genérico.

Pesos: **siempre kg** en el import, con conversión en el borde (`ImportSet.weightKg`).

---

## 6. Matriz comparativa

### 6.1 Modelo de datos

| Eje | **FitNotes 25.1** | **Hevy 3.1.16** | **JEFIT 17.0.1** | **Symmetry 7.16.0** | **Cronos (actual)** |
|---|---|---|---|---|---|
| Runtime | Kotlin + Room (plumbing) | React Native + Hermes | Kotlin nativo + Room | Flutter + Dart AOT | React 18 + Vite + TS |
| Persistencia | SQLite local, DAOs a mano | **Sin BD local** (AsyncStorage) | SQLite **cifrado** (SQLCipher) | SQLite vía **Drift** | Postgres (Supabase) + IndexedDB |
| Autoridad del dato | Local | **Servidor** | Servidor | Local-first, sync | Servidor, cola offline |
| Catálogo de ejercicios | Tabla `exercise` propia | Servidor | Tablas Room de referencia | Módulo `exercise_catalog_module` | `exercises` (1 324 filas, seed servidor) |
| Modelo muscular | `category_id` | `muscle_group` | `involvement_percent` (REAL) | `muscle_group` | `body_part` + `target` + `muscle_group` (solo en el JSON local) |
| **RPE por serie** | ❌ **ausente** | ✅ `rpe` | ⚠️ sólo servidor (`GetExertionScoreResponse`) | ✅ panel de RPE | ✅ `completed_sets.rpe numeric` |
| **Tipo de serie** | ❌ | ✅ `set_type` | ✅ `setType` + `SetTypeMapper` | ✅ `updateSetTypeUseCase` | ⚠️ `kind` en cliente, **no persistido** (sólo `is_warmup`) |
| **Super-series** | ❌ | ✅ `superset_id` | ✅ `SupersetItem` | ✅ `superset` | ❌ **0 ocurrencias** |
| Unidad de peso | `metric_weight` + `unit` | `weight_kg` | **`weightLbs`** | kg con centésimas (`heavyKgHundredths`) | `weight numeric` (kg) |
| Distancia / cardio | `distance` + `unit` + `duration_seconds` | `distance_meters`, `duration_seconds` | `distanceMi`, `speedMph`, `duration` | `duration` | ❌ **no en el modelo** (`ImportSet` los tiene, la BD no) |
| **PR** | `is_personal_record` + `_first` en la serie | `personalRecords` | `record` + `recordType` | `is_pr` | 1RM Epley calculado en cliente |
| 1RM | SQL (alias `one_rep_max`) | — | — | `oneRm`, `percentOfOneRepMax` | `estimateOneRepMax` (Epley, ≤10 reps) |
| **Plan vs ejecución** | ✅ 4 niveles + 3 niveles, enlazados | `exerciseTemplateIds` | `Routine.dayCount` + `dayItemId` | `workout_plans` + `predefined_workout_plans` | ⚠️ 2 niveles (`routines` → `routine_exercises` con `day_index`/`day_label`) |
| **RPE como gobernador** | ❌ | ❌ | ❌ | ❌ | ✅ **única app que lo usa**: `overload.ts` — RIR = 10 − RPE decide la progresión |
| Progresión / deload | ❌ | ❌ | `GenerateMesocyclePlanDataResponse` | `starting_load`, `OverloadAppliedStore` | ✅ `overload.ts` (doble progresión + deload a 3 estancamientos) |
| **Notas por serie** | `Comment` polimórfico (`owner_type_id`) | `description` / `exercise_notes` | `Notes` | `notes` | ✅ `completed_sets.notes` (≤2000) + chips |
| Comentarios en serie | ✅ genéricos | ✅ sociales (likes, comentarios) | ❌ | ✅ (`social_media`) | ❌ |
| Visibilidad social | ❌ | ✅ 4 niveles | ✅ (privado / amigos / coaches) | ✅ | ❌ |
| Cifrado local | ❌ | ❌ | ✅ **SQLCipher** | ❌ | ❌ |
| Recuperación ante fallo | ❌ | ❌ | ❌ | ❌ | ✅ **todo degrada a `null`** |

### 6.2 Compuestos de la matriz — el ordenamiento real

1. **Cronos es la única de las cinco con RPE como motor de decisión, no como campo.** En las otras cuatro, el RPE es (o no es) un dato que se registra. En Cronos, `overload.ts` deriva RIR = 10 − RPE y usa el RIR para decidir si una sesión *ganó* el derecho a subir carga, y trata tres sesiones estancadas como señal de deload. Es la señal más valuable del set y la única cuyo uso no está copiado de una referencia.
2. **Cronos es la única con degradación a `null` en toda la capa de persistencia.** Ninguna de las cuatro referencias tiene un contrato "registrar una serie nunca puede fallar". Es una ventaja de diseño propia, no derivada.
3. **Cronos es la única con idempotencia por diseño en el sync** (id generado por el cliente + upsert + borrado + inserción). Las otras cuatro sincronizan por `editTime`/`DeleteTracking` (JEFIT) o por cola de Conflictos con el servidor (Hevy, Symmetry) — más complejos y con resolución de conflictos explícita.
4. **El modelo de datos de Cronos es el más estrecho de los cinco en cuatro ejes**, y es una decisión consciente: `completed_sets` tiene 9 columnas frente a las ~14 de `ExerciseSetLog` de JEFIT y las 13 de `training_log` de FitNotes. Lo que falta —tipo de serie, super-series, distancia, duración— es exactamente lo que las otras cuatro registran y lo que un import de Hevy **descarta en silencio**: `setType` se mapea en `CANONICAL_FIELDS` pero `completed_sets` no tiene columna donde caiga, y `ImportSet` sí tiene `durationSec`/`distanceM` que tampoco tienen destino.
5. **Cronos no tiene la separación plan/ejecución que FitNotes sí tiene.** `routines` → `routine_exercises` con `day_index`/`day_label` cubre el caso de "rutina de N días" con dos niveles y una columna de día. FitNotes tiene 4 niveles de plantilla + 3 de ejecución y un enlace explícito entre la serie registrada y la serie de la rutina que la originó (`routine_section_exercise_set_id`), lo que permite reconstruir "qué de la plantilla se cumplió". Cronos no puede.
6. **Cronos no tiene la inteligencia muscular porcentual de JEFIT.** `exercise_movement_pattern.involvement_percent` es un `REAL` por (ejercicio, patrón de movimiento). El catálogo de Cronos tiene `target` y `muscle_group` como cadenas, y la aparición de `muscle_group` en `src/` es **una sola** (en el JSON local), mientras `body_part` aparece 93 veces. Es decir: el modelo de datosrelationa lo corporal pero no lo muscular, mientras la UI de rangos anatómicos (`src/lib/ranks/`, `useMuscleRanks`) calcula sobre `muscleMap.ts`.

---

## 7. Hallazgos verificables

### 7.1 El tipo de serie se pierde al sincronizar

`SetKind` distingue `normal | warmup | failure | drop`, pero `completed_sets` solo tiene `is_warmup boolean`. `setKind.ts:40-46` lo documenta como decisión deliberada ("la columna `is_warmup` ya es suficiente; el tipo más rico se detiene en esta frontera"). El resultado observable:

- Una serie `drop` sincronizada se lee como `normal` en el servidor.
- `countsAsWorkingSet()` excluye solo `warmup`, así que el volumen histórico de las series `drop`/`failure` es correcto **en el cliente** y también **en el servidor** (porque `is_warmup = false` para ellas) — el conteo no se rompe.
- Pero **el tipo se pierde**: el historial que devuelve el servidor no distingue una serie de drop de una normal, y las tres de las cuatro apps de referencia sí lo guardan (Hevy `set_type`, JEFIT `setType`, Symmetry `updateSetTypeUseCase`).

Coste de arreglarlo: una columna `set_type text` (o `set_kind`) en `completed_sets` + 4 líneas en el mapper. Beneficio: paridad con las tres referencias y con la UI de chips que ya existe.

### 7.2 El store `exerciseNotes` de IndexedDB es esquema muerto

`idb.ts` declara el store `exerciseNotes` (keyPath `setId`, índice `exercise_id`) desde la v4, con un comentario que dice "notas por serie, encoladas para sincronizar junto a la serie". Búsqueda de `EXERCISE_NOTES_STORE` / `exerciseNotes` en todo `src/`: solo aparece en `idb.ts` y en `idb.test.ts`. **Ningún código de producción lo usa.**

El camino real de las notas es otro: `QueuedSet.notes` → `completed_sets.notes` en el `insert` de `sessionSync.ts:86`. La lectura es `src/lib/exercise/exerciseNotes.ts` → `collectNotes()` sobre `ExerciseSetRecord` que ya viene de la consulta a `completed_sets`.

Y hay una razón de fondo por la que el store no podría funcionar tal como está: su `keyPath` es `setId`, pero **`completed_sets.id` lo genera el servidor** (`gen_random_uuid()`) y `pushSession` nunca devuelve ni usa esos ids. Un `setId` local no tiene correspondencia con una fila del servidor. El store está bien documentado, bien diseñado y bien probado — y es(schema que la aplicación no necesita.

### 7.3 Tres tablas del modelo de tipos no tienen DDL en el repositorio

`src/types/supabase.ts` tipa `bodyweight_entries`, `body_measurements` y `session_checkins` con Row/Insert/Update completos. **Ninguna de las tres aparece en `supabase/schema.sql` ni en ninguna de las seis migraciones.** Búsqueda literal: `NO ENCONTRADA` en los tres casos.

Consecuencia: un `supabase db reset` sobre este repositorio produce una base **sin esas tres tablas**, y el cliente sigue creyendo que existen. Las tres son precisamente las que sostienen las funciones de peso corporal, medidas y check-in diario — y `src/components/profile/BiometricsInputs.tsx` y `src/components/progress/ConsistencyTracker.tsx` dependen de ellas. O bien las tablas se crearon a mano en el entorno desplegado (deriva entre entornos), o bien el repositorio no es reproducible.

### 7.4 El import mapea campos que la base de datos no tiene

`CANONICAL_FIELDS` incluye `setType`, y `ImportSet` incluye `durationSec` y `distanceM`. Pero `completed_sets` no tiene columna para ninguno de los tres. Consecuencia observable: un CSV exportado de Hevy con `set_type = "drop"` y una fila de cardio con `duration` **se importan sin error, y los datos se pierden** — exactamente el modo de fallo que `sources.ts` dice querer evitar en el otro extremo ("una suposición equivocada es mucho más cara que una pregunta").

El mismo patrón, en la otra dirección, es el que `sources.ts` sí resolvió bien: los campos canónicos se limitan a los que la BD acepta, y los headers no mapeados se reportan en la UI ("no usamos esta columna"). El hueco es entre la capa de análisis (que reconoce 9 campos) y la de persistencia (que acepta 6).

### 7.5 FitNotes y Hevy convergen; Cronos ya está más allá

Para el caso de uso inmediato — registrar series y analizar progresión —:

- **FitNotes** aporta el patrón más valioso: la separación plan/ejecución con enlace explícito, y el PR como bandera materializada y recalculada.
- **Hevy** aporta el vocabulario de exportación (`set_index`, `weight_kg`, `superset_id`, `rpe`, `set_type`) que Cronos ya reconoce en su tabla de alias, y el modelo de `superset_id` que Cronos no tiene.
- **Cronos** ya aporta dos cosas que ninguna referencia tiene: RPE como gobernador de la progresión, y un contrato de degradación total en la capa de persistencia.

---

## 8. Conclusiones de Fase 1

1. **Fase 1 completa.** Las cuatro apps se descompilaron con REA, sus manifiestos se leyeron, y sus modelos de datos se extrajeron por el método que cada runtime impone (SQL literal en FitNotes/JEFIT, cadenas en los binarios Hermes/Dart de Hevy/Symmetry).
2. **Cronos ya tiene el elemento diferenciador** (RPE como gobernador de progresión) y **el contrato de robustez** (degradación a `null`) que ninguna de las cuatro referencias tiene. No hay que adoptar esas ideas: ya están.
3. **Cronos tiene tres huecos concretos y acotados**, no un deficit de modelo: el tipo de serie no se persiste (§7.1), un store de IndexedDB es esquema muerto (§7.2), y tres tablas tipadas no tienen DDL en el repositorio (§7.3). Los tres son de un orden de magnitud menor que "rediseñar el modelo".
4. **El import es el punto de mayor fricción con el exterior** (§7.4): reconoce más campos de los que puede guardar. Cada uno de los que pierde es un dato que un usuario de Hevy puede ver en su propio histórico y que Cronos no conserva.
5. **Ningún APK ni archivo de producción fue modificado.** Toda la salida de descompilación vive fuera del repositorio, en `C:\Users\yayog\Downloads\decompiled\`.

---

*Fase 1 — completada. Entregable: `03-data-model-comparison.md`. Pendiente para fases siguientes: definición del esquema objetivo (Fase 2) y plan de migración (Fase 3).*
