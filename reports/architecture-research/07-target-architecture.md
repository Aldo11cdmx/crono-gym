# Fase 4 — Arquitectura objetivo de Cronos Gym

**Alcance:** la arquitectura final que debería tener Cronos Gym, consolidando lo aprendido en las cuatro fases de la auditoría (modelo de datos, motor de entrenamiento, catálogo y medios, auditoría de código) y las mejores prácticas observadas en **JEFIT 17.0.1**, **Hevy 3.1.16**, **FitNotes 25.1** y **Symmetry 7.16.0**.

**Estado del baseline:** intacto. Ningún archivo de `src/` ni de `supabase/` fue modificado. Este documento es una **especificación**, no una implementación: cada sección indica qué se construye, dónde vive, de qué referencia viene la idea, y qué evidencia de la auditoría actual la motiva.

| Comprobación | Resultado |
|---|---|
| Tipos | `npm run typecheck` → limpio, 0 errores |
| Tests | `npm test` → 129/129 ficheros en verde (309,15 s), confirmado en dos ejecuciones — recuento consolidado de la Fase 5: **4 ejecuciones completas**, ver `10-execution-log.md` §5 |
| Build | `npm run build` → correcto; chunk principal **16,13 MB** (gzip 2,58 MB) |

> **Cómo leer este documento.** Cada decisión lleva tres etiquetas: **[R]** la referencia de la que viene la idea, **[E]** la evidencia en Cronos que la motiva, y **[M]** la métrica con la que se sabe que funcionó. Sin esas tres etiquetas, una arquitectura objetivo es una lista de deseos.

---

## 1. Resumen ejecutivo

1. **El problema de Cronos no es que le falten cosas: es que tiene dos aplicaciones.** El 15,3 % de su código de producción (9 588 líneas, 48 ficheros) es inalcanzable desde `src/main.tsx`, e incluye **una pantalla de entrenamiento completa —tabla de series, temporizador, audio, fatiga— que solo los tests ven** [E: §4.2 del informe 06]. La arquitectura objetivo empieza por **elegir una sola implementación** y hacer que todo lo demás sea una consecuencia.
2. **La arquitectura objetivo tiene cinco capas y una sola fuente de verdad por dato.** `domain` (modelo puro, sin React ni Supabase), `data` (Supabase + caché), `features` (pantallas y sus hooks), `app` (shell, rutas, providers) y `platform` (IndexedDB, medios, i18n, telemetría). **Cada dato tiene un único dueño**: el catálogo en `domain`, la sesión en `data/session`, el borrador en `platform/offline`.
3. **El modelo de datos unificado añade lo que las referencias tienen y Cronos no**: implicación muscular con rol y porcentaje (JEFIT), grupo muscular a dos niveles y ponderación de series (Hevy), tipo de serie completo (`normal|warmup|drop|failure`), agrupación en supersets, patrón de movimiento, tipo de entrenamiento primario/secundario, y **ejercicios creados por el usuario** con su propio ciclo de vida.
4. **El motor de entrenamiento activo se reescribe sobre una máquina de estados explícita** con un **temporizador anclado y persistido** (`endsAt` en epoch ms), **resincronización al primer plano** y **recuperación de borrador** en el arranque de la aplicación, no en un `onClick` perdido. La escritura al servidor pasa a ser **una RPC transaccional** que elimina de raíz la ventana «sesión sin series».
5. **Los medios dejan de ser un `gif_url` de texto y pasan a ser un recurso con clave, variantes y caché en disco**: CDN con URL inmutable, `WebP`/`AVIF` para fotos, `MP4`/WebM para demostraciones, **caché LRU con cuota en IndexedDB**, catálogo comprimido persistido y un **service worker** que deja la app utilizable sin red.
6. **El bundle principal baja de 16,13 MB a menos de 1 MB.** El catálogo deja de estar embebido y se sirve como activo; el SDK de Supabase se aísla; las rutas que hoy descargan 1 324 filas enteras pasan a filtrar o a usar una vista materializada.
7. **El i18n pasa de diccionario español a sistema de locales**: el catálogo trae 10 idiomas de instrucciones y hoy se truncan a `.es` [E: `seedExercises.ts:45-60`]. El objetivo conserva los 10 y añade selector.
8. **El error deja de tragarse.** Los tres `catch` que ocultan fallos al usuario [E: `sessionSync.ts:151-155`, `routineGenerator.ts:587-591,594`] se convierten en un canal de observabilidad con estado de error visible, y los IDsB con degradación a `null` mantienen ese contrato pero con **telemetría**.
9. **El plan de migración es de 8 fases (M0–M7)**, cada una con criterios de entrada y salida verificables. Las dos primeras (M0, M1) no tocan el esquema de datos y son reversibles en un commit cada una.

---

## 2. Principios

| # | Principio | De dónde viene | Qué significa en Cronos |
|---|---|---|---|
| P1 | **Una sola implementación por pantalla** | Symmetry (un cubit por flujo) | Si una pantalla tiene dos versiones, la suite de tests debe cubrir la que se ejecuta. Hoy cubre la que no. |
| P2 | **Un solo dueño por dato** | JEFIT (Room como fuente única) | Catálogo, sesión, borrador y perfil tienen un módulo propietario. Ningún segundo lugar donde escribir. |
| P3 | **El reloj vive en el reloj** | Hevy (`anchoredRemaining`), Symmetry (`anchoredRemaining`) | Todo temporizador se ancla en una marca de tiempo absoluta, nunca en un contador que se decrementa. |
| P4 | **Escribir es atómico o no es escribir** | FitNotes (transacciones Room), Symmetry (Drift) | Una sesión y sus series se persisten en una transacción. No hay «sesión sin series». |
| P5 | **El estado derivado no se guarda** | Hevy (cálculo en el cliente) | PRs, rangos, fatiga y progresión se **derivan** de los datos, no se persisten como segunda fuente de verdad. |
| P6 | **La degradación es explícita y observable** | Todos | «Funciona sin red» es un modo diseñado, no un accidente. Y cuando falla, se dice. |
| P7 | **Un solo vocabulario por concepto** | JEFIT (músculo → grupo → movimiento) | Un grupo muscular tiene **un** identificador canónico en todo el sistema. |
| P8 | **El bundle es un presupuesto** | — | Presupuesto explícito por chunk, verificado en CI. |
| P9 | **El tipo de datos es el contrato** | — | `numeric`, `text[]`, `jsonb` y opcionales tienen su tipo real en TypeScript, generado desde el esquema. |
| P10 | **El usuario es dueño de sus datos** | JEFIT/Hevy/Symmetry (ejercicios custom) | Los ejercicios creados por el usuario son datos de primera clase, con su propia tabla, su propia RLS y su ciclo de vida. |

---

## 3. Estructura de capas

### 3.1 Directorios objetivo

```
src/
├─ app/                        ← Shell, rutas, providers. No contiene lógica de negocio.
│  ├─ AppShell.tsx  router.tsx  providers.tsx
│  └─ routes/                  ← Un componente por ruta, sin datos.
│
├─ domain/                     ← Modelo puro. Sin React, sin Supabase, sin IndexedDB.
│  ├─ exercise/                ← tipos, taxonomía, reglas de equivalencia
│  ├─ training/                ← sesión, series, RPE, supersets, descanso
│  ├─ physiology/              ← PRs, fatiga, progresión, volumen, rangos
│  ├─ profile/                 ← atleta, consentimiento, flags
│  └─ catalog/                 ← lectura del catálogo, normalización de nombres
│
├─ data/                       ← Acceso a datos. Un módulo por recurso, un método por operación.
│  ├─ supabase/                ← cliente, cliente de solo-lectura, errores tipados
│  ├─ queries/                 ← exercises.ts, sessions.ts, routines.ts, profiles.ts
│  ├─ rpc/                     ← finishSession(), upsertRoutine(), upsertUserExercise()
│  └─ cache/                   ← caché en memoria con TTL y deduplicación de inflight
│
├─ features/                   ← Una carpeta por feature. Cada una con sus componentes,
│  │                              sus hooks y sus módulos de dominio.
│  ├─ workout/                 ← ActiveWorkout, SetRow, RestTimer, DraftRecovery
│  ├─ routines/                ← lista, editor, planificador, archivado
│  ├─ exercise/                ← catálogo, detalle, hub de ejercicio
│  ├─ ranks/                   ← rangos anatómicos, radar, heatmap
│  ├─ progress/                ← dashboard, gráficos, historial
│  ├─ coach/                   ← chat, hub, generador, portal
│  └─ profile/                 ← perfil, onboarding, ajustes
│
├─ platform/                   ← Capacidades del entorno.
│  ├─ offline/                 ← idb.ts, queue.ts, draftStore.ts, catalogStore.ts
│  ├─ media/                   ← resolve.ts, cache.ts, loader.ts
│  ├─ audio/                   ← beep, vibración
│  ├─ i18n/                    ← locales, catálogos, formateadores
│  ├─ telemetry/               ← errores, métricas, trazas
│  └─ lifecycle/               ← foreground/background, pagehide, visibilitychange
│
├─ ui/                         ← Sistema de diseño. Sin lógica de dominio.
│  ├─ primitives/  layout/  tokens/
│
└─ shared/                     ← Utilidades puras sin estado.
   ├─ format/  id/  result/  time/
```

