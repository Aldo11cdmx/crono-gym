# Fase 3 — Catálogo de ejercicios, taxonomía y medios

**Alcance:** el modelo de catálogo de ejercicios (taxonomía, musculatura, equipamiento, papel compuesto/aislamiento), el soporte de ejercicios creados por el usuario, el tratamiento de duplicados, la estrategia de medios (imágenes, GIF, vídeo, demostración) y el soporte offline de las apps de referencia, auditados contra la implementación actual de `C:\Users\yayog\crono-gym`.

**Estado del baseline:** intacto. Ningún archivo de `src/` ni de `supabase/` fue modificado en esta fase. El único artefacto producido es este documento.

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` (`tsc --noEmit`) | ✅ limpio, 0 errores |
| Tests | `npm test` (`vitest run`) | ✅ **129** ficheros de test en verde, 0 fallos (309,15 s), confirmado en dos ejecuciones consecutivas (2.ª: 379,33 s) — recuento consolidado de la Fase 5: **4 ejecuciones completas**, ver `10-execution-log.md` §5 |
| Diff de producción | `git status` | sin cambios en `src/` respecto al inicio de la fase |

> **Nota de estabilidad.** En una ejecución canalizada con filtrado de salida se observó un fallo puntual de temporización en `src/components/coach/portal/RequestQueue.test.tsx` (*«lee los nombres de los atletas en una segunda consulta»*). El caso pasa de forma aislada (6,76 s) y en las dos ejecuciones completas no canalizadas el fichero va en verde (20 tests, 3 519 ms). Se trata de una prueba sensible a la carga del entorno, ajena a esta fase: no se ha modificado ningún archivo de `src/`.

**Metodología.**

| Fuente | Runtime | Dónde vive la evidencia | Método |
|---|---|---|---|
| JEFIT 17.0.1 | Nativo Kotlin + Room + SQLCipher | Entidades Room en `decompiled\jefit\sources\je\fit\data\room\entity\` | Lectura directa de campos y anotaciones |
| Hevy 3.1.16 | React Native + Hermes | `decompiled\hevy\resources\assets\index.android.bundle` (22,2 MB) | Extracción dirigida de cadenas y plantillas de URL |
| FitNotes 25.1 | Java + SQLite propio (`database.db` v22) | `decompiled\fitnotes\sources\` | Lectura de esquema (`CREATE TABLE`) y de los lectores/escritores de cada columna |
| Symmetry 7.16.0 | Flutter (Dart AOT en `libapp.so`) + Kotlin | `decompiled\symmetry\resources\assets\flutter_assets\` + `decompiled\symmetry-arm64\resources\lib\arm64-v8a\libapp.so` | Extracción de cadenas del binario Dart + lectura de JSON empaquetados |
| Cronos Gym | React 18 + Vite 5 + Supabase + IndexedDB | `src/`, `supabase/`, `public/` | Lectura de código + análisis byte a byte de los datos (Node sobre `exercisesCatalog.json`) |

> **Caveats de método.** (a) JEFIT expone su taxonomía como clases Java legibles, verificable. (b) Hevy y Symmetry son binarios ofuscados: de ellos se afirma **la forma del modelo** (claves de i18n, nombres de campo, plantillas de URL), no la semántica de su servidor. (c) Para Cronos se analizaron los **datos reales**, no su documentación: 16 265 338 bytes, 1 324 registros, leídos y contabilizados campo a campo con Node.

---

## 1. Resumen ejecutivo

1. **Cronos tiene dos catálogos que no son el mismo catálogo.** El del servidor (`public.exercises`, 7 columnas) y el local (`src/data/exercisesCatalog.json`, 16 campos, 16,3 MB). El local tiene **9 campos que el servidor no tiene** —`category`, `muscle_group`, `secondary_muscles`, `image`, `media_id`, `created_at`, `attribution`, `availableInCronosGym`, `instruction_steps`— y el servidor **pierde 9 de los 10 idiomas** de las instrucciones.
2. **El catálogo local de 16,3 MB entra entero en el bundle** por import estático (`ExerciseSelectorModal.tsx:17`), aunque el modal se abra una vez por sesión. `vite.config.ts` separa `react`/`supabase`/`ui`, pero no el catálogo.
3. **La taxonomía tiene un campo redundante y tres vocabularios musculares superpuestos.** `category` es **idéntico** a `body_part` en los 1 324 registros (mismos 10 valores, mismas frecuencias). `target` (19 valores), `muscle_group` (29) y `secondary_muscles` (40 valores distintos) nombran los mismos músculos de tres maneras: `pectorals`/`chest`, `delts`/`deltoids`, `quads`/`quadriceps`, `lats`/`latissimus dorsi`, `abs`/`abdominals`/`obliques`/`core`, `traps`/`trapezius`.
4. **Cronos no tiene ninguna dimensión de taxonomía que las referencias sí tienen.** JEFIT aporta seis (músculo con % y rol, equipamiento con alternativas y opcionalidad, articulaciones, patrones de movimiento con %, tipos de entrenamiento primario/secundario, jerarquía de grupos). Hevy aporta dos niveles de grupo muscular (19 detallados + 6 simplificados) y **ponderación de series** (principal = 1 serie, secundario = 0,5). Symmetry aporta `primaryMuscles`/`secondaryMuscles`, `ExerciseType`, `ExercisePattern` y un `isolation` explícito. FitNotes aporta solo `Category` + `ExerciseType`.
5. **Compuesto/aislamiento solo existe como dato en JEFIT y Symmetry.** En Hevy, `compound`/`isolation` aparecen **solo en prosa editorial** (descripciones de rutinas, artículos) y en selectores CSS (`<compound-selector>`): es un **hallazgo negativo estructural**. En Cronos no existe en ninguna forma.
6. **Cronos no soporta ejercicios creados por el usuario.** No existe tabla de ejercicios de usuario, ni columna `is_custom`, ni política de escritura sobre `exercises` (solo `exercises_select_authenticated`), ni ruta de UI: todos los «add exercise» del código significan *añadir un ejercicio existente a una rutina*. Hevy (`isCustomExercise`, `CustomExerciseTemplateCustomizations`), Symmetry (`isCustom`, `CreateCustomExercisePayload`, `CustomExercisePhotoStore`) y FitNotes (escritura local en la misma tabla) sí lo soportan. **Es la brecha funcional más grande de la Fase 3.**
7. **Los 6 nombres duplicados del catálogo no se pueden desambiguar.** Los 6 pares comparten `target`, `equipment`, `body_part` **y** `muscle_group`: el desambiguador que el importador promete (`useExerciseCatalog.ts:69-73`) no desambigua ninguno y devuelve la fila arbitrariamente. Hevy resuelve esto con duplicación explícita a ejercicio *custom* (`duplicateResolver`, `isDuplicate`); FitNotes con un chequeo manual de nombre; Symmetry con distancia de edición y modelo de duplicados de importación.
8. **La estrategia de medios de Hevy es la referencia que Cronos debería copiar.** Hevy sirve **demostraciones en MP4** desde CloudFront (`.../exercise-assets/{id}-{Nombre}_{Grupo}.mp4`, 672 URLs distintas) y **thumbnails** (`.../exercise-thumbnails/{id}-{Nombre}_{Grupo}_thumbnail`, 826 URLs distintas), y además empaqueta thumbnails `@3x` en el APK. Cronos sirve **GIF** desde `main` de GitHub raw (rama móvil, sin versión fijada) y renderiza 10 puntos de media con **una sola** función de resolución (`resolveImageSrc`), que solo cubre 2 de ellos.
9. **Las fotos de maquinaria no cargan en 3 de 4 puntos de uso y las miniaturas de ejercicio no cargan en ninguno.** La ruta almacenada es `public/images/gym-equipment/…` y Vite sirve `public/` en la raíz: solo `ExerciseSelectorModal.tsx:423` aplica el parche `resolveImageSrc`. `EquipmentModal.tsx:82`, `ActiveWorkout.tsx:932` y `ActiveWorkout.tsx:1396` usan la ruta cruda → 404. El JSON guarda rutas relativas (`videos/0001-….gif`) y `resolveImageSrc` solo quita el prefijo `public/`, así que el `src` final es relativo a la ruta actual; no existe `public/videos/`.
10. **El almacenamiento offline no cubre el catálogo.** La base `cronos-offline` (v5, 7 stores) guarda borradores de sesión, cola de sincronización, historial de rangos, chat del coach y estado local — **nunca el catálogo ni los medios**. No hay service worker, ni `CacheStorage`, ni plugin PWA: `navigator.onLine` es la única señal de offline. Un arranque en frío sin red deja la app **sin catálogo y sin demos**.
11. **Existe un store IndexedDB muerto** (`exerciseNotes`, v4): declarado en `idb.ts:79` y verificado en `idb.test.ts`, pero ningún módulo de runtime lo lee ni lo escribe (`src/lib/exercise/exerciseNotes.ts` es un módulo de validación en memoria, no el store). Contrasta con `coachChats`, que sí está vivo (`src/lib/ai/chatStorage.ts`).
12. **El puente de equipamiento es frágil por construcción y tiene código inalcanzable.** `getEquipmentSuggestionForExercise` (`equipmentCatalog.ts:256-308`) prueba **46 regex** en orden y la **última** es `/.*/`: casa con cualquier texto, así que el bucle siempre retorna y los **dos fallbacks siguientes —los únicos que consumen los 34 slugs de `availableEquipment.ts`— son inalcanzables**.

---

## 2. Análisis de referencias

### 2.1 JEFIT 17.0.1 — la taxonomía como modelo relacional

#### 2.1.1 El modelo de datos (verificado, campos exactos)

JEFIT no guarda «un ejercicio con un músculo». Guarda **relaciones tipadas** entre tablas de referencia.

| Entidad | Campos verificados | Dimensión |
|---|---|---|
| `MuscleGroupsEntity` | `id`, `anatomicalName`, `commonName`, `parentGroupId` | **Jerarquía de grupos musculares**, con nombre anatómico y nombre común |
| `ExerciseMuscleInvolvementMapEntity` | `exerciseId` (int), `muscleGroupId` (int), `involvementPercent` (**double**), `role` (String) | **Músculo principal/secundario con % de implicación y rol** |
| `EquipmentTypesEntity` | `id` (int), `name`, `parentGroupId` (int), `categoryIndex` (Integer?), `thumbnailUrl`, `typicalFacility` | **Jerarquía de equipamiento** + miniatura + instalación típica |
| `ExerciseEquipmentMapEntity` | `rowId`, `exerciseId`, `equipmentTypeId`, `type`, `optional` (boolean), `parentRowId` | **Equipamiento por ejercicio**, con tipo, opcionalidad y filas agrupadas por padre (alternativas) |
| `JointEntity` | `id`, `commonName`, `details` | **Articulaciones** |
| `ExerciseFocusAreaJointMapEntity` | `exerciseId`, `areaJointId` | **Articulación enfocada por ejercicio** |
| `MovementPatternEntity` | `id`, `commonName`, `details` | **Patrones de movimiento** |
| `ExerciseMovementPatternEntity` | `exerciseId`, `movementPatternId`, `involvementPercent` | **Patrón de movimiento con % de implicación** |
| `TrainingTypeEntity` | `id`, `commonName`, `parentGroupId` | **Tipos de entrenamiento** con jerarquía |
| `ExerciseTrainingTypeMapEntity` | `exerciseId`, `primaryTrainingTypeId`, `secondaryTrainingTypeId` | **Tipo de entrenamiento primario y secundario** |

Los nombres de campo JSON del DAO lo confirman literalmente (`ExerciseMuscleInvolvementMapItemResponse`): `@Json(name = "exercise_id")`, `@Json(name = "muscle_group_id")`, `@Json(name = "involvement_percent")`, `@Json(name = "role")`.

Lo que esto compra, y Cronos no tiene:

- **Un músculo puede tener peso.** `involvementPercent` es un `double`, no un booleano: «pectoral 70 %, tríceps 30 %» es una fila, no una inferencia.
- **El rol se guarda.** `role` distingue principal de secundario **en el dato**, no en el nombre de una columna.
- **El equipamiento tiene alternativas explícitas.** `parentRowId` agrupa filas: el ejercicio admite X, X′ es la alternativa de X, y ambas son opcionales (`optional`).
- **La taxonomía tiene jerarquía.** `parentGroupId` en músculos, equipamiento y tipos permite «hombro → deltoides → lateral», que es lo que hace falta para un mapa anatómico navegable.
- **Compuesto/aislamiento vive en `TrainingType`**, no en una heurística de nombre: `primaryTrainingTypeId` y `secondaryTrainingTypeId` por ejercicio.

#### 2.1.2 Duplicados y ejercicios personalizados

- **Identidad:** `exerciseId` numérico en todas las tablas de relación, más `exercise_template` como entidad separada. La duplicación *deliberada* de un ejercicio en JEFIT es una fila más con su propio id y su propio juego de relaciones, no una colisión de nombre.
- **Sin bandera de «creado por el usuario» en el modelo Room**: no hay `user_id` ni `is_custom` en las entidades de ejercicio. El modelo es un catálogo de sistema; la personalización vive en la capa de usuario (rutinas), no en el catálogo.
- **Consecuencia comparativa:** JEFIT resuelve la identidad por **id**, no por nombre. Los 6 pares homónimos de Cronos no tienen equivalente en JEFIT porque el nombre no es clave.

#### 2.1.3 Medios: CDN, no paquete

| Recurso | Origen | Evidencia |
|---|---|---|
| Imagen de ejercicio (960 × 590) | `https://cdn.jefit.com/images/exercises/960_590/{exerciseId}.jpg` | `je/fit/util/UrlUtilsKt.java:17-19` (`getExerciseImageUrl`), `je/fit/ExerciseImageHandler.java:95` |
| Miniatura de equipamiento | `https://www.jefit.com/uc/file/{hash}/{name}.png` | `je/fit/data/repository/EquipmentRepository.java:84-106` (`barbell.png`, `bench.png`, `bands.png`, `dumbbell.png`, `ez-bar.png`, `kettle-bell.png`, `treadmill.png`, `machine.png`…) |
| Foto de usuario / progreso | `https://cdn.jefit.com/wp/wp-content/uploads/…` | `je/fit/watchapp/WatchAppRepository.java:235` |
| Render de GIF | Glide con `gifdecoder` + Coil | `com/bumptech/glide/gifdecoder/`, `coil/drawable/` |

El catálogo de ejercicios **no viaja en el APK**: JEFIT empaqueta un `encrypted_data.enc.json` con su `encrypted_key.txt` (`resources/assets/`) y el catálogo llega por API (`https://api.jefit.com/api/…`, peticiones firmadas con `hashWrapForAPI`/MD5). El paquete local solo trae los **GIF de animación del propio producto** (`res/drawable/accumulation_clock.gif`, `deload_clock.gif`, `fresh_start.gif`, `intensification_clock.gif`, `on_ramp_clock.gif`, `rocket_launch.gif`): 6 archivos, 3,1 MB, todos de UI, ninguno de ejercicios.

#### 2.1.4 Offline

- **Caché de sincronización descargable**: `je/fit/domain/sync/DownloadSyncDataUseCase.java:105-107` descarga `https://www.jefit.com/usersync/{userId}.cache` → archivo de estado en disco que permite seguir trabajando sin red.
- **Cifrado en reposo** del paquete de datos (`encrypted_data.enc.json` + clave aparte).
- **Base local cifrada**: SQLCipher en `MobileOnlyDatabase` (nombre real `jefit_prodRelease`, que expone **solo** `WorkoutReminderDao` — el catálogo no está en la base local).
- **Carga diferida de imagen**: `GetImageOrientationFromUriUseCase` / `GetImageOrientationFromUrlUseCase` resuelven la orientación antes de mostrar, señal de que las imágenes llegan de fuentes externas heterogéneas.

