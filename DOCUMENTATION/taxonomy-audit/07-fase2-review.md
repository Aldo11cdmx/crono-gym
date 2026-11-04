# Fase 2 - Revisión documental y correcciones de vocabulario

Modo: READ-ONLY. No se modifica `exercisesCatalog.json`, catálogos, código, migraciones, disponibilidad ni IDs.

## 1. Corrección: separación de patrón, función y acción articular

Se separan tres dimensiones independientes:

| Dimensión | Campo propuesto | Definición | Fuente mínima |
|---|---|---|---|
| Patrón biomecánico | `pattern_family` | Movimiento global del ejercicio | E1/E2 |
| Clasificación funcional | `functional_classification` | Intención de entrenamiento | E2/E3 documentada |
| Acción articular | `primary_joint_action` | Articulación y movimiento principal | E1/E2 |

Valores de `functional_classification`:
- `strength`
- `hypertrophy`
- `power`
- `endurance`
- `mobility`
- `stability`
- `skill`
- `recovery`
- `mixed`
- `unknown`

Regla: si no existe evidencia de intención, usar `unknown`; no inferir por nombre.

## 2. Corrección: implemento, resistencia y accesorio

Se separan tres dimensiones independientes:

| Dimensión | Campo propuesto | Definición | Fuente mínima |
|---|---|---|---|
| Implemento | `implement_type` | Objeto físico principal usado | E1/E2 |
| Sistema de resistencia | `resistance_system` | Mecanismo de carga | E1/E2 |
| Accesorio | `accessory_type` | Elemento secundario o modificador | E1/E2 |

`accessory_type` puede ser `none`, `bench`, `stability_ball`, `assistance`, `band`, `attachment`, `unknown`.

Regla: el accesorio no redefine el implemento principal ni el sistema de resistencia.

## 3. Corrección: acciones articulares agrupadas

Las acciones que agrupaban movimientos distintos se separan:

| Acción original | Acción revisada | Motivo |
|---|---|---|
| `knee_flexion_extension` | `knee_extension`, `knee_flexion`, `knee_flexion_extension_complex` | Sentadilla, extensión y curl no son el mismo movimiento |
| `shoulder_abduction_adduction` | `shoulder_abduction`, `shoulder_adduction`, `shoulder_abduction_adduction_complex` | Elevación lateral y cruce no son equivalentes |
| `trunk_flexion_extension_lateral` | `trunk_flexion`, `trunk_extension`, `trunk_lateral_flexion`, `trunk_flexion_extension_complex` | Crunch, hiperextensión y flexión lateral son distintos |

Si un ejercicio combina varias acciones sin una dominante clara, usar `*_complex` o `unknown`.

## 4. Corrección: categorías musculares mixtas

Las categorías que mezclan región y músculo se separan:

| Categoría original | Separación propuesta |
|---|---|
| `muscle.back.upper_back` | `upper_back_retractors`, `latissimus`, `trapezius` |
| `muscle.core.abs` | `abdominals`, `hip_flexors`, `obliques` |
| `muscle.legs.quadriceps` | `quadriceps`, `knee_extensors` solo si se documenta |
| `muscle.cardio.cardiovascular` | `cardiovascular_system` como objetivo, no músculo esqueletico |

Regla: `target`, `muscle_group` y `secondary_muscles` son fuentes E1, pero no se fusionan automáticamente. Si hay conflicto, registrar `unknown` o pregunta humana.

## 5. Procedencia de cada clasificación

Cada clasificación debe registrar:

| Campo | Descripción |
|---|---|
| `source_fields` | Campos usados: `name`, `body_part`, `target`, `muscle_group`, `secondary_muscles`, `equipment`, `instructions`, `availableInCronosGym` |
| `evidence_level` | `E1`, `E2`, `E3`, `E4` |
| `classification_method` | `structured_field`, `instruction_text`, `documented_rule`, `name_tie_break`, `manual_review` |
| `confidence` | `high`, `medium`, `low` |
| `review_status` | `proposed`, `needs_human_review`, `reviewed`, `accepted` |
| `unknown_fields` | Lista de campos no determinables |
| `contradictions` | Conflictos entre fuentes |
| `reviewer` | Persona o agente que propone |
| `review_date` | Fecha de propuesta |
| `human_approval` | Requerido para `accepted` |

Regla: un valor derivado solo de E4 no puede tener confianza `high`.

## 6. Regla de aprobación

`accepted` requiere aprobación humana explícita y documentada. Ningún agente ni script puede marcar `accepted` automáticamente.

## 7. Justificación de los cambios

Los cambios evitan:
- Mezclar patrón, función y articulación.
- Confundir implemento con resistencia.
- Forzar clasificaciones por nombre.
- Fusionar músculos por similitud de región.
- Ocultar incertidumbre.

No se implementan contratos ni se modifica el catálogo.