### 3.2 Reglas de dependencia (verificables en CI)

| Regla | Enunciado | Cómo se comprueba |
|---|---|---|
| D1 | `domain/` no importa nada de `data/`, `features/`, `platform/`, `ui/` | `eslint-plugin-boundaries` o un test de arquitectura con `?raw` (el patrón ya existe en `lib/exercise/exerciseSchema.test.ts`) |
| D2 | `platform/` no importa nada de `features/` | igual |
| D3 | `features/x/` no importa de `features/y/` salvo por `shared/` | igual |
| D4 | Ningún fichero importa el catálogo JSON directamente | `import exercisesCatalog` solo puede aparecer en `data/queries/exercises.ts` o en `platform/offline/catalogStore.ts` |
| D5 | Ningún componente escribe en Supabase | Solo `data/queries/` y `data/rpc/` hacen `.from()` / `.rpc()` |
| D6 | Ningún módulo importa `@supabase/supabase-js` salvo `data/supabase/` | Test de arquitectura |
| D7 | Todo `catch` que traga un error debe emitir a `telemetry/` | ESLint `no-restricted-syntax` |

> Estas siete reglas son la diferencia entre «la arquitectura objetivo» y «una carpeta nueva». Sin ellas, la reubicación se deshace en tres meses.

---

## 4. Modelo de datos unificado

### 4.1 El problema que resuelve

Hoy el mismo concepto vive en tres sitios:

| Concepto | Forma actual | Dónde |
|---|---|---|
| Ejercicio | 3 representaciones (fila de 7 columnas, registro de 16 campos del JSON, tipo local) | `types/supabase.ts:22`, `data/exercisesCatalog.json`, `components/ExerciseSelectorModal.tsx:33-50` |
| Tipo de serie | `SetKind` de 4 valores → `boolean` | `lib/workout/setKind.ts:19,45` |
| Grupo muscular | 3 vocabularios superpuestos (19 / 29 / 40) | `data/exercisesCatalog.json` (`target`, `muscle_group`, `secondary_muscles`) |
| PR | 2 definiciones distintas | `useAthletePRs.ts`, `lib/ai/types.ts:223-236` |
| Atribución del autor | Tipo declarado sin usar + `Record` plano | `types/supabase.ts:662-667` vs `lib/i18n.ts:1539` |

La arquitectura objetivo **elimina cada duplicación por construcción**, no por convención.

### 4.2 Taxonomía: el modelo de JEFIT, simplificado

**[R]** JEFIT: `ExerciseMuscleInvolvementMapEntity` (exerciseId, muscleGroupId, **involvementPercent**, **role**), `MuscleGroupsEntity` con **parentGroupId**, `ExerciseEquipmentMapEntity` con **optional/parentRowId**, `ExerciseMovementPatternEntity` con **porcentaje**, `ExerciseTrainingTypeMapEntity` (**primary/secondary**).
**[R]** Hevy: dos niveles de grupo muscular (19 detallados + 6 simplificados) y **ponderación de series** (principal = 1 serie, secundario = 0,5).
**[R]** Symmetry: `primaryMuscles`/`secondaryMuscles`, `ExerciseType`, `ExercisePattern`, `isolation` explícito.
**[E]** Cronos tiene `category` ≡ `body_part` (idénticos en los 1 324 registros) y tres vocabularios musculares que nombran lo mismo de tres maneras.

```sql
-- ─────────────────────────────────────────────────────────────
-- Taxonomía canónica. Un solo identificador por concepto.
-- ─────────────────────────────────────────────────────────────

-- Un grupo muscular. parent_group_id da la jerarquía
-- (dorsal -> espalda -> torso), como en JEFIT.
create table public.muscle_groups (
  id            text primary key,              -- 'lats', 'pecs', 'quads'… canónico
  parent_id     text references public.muscle_groups(id),
  depth         smallint not null default 0,   -- 0 = grupo simple (Hevy simplified)
  display_order smallint not null default 0,
  constraint muscle_groups_depth_check check (depth between 0 and 1)
);

-- Un patrón de movimiento (empuje, tirón, squat, hinge, rotación…)
create table public.movement_patterns (
  id         text primary key,                  -- 'push_horizontal', 'squat'
  label_key  text not null                     -- clave de i18n, nunca texto literal
);

-- Un tipo de entrenamiento con su papel: principal o secundario.
-- Esto es lo que JEFIT llama "training type" y Hevy NO tiene.
create table public.training_types (
  id            text primary key,               -- 'strength', 'hypertrophy'
  primary_label text not null,
  secondary_label text not null
);

-- El catálogo de ejercicios, unificado.
create table public.exercises (
  id             text primary key,              -- '0001'
  name           text not null,
  name_normalized text not null,               -- para resolver duplicados
  body_part      text not null,                -- vocabulario canónico (10 valores)
  target         text not null,                -- grupo muscular principal (canónico)
  exercise_type  text not null,                -- 'compound' | 'isolation'
  isolation      boolean not null default false,
  is_user_authored boolean not null default false,
  author_user_id uuid references auth.users(id) on delete cascade,
  attribution    text,
  created_at     timestamptz not null default now(),
  constraint exercises_user_authored_check
    check (not is_user_authored or author_user_id is not null)
);

create index exercises_name_normalized_idx on public.exercises (name_normalized);

-- Implicación muscular con rol y porcentaje. El dato que JEFIT
-- tiene y Cronos no: no basta con decir "trabaja dorsal",
-- hay que decir "cuánto" y "con qué papel".
create table public.exercise_muscle_map (
  exercise_id    text not null references public.exercises(id) on delete cascade,
  muscle_group_id text not null references public.muscle_groups(id),
  role           text not null,                -- 'primary' | 'secondary'
  involvement    numeric(5,2) not null,         -- 0..100
  series_weight  numeric(4,2) not null default 1,  -- ponderación Hevy: 1 / 0,5
  primary key (exercise_id, muscle_group_id),
  constraint exercise_muscle_map_role_check check (role in ('primary','secondary')),
  constraint exercise_muscle_map_involvement_check check (involvement between 0 and 100)
);

-- Patrón de movimiento con porcentaje (JEFIT).
create table public.exercise_pattern_map (
  exercise_id text not null references public.exercises(id) on delete cascade,
  pattern_id  text not null references public.movement_patterns(id),
  involvement numeric(5,2) not null,
  primary key (exercise_id, pattern_id)
);

-- Tipo de entrenamiento primario/secundario (JEFIT).
create table public.exercise_training_type_map (
  exercise_id text not null references public.exercises(id) on delete cascade,
  training_type_id text not null references public.training_types(id),
  role        text not null,                  -- 'primary' | 'secondary'
  primary key (exercise_id, training_type_id)
);

-- Equipamiento, con jerarquía y opcionalidad (JEFIT: parentRowId/optional).
create table public.equipment (
  id         text primary key,                 -- 'CG-EQP-0022'
  name       text not null,
  category   text not null,
  parent_id  text references public.equipment(id),
  photo_key  text                             -- clave del catálogo de medios, NO una ruta
);

create table public.exercise_equipment_map (
  exercise_id  text not null references public.exercises(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  is_primary   boolean not null default false,
  is_optional  boolean not null default false,
  primary key (exercise_id, equipment_id)
);
```