---

### 2.2 Hevy 3.1.16 — el modelo de dos niveles y la ponderación de series

#### 2.2.1 Taxonomía: 19 grupos musculares + 6 simplificados + secundarios ponderados

Hevy es la referencia con la taxonomía **más comparable** con Cronos, porque también separa «músculo detallado» de «grupo resumido». La diferencia es que el resumen de Hevy es **derivado del músculo** y el de Cronos es una región gruesa independiente.

**Vocabulario canónico de Hevy** (claves i18n `exerciseData.muscleGroup.*`, 19 valores):

`abdominals`, `abductors`, `adductors`, `biceps`, `calves`, `cardio`, `chest`, `forearms`, `fullBody`, `glutes`, `hamstrings`, `lats`, `lowerBack`, `neck`, `otherMuscles`, `quadriceps`, `shoulders`, `triceps`, `upperBack`.

**Capa simplificada** (claves `global.simplifiedMuscleGroup.*`, 6 valores): `arms`, `back`, `chest`, `core`, `legs`, `shoulders`. Es exactamente el mismo propósito que `body_part` en Cronos, pero derivado del músculo en lugar de almacenado aparte.

**Músculos secundarios: existen y están ponderados.** Hevy modela el primario y el secundario como **dos listas** y define un **factor de contribución**:

> «The sets of an exercise will count as one for primary muscle groups and half for secondary muscle groups.»

Y en la misma familia, con el criterio de exclusión de series en caliente:

> «The number of sets completed of exercises that target each muscle group. This applies for both primary and secondary muscles. Warm-up sets are excluded.»

Claves relacionadas: `Secondary Muscle Groups`, `SetSecondaryMuscleGroups`, `Secondary Muscle distribution (Body)`, `Secondary: %{secondaryMuslceGroup}` (con el *typo* `Muslce` de Hevy en su propia cadena de i18n), `CalculateSetContributionsForSimplifiedMuscleGroups`, `CalculateSetCountPerMuscleGroups`, `SetCountPerMuscleGroupScreen`, `byMuscleGroup`, `muscleGroupMap`, `SelectedMuscleGroupsCount`.

**Equipamiento: categoría + taxonomía granular.** Hevy no expone un `equipment` de texto libre por ejercicio como Cronos; expone `equipment_category` y un catálogo granular con versionado de migración: `hevyTrainer.granularEquipment.suspensionBand`, `hevyTrainer.availableEquipment.platesAndBars.description`, `showAvailableEquipmentOptions`, `showEquipmentActionSheet`, `PlateCalculator.manageEquipment`, `FAULT_AVAILABLE_EQUIPMENT` (fallo *degradable* cuando la disponibilidad de una máquina no se puede confirmar).

**Plantillas de ejercicio.** El ejercicio de Hevy es una **plantilla** (`exercise_template`, 11 apariciones; `exerciseTemplateIds`; `popularExerciseTemplateIds`; `postExerciseTemplateUnit`; `DeleteExerciseTemplateUnitStore`), no un catálogo de rol. Un mismo movimiento con variantes de máquina son plantillas distintas con id distinto.

#### 2.2.2 Compuesto/aislamiento — hallazgo negativo

`compound` (11 apariciones) e `isolation` (26) existen en el bundle, pero **ninguna es un campo de datos del ejercicio**:

- Las apariciones de `compound` son: prosa editorial («Compound lifts like the squat are suitable for heavier training»), texto de rutina generado («This workout includes compound lifts for the chest and shoulders, plus isolation exercises for the triceps and abs») y el selector CSS `<compound-selector>` de React Native.
- Las de `isolation` son: prosa editorial («Isolation lifts like the bicep curl are best done with lighter weights»), nombres de variables internas (`defaultIsolationScope`, `UnsetIsolationScope`, `IsolationScope` — Isolated JS scopes, no ejercicios) y descripciones de rutina.

**Conclusión:** Hevy **no** tiene un campo compuesto/aislamiento estructurado; lo comunica en texto generado. Esto sitúa a Cronos en un punto intermedio: Cronos tampoco lo tiene (lo que es correcto frente a Hevy), pero sí lo tiene JEFIT (`ExerciseTrainingTypeMapEntity`) y Symmetry (`isolation`, `ExerciseType`, `ExerciseTypeExtension|fromJson`).

#### 2.2.3 Ejercicios personalizados — soporte de primera clase

Hevy es la referencia de esta capacidad:

- **Bandera de datos:** `isCustomExercise` es un booleano del modelo de ejercicio.
- **Modelo de personalización:** `CustomExerciseTemplateCustomizations` (una personalización por plantilla).
- **Superficie de UI:** `showAddNewExercise`, `faq.customExercises`, `faq.editCustomExercise`, `exerciseDetail.actionSheet.customExerciseOptions.delete`, `customExercisesFiltered`.
- **Límite de plan:** «Unlimited Custom Exercises (%{customExerciseCount}/7)», «Editar Ejercicios a Medida (%{customExerciseCount}/7)», «Esercizio personalizzato (%{customExerciseCount}/7)» → **7 ejercicios custom en el plan gratuito**, escalable con suscripción.
- **Patrón de borrado:** `DeleteExerciseTemplateUnitStore` y `customExerciseOptions.delete` — la eliminación de un custom no puede tocar el catálogo base.

#### 2.2.4 Duplicados — explícitos, no colisiones

Hevy **no** resuelve duplicados por coincidencia de nombre: los **crea**:

- `duplicateResolver` (función de resolución de duplicados), `isDuplicate` (bandera).
- Guía de producto en el bundle: *«Duplicate Exercises or Routines — Starting fresh with an exercise: You can duplicate an exercise to create a new custom version without any past data. 1. Go to the Profile tab 2. Tap Exercises 3. Select the exercise you want to reset 4. Tap the three dots in the top-right corner 5. Select Duplicate Exercise 6. Rename it»*.
- Confirmación al usuario: «%{exercise_name} has been successfully duplicated. You can find it in the Exercise Library.» → **la copia aterriza en la biblioteca del usuario como ejercicio custom, con nombre renombrable**.

Es un patrón directamente transferable a Cronos: convertir cada homónimo en un ejercicio custom del usuario, con `is_custom` y `source_exercise_id`.

#### 2.2.5 Medios: CloudFront con dos rutas (vídeo + miniatura)

Hevy es la **única** de las cuatro referencias con una CDN de medios de ejercicio verificable, y usa **MP4**, no GIF.

**Plantillas de URL extraídas del bundle** (`index.android.bundle`, 22,2 MB):

```
https://d2l9nsnmtah87f.cloudfront.net/exercise-assets/{id}-{Nombre}_{Grupo}.mp4
https://d2l9nsnmtah87f.cloudfront.net/exercise-thumbnails/{id}-{Nombre}_{Grupo}_thumbnail
```

| Recurso | URLs distintas | Nota |
|---|---|---|
| `exercise-assets/*.mp4` | **672** | demostración en vídeo |
| `exercise-thumbnails/*` | **826** | miniatura, sin extensión en la URL |
| Total de URLs CloudFront distintas | **1 498** | |

**Convenio de nombres (decodificado):** `{id}{flags}-{Nombre del ejercicio}_{Grupo muscular}`. Ejemplos reales:

```
…/exercise-assets/00011201-3-4-Sit-up_Waist.mp4
…/exercise-assets/00251201-Barbell-Bench-Press_Chest.mp4
…/exercise-assets/00321201-Barbell-Deadlift_Hips-FIX.mp4
…/exercise-thumbnails/00301201-Barbell-Close-Grip-Bench-Press_Upper-Arms_thumbnail
```

El sufijo `_FIX` marca variantes corregidas del mismo ejercicio: es el mismo patrón de *variante* que en Cronos (`lever chest press` 0576/0577), pero **con identificador de medio** (`media_id` en Cronos, `2gPfomN`) y **con variante nominal explícita**, en lugar de dos filas indistinguibles.

**Grupos musculares en las URL** (extraídos del campo tras el último `_`): `Chest`, `Upper-Arms`, `Waist`, `Thighs`, `Back`, `Hips`, `Shoulders`, `Calves`, `Forearm`/`Forearms`, `Plyometrics`, `Cardio`. Nótese `Hips` y `Thighs` separados: es una taxonomía **más fina** que la de Cronos, donde `glutes`/`quadriceps`/`hamstrings` conviven con `hip flexors` como `muscle_group`.

**Assets empaquetados:** el APK **sí** incluye miniaturas del catálogo en `res/drawable-xxhdpi/`, con el patrón `src_exercises_assets_{id}{nombre}_{músculo}_thumbnail@3x.jpg` (p. ej. `70021201smithbenchpressfemale_chest_thumbnail_.jpg`). Son los *fallbacks* empaquetados; el bundle referencia `/assets/00171201-Assisted-Pull-up_Back_thumbnail@3x.jpg`. Los únicos GIF del APK son stickers de PhotoEditor (`imgly_sticker_animated_*.gif`), no de ejercicios.

#### 2.2.6 Offline y compresión

- **Hallazgo negativo en caché de medios:** no hay `FastImage`, `expo-image`, `Coil`, `Glide` (sí está `libimagepipeline.so` de Fresco, el pipeline por defecto de Android), `OkHttp cache`, `SDWebImage` ni `blurhash` referenciados para medios de ejercicio. No hay política de caché de disco explícita en el bundle.
- **Compresión:** los thumbnails son JPG pre-renderizados a densidad `@3x`. No hay parámetros de redimensionado en runtime (`w=`, `q=`, `f_auto`, `fm=`) ni `webp`/`avif`/`quality`/`placeholder`/`lazy` para medios de ejercicio. La optimización es **de build**, no de red: el recurso ya viene en la resolución que se va a pintar.

---

### 2.3 FitNotes 25.1 — catálogo local mínimo, sin medios

#### 2.3.1 Corrección de la Fase 1

La Fase 1 asignó `X\C0250e0.java` a la tabla `exercise` y `X\C0245c.java` a `Category`. **Ambas asignaciones son incorrectas:**

| Fichero | Realidad verificada |
|---|---|
| `sources/X/C0250e0.java` | `RoutineSectionExerciseTable.java` — `CREATE TABLE RoutineSectionExercise(...)` (línea 19) |
| `sources/X/C0245c.java` | `BarbellTable.java` — `CREATE TABLE Barbell (...)` (línea 92) |
| `sources/X/C0284w.java` | **`ExerciseTable.java`** — `CREATE TABLE exercise(...)` (línea 233) |
| `sources/X/C0259j.java` | **`CategoryTable.java`** — `CREATE TABLE Category(...)` (línea 19) |

Y la columna que la Fase 1 llamó `default_gif_id` **no existe con ese nombre**: la real es `default_graph_id` (un *default de tipo de gráfica*, no un GIF), y **está viva** (lectores en `P0/i.java:275,278`, `M0/t.java:281`, `M0/q.java:997,1110,1364`, modelo en `Exercise.getDefaultGraphId()`).

#### 2.3.2 Taxonomía plana (verificada)

```sql
-- sources/X/C0284w.java:233-236
CREATE TABLE exercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  category_id INTEGER NOT NULL, exercise_type_id INTEGER NOT NULL DEFAULT 0,
  notes TEXT, weight_increment INTEGER, default_graph_id INTEGER,
  default_rest_time INTEGER, weight_unit_id INTEGER NOT NULL DEFAULT 0,
  is_favourite INTEGER NOT NULL DEFAULT 0);

-- sources/X/C0259j.java:19
CREATE TABLE Category(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  colour INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0);
```

- **`category_id` es una FK real**, no un string. Las 8 categorías por defecto (líneas 123-124) son **grupos musculares**: `Shoulders`, `Triceps`, `Biceps`, `Chest`, `Back`, `Legs`, `Abs`, `Cardio`.
- **`exercise_type_id` apunta a un enum de código, no a una tabla**: `ExerciseType` (10 valores: `WEIGHT_AND_REPS`, `WEIGHT_AND_DISTANCE`, `WEIGHT_AND_TIME`, `REPS_AND_DISTANCE`, `REPS_AND_TIME`, `DISTANCE_AND_TIME`, `WEIGHT`, `REPS`, `DISTANCE`, `TIME`), con solo `WEIGHT_AND_REPS` y `DISTANCE_AND_TIME` activos por defecto.
- **Sin equipamiento**: 0 coincidencias de `equipment`/`Equipment` en todo el árbol de fuentes.
- **Sin musculatura secundaria ni porcentajes**: 0 coincidencias de `muscle`, `bodyPart`, `body_part`, `primary_muscle`, `secondary_muscle`. Los 41 `target` son de otros dominios (`target_date` de metas, `target_weight` de calculadora de discos).
- **Catálogo sembrado en código, no en assets**: ~96 ejercicios por defecto en `C0284w.a0()` (líneas 238-351) vía `DefaultExercise(name, categoryId, exerciseTypeId)`. `resources/assets/` contiene **un solo** fichero (`org/threeten/bp/TZDB.dat`).
- **Base**: `SQLiteOpenHelper` propio (`sources/V/c.java:49-51`, `"database.db"`, versión **22**), **no** Room.

#### 2.3.3 Duplicados

- **Sin constraint `UNIQUE` sobre `name`.**
- Chequeo manual y **sensible a mayúsculas** (`SQLite =` sobre `TEXT` es case-sensitive por defecto, sin `COLLATE NOCASE`):

```java
// sources/X/C0284w.java:368-370
public boolean M(String str) {
    return i("SELECT * FROM exercise WHERE name = ?", str).c();
}
```

- Invocado desde el guardado (`sources/I0/b.java:976`), que bloquea el alta si ya existe una fila con ese nombre exacto (salvo que sea la misma fila que se está editando).
- **Desambiguación efectiva: por `_id`**, nunca por nombre. Es la referencia de *lo mínimo*: un id estable y una comprobación de unicidad.

#### 2.3.4 Ejercicios personalizados

- **Sin `user_id` y sin `isCustom` en la tabla `exercise`** (`isCustom()` existe solo en `Measurement`/`MeasurementUnit`).
- El usuario **puede** crear ejercicios (`ExerciseAddEditActivity`, `sources/P0/i.java`; guardado en `sources/I0/b.java:976`) y se insertan **en la misma tabla que los por defecto**, sin marca que los distinga.
- Catálogo **localmente escribible**, sin nube ni sincronización de ejercicios (el backup de Google Drive cubre `database.db` entero).

#### 2.3.5 Medios: ninguno

- **0 ficheros `.gif` en el APK** (verificado sobre `resources/` completo).
- **0 assets de demostración de ejercicio**: los ~41 drawables XML son UI (`ic_action_*`, `ic_stat_dumbbell`, `card_background_*`…), los PNG por densidad son iconos de acción/launcher.
- **0 librerías de imagen**: sin Glide, Picasso, Coil, Retrofit, OkHttp. La red es `HttpURLConnection` + `AsyncTask`, y **solo** para Google Drive (OAuth, backup) y revocación de token (`sources/R1/f.java:40`).
- **Sin columna de imagen/vídeo/GIF** en `exercise` ni en `Exercise`.

> FitNotes es la referencia de **lo mínimo viable**: catálogo local, id autoincremental, FK de categoría, unicidad de nombre por código. La lección para Cronos no es su taxonomía (es más pobre que la de Cronos) sino su **coste de catálogo**: cero KB de medios, cero peticiones por ejercicio, arranque instantáneo.

---

### 2.4 Symmetry 7.16.0 — Flutter, catálogo en JSON y caché de medios en disco

#### 2.4.1 Stack

Flutter 7.16.0 (`club.symmetry.application`, versionCode 51205, minSdk 26, targetSdk 36). La lógica Dart está compilada AOT en `libapp.so` (arm64-v8a); las fuentes Kotlin/Java están ofuscadas con nombres de una letra. **El catálogo se puede leer directamente**: los assets JSON están sin ofuscar.

