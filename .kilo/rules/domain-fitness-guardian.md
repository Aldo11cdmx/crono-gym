# Domain Fitness Guardian
> Se activa cuando: series, volumen, PRs, rangos musculares, sobrecarga progresiva, tipos de serie, importación de datos, tipos de `src/types/supabase.ts`.

## Misión
Proteger la pureza del dominio de entrenamiento: nada inventado, nada ambiguo, nada que mienta sobre el progreso del atleta.

## Framework de Decisión
1. ¿Este campo existe en el schema (`supabase/schema.sql`, migraciones) y en `src/types/supabase.ts`?
2. ¿El cálculo usa datos reales o supuestos?
3. ¿Qué pasa con un dato nulo, cero, `numeric` como string o unidad distinta?
4. ¿Esto muta una serie ya sincronizada?

## Conceptos canónicos
Routine → `routine_exercises` · `workout_logs` (sesión) → `completed_sets` (`exercise_id`, `set_number`, `weight`, `reps`, `rpe`, `is_warmup`). Tipos de serie en UI: `normal | warmup | failure | drop` (`lib/workout/setKind.ts`, `SET_TYPE_LABELS`).

## Patrones Obligatorios
- **No inventar campos.** `RIR` no es columna: se deriva (`RIR = 10 − RPE`, `lib/overload.ts`). `SetKind` `drop`/`failure` aún no se persiste (solo `is_warmup`): cualquier persistencia nueva pasa por migración (ver `supabase-data-and-migrations-guardian.md`).
- Músculos y equipo siempre por `translateMuscle` / `MUSCLE_LABELS_ES` / `EQUIPMENT_LABELS`; un solo vocabulario por concepto.
- Series sincronizadas: no hay `UPDATE` parcial. Una corrección = nuevo `finalize_session` del mismo `logId` (reemplazo completo, auditable), nunca edición silenciosa.
- `numeric` de Postgres puede llegar como string: normalizar al leer (el audit detectó `useAthletePRs` descartando filas cuyo peso no es `number`).
- Volumen/progreso/rangos solo desde datos del schema: `lib/exercise/*`, `lib/ranks/*` (buildRankMap, muscleScore, scoreToRank, rankHistory) con sus tests.
- Peso corporal + lastre: respeta la lógica de peso de `lib/workout/weightUtils.ts`; unidades kg/lb explícitas (`WEIGHT_UNIT_LABELS`).

## Cómo debe responder Kilo
Cita el campo/columna real y su fuente. Si el cálculo necesita algo que el schema no tiene, di qué falta y propón la migración, no el atajo.

## Comportamiento Proactivo
- Corrige lógica inventada (RIR como campo, "tempo", etc.).
- Detecta pérdida silenciosa de datos en import (CSV con `set_type = "drop"` que se descarta).
- Propone modelos más limpios (p. ej. persistir `SetKind`) con plan de migración compatible con la cola offline.

## Anti-patrones
- Cálculos con supuestos (1RM/volumen sin reps ni peso reales).
- Mutar series ya sincronizadas fuera de `finalize`.
- Tres vocabularios para un músculo (`target`, `muscle_group`, `secondary_muscles` mezclados sin `translateMuscle`).
- Strings de músculo/equipo hardcodeados en componentes.

## Checklist
- [ ] Todo campo usado existe en schema y tipos
- [ ] Músculos/equipo vía funciones de `i18n.ts`
- [ ] Sin mutación de series sincronizadas
- [ ] `numeric` normalizado; unidades explícitas
- [ ] Tests de `lib/exercise`/`lib/ranks` en verde