**Por qué `photo_key` y no una ruta:** hoy `equipmentMap.ts:18-614` guarda `public/images/gym-equipment/…` — una ruta que Vite no sirve como está (404 en 3 de 4 usos, §9.3 del informe 06). Con una **clave** (`CG-EQP-0022`), la resolución de la URL ocurre en un solo sitio (`platform/media/resolve.ts`), y el mismo recurso puede servirse desde CDN, desde la caché local o desde el empaquetado sin tocar los datos.

### 4.3 Entrenamiento: sesiones, series, RPE, supersets

**[R]** Hevy: conjunto de series principal/secundario con ponderación.
**[R]** JEFIT: tipo de entrenamiento por rol.
**[R]** Symmetry: `superset_strip_block` — bloques de ejercicios que comparten descanso.
**[E]** Cronos detecta `superset_id` al importar y lo tira (`lib/import/sources.ts:90`); y `failure`/`drop` se pierden en `toWarmupColumn` (`lib/workout/setKind.ts:45`).

```sql
create table public.workout_logs (
  id          uuid primary key,                -- UUID generado en el cliente (offline-first)
  user_id     uuid not null references auth.users(id) on delete cascade,
  routine_id  uuid references public.routines(id) on delete set null,
  title       text not null,
  started_at  timestamptz not null,
  completed_at timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.completed_sets (
  id            uuid primary key default gen_random_uuid(),
  log_id        uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id   text not null references public.exercises(id),
  set_number    integer not null,
  weight        numeric,
  reps          integer,
  rpe           numeric,
  set_type      text not null default 'normal',  -- normal|warmup|drop|failure
  group_id      uuid,                            -- superset: agrupa ejercicios
  group_order   smallint,                        -- orden dentro del grupo
  notes         text,
  constraint completed_sets_set_type_check
    check (set_type in ('normal','warmup','drop','failure')),
  constraint completed_sets_set_number_check check (set_number > 0)
);

create index completed_sets_log_idx    on public.completed_sets (log_id);
create index completed_sets_exercise_idx on public.completed_sets (exercise_id);
create index completed_sets_user_started_idx
  on public.workout_logs (user_id, started_at desc);
```

**El cambio clave: `set_type` en vez de `is_warmup`.** Con `set_type`, la distinción `failure`/`drop` sobrevive a la sincronización, y `countsAsWorkingSet` (`lib/workout/setKind.ts:34`) se implementa como `set_type <> 'warmup'` en SQL, sin lógica de cliente que pueda desincronizarse.

**`group_id` + `group_order` modelan el superset** con dos columnas y ninguna tabla nueva: dos ejercicios comparten `group_id`, y `group_order` fija el orden A → B. Es exactamente lo que necesita el render de bloques que la Fase 2 propuso (P2.2).

### 4.4 RPC transaccional: el fin de la ventana «sesión sin series»

**[R]** FitNotes: todo el esquema en Room, cada escritura en una transacción.
**[R]** Symmetry: Drift, escrituras transaccionales.
**[E]** Hoy: `workout_logs.upsert` → `completed_sets.delete` → `completed_sets.insert` (`lib/sessionSync.ts:65,80,87`), con ventana entre medias y con una operación de cola **descartada** si el error no es reintentable (`:132-137`).

```sql
-- Idempotente por diseño: volver a enviarla con el mismo log_id
-- produce exactamente el mismo estado, sin duplicar series.
create or replace function public.finish_session(
  p_log_id uuid,
  p_user_id uuid,
  p_routine_id uuid,
  p_title text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_notes text,
  p_sets jsonb
) returns void
language plpgsql security invoker
as $$
begin
  -- Guard de propiedad: el usuario solo escribe sus propias sesiones.
  if auth.uid() is distinct from p_user_id then
    raise exception 'session belongs to another account' using errcode = '42501';
  end if;

  insert into public.workout_logs (id, user_id, routine_id, title, started_at, completed_at, notes)
  values (p_log_id, p_user_id, p_routine_id, p_title, p_started_at, p_completed_at, p_notes)
  on conflict (id) do update
    set title = excluded.title,
        completed_at = excluded.completed_at,
        notes = excluded.notes;

  -- Reemplazo atómico: dentro de la misma transacción.
  delete from public.completed_sets where log_id = p_log_id;

  insert into public.completed_sets
    (log_id, exercise_id, set_number, weight, reps, rpe, set_type, group_id, group_order, notes)
  select p_log_id,
         (s->>'exercise_id'),
         (s->>'set_number')::integer,
         nullif(s->>'weight', '')::numeric,
         nullif(s->>'reps', '')::integer,
         nullif(s->>'rpe', '')::numeric,
         coalesce(s->>'set_type', 'normal'),
         nullif(s->>'group_id', '')::uuid,
         nullif(s->>'group_order', '')::smallint,
         s->>'notes'
  from jsonb_array_elements(p_sets) as s;

  -- Si algo falla arriba, la transacción entera se deshace:
  -- no existe el estado "sesión sin series".
end;
$$;
```

Con esto, la cola offline puede **descartar la operación sin miedo**: reenviarla es idempotente y la RPC es atómica. La clasificación `isRetryable` deja de ser una heurística de strings (`lib/sessionSync.ts:37-49`).

### 4.5 Ejercicios creados por el usuario

**[R]** Hevy: `isCustomExercise`, `CustomExerciseTemplateCustomizations`, límite de 7 en plan gratuito, duplicado → custom.
**[R]** Symmetry: `isCustom`, `CreateCustomExercisePayload`, `CustomExercisePhotoStore`.
**[R]** JEFIT: duplicados resueltos por el usuario, no por el sistema.
**[E]** Cronos no soporta ejercicios de usuario en ninguna forma: no hay tabla, ni `is_custom`, ni política de escritura (`exercises_select_authenticated` es la única), ni ruta de UI. **Es la brecha funcional más grande de la auditoría.**

```sql
-- El ejercicio del usuario vive en la MISMA tabla que el catálogo.
-- Beneficio: todo lo que ya funciona (filtros, swaps, ranks, hub)
-- funciona sin una sola consulta nueva.
create table public.user_exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  name_normalized text not null,
  body_part     text not null,
  target        text not null,
  exercise_type text not null default 'isolation',
  equipment_id  text references public.equipment(id),
  notes         text,
  media_key     text,
  created_at    timestamptz not null default now(),
  unique (user_id, name_normalized)
);

-- Resolución de ejercicios: catálogo primero, luego los del usuario.
create or replace view public.resolvable_exercises as
  select id, name, body_part, target, exercise_type, false as is_user_authored, attribution
  from public.exercises
  union all
  select id::text, name, body_part, target, exercise_type, true, null
  from public.user_exercises;
```

**Ciclo de vida sugerido** (heredado de Hevy):

| Regla | Comportamiento |
|---|---|
| Creación | El usuario nombra el ejercicio, elige grupo muscular y opcionalmente sube una foto |
| Duplicado | Si el nombre normalizado ya existe en el catálogo **o** entre sus ejercicios, se ofrece: *usar el existente* / *crear el mío* (Hevy: `isDuplicate` → duplicar a custom) |
| Límite | 7 ejercicios propios en plan gratuito; ilimitado en premium (Hevy) |
| Borrado | En cascada sobre las series del usuario; el histórico conserva `exercise_id` como texto para no perder la fila |

**Consecuencia de usar `uuid` en `user_exercises` y `text` en `exercises`:** la vista `resolvable_exercises` proyecta a `text`. La alternativa (tabla separada con `text` también) sería más simple de migrar; la vista evita tener **dos** rutas de resolución, que es el problema que ya existe hoy con los 4 resolutores de nombre (`useExerciseCatalog.ts`, `pickerHelpers.ts`, `ImportWizard.tsx`, `seedExercises.ts`).