#### 2.4.2 Taxonomía (recuperada de `libapp.so`)

| Concepto | Símbolo / clave | Equivalente en Cronos |
|---|---|---|
| Músculos primarios | `primaryMuscles` | `target` |
| Músculos secundarios | `secondaryMuscles`, `secondaryMuscleGroups` | `secondary_muscles` (string) |
| Tipo de grupo muscular | `MuscleGroupType`, `MuscleGroupExtension\|fromJson`, `MuscleGroupExtension\|get#localization` | — (no existe) |
| Tipo de ejercicio | `ExerciseType`, `ExerciseTypeExtension\|fromJson`, `ExerciseTypeExtension\|tryFromJson`, `ExerciseTypeBottomSheet` | — (no existe) |
| Patrón de movimiento | `ExercisePattern`, `patternId`, `movementPattern`, `exercise_patterns.json`, `ExerciseClassifier.satisfies` | — (no existe) |
| Aislamiento | `isolation` | — (no existe) |
| Plano de entrenamiento | `exercise_plane.dart`, `ExercisePlaneButtonState` | — (no existe) |
| Nivel y categoría | `exercise_category`, `exercise_type`, `exercise_level` | `body_part` |
| Equipamiento requerido | `requiredEquipment`, `EquipmentClassifier.satisfies`, `equipment_group_match.dart`, `resolve_available_equipment` | `equipment` (string) |
| Solo peso corporal | `bodyweightOnly`, `isBodyweight` | — |

**17 grupos musculares con diagrama empaquetado** (`assets/images/shared/`, pares base/`_selected`): `abs, abductors, adductors, biceps, calves, cardio, chest, forearms, glutes, hamstrings, lats, lowerback, neck, quads, shoulders, trapezoids, upperback`.

**Enum de equipamiento** (24 valores, `packages/equipment/lib/src/equipment.dart`): `legPress, noEquipment, commercialGymWeightMachines, barbells, squatRack, dumbbells, backExtensionBench, inclineBench, flatBench, hiLoPulleyCable, ropeCable, dipBar, pullUpBar, kettlebells, resistanceBands, gymBall, foamRoller, jumpRope, yogaMat, trx, battleRopes, verticalBench, preacherCurlBench, crossoverCable`.

> **Comparación con el catálogo de Cronos:** el enum de Symmetry es de **tipos de máquina** (una entrada = un tipo de equipo, con variantes por marca), mientras que los 28 tokens de Cronos (`body weight`, `cable`, `barbell`…) son **materiales**, y sus 73 máquinas `CG-EQP-XXXX` son **instancias de un gimnasio concreto**. Symmetry separa los tres niveles (tipo → centro → instancia) igual que Cronos separa tipo → máquina, pero Cronos mezcla el catálogo maestro con el inventario.

#### 2.4.3 Catálogos empaquetados: datos reales, no solo código

| Asset | Contenido | Interés para Cronos |
|---|---|---|
| `assets/workout_plan_templates/predefined_workout_plans_v2.json` | 82 planes, universo de 155 ejercicios | Plantilla de catálogo con `planId`, `formatVersion` |
| `assets/workout_plan_templates/legacy_v1_id_map.json` | Mapa **congelado** `index → {stable id, name, nameEn}` | **Precedente de estabilización de ids** ante un cambio de dataset |
| `assets/workout_plan_templates/substitution_tables.json` | `tableA`/`tableB` con `{exerciseId, destinos}` en `substitutes`/`upgrades`, `requiredEquipment`, `injuryExclusions` | **Tabla de sustituciones** como dato |
| `assets/starting_load/starting_load_coefficients.csv` | 155 filas; columnas `exercise_id, name, implement, prescribes_weight, no_weight_reason, coefficient_unit, logged_unit, load_divisor, coef_male_novice, coef_male_experienced, coef_female_novice, coef_female_experienced, lighter_alternative_id, review_note, approved_by`; `implement ∈ {barbell, machine, smith, dumbbell}` | **Algoritmo de carga inicial con justificación y aprobador** |
| `assets/starting_load/starting_load_approval.json` | `version`, `status`, `fingerprint`, `frozen`, `pending_decisions`, `source_errors` | **Congelamiento versionado** del catálogo |
| `assets/exercise_ranking_mock.json` | 21 002 líneas: `exerciseTemplateId`, `exerciseName`, `rankThresholds{male[], female[]}` | Umbrales de rango por ejercicio y sexo |
| `assets/quick_workouts/quick_workouts_en.json` | `muscleGroups[{id, workouts[{name, thumbnailUrl, durationMinutes, equipmentVersion, level, exercises[{exerciseTemplateId, name, numberOfSets, repsPerSet, restTimeInBetweenSets, note}]}]}]` | `equipmentVersion` = versionado del catálogo |

#### 2.4.4 Ejercicios personalizados y duplicados

- **Bandera:** `isCustom` (en `package:symmetry/packages/exercises/…/entities`), con payload `CreateCustomExercisePayload` y almacenamiento de foto `CustomExercisePhotoStore`.
- **Estado no sincronizado:** `pending_custom_exercises.dart`, `UnsyncedCustomExercisesState`, `_customExercisesAreOnServer` → el custom vive primero en local y se sincroniza después.
- **UI de alta con roles musculares:** `create_custom_exercise.required`, `create_custom_exercise.optional`, `create_custom_exercise.secondary_muscle_groups.placeholder`, `create_custom_exercise.type_selector.timed.subtitle` → **la app pide primario, opcional y secundario en el alta**.
- **Duplicados y conflictos (importación):** `import_duplicates_model.dart`, `ImportDuplicatesModel`, `import_workouts.errors.conflict`, `mismatch_count`, `import_workouts.result.skipped_incomplete`, `PurchaseDedupeStore`.
- **Búsqueda tolerante:** `package:symmetry/packages/exercise_search/lib/src/v1/scoring/edit_distance.dart` → `ExerciseSearcherV1` con **distancia de edición**, es decir: cuando no hay coincidencia exacta, propone la más cercana en vez de devolver null. Contraste directo con `useExerciseCatalog.find()`, que devuelve `null` antes que la coincidencia aproximada.
- **Sugerencias al catálogo:** `ExerciseCatalogSuggestion`, `exerciseCatalogSuggestionSubmittedEvent`, `ExerciseSuggestionServerFailure`, `ExerciseSuggestionFailure.offline()` → **el usuario puede proponer un ejercicio al catálogo**, y el sistema registra los envíos pendientes sin conexión.

#### 2.4.5 Medios

| Aspecto | Implementación | Evidencia |
|---|---|---|
| **Host remoto** | `https://symmetry-assets.com/public/…` | `quick_workouts_*.json` → `thumbnailUrl` en `.webp` |
| **CDN de medios de ejercicio** | **remoto**, no empaquetado | no hay GIF/vídeo de ejercicio en el APK |
| **Caché en disco** | `flutter_cache_manager`: `DefaultCacheManager`, `cache_info_repository`, `cache_info_repositories/helper_methods.dart`, `file_response.dart`, `CacheRetrievalType`, `CacheObjectProvider` | precarga de thumbnails |
| **Precarga** | `prefetchThumbnailUrl`, `_precacheThumbnail@7861014036`, `_precacheSessionThumbnails@7902458815`, `ExerciseThumbnailCache`, `ExerciseThumbnailIcon`, `_resolveCachedGif@8059023216`, `TrainingImagePrewarmer`, `OnboardingImagePrecacher` | warming de disco para listas |
| **Vídeo** | `video_player` (API pigeon de Android), `InlineVideoControllerPool`, `InlineMediaVideoPlayer`, `RemoteMediaPreview`, `pooled_video_preview.dart`, `flutter_native_video_trimmer`; formatos `video/mp4`, `application/vnd.apple.mpegurl` (HLS), `m3u8`, `webm` | demos en vídeo |
| **Compresión** | `flutter_image_compress` (`_compressImage@4748069413`, `ImageCompressionProvider`, `ImageCompressionBoundsD`), `webp`, `blurhash` | compresión en cliente y placeholder |
| **Medios de sesión** | `SessionMediaWriter`, `MediaUploadProvider`, `ActiveSessionMediaItemsTable`, `pending_completed_session_media`, `immutable_media_file_service.dart` | captura de vídeo/foto del atleta |

**Assets empaquetados (inventario real):**

| Tipo | Nº | Contenido |
|---|---|---|
| PNG | 100+ | UI + **17 diagramas de grupo muscular** (base/`_selected`) + `default_exercise_thumbnail.png` + `placeholder_addexercise.png` |
| SVG | 100+ | iconos y logos |
| JPG/JPEG | ~35 | fotos de equipamiento (`assets/images/equipment/`) |
| MP4 | **1** | `videos/introduction_video.mp4` (UI) |
| GIF | **2** | `loading_animation.gif`, `revising-video.gif` (UI) |
| MP3 | 7 | sonidos de temporizador, fin de descanso, récord |
| WAV | 1 | `sounds/silent.wav` |
| Lottie JSON | 1 | `ranks/animations/lottie_rank_up_animation.json` |
| JSON de catálogo | 12 | planes, sustituciones, coeficientes de carga, ranking, quick workouts |

**Conclusión de medios:** Symmetry es **la referencia de medios de Cronos**: sirve la demostración desde un CDN propio, la **precachea en disco** con `flutter_cache_manager`, usa **thumbnails en WebP** en listas, **vídeo** para la ficha, y `blurhash` como placeholder. No empaqueta demos de ejercicio. Es exactamente el patrón que Cronos necesita y no tiene.

---

### 2.5 Lecturas transversales: qué aporta cada referencia

| Capacidad | JEFIT | Hevy | FitNotes | Symmetry | **Lección para Cronos** |
|---|---|---|---|---|---|
| Jerarquía de grupo muscular | ✅ `parentGroupId` | ✅ 19 → 6 simplificados | ❌ 8 planas | ❌ plana | Adoptar **dos niveles** (detallado + resumen), como Hevy |
| Músculo secundario | ✅ lista con rol | ✅ lista, ponderada 0,5 | ❌ | ✅ lista | Adoptar **lista** de secundarios (no string) |
| % de implicación | ✅ `double` | ❌ (factor fijo 1 / 0,5) | ❌ | ❌ | El factor de Hevy basta; JEFIT es el techo |
| Compuesto/aislamiento | ✅ `TrainingType` | ❌ (solo prosa) | ❌ | ✅ `isolation`/`ExerciseType` | Modelarlo como **dato**, no como convención |
| Patrón de movimiento | ✅ con % | ❌ | ❌ | ✅ `ExercisePattern` | Alto valor para progresión |
| Equipamiento tipado | ✅ jerarquía + alternativas + opcionalidad | ✅ `equipment_category` + granular | ❌ | ✅ enum + `requiredEquipment` | Unificar tipo ↔ instancia de máquina |
| Ejercicio custom por usuario | ❌ (no en el modelo) | ✅ `isCustomExercise` + límite 7 | ✅ (local, sin marca) | ✅ `isCustom` + roles al alta | **Ausente en Cronos** → brecha mayor |
| Duplicados | ✅ por id | ✅ duplicar → custom | ✅ check manual de nombre | ✅ distancia de edición + modelo de conflictos | Ninguna estrategia en Cronos |
| Medios empaquetados | ❌ (6 GIF de UI) | ✅ thumbnails `@3x` | ❌ (0) | ❌ (0 demos) | Empaquetar **fallback** estático, no demo |
| Medios en CDN | ✅ `cdn.jefit.com` | ✅ CloudFront (MP4 + thumbs) | ❌ | ✅ `symmetry-assets.com` | Cronos: GitHub `main` (rama móvil) → **pin por commit** |
| Formato de demo | JPG 960×590 | **MP4** | — | MP4/HLS | GIF es el peor de los tres: pesa y no escala |
| Caché de medios offline | ⚠️ implícita (Glide/Coil) | ❌ | ❌ | ✅ `flutter_cache_manager` + precarga | **Cronos: ninguna** |
| Coste de catálogo en cliente | API + sync cache | 1 498 URLs CDN | ~96 filas SQLite | JSON + precache | Dejar de meter 16,3 MB en el bundle |

---

## 3. Auditoría del catálogo en Cronos Gym

### 3.1 Dos catálogos, dos verdades

| | Catálogo del servidor | Catálogo local |
|---|---|---|
| Ubicación | tabla `public.exercises` (`supabase/schema.sql:11-19`) | `src/data/exercisesCatalog.json` |
| Filas | 1 324 (comentario del esquema, línea 8) | **1 324** (verificado) |
| Campos | **7**: `id`, `name`, `body_part`, `target`, `equipment`, `gif_url`, `instructions text[]` | **16**: las 7 anteriores + `category`, `muscle_group`, `secondary_muscles`, `image`, `media_id`, `instruction_steps`, `created_at`, `attribution`, `availableInCronosGym` |
| Tamaño | ~1 MB en Postgres | **16 265 338 B (16,3 MB)** |
| Idiomas | 1 (`instructions` = `instruction_steps.es`, `seedExercises.ts:48`) | **10** (`en es fr hi it ko pl ru tr zh`) en `instructions` y en `instruction_steps` |
| Forma de `instructions` | `text[]` (array) | **objeto** `{lang: string}` + `instruction_steps` = `{lang: string[]}` |
| Cómo se carga | `supabase.from("exercises").select("*")` (`useExerciseCatalog.ts:56`) | `import exercisesCatalog from "@/data/exercisesCatalog.json"` (`ExerciseSelectorModal.tsx:17`) |
| RLS | `exercises_select_authenticated` (solo lectura, autenticados) | local |
| Índices | `body_part`, `equipment`, `target`. **Ninguno en `name`** | n/a |
| Semántica de medios | URL absoluta (`https://raw.githubusercontent.com/…/videos/0001-….gif`) | ruta relativa (`videos/0001-….gif`) |

Divergencias que no son de tamaño, sino de modelo:

- **El servidor no puede filtrar por disponibilidad.** `availableInCronosGym` (1 135 de 1 324) solo existe en el JSON local; el `ExerciseBrowser` consume la tabla y no puede aplicar el mismo criterio que el selector del entrenamiento activo.
- **El servidor pierde la atribución.** El dataset declara «© Gym visual — https://gymvisual.com/» en los 1 324 registros (un único valor distinto, verificado) y ni el campo `attribution` ni `available` existen en la tabla: quien consume el catálogo desde Supabase **no puede saber de dónde viene la imagen**.
- **El servidor pierde la musculatura secundaria y el medio estático**: `secondary_muscles`, `image` y `media_id` no están en la tabla.
- **Los medios tienen dos bases según la ruta de entrada.** El mismo ejercicio tiene dos URLs según de dónde venga.
- **El comentario del esquema está desactualizado**: `schema.sql:9` dice *«id matches the dataset id ("0001".."1713")»*, pero el id máximo real es **5201**.
- **La política de escritura que el código cita no existe.** `seedExercises.ts:135` afirma que escribe «through the `exercises_insert_authenticated` policy», pero en `supabase/schema.sql` y en las 7 migraciones **la única política sobre `exercises` es `exercises_select_authenticated`**. El seeding no tiene política de escritura en el repositorio.

### 3.2 Taxonomía: un campo redundante y tres vocabularios musculares

**`category` es idéntico a `body_part`** en los 1 324 registros: mismos 10 valores, mismas frecuencias.