### 4.6 Historial, PRs y rangos: derivar, no duplicar

**[R]** Hevy y Symmetry derivan los récords; no hay tabla de PR.
**[P5]** El Cronos actual deriva los PR en memoria (`useAthletePRs.ts:184-239`) pero **con dos definiciones distintas** y **con techo de 2 000 series** (`:48,122`), lo que hace que un PR antiguo desaparezca.

```sql
-- Vista de materialización para PRs: lo que hoy se calcula en el cliente
-- con un techo arbitrario.
create view public.exercise_prs as
select cs.user_id, cs.exercise_id, max(cs.weight) as best_weight,
       max(cs.reps) filter (where cs.weight = (select max(w.weight) from completed_sets w
                          where w.user_id = cs.user_id and w.exercise_id = cs.exercise_id
                            and w.set_type <> 'warmup')) as best_reps,
       max(cs.reps) as max_reps
from completed_sets cs
where cs.set_type <> 'warmup'
group by cs.user_id, cs.exercise_id;
```

Con el índice parcial sobre `completed_sets(user_id, exercise_id) where set_type <> 'warmup'`, la vista se materializa en milisegundos y **el techo de 2 000 desaparece**: el PR histórico pasa a ser visible. Esto cierra de paso la divergencia `numeric` (§5 del informe 06), porque el cast a `numeric` ocurre en Postgres y no en dos módulos TypeScript distintos.

**Los rangos anatómicos se siguen derivando en el cliente** (P5), pero con **una** definición: `domain/physiology/muscleScore.ts` es el único módulo que convierte series en puntuación; el motor de ranks y el coach usan el mismo. Hoy hay dos: `lib/ranks/muscleScore.ts` y `lib/ai/types.ts:223-236`.

### 4.7 Interfaces TypeScript del dominio objetivo

```ts
// ── domain/exercise ──────────────────────────────────────────────

export type MuscleGroupId = string;      // 'lats' | 'pecs' | 'quads' | …
export type PatternId = string;          // 'push_horizontal' | 'squat' | …
export type TrainingTypeId = string;     // 'strength' | 'hypertrophy' | …

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly bodyPart: string;
  readonly target: MuscleGroupId;
  readonly exerciseType: "compound" | "isolation";
  readonly isolation: boolean;
  readonly isUserAuthored: boolean;
  readonly attribution: string | null;
}

/** Implicación muscular: el dato que Cronos no tiene. */
export interface MuscleInvolvement {
  readonly muscleGroupId: MuscleGroupId;
  readonly role: "primary" | "secondary";
  /** 0..100 */
  readonly involvement: number;
  /** Ponderación de series al estilo Hevy: 1 para principal, 0.5 para secundaria. */
  readonly seriesWeight: 1 | 0.5;
}

export interface ExerciseDetail extends Exercise {
  readonly muscles: readonly MuscleInvolvement[];
  readonly patterns: readonly { patternId: PatternId; involvement: number }[];
  readonly trainingTypes: readonly { trainingTypeId: TrainingTypeId; role: "primary" | "secondary" }[];
  readonly equipment: readonly { equipmentId: string; isPrimary: boolean; isOptional: boolean }[];
  /** Instrucciones por idioma, no un array plano. */
  readonly instructions: Readonly<Record<Locale, readonly string[]>>;
  readonly media: ExerciseMedia;
}

// ── domain/training ───────────────────────────────────────────────

export type SetType = "normal" | "warmup" | "drop" | "failure";

export interface LoggedSet {
  readonly exerciseId: string;
  readonly setNumber: number;
  readonly weight: number | null;
  readonly reps: number | null;
  readonly rpe: number | null;
  readonly setType: SetType;
  /** Superset: ejercicios que comparten groupId comparten descanso. */
  readonly groupId: string | null;
  readonly groupOrder: number | null;
  readonly notes: string | null;
}

export interface TrainingSession {
  readonly logId: string;          // UUID del cliente: offline-first
  readonly userId: string;
  readonly routineId: string | null;
  readonly title: string;
  readonly startedAt: string;      // ISO
  readonly completedAt: string | null;
  readonly sets: readonly LoggedSet[];
}

// ── domain/physiology ─────────────────────────────────────────────

export interface PersonalRecord {
  readonly exerciseId: string;
  readonly bestWeight: number | null;
  readonly bestReps: number | null;
  readonly maxReps: number | null;
  readonly achievedAt: string;
}

export interface MuscleScore {
  readonly muscleGroupId: MuscleGroupId;
  readonly score: number;
  readonly rank: number;
  readonly confidence: "low" | "medium" | "high";
}
```

### 4.8 Mapa de tipos: de tres representaciones a una

| Concepto | Hoy | Objetivo | Migración |
|---|---|---|---|
| Ejercicio | `types/supabase.ts:22` (7 col) + JSON (16 campos) + `CatalogExercise` | `Exercise` + `ExerciseDetail` | Generar desde el esquema; el JSON se convierte en **semilla** |
| `instructions` | `text[]` vs `Record<string,string>` | `Record<Locale, readonly string[]>` | Migración `text[] → jsonb` con el español actual como clave `es` |
| Grupo muscular | 3 vocabularios | 1 canónico + tabla de jerarquía | Script de mapeo + tabla de aliases de una vez |
| Tipo de serie | `boolean` | `set_type text` | `is_warmup → 'warmup'/'normal'` |
| PR | Derivado en cliente, 2 definiciones | Vista `exercise_prs` | Eliminar `useAthletePRs.ts` |
| Autoría | `RoutineSource` declarado sin usar | `routines.source` con `check` | Alinear nulabilidad |
| Media | `gif_url text` con ruta relativa o absoluta | `media_key` + tabla de variantes | Migración + backfill |

---

## 5. Motor de entrenamiento activo

### 5.1 Máquina de estados explícita

Hoy `ActiveWorkout.tsx` tiene 18 `useState` y mezcla cinco responsabilidades. El objetivo las separa en una máquina de estados que **se puede dibujar en un diagrama y probar sin React**.

```
                    ┌──────────┐
   load() ─────────▶│  idle    │◀──────────── finish() ──┐
                    └────┬─────┘                       │
                         │ start(routine)              │
                         ▼                             │
                    ┌──────────┐   pause()   ┌────────┐│
                    │ running  │◀───────────▶│ paused ││
                    └────┬─────┘             └────┬───┘│
                         │ rest ends              │    │
                         ▼                        │    │
                    ┌──────────┐  timeout()       │    │
                    │ resting  │──────────────────┘    │
                    └────┬─────┘                       │
                         │ dismiss                     │
                         └────────────▶┌───────────────┘
                                      ▼
                               ┌──────────┐
                               │ finishing │──flush()──▶ (server)
                               └──────────┘
```

```ts
// features/workout/useWorkoutSession.ts
export type WorkoutPhase =
  | { kind: "idle" }
  | { kind: "running"; startedAt: string }
  | { kind: "paused"; pausedAt: string }
  | { kind: "resting"; exerciseKey: string; endsAt: number }
  | { kind: "finishing" };

export type WorkoutAction =
  | { type: "start"; routineId: string | null; title: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restStarted"; exerciseKey: string; seconds: number }
  | { type: "restDismissed" }
  | { type: "finish" }
  | { type: "setChanged"; exerciseKey: string; set: LoggedSet };
```

**El requisito de `resting` es que `endsAt` sea un epoch absoluto**, nunca un contador. Con eso, el temporizador no necesita `setInterval` para ser correcto: el `setInterval` solo refresca el texto.

### 5.2 Temporizador anclado y persistido

**[R]** Hevy: `anchoredRemaining`. Symmetry: `anchoredRemaining` + `app_lifecycle_changes`.
**[E]** Hoy hay dos implementaciones: el overlay inline (`ActiveWorkout.tsx:690 RestTimerOverlay`, con `{id, seconds}`) y el componente `RestTimer.tsx` (513 líneas) **inalcanzable** con la aritmeticamente correcta (`lib/workout/restTimer.ts`), su beep y su vibración. La app real no tiene sonido.

```ts
// platform/lifecycle/anchoredClock.ts
/**
 * Un reloj anclado: el ancla es un epoch absoluto, el resto es aritmética.
 * No depende de setInterval para ser correcto: el intervalo solo refresca
 * el texto. Si la pestaña se estrangula, al volver el valor sigue siendo
 * el correcto.
 */
export function remainingMs(endsAt: number, now: number = Date.now()): number {
  return Math.max(0, endsAt - now);
}

/** Para renderizar: refresca a un ritmo fijo, recalculando desde el ancla. */
export function useAnchoredRemaining(endsAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    // Un tick por segundo basta para el texto; la verdad es endsAt.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return endsAt === null ? 0 : remainingMs(endsAt, now);
}
```

**Consecuencias que la app pierde hoy y que el objetivo gana:**

| Ganancia | Mecanismo |
|---|---|
| El descanso no se reinicia al remontar | `endsAt` persistido, no `seconds` |
| El sonido funciona | `RestTimer.tsx` ( beep + vibración) pasa a ser **el** temporizador, no un componente huérfano |
| La alerta de fin de descanso suena una sola vez | Marca `alertedAt` en el ancla, no en un `useEffect` que se repite |
| Se cierra la divergencia `isBodyweight`/sonido | Un solo módulo decide qué suena |

### 5.3 Resincronización al primer plano

**[R]** Symmetry: `app_lifecycle_changes`. Hevy: el reloj vive en el reloj.
**[E]** Hoy `useOfflineSync` reacciona a `visibilitychange` para **drenar la cola** (`hooks/useOfflineSync.ts:80-82`), pero **nadie** resincroniza el temporizador ni la sesión al volver al frente.

```ts
// platform/lifecycle/useForegroundSync.ts
export function useForegroundSync(onForeground: (elapsedMs: number) => void): void {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Cuánto tempo pasó fuera: puede ser un día.
      onForeground(Date.now() - lastVisibleAt.current);
      lastVisibleAt.current = Date.now();
    };
    const lastVisibleAt = { current: Date.now() };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onForeground]);
}
```

Con `endsAt` persistido, volver al frente produce exactamente tres casos:

| Estado del ancla al volver | Acción |
|---|---|
| `endsAt` en el futuro | Repintar el resto real, sin tocar el estado |
| `endsAt` ya pasado | Disparar la alerta de fin de descanso **una vez** y cerrar el descanso |
| Sin descanso en curso | No-op |

### 5.4 Recuperación de borrador

**[E]** Hoy el borrador existe (`lib/offlineStore.ts`) y es recuperable (`loadRecoverableDraft`, `:138-157`), pero **la puerta está cerrada**: la recuperación vive en `ActiveWorkout.tsx:1608 restoreRecovered`, que solo se ejecuta si el usuario llega a la pantalla de entrenamiento. Si el usuario recarga en el dashboard, el borrador queda huérfano y no se le ofrece.

**[R]** Symmetry: la sesión activa se rehidrata al arrancar la aplicación.

```ts
// app/providers.tsx — antes de renderizar el router
export function SessionRehydrationGate({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) { setReady(true); return; }
    void loadRecoverableDraft(userId).then((d) => { setDraft(d); setReady(true); });
  }, [userId]);

  if (!ready) return <SplashScreen />;
  return (
    <ActiveSessionProvider initialDraft={draft}>
      {draft ? <RecoveryPrompt draft={draft} /> : null}
      {children}
    </ActiveSessionProvider>
  );
}
```

**Y el modelo de borrador v2** (Fase 2 §8.2, sin cambios), con `restEndsAt` como campo de primera clase:

```ts
export interface SessionDraft {
  readonly logId: string;
  readonly userId: string;
  readonly routineId: string | null;
  readonly routineTitle: string;
  readonly startedAt: string;
  readonly items: readonly DraftExercise[];
  readonly notes: string;
  readonly finalized: boolean;
  /** Ancla del descanso en curso (epoch ms). v2 */
  readonly restEndsAt: number | null;
  /** Ejercicio seleccionado, para reabrir donde se estaba. v2 */
  readonly selectedKey: string | null;
  /** Segundos de descanso ya resueltos por ejercicio. v2 */
  readonly restSecondsByExercise: Readonly<Record<string, number>>;
  readonly version: 2;
}
```

La migración `v1 → v2` cabe en el `normalizeDraft` que ya existe (`lib/offlineStore.ts:118-126`), que ya sabe reparar borradores antiguos.

### 5.5 Escritura: RPC + cola con backoff

```ts
// data/rpc/finishSession.ts
export async function finishSession(payload: FinalizePayload): Promise<WriteResult> {
  const { data, error } = await supabase.rpc("finish_session", {
    p_log_id: payload.logId,
    p_user_id: payload.userId,
    p_routine_id: payload.routineId,
    p_title: payload.routineTitle,
    p_started_at: payload.startedAt,
    p_completed_at: payload.completedAt,
    p_notes: payload.notes,
    p_sets: payload.sets,
  });
  if (error) throw new SupabaseError(error);
  return { ok: true };
}
```

**Y la cola deja de clasificar errores por texto:**

| Hoy (`lib/sessionSync.ts:37-49`) | Objetivo |
|---|---|
| `isRetryable(message)` busca `"fetch"`, `"network"`, `"timeout"`, `"502"`, `"503"`, `"504"` | El error trae un **código** (`42501` permisos, `23502` nulabilidad, `40001` serialización). Reintentable = todo lo que no sea `4xx` de cliente |
| Intervalo fijo de 60 s | Backoff exponencial con jitter: `min(2^n · 15 s, 15 min)` |
| El fallo se traga (`catch { return null; }`) | El fallo se propaga a `useOfflineSync`, que lo expone en la UI |

```ts
// platform/offline/queue.ts
const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 900_000;

export function nextDelayMs(attempts: number): number {
  const exponential = BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1);
  const jitter = Math.random() * 0.3 * exponential;   // 0..30 %
  return Math.min(BACKOFF_MAX_MS, exponential + jitter);
}
```

### 5.6 Eliminar el segundo motor de descanso

La decisión de producto que hay que tomar antes de escribir código:

| Opción | Qué implica | Coste |
|---|---|---|
| **A. `RestTimer.tsx` pasa a producción** | `ActiveWorkout` lo monta; el beep y la vibración vuelven; `lib/workout/restTimer.ts` y `lib/audio/audio.ts` dejan de ser huérfanos | Bajo — ya está escrito y testeado |
| **B. El overlay inline pasa a producción** | Se elimina `RestTimer.tsx` (514) + `restTimer.ts` (86) + `audio.ts` (122) + sus tests (~450) | Medio — hay que escribir el beep y la vibración |

**La auditoría recomienda A**: el componente ya existe, ya está testeado y tiene el comportamiento correcto (anclado, con sonido). **Lo que hay que hacer es conectarlo, no reescribirlo** — y eso significa que la suite de tests deja de cubrir una pantalla fantasma.

---

## 6. Medios y caché offline

### 6.1 El problema que resuelve

**[E]** Hoy hay tres rutas de medios rotas y **ninguna caché**:
- 3 de 4 usos de foto de maquinaria hacen `public/images/…` → 404 en Vite.
- El JSON guarda `videos/0001-….gif` y `resolveImageSrc` solo quita el prefijo `public/`, así que la ruta final es relativa a la ruta actual; no existe `public/videos/`.
- Los GIF **no están en el repositorio**: se sirven desde `main` de GitHub raw, una rama móvil sin versión fijada.
- No hay service worker, ni `CacheStorage`, ni plugin PWA: `navigator.onLine` es la única señal.

**[R]** Hevy: MP4 de demostración en CloudFront + thumbnails, con **URL inmutable** (`{id}-{Nombre}_{Grupo}.mp4`) y thumbnails `@3x` empaquetados en el APK.
**[R]** Symmetry: `symmetry-assets.com` + `flutter_cache_manager` + `prefetchThumbnailUrl` + WebP + blurhash + vídeo HLS/MP4.