| `body_part` ≡ `category` | Nº | | `target` | Nº | | `muscle_group` | Nº |
|---|---|---|---|---|---|---|---|
| upper arms | 292 | | abs | 169 | | shoulders | 191 |
| upper legs | 227 | | pectorals | 158 | | forearms | 165 |
| back | 203 | | biceps | 151 | | biceps | 164 |
| waist | 169 | | glutes | 144 | | triceps | 161 |
| chest | 163 | | delts | 143 | | hamstrings | 127 |
| shoulders | 143 | | triceps | 141 | | quadriceps | 110 |
| lower legs | 59 | | upper back | 88 | | glutes | 71 |
| lower arms | 37 | | lats | 81 | | obliques | 67 |
| cardio | 29 | | calves | 59 | | hip flexors | 66 |
| neck | 2 | | quads | 44 | | chest | 53 |
| | | | forearms | 37 | | trapezius | 36 |
| | | | cardiovascular system | 29 | | traps | 32 |
| | | | hamstrings | 28 | | deltoids | 24 |
| | | | spine | 19 | | calves | 11 |
| | | | traps | 15 | | ankles | 11 |
| | | | adductors | 6 | | core | 7 |
| | | | serratus anterior | 5 | | lower back | 6 |
| | | | abductors | 5 | | rotator cuff | 4 |
| | | | levator scapulae | 2 | | soleus | 4 |
| | | | | | | rhomboids, wrist flexors, latissimus dorsi, abdominals | 2 |
| | | | | | | ankle stabilizers, upper back, wrist extensors, lats, wrists, hands | 1 |

**Los tres vocabularios se solapan y se contradicen:**

| Músculo | `target` | `muscle_group` | `secondary_muscles` | Problema |
|---|---|---|---|---|
| pectoral | `pectorals` (158) | `chest` (53) | `chest`, `upper chest` | dos nombres para lo mismo, repartidos |
| deltoides | `delts` (143) | `deltoids` (24) | `deltoids`, `shoulders`, `rear deltoids` | tres nombres |
| cuádriceps | `quads` (44) | `quadriceps` (110) | `quadriceps` | dos nombres con alcances distintos |
| dorsal ancho | `lats` (81) | `lats` (1), `latissimus dorsi` (2) | `lats`, `latissimus dorsi` | el mismo músculo partido en 3 filas distintas |
| abdomen | `abs` (169) | `abdominals` (2), `obliques` (67), `core` (7) | `abdominals`, `obliques`, `core`, `lower abs` | cuatro nombres |
| trapecio | `traps` (15) | `traps` (32), `trapezius` (36) | `traps`, `trapezius` | dos nombres |
| dorsal alto | `upper back` (88) | `upper back` (1) | `upper back`, `back` | mismo nombre, alcances distintos |
| isquiotibiales | `hamstrings` (28) | `hamstrings` (127) | `hamstrings` | mismo nombre, redistribuido |
| gemelos | `calves` (59) | `calves` (11), `soleus` (4) | `calves`, `soleus` | sub-músculo promoted a grupo |

**`secondary_muscles` contiene 40 valores distintos**, muchos de los cuales no existen como `target` ni como `muscle_group`: `brachialis`, `grip muscles`, `sternocleidomastoid`, `wrist flexors`, `wrist extensors`, `ankle stabilizers`, `rotator cuff`, `rhomboids`, `rear deltoids`, `upper chest`, `lower abs`, `inner thighs`, `groin`, `shins`, `feet`, `hands`, `wrists`, `soleus`, `hip flexors`, `lower back`.

**El puente anatómico no lee los campos ricos.** `src/lib/muscleMap.ts` (319 líneas) existe exactamente para traducir esto, y su encabezado documenta un modelo que el JSON ya no tiene:

> «The catalog stores two columns: `body_part` (10 coarse regions) and `target` (19 specific muscles).»

`muscleMatchLevel(exercise: { target: string; body_part: string }, slug)` (líneas 271-282) recibe **solo** `target` y `body_part`. Ignora `muscle_group`, `secondary_muscles` y `category`. Y su comentario sobre los oblicuos es la confirmación textual de la deuda:

> «The catalog has no `obliques` target, so obliques map onto `abs`.»

…mientras el JSON **sí** trae `muscle_group: "obliques"` en **67** ejercicios, y `secondary_muscles` contiene `obliques` en 67 más. El puente que haría falta ya existe en los datos y no se está usando.

**Estructura de `muscleMap.ts`:** 23 definiciones (`MUSCLE_DEFINITIONS`), 15 habilitadas y 8 deshabilitadas (`hands`, `feet`, `knees`, `ankles`, `head`, `tibialis`, `hair`), una única alias explícita (`obliques → aliasOf: "abs"`), `BY_SLUG`, `ALL_SLUGS`, `muscleDefinition`, `enabledSlugs`, `disabledSlugs`, `MatchLevel = "primary" | "secondary"`, `muscleMatchLevel`, `exerciseMatchesMuscle`, `catalogVocabulary`.

**Equipamiento: 28 tokens con sinónimos no resueltos.**

| Valor | Nº | Observación |
|---|---|---|
| `body weight` | 325 | |
| `dumbbell` | 294 | |
| `cable` | 157 | |
| `barbell` | 154 | convive con `olympic barbell` (2), `ez barbell` (23) y `trap bar` (1): cuatro formas de decir barra |
| `leverage machine` | 81 | *(ausente en inventarios previos)* |
| `band` | 54 | convive con `resistance band` (7): el mismo material con dos tokens |
| `smith machine` | 48 | *(ausente en inventarios previos)* |
| `kettlebell` | 41 | *(ausente en inventarios previos)* |
| `weighted` | 36 | token sin equipo concreto (peso corporal lastrado) |
| `stability ball` | 28 | *(ausente en inventarios previos)* |
| `ez barbell` | 23 | |
| `assisted` | 15 | no es un equipo, es un modificador (`assisted pull-up` necesita máquina, no banda) |
| `sled machine` | 15 | *(ausente en inventarios previos)* |
| `medicine ball` | 13 | |
| `rope` | 10 | |
| `roller` | 8 | |
| `resistance band` | 7 | |
| `bosu ball` | 3 | |
| `olympic barbell` | 2 | |
| `wheel roller` | 2 | |
| `upper body ergometer`, `skierg machine`, `hammer`, `stationary bike`, `tire`, `trap bar`, `elliptical machine`, `stepmill machine` | 1 | mayorías de un solo ejercicio: catálogo de facto no curado. `hammer` es el **ejercicio** de lanzamiento de martillo (cardio), no un tipo de material |

### 3.3 Dos catálogos de equipamiento y un puente de regex

| Archivo | Contenido verificado |
|---|---|
| `src/data/equipmentMap.ts` | **73** máquinas `CG-EQP-0001`…`CG-EQP-0074` (**falta `CG-EQP-0058`**), nombres en español («Extension Cuadriceps», «Sentadilla Hack», «Prensa 45 Grados») y **160** fotos (`public/images/gym-equipment/…`) |
| `src/data/availableEquipment.ts` | **34** *slugs* de tipo de ejercicio → ids de máquina (`leg_extension → CG-EQP-0001`…) + `freeEquipment` (pesos de mancuernas, discos, barras) |
| `src/data/equipmentCatalog.ts` | Fusión + **7 categorías** en español (`Polea`, `Máquina Selectorizada`, `Banco`, `Mancuernas`, `Barra / Discos`, `Peso Corporal`, `Accesorio`) + **46 reglas** de asignación |
| `src/data/myGymEquipment.ts` | `MY_GYM_MACHINES` (**32**), `MY_GYM_EQUIPMENT_TAGS`, `UNAVAILABLE_EQUIPMENT` (**16** tags), `MY_GYM_GROUPS`, `isAvailableInMyGym` |
| `src/data/gripMap.ts` | `Grip`, `gripMap` (**3** agarres), `getGripForExercise` — **placeholder**: devuelve el primer agarre ante cualquier ejercicio |

**El puente es frágil por construcción.** `getEquipmentSuggestionForExercise` (`equipmentCatalog.ts:256-308`) concatena nombre y equipamiento y prueba **46 regex** en orden:

```ts
for (const rule of EQUIPMENT_RULES) {
  if (rule.matches.test(allText)) return buildSuggestion(rule);
}
// …dos fallbacks por slug que ya no se pueden alcanzar…
```

La **última** regla es `{ matches: /.*/, primary: "CG-EQP-0022", alternatives: [...] }` (línea 250): casa con cualquier texto, así que el bucle siempre retorna. Los dos fallbacks siguientes —los únicos que consumen los 34 slugs de `availableEquipment.ts`— son **código inalcanzable** (`equipmentCatalog.ts:270-307`).

Consecuencias:

- La asignación de máquina depende de **regex sobre el nombre en inglés** del ejercicio. Un ejercicio cuyo nombre no case con ninguna regla recibe la torre de poleas por defecto (`CG-EQP-0022`), aunque sea una sentadilla con barra.
- `availableEquipment.ts` **no participa en ninguna decisión de asignación**: solo se usa para poblar el metadato `exerciseTypes` de cada máquina.
- La categoría de cada máquina está **inferida a mano por id** (`equipmentCategories`, `equipmentCatalog.ts:35-109`): `CG-EQP-0001` («Extension Cuadriceps») y `CG-EQP-0005` («Maquina Abductores Aductores») están ambas como «Máquina Selectorizada», y `CG-EQP-0013` («Maquina Curl Biceps Predicador») también, cuando `availableEquipment.ts` la llama `preacher_curl_machine`.
- Las fotos son el único medio **local y correcto** del proyecto, y aun así fallan por la ruta (§3.5).

**Exports muertos** (verificados por grep sobre todo `src/`): `equipmentCatalog`, `exerciseNameToSlug`, `EQUIPMENT_RULES`, `getEquipmentForExercise`, `getEquipmentById`, `getEquipmentByCategory`, `UNAVAILABLE_EQUIPMENT`, `MY_GYM_GROUPS`, `gripMap` (valor) y `getGripForExercise` — ninguno se importa fuera de su propio fichero. Vivos: `getEquipmentSuggestionForExercise` (`ExerciseSelectorModal`, `ActiveWorkout`), `isAvailableInMyGym` (`exerciseSwap`), `MY_GYM_EQUIPMENT_TAGS`/`MY_GYM_MACHINES` (`ai/tools`, `RoutinesPage`).

### 3.4 Identidad, nombres y duplicados

- **Ids**: de `0001` a `5201`, **1 324 usados y 3 877 huecos**. El comentario del esquema (`schema.sql:9`) dice *«id matches the dataset id ("0001".."1713")»* → **desactualizado**. El espacio de ids es disperso y viene de un dataset fusionado, sin clave sustituta local.
- **Nombres duplicados: 6 pares**, y en **los 6 coinciden `target`, `equipment`, `body_part` y `muscle_group`**:

| Nombre | Ids | `target` | `equipment` | `body_part` | `muscle_group` |
|---|---|---|---|---|---|
| `barbell seated calf raise` | 0088, 1371 | `calves` | `barbell` | lower legs | hamstrings |
| `ez barbell spider curl` | 0454, 1628 | `biceps` | `ez barbell` | upper arms | forearms |
| `lever chest press` | 0576, 0577 | `pectorals` | leverage machine | chest | triceps |
| `push-up (on stability ball)` | 0655, 0656 | `pectorals` | stability ball | chest | triceps |
| `self assisted inverse leg curl` | 0697, 1766 | `hamstrings` | body weight | upper legs | glutes |
| `smith reverse calf raises` | 0763, 1394 | `calves` | smith machine | lower legs | hamstrings |

`useExerciseCatalog.find()` (`useExerciseCatalog.ts:66-76`) declara:

> «Scoped first: two exercises can share a name across regions, and the muscle the user assigned in the mapping step is the disambiguator.»

Para estos 6 el músculo **no** desambigua: el filtrado por `target` deja las dos filas y `find` devuelve la primera. Un importador que resuelva «lever chest press» puede escribir la serie contra la fila equivocada — exactamente lo que el comentario dice querer evitar.

El importador CSV no añade desambiguación: `planBatch` (`src/lib/import/commit.ts:155-204`) llama a un callback inyectado `options.resolveExercise(set.exerciseName)` y, si devuelve `null`, añade el nombre a `unresolved` y **descarta las series** (líneas 167-171). No hay coincidencia aproximada ni aviso de ambigüedad: un nombre ambiguo se reporta como no resuelto, aunque una de las dos filas sea la correcta.

- **`media_id`**: 1 324 valores únicos de 7 caracteres alfanuméricos (`2gPfomN`). Es la clave de medio del dataset y **no existe en la tabla `exercises`**: es lo que permitiría distinguir un medio de otro sin depender del `id` del ejercicio.
- **`created_at`**: las 1 324 filas comparten la misma ventana temporal (`2026-03-18T12:31:32.854798Z` … `…906631Z`): es la marca de la generación del dataset, no del ejercicio. **Dato redundante**.

### 3.5 Medios: 14 puntos de render, 4 rotos, 1 versión móvil

**A. Los 10 puntos de render de `gif_url`:**

| Punto de uso | ¿Resuelve la ruta? | Resultado |
|---|---|---|
| `ExerciseSelectorModal.tsx:347` | Sí (`resolveImageSrc`) | ❌ 404 (ruta relativa, ver B) |
| `ActiveWorkout.tsx:862` | No | ✅ si el servidor sembró la URL absoluta |
| `ExerciseBrowser.tsx:728` | No | ✅ ídem |
| `ExerciseCard.tsx:62` | No | ✅ ídem |
| `ExercisePanel.tsx:53` | No | ✅ ídem |
| `ExerciseDetailSheet.tsx:83` | No | ✅ ídem |
| `ExerciseCarousel.tsx:235` (vía `exerciseGif`, :415) | No | ✅ ídem |
| `workout/ExerciseStage.tsx:269` (vía `gif`, :262) | No | ✅ ídem |
| `hub/DemoTab.tsx:110` (vía `gif`, :100) | No | ✅ ídem |
| `TutorialModal.tsx:51` | No | ✅ ídem |

**B. La miniatura del selector modal está rota por construcción.** El JSON guarda `gif_url: "videos/0001-2gPfomN.gif"` e `image: "images/0001-2gPfomN.jpg"`. `resolveImageSrc` (`ExerciseSelectorModal.tsx:61-63`) solo quita el prefijo `public/`:

```ts
function resolveImageSrc(src: string): string {
  return src.replace(/^public\//, "/");
}
```

`videos/0001-2gPfomN.gif` no empieza por `public/`, así que sale intacta y se convierte en una **URL relativa a la ruta actual** (`/entrenar/videos/0001-2gPfomN.gif`). **No existe `public/videos/`**: el árbol de `public/` es `logo.jpg` + `public/images/gym-equipment/`, **161 archivos, 24 356 165 B, todos `.jpg`** (verificado). Resultado: la miniatura de las 1 135 tarjetas del selector no carga.

**C. Las fotos de maquinaria no cargan en 3 de 4 puntos de uso.** `equipmentMap.ts` almacena `"public/images/gym-equipment/CG-EQP-0001_….jpg"` (160 referencias, todas distintas). En Vite, `public/` se sirve **en la raíz**, así que la URL correcta es `/images/gym-equipment/…`:

| Punto de uso | ¿Aplica `resolveImageSrc`? | Resultado |
|---|---|---|
| `ExerciseSelectorModal.tsx:423` | Sí | ✅ carga |
| `EquipmentModal.tsx:82` | **No** | ❌ 404 |
| `ActiveWorkout.tsx:932` (miniatura 32 px) | **No** | ❌ 404 |
| `ActiveWorkout.tsx:1396` (chip de equipo) | **No** | ❌ 404 |

**D. El campo `image` (fotograma estático) no se usa en ninguna parte.** El JSON trae 1 324 URLs de imagen fija y ningún componente las lee: solo `gif_url`. Es exactamente el recurso que debería sustituir al GIF en una lista de 48 × 48 px.

**E. Los GIF vienen de un CDN de GitHub sin versión fijada.**

```
https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0001-2gPfomN.gif
```