### 6.2 Modelo de medio

```ts
// domain/media.ts
export type MediaKind = "thumbnail" | "photo" | "animation" | "video";

export interface MediaVariant {
  readonly kind: MediaKind;
  readonly format: "webp" | "avif" | "jpg" | "gif" | "mp4" | "webm";
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export interface ExerciseMedia {
  /** Clave estable. Nunca una URL. */
  readonly key: string;                 // 'exercise/0001'
  readonly variants: readonly MediaVariant[];
  /** Colores de la silueta para el placeholder antes de cargar. */
  readonly blurhash: string | null;
  readonly durationMs: number | null;   // para vídeo
}
```

**La regla: `media_key` en los datos, resolución de URL en `platform/media/`.** Ningún componente escribe una ruta.

```ts
// platform/media/resolve.ts
const CDN = import.meta.env.VITE_CDN_URL;

export function resolveMedia(key: string, variant: MediaVariant): string {
  // URL inmutable: el contenido no cambia nunca bajo la misma clave,
  // así que se puede cachear para siempre.
  return `${CDN}/${key}/${variant.format}/${variant.width}x${variant.height}`;
}
```

**Un solo lugar resuelve. Los tres 404 desaparecen por construcción.**

### 6.3 Caché en disco con cuota

**[R]** Symmetry: `flutter_cache_manager` con cuota y limpieza.
**[E]** Hoy no hay caché de medios; un arranque en frío sin red deja al usuario **sin catálogo y sin demos**.

```ts
// platform/media/cache.ts
const QUOTA_BYTES = 120 * 1024 * 1024;   // 120 MB
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;

interface CacheEntry {
  readonly key: string;
  readonly bytes: number;
  readonly lastUsed: number;
  readonly etag: string | null;
}

/**
 * Caché LRU con cuota. Al superar la cuota se evicta por
 * menos-uso-hace-más-tiempo, empezando por las animaciones:
 * son los bytes más caros y los menos frequently needed offline.
 */
export async function put(key: string, blob: Blob, etag: string | null): Promise<void> {
  const bytes = blob.size;
  if (bytes > MAX_ENTRY_BYTES) return;                  // no cachear
  await mediaStore.put(key, blob, bytes, Date.now(), etag);
  await evictIfNeeded(QUOTA_BYTES);
}

export async function evictIfNeeded(quota: number): Promise<void> {
  let total = await mediaStore.totalBytes();
  if (total <= quota) return;
  const entries = await mediaStore.all();                 // ordenados por lastUsed
  for (const entry of entries) {
    if (total <= quota * 0.8) break;                       // baja al 80 % de la cuota
    await mediaStore.remove(entry.key);
    total -= entry.bytes;
  }
}
```

**Prioridad de eviction** (decisión de producto, con criterio):

| Categoría | Política | Motivo |
|---|---|---|
| Thumbnails del catálogo | **Nunca** se evictan | Son necesarios para que el catálogo se vea sin red |
| Fotos de maquinaria | Se evictan después de los thumbnails | Útiles pero sustituibles |
| Animaciones (GIF/MP4) | **Primero** en evictar | Son los bytes más caros (decenas de MB para 1 324 ejercicios) |
| Vídeos de demostración | Solo bajo demanda | Nunca se precachean |

### 6.4 El catálogo como activo, no como bundle

**[E]** El chunk principal mide 16,13 MB porque `exercisesCatalog.json` entra por import estático (`ExerciseSelectorModal.tsx:17`).

**Objetivo:**

```ts
// platform/offline/catalogStore.ts
/**
 * El catálogo es un activo estático: idéntico para todos los atletas.
 * Se descarga una vez, se guarda comprimido en IndexedDB y se sirve
 * desde ahí. El bundle inicial no lo contiene.
 */
export async function ensureCatalog(): Promise<CatalogSnapshot | null> {
  const cached = await catalogStore.get();
  if (cached && cached.version === CATALOG_VERSION) return cached;

  const response = await fetch(`${CDN}/catalog/${CATALOG_VERSION}.json.gz`);
  if (!response.ok) return cached ?? null;                // red caída: usar lo que hay

  const raw = await response.json();
  await catalogStore.put({ version: CATALOG_VERSION, data: raw });
  return raw;
}
```

| Antes | Después |
|---|---|
| 16,26 MB en el bundle, descargados en cada carga fría | 0 bytes en el bundle; ~1,5 MB comprimidos, **una vez**, cacheados |
| El catálogo no se puede usar sin red | El catálogo se lee de IndexedDB |
| 3 consultas `select("*")` de 1 324 filas | 0 consultas: el catálogo es local |
| La app tarda en arrancar en móvil de gama baja | Arranque inmediato; el catálogo llega después y repinta |

### 6.5 Service worker: el shell sin red

**[E]** `navigator.onLine` es hoy la única señal de offline. Una recarga sin red deja al usuario fuera de la app.
**[R]** Todos los clientes profesionales lo hacen.

```ts
// app/sw.ts (o vite-plugin-pwa con workbox)
precacheAndRoute([
  '/', '/rutinas', '/entrenar', '/progress', '/rangos',
]);
runtimeCaching([
  { urlPattern: /\/catalog\/.+\.json\.gz$/, handler: 'NetworkFirst', options: { cacheName: 'catalog' } },
  { urlPattern: /\/exercise\/.+\.(webp|avif)$/, handler: 'CacheFirst', options: { cacheName: 'media' } },
  { urlPattern: /\/exercise\/.+\.(mp4|webm)$/, handler: 'CacheFirst', options: { cacheName: 'video', expiration: { maxEntries: 40 } } },
]);
```

**Contrato de UX resultante:**

| Situación | Comportamiento |
|---|---|
| Sin red, app ya abierta | Funciona; las escrituras van a la cola |
| Sin red, recarga | El shell se sirve del precaché; el catálogo y la sesión del IndexedDB |
| Sin red, primer arranque | Se muestra el shell y un aviso; no un error blanco |
| Con red | Todo normal |

### 6.6 Formatos recomendados

| Contenido | Formato | Motivo |
|---|---|---|
| Thumbnail del catálogo | **WebP** (o AVIF si el navegador lo soporta) | 5–10× más pequeño que JPG para una imagen de 320 px |
| Foto de maquinaria | **WebP** + AVIF | Hoy son 161 JPG de 24,4 MB |
| Animación de ejecución | **WebM/VP9** o **MP4/H.264** | Un GIF de 2 MB es 200× más caro que un MP4 de 30 KB |
| Demostración | **MP4** (H.264) | Compatibilidad máxima; es lo que sirve Hevy |
| Placeholder | **blurhash** | 20 bytes; la silueta se ve mientras carga |

**Presupuesto de medios para el modo offline:** con 1 324 ejercicios, un thumbnail WebP de 320 px ronda los 12 KB → **~16 MB de catálogo**, lo que cabe de sobra en la cuota de 120 MB. Las animaciones no caben: de ahí que la eviction las sacrifique primero.

---

## 7. Ejercicios de usuario

**[R]** Hevy, Symmetry y FitNotes lo soportan; Cronos no. Es la brecha funcional más grande.

| Aspecto | Decisión | Origen |
|---|---|---|
| Modelo | `user_exercises` + vista `resolvable_exercises` | P10 |
| Duplicados | Al crear, se busca por `name_normalized` en catálogo **y** entre los del usuario; se ofrece *usar el existente* o *crear el mío* | Hevy `isDuplicate` / `duplicateResolver` |
| Límite | 7 en plan gratuito, ilimitado en premium | Hevy |
| Foto | Subida opcional, almacenada en el bucket con `media_key` | Symmetry `CustomExercisePhotoStore` |
| Resolución | **Un solo** resolver de nombre (`domain/catalog/resolveExercise.ts`) con normalización compartida | E: hoy hay 4 |
| Efecto en el resto | Ninguna consulta nueva: filtros, swaps, ranks y hub ya consultan `exercises` | — |

---

## 8. Integraciones: IA y portal del entrenador

### 8.1 IA

**[E]** Hoy `supabase` se importa dinámicamente en `coachAssistant.ts:363` y `useCoachAuth.ts:231` con la intención de diferir el SDK, pero 26 módulos lo importan estáticamente: **la intención es inoperante** (Vite lo advierte en cada build).

| Decisión | Detalle |
|---|---|
| Aislar la IA | `features/coach/` es la **única** zona que habla con el proveedor. El resto de la app nunca importa `openrouter`. |
| Tools tipadas | El esquema de herramientas de `lib/ai/tools.ts` se genera desde un único `ToolDefinition[]` y el `parseCoachAction` se valida contra él |
| Errores visibles | `routineGenerator.ts:587-591,594` deja de tragar: un `JSON.parse` fallido o una herramienta que falla producen un mensaje en la UI |
| Contexto acotado | El contexto del usuario se construye desde `domain/profile`, con consentimiento explícito (`lib/profile/consent.ts`) |
| Coste y cuota | `lib/ai/types.ts` ya tiene tipos de uso; falta la regla que los aplique al producto |

### 8.2 Portal del entrenador

**[E]** Tres lecturas de `profiles` en el mismo portal (`RequestQueue.tsx:103,138` + `CoachPortal.tsx:208`); `AthleteCRM.tsx:112` lee el catálogo entero sin `limit` y **sin manejar el error**.

| Decisión | Detalle |
|---|---|
| Una caché de perfil | `data/cache/` deduplica por clave y por petición en vuelo; las tres lecturas se resuelven con una |
| Errores tipados | `data/supabase/errors.ts` traduce el `PostgrestError` a un tipo de dominio con mensaje en español |
| Límites de consulta | Toda lectura del catálogo lleva `limit` y `select` explícito |
| Aislamiento de datos | El `user_id` de cada lectura viene del `outlet context`, nunca de un parámetro libre |

---

## 9. i18n objetivo

**[E]** Hoy: 1 937 líneas de diccionarios anidados **en español fijo**, sin selector de idioma; el catálogo trae 10 idiomas y la semilla usa solo `.es`; 43 claves muertas; cadenas literales en componentes.

| Decisión | Detalle |
|---|---|
| Locales reales | `es` (por defecto), `en`, `pt`, `fr`, `de`, `it` — el idioma de los datos, no el del mercado |
| Catálogo por locale | `platform/i18n/` con carga bajo demanda: `import("./locales/en.ts")` |
| Claves de datos | La base de datos guarda **claves** (`label_key`), nunca texto traducido: ya se hace en `movement_patterns.label_key` (§4.2) |
| Instrucciones | `Record<Locale, readonly string[]>`; el servidor guarda el JSON completo y el cliente elige (`§4.7`) |
| Formateadores | `shared/format/` con **un** `Intl.DateTimeFormat` y **un** `Intl.NumberFormat` parametrizados por locale (hoy hay 5 formateadores sueltos y 0 `NumberFormat`) |
| Validación | Un test que recorra todas las claves de todos los locales y falle si falta alguna o sobra (el patrón ya existe en `lib/i18n.test.ts`) |

---

## 10. Errores, tipado y observabilidad

### 10.1 Tipos de error de dominio

```ts
// platform/telemetry/errors.ts
export type AppError =
  | { kind: "network"; retryable: true; cause: unknown }
  | { kind: "permission"; retryable: false; cause: unknown }
  | { kind: "validation"; retryable: false; field: string; message: string }
  | { kind: "conflict"; retryable: false; cause: unknown }
  | { kind: "unknown"; retryable: false; cause: unknown };
```

**Regla:** ninguna función que cruza la frontera de red devuelve `null` para un error. Devuelve `Result<T, AppError>`. El contrato «degradar a `null`» de `lib/idb.ts` **se mantiene para el almacenamiento local** (registrar no puede romper un entrenamiento), pero **cada degradación emite una métrica**.

### 10.2 Lo que se instrumenta

| Evento | Dónde | Para qué |
|---|---|---|
| `sync.drain.failed` | `useOfflineSync` | Saber que hay sesiones atascadas |
| `catalog.load.failed` | `catalogStore` | Distinguir «sin red» de «catálogo corrupto» |
| `media.cache.evicted` | `media/cache` | Ajustar la cuota con datos |
| `media.404` | `platform/media/loader` | Detectar rutas rotas antes de que las vea el usuario |
| `import.read.failed` | `useCsvImport` | Depurar el importador |
| `workout.rest.missed` | `features/workout` | Medir si la alerta de fin de descanso llega a tiempo |

### 10.3 Contrato de nulabilidad generado

**[P9]** Hoy `numeric` es `number` en TypeScript y `numeric` en SQL [E: informe 06 §5.2], y dos módulos asumen cosas distintas.

```bash
# Generar los tipos desde el esquema real, no a mano.
supabase gen types typescript --linked > src/data/supabase/database.types.ts
```

Con tipos generados, `numeric` llega como `number` **o** como el tipo que el generador declare, y el casts `as unknown as` (`useAthletePRs.ts:133`, `exerciseHistory.ts:135`) **desaparecen**. Un test de arquitectura verifica que `src/types/supabase.ts` no se edite a mano.

---

## 11. Presupuestos de rendimiento

| Presupuesto | Hoy | Objetivo | Cómo se verifica |
|---|---|---|---|
| Chunk principal (gzip) | **2,58 MB** | **< 300 kB** | `vite build` en CI |
| Chunk de catálogo | (embebido) | **< 200 kB** (comprimido) | idem |
| Solicitudes al arrancar | 6+ | ≤ 2 | Medición en el navegador |
| Filas de `exercises` descargadas | 1 324 × 3 sitios | 0 | El catálogo es local |
| Filas de `routine_exercises` por refresco | todas | las de la rutina | `where routine_id = …` |
| `useState` en un componente | 18 | ≤ 8 | ESLint |
| Líneas por componente | 2 262 | ≤ 600 | ESLint |
| `import()` que no divide bundle | 3 | 0 | Aviso de Vite en CI = error |
| `catch` que traga sin telemetría | 3 | 0 | Regla D7 |

---

## 12. Plan de migración

### 12.1 Fases M0–M7

| Fase | Contenido | Criterio de entrada | Criterio de salida | Reversible |
|---|---|---|---|---|
| **M0 — Higiene** | Eliminar exports muertos (55), quitar `export` a 265, borrar `AnatomicalRanksPage.backup.tsx`, `equipmentHelpers.ts`, `pickerTokens.ts`, `neonRanks.ts`, `userContext.ts`; corregir el `sort` no-op y el código de issue del RPE | — | Typecheck verde, 129/129 verde, −3 500 líneas | Sí, commit único |
| **M1 — Defectos visibles** | Corregir rutas de medios (4), barra de progreso del importador, `existingImportIds`, toggle de favorito, error de `AthleteCRM`, stubs de progreso, propagar el error de drenaje | M0 | Cero 404 de medios; el error de sync es visible | Sí, commits separados |
| **M2 — Decisión de pantalla** | **Elegir** `ActiveWorkout` en línea o `SetTable`. Migrar los tests a la que quede. Conectar el beep y la vibración | M1 | Una sola pantalla de series; los tests cubren lo que se ejecuta; el audio vuelve a la app | Media |
| **M3 — Capas y reglas** | Crear `domain/`, `data/`, `features/`, `platform/`; mover por capas; añadir las 7 reglas de dependencia como tests | M2 | Las reglas de dependencia pasan en CI; ningún `domain/` importa React ni Supabase | Sí, por capas |
| **M4 — Datos** | Migración `set_type`; `group_id`/`group_order`; `numeric` correcto; tipos generados; nulabilidad alineada; marcar `schema.sql` obsoleto; RPC `finish_session` | M3 | Un PR más antiguo que 2 000 series es visible; una sesión nunca queda sin series | No (migración de datos) — se hace al final y con copia |
| **M5 — Catálogo y medios** | Sacar el JSON del bundle; `media_key` + `resolveMedia`; caché LRU con cuota; catálogo comprimido en IndexedDB; service worker | M4 | Chunk principal < 300 kB gzip; la app arranca sin red y muestra el catálogo | Sí (el JSON sigue en el repo como semilla) |
| **M6 — Taxonomía** | Tablas `muscle_groups`, `movement_patterns`, `training_types`, `exercise_muscle_map`, `exercise_pattern_map`, `exercise_training_type_map`, `equipment`; script de mapeo desde el JSON; un solo vocabulario | M5 | Un identificador canónico por grupo muscular; la sugerencia de equipamiento acierta | No (migración de datos) |
| **M7 — Usuario e i18n** | `user_exercises` + vista; límite y duplicados; locales reales; formateadores únicos; limpieza de claves muertas | M6 | Un ejercicio propio aparece en el selector; el idioma cambia | Media |