`main` es una rama móvil: el contenido puede cambiar sin que cambie el catálogo, y no hay `integrity`, ni `Cache-Control` propio, ni copia local. `seedExercises.ts:74` permite sobrescribir la URL del dataset con `VITE_EXERCISES_DATA_URL`, pero **las URLs de medios se derivan de la misma constante `RAW_BASE`** (`seedExercises.ts:21, 59`), de modo que cambiar el dataset no cambia la base de los medios.

**F. Las fotos de maquinaria pesan 24,3 MB sin variantes.** 160 JPEG de ~150 KB, sin WebP, sin tamaños responsivos, sin miniatura; se copian íntegros a `dist/`. Se piden con `loading="lazy"` (`EquipmentModal.tsx:85`), lo cual está bien, pero la primera pantalla de un modal de 2 vistas por máquina descarga 300 KB para mostrar una miniatura de 32 px en la sesión activa.

### 3.6 Offline e IndexedDB (`cronos-offline`)

**Base de datos** (`src/lib/idb.ts`, 177 líneas): nombre **`cronos-offline`**, **versión 5**, 7 object stores declarados en la tabla `STORES` (líneas 52-91) con `onupgradeneeded` **aditivo** (líneas 114-121: si el store ya existe, se salta).

| Store | Key path | Índices | Escrito por | Leído por | Estado |
|---|---|---|---|---|---|
| `drafts` | `logId` | — | `saveDraft` (`offlineStore.ts:106`), `deleteDraft` (:159) | `loadDraft` (:129), `loadRecoverableDraft` (:138) → `ActiveWorkout.tsx:1599`, `useActiveSetProgress.ts:84`, `sessionSync.ts:114` | ✅ vivo |
| `queue` | `id` | `createdAt` | `enqueueFinalize` (:165), `removeFromQueue` (:186), `updateQueueOp` (:190) | `listQueue` (:181) → `sessionSync.ts:106`; `queueLength` (:194) → `useOfflineSync.ts:44,53` | ✅ vivo |
| `rankHistory` | `id` | `day`, `slug` | `appendRankHistory` (`rankHistory.ts:82`) | `loadRankHistory` (:89), `loadRankHistoryFor` (:97) → `useMuscleRanks.ts:387,445` | ✅ vivo |
| `lastRanks` | `slug` | — | `saveLastRanks` (:112) | `loadLastRanks` (:116) → `useMuscleRanks.ts:384,426` | ✅ vivo |
| `coachChats` | `id` | — | `chatStorage.ts:73,89,95,123` | `chatStorage.ts:51,80,112` → `CoachChat.tsx:57` | ✅ vivo |
| `exerciseNotes` | `setId` | `exercise_id` | — | — | ❌ **MUERTO** (solo `idb.ts:79` y `idb.test.ts:76,78,89`) |
| `localState` | `key` | — | `saveLocalState` (`localState.ts`) | `readLocalRole` (`localSession.ts:40-43`) → `ProfilePage.tsx:106`, `coachAssistant.ts:277` | ✅ vivo |

**Precisión sobre `exerciseNotes`:** `src/lib/exercise/exerciseNotes.ts` (210 líneas) es un módulo **puramente funcional** (validación de longitud, `collectNotes`, `recentNotes`, `searchNotes`, `fold`, `noteCoverage`) que opera sobre `ExerciseSetRecord[]` en memoria. Su comentario de cabecera menciona «the local store is keyed by `setId`», pero **nunca llama a `tx()` ni importa `idb.ts`**. El store IndexedDB homónimo está declarado, indexado y testeado, y **no lo usa nadie**. Es un resto de diseño, exactamente de la misma clase que la columna `default_graph_id` de FitNotes (que sí está viva) y que el store `exerciseNotes` de Cronos (que no).

**No hay TTL ni expiración.** `offlineStore.ts` no contiene ninguna lógica de caducidad (verificado por grep de `ttl|expir`): los borradores persisten hasta que se borran, y la cola hasta que drena.

**Protocolo de sincronización** (`useOfflineSync.ts` + `sessionSync.ts`):

- `useOfflineSync`: al evento `online`, al `visibilitychange` a visible, y cada 60 s mientras `navigator.onLine`; drena en montaje si hay red. Sin backoff exponencial.
- `sessionSync.pushSession`: `upsert` de `workout_logs` con `onConflict: "id"`, `delete` de `completed_sets` por `log_id` y `insert` de las series → **reemplazo idempotente**: reejecutar deja el mismo estado.
- `sessionSync.drainQueue`: procesa la cola de más antigua a más nueva; en error **reintentable** (`fetch`/`network`/`timeout`/`connection`/502/503/504) rompe el drenaje y reintenta después; en error **no reintentable** descarta la operación para siempre (`sessionSync.ts:132-137`).
- **Cola determinista**: el id de la operación es `finalize:<logId>`, así que re-finalizar reemplaza en vez de duplicar.

**Comportamiento ante falta de conexión (catálogo y medios):**

| Aspecto | Comportamiento actual |
|---|---|
| Catálogo de ejercicios | **No disponible.** `useExerciseCatalog` consulta Supabase en vivo (`select("*")`) y guarda solo en estado de React. No hay copia en IndexedDB. |
| Fallback del catálogo | `seedExercises.loadExercises()` → `fetch` a GitHub raw, **también de red**, con caché **solo en memoria** (`CACHE_TTL_MS = 24 h`, `seedExercises.ts:69`) y deduplicación de peticiones en vuelo (líneas 70-72, 94-121). |
| Medios (GIF/JPG) | **No disponibles.** Todos los `src` son URLs vivas; no hay `fetch`+caché de medios en ningún sitio. |
| Service worker / PWA | **No existe.** Ni `public/sw.js`, ni `workbox`, ni `CacheStorage`, ni `vite-plugin-pwa`; `vite.config.ts` solo declara `react()` y `tsconfigPaths()`. `package.json` no tiene dependencias de PWA. |
| Señal de offline | Únicamente `navigator.onLine` (`useOfflineSync.ts:33, 89`). No hay `online`/`offline` en el resto de la app. |
| Lo que **sí** funciona offline | Sesiones en curso: `drafts` + `queue` en IndexedDB, reintentadas al volver la red. |
| **Arranque en frío sin red** | **La app abre sin catálogo y sin demos.** El `ExerciseSelectorModal` sí abre (importa el JSON del bundle) pero **sus miniaturas no cargan**; el `ExerciseBrowser` cae en `loadExercises()` y falla la petición. |

**Conclusión de la auditoría offline:** el sistema de sesión offline de Cronos está **bien construido** (id de cliente, cola idempotente, degradación a no-op) y es la pieza más sólida del subsistema. Lo que falta es su **complemento natural**: el catálogo y los medios son, hoy, los únicos datos que la app necesita **siempre** y que **no** sobreviven a un arranque sin red — mientras que los datos que sí sobreviven (la sesión en curso) son los que menosurgentemente hacen falta.

### 3.7 Atribución y licencias

El dataset trae `attribution: "© Gym visual — https://gymvisual.com/"` en los **1 324** registros (un único valor distinto, verificado). La tabla `exercises` **no tiene columna de atribución**, ni la tiene el tipo `Exercise` de `src/types/supabase.ts:22-51`. Consecuencia: el catálogo que consume la app desde el servidor entrega imágenes de terceros **sin su crédito ni su licencia**, y sin ninguna forma de mostrarla. Los campos `image` y `media_id` siguen el mismo camino.

### 3.8 Rendimiento de carga

| Problema | Evidencia | Coste |
|---|---|---|
| **Catálogo completo en el bundle** | `ExerciseSelectorModal.tsx:17` importa el JSON de 16,3 MB; `vite.config.ts` solo separa `react`, `supabase`, `ui` | El JS inicial carga los 16,3 MB (≈12,3 KB por ejercicio) para un modal que se usa una vez |
| **Filtro lineal sobre objetos con 10 idiomas** | `ExerciseSelectorModal.tsx:79-85`: `catalog.filter(...)` en cada tecla, sobre 1 324 objetos que cada uno lleva 20 blobs de texto | Cada tecla recorre 16 MB de cadenas |
| **Re-evaluación de 46 regex por ejercicio y por filtro** | `ExerciseSelectorModal.tsx:87-96` construye `suggestions` con `getEquipmentSuggestionForExercise` para **cada** ejercicio filtrado | Con 1 135 ejercicios: ~52 000 pruebas de regex por cambio de filtro, repetidas en cada tecla |
| **Lectura de la tabla completa** | `useExerciseCatalog.ts:56`: `select("*")` sin paginación, sin filtro, sin caché local | 1 324 filas × 7 columnas en cada montaje del importador |
| **Sin índice en `name`** | `schema.sql:21-23` indexa `body_part`, `equipment`, `target` | La resolución por nombre del importador es 100 % cliente: trae la tabla entera para filtrar en memoria |
| **Virtualización con altura medida durante el render** | `ExerciseSelectorModal.tsx:98`: `listRef.current?.clientHeight` se lee en el render; el primer render usa el fallback 336 px | La lista renderiza con una ventana equivocada hasta el primer scroll, y no reacciona a cambios de tamaño (no hay `ResizeObserver`) |
| **Dos fuentes de verdad en el navegador** | `ExerciseBrowser.tsx:124` cae a `loadExercises()` (fetch a GitHub raw) cuando la tabla falla | Un catálogo de 1 324 filas en un fetch remoto de 16 MB, con caché solo en memoria (24 h) y sin IndexedDB |
| **Fotografías de maquinaria en `dist/`** | 160 JPEG, 24,3 MB, sin variantes | Se copian íntegros al artefacto de build |

> El `dist/` presente en el repositorio está **incompleto** (111 archivos, 19 671 947 B, **sin `index.html`**), por lo que **no se pudo medir** el tamaño real del bundle con una build. El impacto de los 16,3 MB se deriva del import estático, que es verificable por lectura (`ExerciseSelectorModal.tsx:17`); conviene confirmarlo con `npm run build` y el informe de Vite antes de dimensionar la migración.

### 3.9 Inventario de archivos del subsistema

| Archivo | Tamaño / contenido | Papel |
|---|---|---|
| `src/data/exercisesCatalog.json` | 16 265 338 B | catálogo local completo (1 324 ejercicios, 16 campos, 10 idiomas) |
| `src/data/equipmentMap.ts` | 73 máquinas + 160 rutas de foto | inventario del gimnasio |
| `src/data/equipmentCatalog.ts` | 346 líneas | fusión + 7 categorías + **46** reglas regex |
| `src/data/availableEquipment.ts` | 48 líneas | 34 slugs → máquinas + `freeEquipment` |
| `src/data/myGymEquipment.ts` | 102 líneas | 32 máquinas del usuario + 16 tags no disponibles |
| `src/data/gripMap.ts` | 43 líneas | 3 agarres; **placeholder** |
| `src/lib/muscleMap.ts` | 319 líneas | puente anatomía → catálogo (solo `target`/`body_part`) |
| `src/lib/muscleFilter.ts` | — | filtrado por músculo |
| `src/hooks/useExerciseCatalog.ts` | 79 líneas | lectura de la tabla + `find()` |
| `src/services/seedExercises.ts` | 146 líneas | siembra + fallback remoto + prefijo de medios |
| `src/lib/idb.ts` | 177 líneas | `cronos-offline` v5, 7 stores |
| `src/lib/offlineStore.ts` | 223 líneas | borradores + cola de sincronización |
| `src/lib/import/*` | — | importación CSV: `analyze` → `commit` → `planBatch` |
| `public/images/gym-equipment/` | 160 archivos, 24,3 MB | fotos de maquinaria |
| `public/logo.jpg` | — | logotipo |
| `public/` (total) | **161 archivos, 24 356 165 B, 100 % `.jpg`** | sin GIF, sin `videos/`, sin `images/` de ejercicios |

---

## 4. Matriz comparativa de taxonomía

| Capacidad | JEFIT | Hevy | FitNotes | Symmetry | **Cronos** |
|---|---|---|---|---|---|
| Grupos musculares jerárquicos | ✅ `parentGroupId` | ✅ 19 → 6 simplificados | ❌ 8 planas | ❌ 17 planas | ❌ `muscleMap.ts` plano (23 slugs anatómicos) |
| Músculo principal por ejercicio | ✅ (`role` en el mapa) | ✅ `primaryMuscles` | ✅ (categoría) | ✅ `primaryMuscles` | ⚠️ `target` (1 de 3 vocabularios) |
| Músculo secundario | ✅ lista con rol | ✅ lista (`secondaryMuscles`) | ❌ | ✅ lista (`secondaryMuscles`) | ⚠️ `secondary_muscles` como **string**, no lista; ausente en el servidor |
| Grupo muscular principal (resumen) | ✅ derivado de la jerarquía | ✅ `simplifiedMuscleGroup` (6) | ⚠️ `Category` (8) | ✅ `exercise_category` | ⚠️ `body_part` (10), **independiente** del músculo y con 2 regiones no musculares (`cardio`, `neck`) |
| % de implicación | ✅ `involvement_percent` (double) | ❌ (factor fijo 1 / 0,5) | ❌ | ❌ | ❌ |
| Patrones de movimiento | ✅ (con %) | ❌ | ❌ | ✅ `ExercisePattern` | ❌ |
| Articulaciones | ✅ | ❌ | ❌ | ❌ (`exercise_plane` es otra cosa) | ❌ |
| Compuesto / aislamiento | ✅ `TrainingType` primario/secundario | ❌ (solo prosa editorial) | ❌ | ✅ `isolation` + `ExerciseType` | ❌ |
| Tipos de entrenamiento (peso/reps/tiempo) | ✅ `TrainingType` jerárquico | ✅ | ✅ `ExerciseType` (enum de 10) | ✅ `ExerciseType` | ⚠️ `setKind` local, no ligado al catálogo |
| Equipamiento con tipo | ✅ `EquipmentTypesEntity` | ✅ `equipment_category` + granular | ❌ (0 modelado) | ✅ enum de 24 + `requiredEquipment` | ⚠️ 28 **strings** libres |
| Equipamiento con alternativas y opcionalidad | ✅ `parent_row_id`, `optional` | ⚠️ granular, sin `optional` visible | ❌ | ❌ | ❌ |
| Jerarquía de equipamiento | ✅ | ⚠️ granular | ❌ | ⚠️ por enum | ⚠️ 7 categorías planas, inferidas a mano por id |
| Miniatura de equipamiento | ✅ `thumbnail_url` | ✅ `exercise-thumbnails` | ❌ | ✅ 35 fotos empaquetadas | ✅ 160 fotos locales (rutas rotas) |
| Ejercicio como plantilla | ✅ `exercise_template` | ✅ `exerciseTemplateIds` | ❌ | ✅ `exerciseTemplateId` | ❌ (`id` del dataset, disperso) |
| Ejercicio creado por el usuario | ❌ | ✅ `isCustomExercise` + límite 7 | ✅ (local, sin marca) | ✅ `isCustom` + roles al alta | ❌ **inexistente** |
| Handle de duplicados | ✅ por id | ✅ duplicar → custom (`duplicateResolver`) | ✅ check manual de nombre | ✅ distancia de edición + `ImportDuplicatesModel` | ❌ 6 colisiones irresolubles |
| Identidad estable | `id` numérico | template id | `_id` autoincremental | `exerciseTemplateId` + `legacy_v1_id_map.json` congelado | ⚠️ `id` textual disperso (`0001`…`5201`, 3 877 huecos) |
| Atribución/licencia por ejercicio | ⚠️ no visible en el modelo | ❌ | ❌ | ❌ | ⚠️ en el JSON local, **ausente en el servidor** |
| Agrupación (superset) | ❌ | ✅ `superset_id` | ❌ | ❌ | ❌ |
| Catálogo empaquetado en el cliente | ❌ (API) | ✅ thumbnails `@3x` | ✅ (SQLite local) | ⚠️ JSON de planes, no de ejercicios | ⚠️ **16,3 MB de JSON en el bundle** |
| Soporte offline del catálogo | ✅ `usersync/{id}.cache` | ❌ | ✅ (SQLite) | ⚠️ precache de thumbnails | ❌ **no hay copia en IndexedDB** |

---

## 5. Matriz comparativa de medios

| Aspecto | JEFIT | Hevy | FitNotes | Symmetry | **Cronos** |
|---|---|---|---|---|---|
| Origen del catálogo | API `api.jefit.com` | servidor | SQLite local (`database.db` v22) | JSON empaquetados + API | **16,3 MB en el bundle + tabla Supabase** |
| URL base de medios | `cdn.jefit.com` | `d2l9nsnmtah87f.cloudfront.net` | — | `symmetry-assets.com/public` | `raw.githubusercontent.com/…/main` (**rama móvil**) |
| Imagen de ejercicio | JPG 960×590 (`{id}.jpg`) | miniatura (`exercise-thumbnails/…_thumbnail`) | ❌ | WebP (`qw_*.webp`) | JPG (`images/{id}-{media_id}.jpg`) — **campo no usado** |
| Demostración | ❌ (imagen fija) | **MP4** (`exercise-assets/…{Grupo}.mp4`) | ❌ | MP4 / HLS (`video_player`) | **GIF** (`videos/{id}-{media_id}.gif`) |
| Nº de URLs de medios | n/d | **672 MP4 + 826 thumbs = 1 498** | 0 | dinámicos | 1 324 GIF + 1 324 JPG (del dataset) |
| Assets empaquetados | 6 GIF de UI | thumbnails `@3x` del catálogo | 0 de ejercicios | 17 diagramas musculares, 35 fotos de equipo, 1 MP4, 2 GIF de UI | **160 fotos de maquinaria + logo** |
| Naming del medio | `{exerciseId}.jpg` | `{id}-{flags}-{Nombre}_{Grupo}.mp4` | — | `qw_*.webp` | `{id}-{media_id}.gif` / `.jpg` |
| Compresión / formatos | JPG | JPG `@3x`, sin parámetros de red | — | **WebP + `blurhash` + `flutter_image_compress`** | JPEG a ~150 KB, **sin WebP ni responsivas** |
| Caché de medios en disco | Glide + Coil (implícita) | ❌ sin política explícita | ❌ | ✅ `flutter_cache_manager` + precarga | ❌ **ninguna** |
| Service worker / PWA | ❌ | ❌ | ❌ | ❌ | ❌ (ausente en las 5) |
| Placeholder / degradación | ✔️ | ✔️ | n/a | ✔️ `blurhash` | ✔️ (fallback en los 10 puntos de render) |
| Versión del contenido | ✅ cifrado + clave | ❌ | n/a | ✅ `equipmentVersion`, `legacy_v1_id_map` congelado | ❌ `main` + `created_at` idéntico en las 1 324 filas |

---

## 6. Modelo de catálogo propuesto

### 6.1 Principios

El objetivo no es clonar las seis dimensiones de JEFIT, sino adoptar su **forma**: tablas de referencia con jerarquía y tablas de relación con roles y porcentajes, de modo que la taxonomía deje de ser un string suelto. Y no clonar la taxonomía de Hevy en bloque, sino **su idea clave**: dos niveles de grupo muscular (detallado + resumen) y una ponderación explícita de la contribución secundaria.

Reglas de normalización del vocabulario (a aplicar **en un generador**, nunca a mano):

- **Un solo nombre por músculo.** `pectorals`/`chest` → uno; `traps`/`trapezius`, `delts`/`deltoids`, `quads`/`quadriceps`, `lats`/`latissimus dorsi` → uno; `obliques` deja de ser alias de `abs`.
- **Sin sinónimos de equipamiento.** `band` ≡ `resistance band` → `resistance_band`; `barbell`/`olympic barbell`/`ez barbell`/`trap bar` → cuatro filas con `parent_id` común.
- **Un campo, un significado.** `category` desaparece (duplica `body_part`); `body_part` pasa a ser **derivado** de los músculos con mayor implicación, como hace Hevy con `simplifiedMuscleGroup`.
- **Los mods desaparecen de la taxonomía.** `assisted` y `weighted` no son tipos de equipo: son modificadores de la variante (`assisted pull-up` sigue siendo `pull_up`).
- **`created_at` no se propaga**: es la marca de generación del dataset, no del ejercicio.

### 6.2 Interfaces TypeScript

```ts
// src/types/catalog.ts — modelo de catálogo (propuesto, no aplicado)

/** Identificador estable de una tabla de referencia. */
export type CatalogId = string;

/** Rol del músculo dentro de un ejercicio. */
export type MuscleRole = "primary" | "secondary" | "stabilizer";

/**
 * Grupo muscular canónico.
 *
 * `parentId` da la jerarquía (hombro -> deltoides -> lateral) que necesita el
 * mapa anatómico; `simplifiedKey` es el grupo resumen derivado (el
 * `simplifiedMuscleGroup` de Hevy), no una columna independiente y duplicada.
 */
export interface MuscleGroup {
  id: CatalogId;
  slug: string;              // "chest", "deltoids", ...
  labelEs: string;
  parentId: CatalogId | null;
  simplifiedKey: string;     // "chest", "arms", "core", "legs", "back", "shoulders"
  enabled: boolean;          // false si no hay ejercicios (hoy: 8 slugs de muscleMap)
}

/** Músculo implicado en un ejercicio, con rol y porcentaje. */
export interface ExerciseMuscle {
  exerciseId: CatalogId;
  muscleId: CatalogId;
  role: MuscleRole;
  /** 0-100. Null si no se conoce (no se inventa). */
  involvementPct: number | null;
}

/** Tipo de equipamiento del catálogo maestro (independiente del gimnasio). */
export interface EquipmentType {
  id: CatalogId;
  code: string;              // "barbell", "resistance_band", "cable_machine"
  labelEs: string;
  category: string;          // "polea" | "selectorizada" | "banco" | ...
  parentId: CatalogId | null;// "barbell" -> "olympic_barbell", "ez_barbell", "trap_bar"
  thumbnailPath: string | null;
}

/** Equipamiento admitido por un ejercicio. */
export interface ExerciseEquipment {
  exerciseId: CatalogId;
  equipmentTypeId: CatalogId;
  role: "primary" | "alternative";
  optional: boolean;
}

/** Papel compuesto/aislamiento (el `TrainingType` de JEFIT, el `isolation` de Symmetry). */
export type MovementType = "compound" | "isolation" | "core" | "conditioning";

/** Patrón de movimiento (empuje, tirón, bisagra, sentadilla, …). */
export interface MovementPattern {
  id: CatalogId;
  code: string;
  labelEs: string;
}

/** Un medio (imagen, póster, demo) de un ejercicio. */
export interface ExerciseMedia {
  exerciseId: CatalogId;
  kind: "poster" | "demo" | "thumbnail";
  /** URL absoluta, versionada (commit SHA o hash de contenido). */
  url: string;
  mimeType: "image/jpeg" | "image/webp" | "image/png" | "video/mp4" | "image/gif";
  width: number | null;
  height: number | null;
  bytes: number | null;
  /** Hash del contenido: cache busting y verificación de integridad. */
  sha256: string | null;
}

/** Ejercicio del catálogo maestro. */
export interface CatalogExercise {
  id: CatalogId;             // id del dataset, inmutable
  slug: string;              // slug estable: clave de deduplicación y de URL
  name: string;
  nameEs: string | null;
  /** Grupo resumen (derivado de los músculos, no almacenado dos veces). */
  simplifiedKey: string;
  movementType: MovementType;
  movementPatternId: CatalogId | null;
  /** Instrucciones por idioma: { "es": ["…"], "en": ["…"] }. */
  instructions: Record<string, string[]>;
  attribution: string | null;
  available: boolean;
  muscles: ExerciseMuscle[];
  equipment: ExerciseEquipment[];
  media: ExerciseMedia[];
}

/**
 * Ejercicio creado por el usuario.
 *
 * `sourceExerciseId` modela la duplicación de Hevy: al duplicar, el ejercicio
 * nuevo es del usuario y apunta al original. Nunca se muta el catálogo base.
 */
export interface UserExercise {
  id: CatalogId;             // uuid, generado en cliente (mismo patrón que workout_logs)
  userId: string;
  sourceExerciseId: CatalogId | null;
  name: string;
  nameEs: string | null;
  muscles: ExerciseMuscle[];
  equipment: ExerciseEquipment[];
  media: ExerciseMedia[];
  createdAt: string;
  updatedAt: string;
}
```

### 6.3 DDL

```sql
-- ---------------------------------------------------------------------------
-- Catálogo maestro: identidad, presentación y relaciones tipadas.
-- Sustituye a public.exercises (7 columnas sueltas) sin perder ningún dato
-- del JSON local: los 9 campos que el servidor no tenía entran aquí.
-- ---------------------------------------------------------------------------

create table public.exercises (
  id                text primary key,                 -- id del dataset ("0001".."5201"), inmutable
  slug              text unique not null,              -- clave de deduplicación y de URL
  name              text not null,
  name_es           text,
  simplified_key    text not null,                     -- grupo resumen derivado (no duplicado)
  movement_type     text not null                      -- compound | isolation | core | conditioning
                      check (movement_type in ('compound','isolation','core','conditioning')),
  movement_pattern_id text,
  instructions      jsonb not null default '{}'::jsonb, -- { "es": ["…"], "en": ["…"] }
  attribution       text,                              -- "© Gym visual — https://gymvisual.com/"
  available         boolean not null default true,
  media_id          text,                              -- clave de medio del dataset
  updated_at        timestamptz not null default now()
);

create index idx_exercises_slug           on public.exercises (slug);
create index idx_exercises_simplified_key on public.exercises (simplified_key);
create index idx_exercises_movement_type  on public.exercises (movement_type);
create index idx_exercises_name_lower     on public.exercises (lower(name));
create index idx_exercises_available      on public.exercises (available) where available;

-- Tablas de referencia ------------------------------------------------------

create table public.muscle_groups (
  id             text primary key,
  slug           text unique not null,
  label_es       text not null,
  parent_id      text references public.muscle_groups (id) on delete set null,
  simplified_key text not null,                        -- resumen de 6 valores, como Hevy
  enabled        boolean not null default true
);

create table public.equipment_types (
  id             text primary key,
  code           text unique not null,                 -- "barbell", "resistance_band", ...
  label_es       text not null,
  category       text not null,                        -- 7 categorías actuales
  parent_id      text references public.equipment_types (id) on delete set null,
  thumbnail_path text
);

create table public.movement_patterns (
  id       text primary key,
  code     text unique not null,
  label_es text not null
);

-- Tablas de relación --------------------------------------------------------

create table public.exercise_muscles (
  exercise_id      text not null references public.exercises (id) on delete cascade,
  muscle_id        text not null references public.muscle_groups (id),
  role             text not null check (role in ('primary','secondary','stabilizer')),
  involvement_pct  numeric(5,2) check (involvement_pct between 0 and 100),
  primary key (exercise_id, muscle_id)
);

create table public.exercise_equipment (
  exercise_id       text not null references public.exercises (id) on delete cascade,
  equipment_type_id text not null references public.equipment_types (id),
  role              text not null default 'primary' check (role in ('primary','alternative')),
  optional          boolean not null default false,
  primary key (exercise_id, equipment_type_id)
);

create table public.exercise_media (
  exercise_id text not null references public.exercises (id) on delete cascade,
  kind        text not null check (kind in ('poster','demo','thumbnail')),
  url         text not null,                            -- absoluta y versionada
  mime_type   text not null,
  width       int,
  height      int,
  bytes       int,
  sha256      text,
  primary key (exercise_id, kind)
);

create index idx_exercise_muscles_muscle  on public.exercise_muscles (muscle_id);
create index idx_exercise_media_exercise   on public.exercise_media (exercise_id);

-- Ejercicios creados por el usuario -----------------------------------------

create table public.user_exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  source_exercise_id text references public.exercises (id) on delete set null,
  name              text not null,
  name_es           text,
  instructions      jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_user_exercises_user on public.user_exercises (user_id);

alter table public.user_exercises enable row level security;

create policy "user_exercises_crud_own"
  on public.user_exercises
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

**Notas de migración:**

- `public.exercises` actual **se conserva** como vista materializada o tabla de compatibilidad durante una versión, para no romper `useExerciseCatalog`, `routine_exercises` (`exercise_id text references public.exercises (id)`) ni `completed_sets` (`exercise_id text references public.exercises (id)`).
- `body_part`, `target` y `equipment` **no se borran**: pasan a ser columnas *derivadas* o vistas, alimentadas desde `exercise_muscles` y `exercise_equipment`, para que el motor de rangos (`src/lib/ranks/`) siga funcionando sin reescribirlo.
- La migración es **aditiva**: nada de lo existente cambia de nombre ni de tipo en el mismo despliegue.

---

## 7. Estrategia de medios

### 7.1 Decisiones

| Decisión | Detalle | Referencia |
|---|---|---|
| **Un solo resolvedor de medios** | Un `resolveMediaUrl(media: ExerciseMedia)` en `src/lib/media.ts` que aplique base configurada, versión e integridad. **Los 14 puntos de render pasan por ahí**; se elimina `resolveImageSrc` local del modal. | — |
| **Rutas correctas desde el origen** | `equipmentMap.ts` guarda `/images/gym-equipment/…` (raíz servida), no `public/images/…`. Con eso los 3 consumidores rotos vuelven a funcionar sin tocar nada más. | — |
| **Versión fijada del dataset y de los medios** | `RAW_BASE` pasa a apuntar a un **commit SHA**, no a `main`; la URL del dataset y la de los medios salen de la misma constante versionada. Alternativa preferida: servir los medios desde un bucket propio con `Cache-Control: immutable` y hash en la URL (`sha256` en la tabla `exercise_media`). | FitNotes (n/a), Symmetry (`legacy_v1_id_map.json` congelado + `equipmentVersion`) |
| **Póster en las listas, demo en la ficha** | En listas (48 × 48 px) se usa el **JPEG** (`image`), no el GIF; el GIF/vídeo se carga solo al ampliar la ficha. Elimina 1 135 animaciones por sesión. | Hevy (thumbnails en listas, MP4 en ficha) |
| **Formato de demo: vídeo, no GIF** | El GIF no escala, no se puede pausar ni buscar y pesa por orden de magnitud más que un MP4 de la misma demostración. Si se conserva el GIF por compatibilidad, al menos servirlo como **poster + vídeo con fallback**, no como única fuente. | Hevy (MP4), Symmetry (MP4/HLS) |
| **Fotos de maquinaria optimizadas** | WebP con fallback JPEG, 2 anchos (400 px / 800 px), miniatura de 160 px para los chips de 32 px, y `srcset`. Ahorro estimado: **24,3 MB → ~4 MB**. | Symmetry (`webp`, `flutter_image_compress`) |
| **Catálogo en disco, no en el bundle** | El JSON de 16,3 MB sale del import estático. Se sirve desde Supabase y se cachea en **IndexedDB** (store nuevo `catalog`), de modo que la app abre con catálogo sin red. | FitNotes (SQLite local), JEFIT (cache de sincronización) |
| **Payload del catálogo reducido** | En el servidor, `instructions` como `jsonb` por idioma y `available` como columna: el cliente descarga **porProjection**, no 16 MB. | — |
| **Shell offline** | Service worker (precache del bundle) + `catalog` en IndexedDB: sin red, la app abre y el catálogo está disponible. Cierra la brecha heredada de la Fase 2. | — |
| **Precarga de medios al entrar** | Precalentar los pósteres de los ejercicios visibles en la sesión activa, en una cola con prioridad, como hace Symmetry (`_precacheThumbnail`, `TrainingImagePrewarmer`). | Symmetry |

### 7.2 Formatos recomendados

| Uso | Formato | Tamaño | Motivo |
|---|---|---|---|
| Miniatura de lista (48–96 px) | **WebP** (fallback JPEG), 160 px | ~6–10 KB | Se pinta dozens de veces por pantalla; WebP reduce ~30 % frente a JPEG |
| Póster de ficha (960 × 590) | **WebP/JPEG** calidad 82 | ~60–90 KB | Es el tamaño nativo del dataset; no hace falta más resolución |
| Demo en ficha | **MP4 (H.264)** 480p sin audio, ≤ 3 s, en bucle | ~150–400 KB | Formato de Hevy y Symmetry; permite `preload="metadata"` y pausar |
| Demo en la sesión activa | **MP4** en streaming con `preload="none"` | — | No se descarga hasta que se reproduce |
| Fallback sin red | **Póster + icono**, nunca GIF animado | — | Degradación honesta y ligera |
| Fotos de maquinaria | **WebP** 2 anchos + miniatura de 160 px | ~15 KB (400 px) | Hoy son ~150 KB por foto en 3 puntos de uso |
| Placeholder mientras carga | **WebP de 20 px escalado** o `blurhash` | < 1 KB | Evita el salto de layout sin cargar el original |

### 7.3 Almacenamiento offline

```
IndexedDB "cronos-offline" (v5 → v6)
├── drafts, queue, rankHistory, lastRanks, coachChats, localState   (existentes)
├── exerciseNotes                                                     (EXISTENTE Y MUERTO → eliminar)
└── catalog                       (NUEVO)
    ├── key: "exercises"            → { version, updatedAt, rows: ExerciseDTO[] }
    ├── key: "mediaIndex"          → { version, urls: string[] }        (para purgar caché)
    └── key: "catalogMeta"         → { version, updatedAt, sourceUrl }