### 12.2 Trazabilidad con las fases anteriores

| Hallazgo | Fase de origen | Fase objetivo |
|---|---|---|
| Dos catálogos que no son el mismo catálogo | Fase 3 §3.1 | M4 + M6 |
| Taxonomía con 3 vocabularios superpuestos | Fase 3 §3.2 | M6 |
| Sin ejercicios de usuario | Fase 3 §1.6 | M7 |
| 6 duplicados irresolubles | Fase 3 §3.4 | M6 + M7 |
| Medios rotos (4 sitios) | Fase 3 §3.5 | M1 + M5 |
| Sin caché offline del catálogo | Fase 3 §3.6 | M5 |
| `exerciseNotes` muerto | Fase 3 §3.7 + Fase 4 §6.4 | M0 |
| `is_warmup` pierde el tipo de serie | Fase 1 §7.1 | M4 |
| Dos implementaciones del temporizador | Fase 2 §4.2 | M2 |
| El borrador no se puede recuperar | Fase 2 §4.3 | M2 + M3 |
| Sin rehidratación al arrancar | Fase 2 §8.2 | M3 |
| Ventana «sesión sin series» | Fase 1 §5.5 + Fase 4 §6.5 | M4 (RPC) |
| Isla de 9 588 líneas | Fase 4 §4 | M0 + M2 |
| 3 tablas tipadas sin DDL | Fase 4 §5.3 | M4 |

---

## 13. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **M2 se pospone** y el proyecto sigue con dos pantallas de entrenamiento | Alta | Alto | M2 tiene un criterio de salida binario y es la única fase que bloquea a las demás |
| La migración de `numeric` a tipos generados rompe código que hoy «funciona» por el `as unknown as` | Media | Medio | M4 empieza por generar los tipos y compilar, sin cambiar los tipos a mano |
| La RPC `finish_session` choca con las políticas RLS actuales | Media | Alto | La RPC es `security invoker`: hereda las políticas. Se prueba con un usuario real antes de desplegar |
| La migración de taxonomía rompe los rangos anatómicos | Media | Alto | M6 se hace después de que la pantalla de rangos esté en M2-M3, y con un script de verificación `verify:mapping` (ya existe en `package.json:14`) |
| El service worker cachea una versión stale y confunde | Baja | Medio | `NetworkFirst` para el catálogo; precaché con revisión por versión; botón «buscar actualizaciones» |
| El catálogo se sirve de un CDN que no existe todavía | Media | Alto | M5 es reversible: el JSON sigue en el repo como semilla y el store tiene fallback al asset local |
| El coste de la RPC (JSONB de arrays) supera al de los inserts sueltos | Baja | Bajo | Medir en M4; el volumen por sesión es pequeño (decenas de filas) |
| La reubicación en capas genera churn sin beneficio | Media | Medio | Cada capa se mueve con sus tests, en commits separados, y las reglas de dependencia se activan **antes** de mover el primer fichero |

---

## 14. Límites de este documento

- **Es una especificación, no un plan ejecutado.** Ninguna de las fases M0–M7 se ha aplicado: `src/` y `supabase/` están intactos.
- **El SQL es ilustrativo.** Los DDL de §4.2–4.6 no se han ejecutado contra una base de datos real; los tipos exactos (`numeric(5,2)`, los `check`, los índices parciales) necesitan validación contra Postgres y contra las políticas RLS actuales.
- **La RPC `finish_session` no está probada.** Su corrección transaccional es evidente por construcción, pero el comportamiento bajo RLS, bajo concurrencia y con `jsonb` malformado requiere pruebas reales.
- **El presupuesto de 300 kB gzip es una estimación**, no una medición: depende de cuánto código quede en el chunk principal tras M3. Los 16,13 MB actuales dan margen amplio, pero el número exacto solo se conoce después de M5.
- **No se ha medido el comportamiento en un navegador real** ( Lighthouse,akis, red móvil ). Los budgets son objetivos verificables, no resultados observados.
- **La capa `features/` no está pensada para micro-frontends.** Es una frontera de dependencias, no de despliegue. Si en el futuro se quiere dividir en paquetes, la misma estructura sirve, pero esa decisión no está tomada.

---

## 15. Anexo — De dónde viene cada idea

| Decisión de la arquitectura objetivo | Referencia | Evidencia en Cronos | Fase |
|---|---|---|---|
| Implicación muscular con rol y porcentaje | **JEFIT** (`ExerciseMuscleInvolvementMapEntity`) | `muscleMap.ts:271-282` solo mira `target` y `body_part` | M6 |
| Jerarquía de grupos musculares | **JEFIT** (`MuscleGroupsEntity.parentGroupId`) | 3 vocabularios superpuestos | M6 |
| Equipamiento con jerarquía y opcionalidad | **JEFIT** (`ExerciseEquipmentMapEntity`) | `equipmentMap.ts` + 46 regex | M6 |
| Patrón de movimiento con porcentaje | **JEFIT** (`ExerciseMovementPatternEntity`) | No existe | M6 |
| Tipo de entrenamiento primario/secundario | **JEFIT** (`ExerciseTrainingTypeMapEntity`) | No existe | M6 |
| Dos niveles de grupo muscular | **Hevy** (`exerciseData.muscleGroup.*` + `global.simplifiedMuscleGroup.*`) | `target`/`muscle_group` | M6 |
| Ponderación de series (1 / 0,5) | **Hevy** | No existe | M6 |
| Duplicado → ejercicio propio | **Hevy** (`duplicateResolver`, `isDuplicate`) | 6 nombres indistinguibles | M7 |
| Límite de 7 ejercicios propios | **Hevy** | No existe | M7 |
| Demostraciones en vídeo MP4 desde CDN | **Hevy** (672 MP4 + 826 thumbnails en CloudFront) | GIF desde `main` de GitHub raw | M5 |
| Temporizador anclado | **Hevy** (`anchoredRemaining`) y **Symmetry** (`anchoredRemaining`) | Dos implementaciones, la buena es huérfana | M2 |
| Resincronización al primer plano | **Symmetry** (`app_lifecycle_changes`) | Nadie resincroniza el temporizador | M2 |
| Rehidratación de la sesión al arrancar | **Symmetry** | El borrador no se puede recuperar | M3 |
| Caché de medios en disco con cuota | **Symmetry** (`flutter_cache_manager`) | No hay caché | M5 |
| Blurhash y variantes WebP | **Symmetry** | 161 JPG de 24,4 MB | M5 |
| Tipos de ejercicio y de patrón | **Symmetry** (`ExerciseType`, `ExercisePattern`) | No existen | M6 |
| `isolation` explícito | **Symmetry** | No existe | M6 |
| Escrituras transaccionales | **FitNotes** (Room) y **Symmetry** (Drift) | 3 escritores sin transacción | M4 |
| Columna de medios configurable | **FitNotes** (`default_graph_id`) | `gif_url` fijo | M5 |
| Esquema legible y versionado | **FitNotes** (SQL + `database.db` v22) | `schema.sql` obsoleto y en silencio | M4 |
| Comprobación manual de duplicados | **FitNotes** | `catalog.find` arbitrario | M7 |
| Store cifrado del lado del cliente | **JEFIT** (Room + SQLCipher) | IndexedDB sin cifrar | Fuera de alcance |
| Detección de duplicados con distancia de edición | **Symmetry** (`ImportDuplicatesModel`) | Coincidencia exacta | M7 |