```

**Reglas:**

1. **El catálogo se hidrata desde el servidor y se cachea en `catalog`.** El arranque lee `catalog` primero (instantáneo, sin red) y refresca en segundo plano si hay red.
2. **Los medios se cachean en `CacheStorage`, no en IndexedDB.** Es la API hecha para esto: `caches.open("cronos-media-v1")`, `cache.match(url)` y `cache.put(url, response)`. El store `mediaIndex` guarda la lista de URLs para poder purgar por versión (`caches.delete("cronos-media-v1")` cuando cambia la versión del catálogo).
3. **Política de entrada:** solo se cachean los medios que el usuario ha visto (pósteres de listas, demos abiertas). Precalentado opcional de los 20 pósteres de la sesión activa.
4. **Sin red:** el póster cacheado se sirve; si no está, placeholder. **La demo nunca es un requisito** para registrar una serie: los 10 puntos de render de medios tienen fallback (4 con `imgError` — `ExerciseBrowser`, `ExerciseCard`, `ExerciseDetailSheet`, `ExercisePanel` — y 6 con comprobación de cadena vacía: `ActiveWorkout`, `ExerciseCarousel`, `ExerciseStage`, `DemoTab`, `TutorialModal`, `ExerciseSelectorModal`).
5. **Cuota:** IndexedDB y CacheStorage degradan a no-op ante cuota agotada (`idb.ts:125-126` ya resuelve `null` ante error; el mismo contrato debe aplicarse a la caché de medios). Un fallo de caché **nunca** puede romper un entrenamiento.
6. **El service worker precachea el bundle**, no los medios: el bundle es pequeño una vez extraído el catálogo del JSON, y precachear 1 324 GIF sería un `cache.addAll` de gigabytes.

**Presupuesto objetivo tras el refactor:**

| Recurso | Hoy | Objetivo |
|---|---|---|
| Bundle JS inicial | ~16,3 MB (catálogo dentro) | **< 1 MB** |
| Payload de catálogo en red | 16 MB (fallback a GitHub) o tabla completa sin paginar | **~300 KB** (porProjection) |
| Medios por sesión | 1 135 GIF en el selector | ~20 pósteres WebP (~200 KB) |
| `public/` | 24,3 MB de JPEG | **~4 MB** de WebP |
| Arranque sin red | **no funciona** | abre con catálogo + pósteres cacheados |

---

## 8. Casos de falla

| # | Escenario | Comportamiento actual | Impacto |
|---|---|---|---|
| C1 | Abrir el selector de ejercicios | Se descarga el JS con 16,3 MB de catálogo | La primera carga de la app carga 16 MB que no se usan |
| C2 | Escribir en el buscador del selector | `filter` + ~52 000 regex por tecla | El buscador se atasca con 1 135 ejercicios visibles |
| C3 | Ver la miniatura de un ejercicio en el selector | `src="videos/0001-….gif"` (relativa) | 404 en las 1 135 tarjetas |
| C4 | Ver la foto de una máquina en `EquipmentModal` | `src="public/images/…"` | 404: no hay imagen en ninguna vista |
| C5 | Ver el chip de máquina en la sesión activa | `src="public/images/…"` | 404: la miniatura de 32 px nunca aparece |
| C6 | Importar un CSV con «lever chest press» | 2 filas indistinguibles (0576/0577) | La serie puede escribirse contra el ejercicio equivocado |
| C7 | Importar un CSV con «barbell seated calf raise» | 2 filas (0088/1371), mismo `target` | Ídem |
| C8 | Consumir el catálogo desde Supabase | Sin `attribution`, sin `availableInCronosGym`, sin `secondary_muscles`, sin `image` | Se pierde la licencia de las imágenes y el criterio de disponibilidad |
| C9 | Usar el catálogo sin red (y con la tabla vacía) | `loadExercises()` → fetch de 16 MB a GitHub | Sin red no hay catálogo y sin IndexedDB no hay caché persistente |
| C10 | Buscar por nombre en la base | Sin índice en `name` | La resolución por nombre es siempre cliente y trae la tabla entera |
| C11 | Ejercicio cuyo nombre no casa con ninguna regla | Regla final `/.*/` → torre de poleas | Una sentadilla con barra puede recibir una máquina de poleas |
| C12 | Ejercicio con musculatura secundaria (`muscle_group: "obliques"`) | `muscleMap.ts` la ignora | El dato existe en el JSON (67 casos) y el puente no lo lee |
| C13 | Pesos de catálogo (`band` vs `resistance band`) | Dos tokens, sin equivalencia | Filtrar por material devuelve resultados inconsistentes |
| C14 | Reproducir la demo de un ejercicio en modo avión | URL a GitHub raw | Sin demostración; la app degrada a placeholder (bien), pero sin copia local |
| C15 | Un usuario quiere un ejercicio que no está en el catálogo | No hay ningún camino: no hay tabla, ni bandera, ni UI | **El usuario no puede registrar su propio movimiento** |
| C16 | El dataset upstream cambia `main` | Las URLs y los medios cambian sin aviso | El catálogo y sus demos dejan de corresponderse; no hay `integrity` ni versionado |
| C17 | Se ejecuta `seedExercises()` | Escribe «through the `exercises_insert_authenticated` policy», que **no existe** en `schema.sql` ni en las 7 migraciones | El seeding falla por RLS o depende de una política fuera del repositorio |
| C18 | Un ejercicio con `instructions` del JSON local llega a `ExerciseDetailSheet` | `instructions` es un objeto `{lang: string}` y el componente hace `.length` y `.map()` (`ExerciseDetailSheet.tsx:137,149`) | El bloque de instrucciones **no se renderiza** (silencioso) |
| C19 | `ExerciseBrowser` cae al fallback remoto | Fetch de 16 MB a GitHub, caché solo en memoria (24 h) | Sin red el catálogo desaparece; con red, se duplican 16 MB de transferencia |

---

## 9. Brechas

| ID | Brecha | Evidencia | Severidad |
|---|---|---|---|
| **C1** | El catálogo local de 16,3 MB entra en el bundle por import estático | `ExerciseSelectorModal.tsx:17`; `vite.config.ts` (sin chunk de catálogo) | **Crítica** (rendimiento) |
| **C2** | El servidor es un subconjunto del local: pierde atribución, disponibilidad, musculatura secundaria y medio estático | `schema.sql:11-19` vs el JSON | **Crítica** (legal + funcional) |
| **C3** | Rutas de medios que no resuelven: 1 de 4 (equipo) y 1 de 1 (ejercicio) | `equipmentMap.ts` (`public/…`), `EquipmentModal.tsx:82`, `ActiveWorkout.tsx:932,1396`, `ExerciseSelectorModal.tsx:61-63,347` | **Crítica** (funcional) |
| **C4** | Sin soporte para ejercicios creados por el usuario | Sin tabla, sin `is_custom`, sin política de escritura, sin UI | **Crítica** (funcional) |
| **C5** | Taxonomía con campo redundante (`category` ≡ `body_part`) y tres vocabularios musculares | análisis del JSON (1 324 registros) | **Alta** |
| **C6** | El puente anatómico no conoce los campos que permitirían el modelo rico (`muscle_group`, `secondary_muscles`) | `muscleMap.ts:1-8, 41-44` | **Alta** |
| **C7** | La asignación de equipamiento depende de 46 regex sobre el nombre, y sus fallbacks por slug son inalcanzables | `equipmentCatalog.ts:250, 264-307` | **Alta** |
| **C8** | Identidad: ids dispersos (`0001`…`5201`, 3 877 huecos) sin clave sustituta; el comentario del esquema está desactualizado | `schema.sql:9` vs datos reales | **Media** |
| **C9** | 6 nombres duplicados con `target` **y** `muscle_group` idénticos: el desambiguador del importador no desambigua | `useExerciseCatalog.ts:66-76` | **Media** |
| **C10** | Sin caché persistente del catálogo ni de los medios: el fallback remoto solo vive en memoria (24 h) | `seedExercises.ts:64-89`; ausencia de `CacheStorage` | **Media** |
| **C11** | Sin índice en `name`; `select("*")` de la tabla completa | `useExerciseCatalog.ts:56`; `schema.sql:21-23` | **Media** |
| **C12** | Medios servidos desde `main` de GitHub raw, sin versión fijada ni integridad | `seedExercises.ts:21, 59, 74` | **Media** |
| **C13** | 24,3 MB de fotos de maquinaria sin WebP, sin responsivas y sin miniatura; el campo `image` (póster) sin usar en ningún componente | `public/images/gym-equipment/`; JSON `image` | **Media** |
| **C14** | Store IndexedDB `exerciseNotes` declarado, indexado y testeado, pero sin uso en runtime | `idb.ts:79`; grep sobre `src/` | **Media** (deuda) |
| **C15** | Token de equipamiento con sinónimos (`band`/`resistance band`, cuatro formas de barra) y `hammer`/`assisted` mal clasificados | análisis del JSON (28 valores) | **Baja** |
| **C16** | La política `exercises_insert_authenticated` que el código cita no existe en el repositorio | `seedExercises.ts:135` vs `schema.sql` + migraciones | **Baja** |
| **C17** | Shape de `instructions` divergente entre JSON (objeto) y tabla/tipo (`text[]`), con un consumidor que asume array | `ExerciseDetailSheet.tsx:137,149`; `types/supabase.ts:30` | **Baja** |
| **C18** | Sin service worker ni shell offline (heredado de la Fase 2, B9) | `vite.config.ts`, `package.json` | **Media** |
| **C19** | `created_at` idéntico en las 1 324 filas (marca de generación, no del ejercicio) | análisis del JSON | **Baja** |

---

## 10. Plan de refactor priorizado y limpieza

### 10.1 Ondas (de menor a mayor riesgo)

| Onda | # | Cambio | Ficheros afectados | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| **O0 — Correctitud de medios** | 1 | Corregir las rutas de `equipmentMap` a `/images/…` y borrar `resolveImageSrc` del modal | `src/data/equipmentMap.ts`, `src/components/ExerciseSelectorModal.tsx` | Bajo | Bajo |
| | 2 | Corregir las rutas de medios del catálogo local (`videos/…`, `images/…` → base versionada) | `src/components/ExerciseSelectorModal.tsx` | Bajo | Bajo |
| | 3 | `RAW_BASE` → commit SHA; medios y dataset salen de la misma constante | `src/services/seedExercises.ts:21,59,74` | Bajo | Bajo |
| **O1 — Rendimiento** | 4 | Índice de búsqueda por `slug`/`lower(name)` construido una vez, en lugar de `filter` lineal por tecla | `src/components/ExerciseSelectorModal.tsx:79-96` | Bajo | Bajo |
| | 5 | Cachear `getEquipmentSuggestionForExercise` por id de ejercicio (tabla, no recálculo) | `src/components/ExerciseSelectorModal.tsx:87-96` | Bajo | Bajo |
| | 6 | Usar el póster (`image`) en listas y el GIF solo en la ficha ampliada | `ExerciseSelectorModal`, `ExerciseCard`, `ExerciseBrowser`, `ExercisePanel`, `ExerciseCarousel` | Bajo | Bajo |
| **O2 — Limpieza de datos muertos** | 7 | Eliminar el store IndexedDB `exerciseNotes` (v4 → v5 ya no lo crea; añadir migración de borrado) | `src/lib/idb.ts:40,79`, `src/lib/idb.test.ts` | Bajo | Bajo |
| | 8 | Eliminar los 10 exports muertos del subsistema de equipamiento | `src/data/equipmentCatalog.ts`, `src/data/myGymEquipment.ts`, `src/data/gripMap.ts` | Bajo | Bajo |
| | 9 | Retirar `category` (duplicado de `body_part`) del JSON y del generador | `src/data/exercisesCatalog.json`, `src/data/generate.ps1` | Bajo | Medio |
| | 10 | Retirar `created_at` (marca de generación) | igual | Bajo | Bajo |
| | 11 | Corregir el comentario obsoleto del esquema y crear la política `exercises_insert_authenticated` | `supabase/schema.sql:9`, nueva migración | Bajo | Bajo |
| **O3 — Modelo de datos** | 12 | Migración aditiva: `attribution`, `available`, `image`, `media_id`, `secondary_muscles`, `muscle_group` en `exercises` + tipos | `supabase/migrations/…`, `src/types/supabase.ts` | Medio | Bajo |
| | 13 | Tablas de taxonomía (`muscle_groups`, `equipment_types`, `movement_patterns`) + tablas de relación, pobladas por un generador | nuevas migraciones + `scripts/generate-catalog.cjs` | Alto | Medio |
| | 14 | Regenerar `muscleMap.ts` desde `muscle_groups` + `exercise_muscles`, cubriendo `muscle_group` y `secondary_muscles` | `src/lib/muscleMap.ts` | Medio | Medio |
| | 15 | Sustituir `EQUIPMENT_RULES` por la tabla `exercise_equipment`, generada desde el mismo script que produce `equipmentMap` | `src/data/equipmentCatalog.ts:181-251` | Alto | Medio |
| | 16 | Normalización del vocabulario (un nombre por músculo, sin sinónimos de equipo, mods fuera de la taxonomía) | generador + migración | Medio | Medio |
| **O4 — Identidad y duplicados** | 17 | `slug` único + `normalized_name`; el importador devuelve **todas** las coincidencias y deja que el usuario elija | `src/hooks/useExerciseCatalog.ts:66-76`, `src/lib/import/commit.ts:167-171` | Medio | Bajo |
| | 18 | Copiar el patrón de Hevy: duplicar un ejercicio crea un ejercicio de usuario, no una fila gemela | `src/components/dashboard/ExerciseSwapModal.tsx`, nuevo flujo | Medio | Bajo |
| **O5 — Ejercicios de usuario** | 19 | Tabla `user_exercises` + RLS + `Exercise` unificado (`kind: 'catalog' \| 'user'`) | migraciones, `src/types/supabase.ts` | Alto | Medio |
| | 20 | UI de alta: nombre, grupo muscular primario, secundarios, equipamiento, foto opcional | nuevos componentes | Alto | Medio |
| **O6 — Offline** | 21 | Store `catalog` en IndexedDB + hidratación al arranque + refresco en segundo plano | `src/lib/idb.ts`, nuevo `src/hooks/useCatalog.ts` | Medio | Medio |
| | 22 | Caché de medios en `CacheStorage` con versionado por hash | nuevo `src/lib/mediaCache.ts` | Medio | Medio |
| | 23 | Service worker: precache del shell + navegación offline | `public/sw.js`, `vite.config.ts` | Medio | Medio |
| **O7 — Medios** | 24 | Convertir las 160 fotos de maquinaria a WebP con 2 anchos + miniatura; actualizar `equipmentMap` | `public/images/…`, `src/data/equipmentMap.ts` | Medio | Bajo |
| | 25 | Migrar la demo de GIF a MP4 (o al menos servir póster + demo con fallback) | bucket de medios + `exercise_media` | Alto | Medio |

### 10.2 Prioridad frente a las brechas

| Brecha | Onda | Nota |
|---|---|---|
| C3 (medios rotos) | O0 | **Lo primero**: son 404 visibles en la UI, y el arreglo es de una línea por fichero |
| C1 (16,3 MB en el bundle) | O1 + O6.21 | La onda O6.21 es la que devuelve el arranque a un tamaño razonable; la O1 solo optimiza el filtro |
| C2 (servidor ⊂ local) | O2.12 | Migración aditiva, riesgo bajo, cierra la brecha legal |
| C4 (sin ejercicios de usuario) | O5 | La brecha funcional más grande, pero es la más grande de construir: O5 completa |
| C5/C6 (vocabularios) | O3.13-16 | Depende de O3.12 (columnas nuevas) |
| C7 (regex de equipamiento) | O3.15 | Depende de O3.13 |
| C9 (duplicados) | O4.17 | El patrón de Hevy (duplicar → custom) resuelve además C4 en parte |
| C14 (store muerto) | O2.7 | Deuda pura, coste casi nulo |
| C18 (offline) | O6.23 | Cierra la brecha heredada de la Fase 2 |

### 10.3 Inventario de esquemas y datos muertos a eliminar

| Objeto | Tipo | Ubicación | Motivo | Acción |
|---|---|---|---|---|
| Store `exerciseNotes` (IndexedDB) | store | `src/lib/idb.ts:40,79` | Creado en v4, indexado, testeado y **nunca usado** en runtime | Eliminar; añadir `deleteObjectStore` en la migración v5→v6 |
| `category` | campo de catálogo | `src/data/exercisesCatalog.json` (1 324) | Duplica `body_part` campo a campo | Eliminar del JSON y del generador; derivar en SQL si hace falta |
| `created_at` | campo de catálogo | `src/data/exercisesCatalog.json` (1 324) | Idéntico para todas las filas: marca de generación del dataset | Eliminar; usar `updated_at` del servidor |
| Reglas 45–46 de `EQUIPMENT_RULES` | código | `src/data/equipmentCatalog.ts:250` | La regla `/.*/` hace inalcanzables los 2 fallbacks posteriores | Eliminar la regla comodín y **activar** los fallbacks por slug |
| Fallbacks por slug de `getEquipmentSuggestionForExercise` | código | `src/data/equipmentCatalog.ts:270-307` | Inalcanzables por la regla comodín | Restaurar su alcance al eliminar `/.*/` |
| `equipmentCatalog`, `exerciseNameToSlug`, `EQUIPMENT_RULES`, `getEquipmentForExercise`, `getEquipmentById`, `getEquipmentByCategory` | exports | `src/data/equipmentCatalog.ts` | Ningún import fuera del propio fichero | Marcar `internal` o eliminar |
| `UNAVAILABLE_EQUIPMENT`, `MY_GYM_GROUPS` | exports | `src/data/myGymEquipment.ts` | Ningún import | Eliminar |
| `gripMap` (valor), `getGripForExercise` | exports | `src/data/gripMap.ts` | Placeholder que devuelve siempre el primer agarre; solo se usa el **tipo** `Grip` | Eliminar la función placeholder o implementarla |
| `default_gif_id` / `default_graph_id` | columna (referencia FitNotes) | — | FitNotes: la columna real es `default_graph_id` y **está viva**; no hay equivalente muerto en Cronos | Sin acción (corrección de la Fase 1, no deuda de Cronos) |
| `src/lib/exercise/exerciseSchema.ts` | módulo ausente | `src/lib/exercise/exerciseSchema.test.ts` | Solo existe el test; el esquema real vive en `src/types/supabase.ts` y `supabase/schema.sql` | Renombrar el test a `exerciseNotes.test.ts` (ya existe) o borrar el duplicado |
| Política `exercises_insert_authenticated` | política ausente | `supabase/` | El código la cita pero no existe | Crearla (escritura autenticada de la siembra) o corregir el comentario |
| `body_part` / `target` / `equipment` | columnas | `public.exercises` | Dejarán de ser fuente de verdad al migrar | **Conservar** como columnas derivadas durante la transición; no borrar hasta que el motor de rangos y el importador usen las relaciones |
| `instructions text[]` | columna | `public.exercises` | Solo guarda `instruction_steps.es`; pierde 9 idiomas y no puede llevar la prosa por idioma | Migrar a `jsonb` por idioma; mantener la columna antigua durante la transición |

---

## 11. Límites del análisis

- **Hevy y Symmetry son binarios ofuscados.** De ellos se afirma **la forma del modelo** (claves de i18n, nombres de campo, plantillas de URL, contenido de los JSON empaquetados), no la semántica de sus servidores. En concreto, no se puede confirmar si el servidor de Hevy guarda un campo compuesto/aislamiento que el cliente no reference; solo se puede afirmar que **el cliente no lo usa**.
- **El contenido del catálogo de JEFIT no es verificable desde el APK.** Lo que se afirma es la **forma del modelo**, no qué ejercicio tiene qué músculo con qué porcentaje: el catálogo llega por API.
- **No se midió el bundle con una build.** El `dist/` presente está incompleto (111 archivos, 19 671 947 B, **sin `index.html`**), así que no hay artefactos JS que medir. El impacto de los 16,3 MB se deriva del import estático, que es verificable por lectura. Conviene confirmarlo con `npm run build` y el informe de Vite antes de dimensionar la migración.
- **No se ejecutó la app.** Los 404 de medios se deducen de la semántica de Vite (`public/` se sirve en la raíz) y de la ausencia de `public/videos/` y de `public/images/*.jpg` (árbol verificado: 161 archivos, 100 % `.jpg`, solo `logo.jpg` + `gym-equipment/`). Conviene confirmarlos en el navegador.
- **No se midió el coste real del filtro y de las regex** en un dispositivo de gama baja; las cifras (≈52 000 regex por tecla) son aritmética sobre 1 135 ejercicios filtrados × 46 reglas.
- **No se midió el tamaño de los GIF del dataset**, que no están en el repositorio: el tamaño del catálogo JSON (16,3 MB) no es el tamaño de los GIF, sino el del JSON con 10 idiomas de instrucciones.
- **El coste de las fotos de maquinaria** (24,3 MB, ~150 KB por foto) está medido sobre `public/`, no sobre `dist/`.

---

## 12. Anexo — Índice de evidencia

**JEFIT** (`decompiled\jefit\sources`): `je/fit/data/room/entity/ExerciseMuscleInvolvementMapEntity.java` (`exerciseId`, `muscleGroupId`, `involvementPercent` double, `role`), `je/fit/data/model/network/database/ExerciseMuscleInvolvementMapItemResponse.java` (`@Json(name = "exercise_id"|"muscle_group_id"|"involvement_percent"|"role")`), `je/fit/data/room/entity/MuscleGroupsEntity.java` (`anatomicalName`, `commonName`, `parentGroupId`), `je/fit/data/room/entity/EquipmentTypesEntity.java` (`name`, `parentGroupId`, `categoryIndex`, `thumbnailUrl`, `typicalFacility`), `je/fit/data/room/entity/ExerciseEquipmentMapEntity.java` (`rowId`, `exerciseId`, `equipmentTypeId`, `type`, `optional`, `parentRowId`), `je/fit/data/room/entity/JointEntity.java`, `je/fit/data/room/entity/MovementPatternEntity.java`, `je/fit/data/room/entity/ExerciseMovementPatternEntity.java`, `je/fit/data/room/entity/TrainingTypeEntity.java`, `je/fit/data/room/entity/ExerciseTrainingTypeMapEntity.java`, `je/fit/data/room/dao/ExerciseMuscleInvolvementMapDao.java`; `je/fit/util/UrlUtilsKt.java:17-19`; `je/fit/ExerciseImageHandler.java:95`; `je/fit/data/repository/EquipmentRepository.java:84-106`; `je/fit/domain/sync/DownloadSyncDataUseCase.java:105-107`; `je/fit/domain/image/GetImageOrientationFromUriUseCase.java`; `je/fit/data/room/db/MobileOnlyDatabase.java` (`jefit_prodRelease`, `WorkoutReminderDao`); `resources/assets/encrypted_data.enc.json`, `encrypted_key.txt`; `resources/res/drawable/*.gif` (6 de UI, 3,1 MB).

**Hevy** (`decompiled\hevy\resources\assets\index.android.bundle`, 22 217 100 B): 1 498 URLs `https://d2l9nsnmtah87f.cloudfront.net/…` (672 `exercise-assets/*.mp4` + 826 `exercise-thumbnails/*`); claves `exerciseData.muscleGroup.*` (19), `global.simplifiedMuscleGroup.*` (6), `Secondary Muscle Groups`, `SetSecondaryMuscleGroups`, `Secondary: %{secondaryMuslceGroup}`, `CalculateSetContributionsForSimplifiedMuscleGroups`, `CalculateSetCountPerMuscleGroups`, `muscleGroupMap`, `byMuscleGroup`; `isCustomExercise`, `CustomExerciseTemplateCustomizations`, `showAddNewExercise`, `faq.customExercises`, `faq.editCustomExercise`, `customExerciseOptions.delete`, `customExercisesFiltered`, `Unlimited Custom Exercises (%{customExerciseCount}/7)`; `duplicateResolver`, `isDuplicate`, `Duplicate Exercise`, `%{exercise_name} has been successfully duplicated`; `exercise_template`, `exerciseTemplateIds`, `popularExerciseTemplateIds`, `DeleteExerciseTemplateUnitStore`; `equipment_category`, `hevyTrainer.granularEquipment.*`, `hevyTrainer.availableEquipment.platesAndBars.description`, `PlateCalculator.manageEquipment`, `FAULT_AVAILABLE_EQUIPMENT`; `compound`/`isolation` (solo prosa + `<compound-selector>`); `resources/res/drawable-xxhdpi/src_exercises_assets_*_thumbnail@3x.jpg`.

**FitNotes** (`decompiled\fitnotes\sources`): `X\C0284w.java:233-236` (`CREATE TABLE exercise`), `X\C0284w.java:368-370` (`M(String)`, check de nombre), `X\C0284w.java:35-43` (escritor `a()`), `X\C0284w.java:238-351` (`a0()`, ~96 ejercicios por defecto), `X\C0259j.java:19` (`CREATE TABLE Category`), `X\C0259j.java:123-124` (8 categorías), `X\C0250e0.java` (`RoutineSectionExerciseTable`), `X\C0245c.java` (`BarbellTable`), `V\c.java:49-51` (`database.db` v22), `V\c.java:54-264` (migraciones), `com/github/jamesgay/fitnotes/model/Exercise.java`, `…/model/ExerciseType.java`, `P0/i.java:275` (`defaultGraphId`), `I0/b.java:976` (guardado + check de duplicado); 0 ficheros `.gif` en `resources/`; 0 coincidencias de `equipment`/`Equipment`/`muscle`/`bodyPart`.

**Symmetry** (`decompiled\symmetry\resources\assets\flutter_assets\` + `decompiled\symmetry-arm64\resources\lib\arm64-v8a\libapp.so`): `package:symmetry/packages/exercises/lib/src/domain/entities/*` (`primaryMuscles`, `secondaryMuscles`, `secondaryMuscleGroups`, `isCustom`), `packages/equipment/lib/src/equipment.dart` (enum de 24), `packages/exercise_search/lib/src/v1/scoring/edit_distance.dart` (`ExerciseSearcherV1`), `packages/exercises/lib/src/data/data_providers/pending_custom_exercises.dart`, `training/shared/domain/exercise_plane.dart`, `assets/workout_plan_templates/*.json` (7), `assets/starting_load/*` (3), `assets/exercise_ranking_mock.json` (21 002 líneas), `assets/images/equipment/` (37 ficheros), `assets/images/shared/` (17 grupos musculares), `assets/videos/introduction_video.mp4`, `assets/images/loading_animation.gif`, `assets/images/revising-video.gif`; cadenas `flutter_cache_manager`, `DefaultCacheManager`, `prefetchThumbnailUrl`, `_precacheThumbnail`, `ExerciseThumbnailCache`, `_resolveCachedGif`, `TrainingImagePrewarmer`, `flutter_image_compress`, `blurhash`, `video_player`, `InlineVideoControllerPool`, `symmetry-assets.com`.

**Cronos**: `src/components/ExerciseSelectorModal.tsx:17,33-50,61-63,79-96,98-100,345-360,421-425`; `src/components/EquipmentModal.tsx:3,16,80-94`; `src/components/ActiveWorkout.tsx:860-862,932,1396,1523`; `src/components/ExerciseBrowser.tsx:105-108,124,726-728`; `src/components/ExerciseCard.tsx:60-62`; `src/components/ExercisePanel.tsx:50-53`; `src/components/ExerciseDetailSheet.tsx:81-83,137,149`; `src/components/ExerciseCarousel.tsx:235,414-416`; `src/components/workout/ExerciseStage.tsx:254-269`; `src/components/hub/DemoTab.tsx:95-110`; `src/components/TutorialModal.tsx:49-51`; `src/data/exercisesCatalog.json` (16 265 338 B, 1 324 registros, 16 campos); `src/data/equipmentMap.ts` (73 máquinas, 160 vistas); `src/data/equipmentCatalog.ts:4,35-109,118-136,144-149,181-251,256-308,324-346`; `src/data/availableEquipment.ts:1-34,36-47`; `src/data/myGymEquipment.ts:13-102`; `src/data/gripMap.ts:1-43`; `src/lib/muscleMap.ts:1-19,23-46,55-219,221-238,255-319`; `src/lib/muscleFilter.ts`; `src/hooks/useExerciseCatalog.ts:35-42,49-64,66-76`; `src/services/seedExercises.ts:16-21,45-62,64-89,90-122,138-146`; `src/lib/idb.ts:22,33,35-41,52-91,102-133,143-166`; `src/lib/offlineStore.ts:23-43,46-67,69-92,106-207`; `src/lib/sessionSync.ts:37-49,54-95,104-143,146-155`; `src/hooks/useOfflineSync.ts:33,44,53,74-93`; `src/lib/ai/chatStorage.ts:23,51-123`; `src/lib/exercise/exerciseNotes.ts:2-121`; `src/lib/exercise/userTips.ts:22-95`; `src/lib/import/commit.ts:155-204,214-275`; `src/lib/import/analyze.ts:230-433`; `src/lib/import/sources.ts:24-132`; `src/types/supabase.ts:22-51,635-643`; `supabase/schema.sql:1-23,94-102`; `supabase/migrations/20261003030000_coach_portal.sql:190-368`; `supabase/migrations/20261003040000_exercise_hub_notes.sql:24,53-71`; `vite.config.ts` (`manualChunks`); `package.json` (sin PWA); `public/` (161 archivos, 24 356 165 B, 100 % `.jpg`); `dist/` (111 archivos, 19 671 947 B, sin `index.html`).

