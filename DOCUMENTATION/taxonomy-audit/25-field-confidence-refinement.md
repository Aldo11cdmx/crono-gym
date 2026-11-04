# Fase 3A.2 - Refinamiento conceptual de confianza por campo

## Objetivo

Refinar la propuesta documental de confianza por campo y distinguir estados de incertidumbre.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/19-field-confidence-proposal.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Confianza global

Representa la confianza general en la propuesta de clasificación del ejercicio.

## Confianza por campo

Representa la confianza de cada dimensión individual.

Dimensiones mínimas:

- `muscle_primary`
- `muscle_secondary`
- `muscle_stabilizers`
- `pattern_family`
- `primary_joint_action`
- `movement_plane`
- `kinetic_chain`
- `laterality`
- `resistance_system`
- `implement_type`

## Registro conceptual por campo

| Elemento | Descripción |
|---|---|
| `value` | Valor propuesto |
| `evidence` | Resumen de la evidencia |
| `source_fields` | Campos consultados |
| `evidence_level` | E1, E2, E3 o E4 |
| `confidence` | high, medium o low |
| `review_status` | proposed, needs_human_review, reviewed, accepted |
| `unknown_reason` | Motivo cuando el valor es unknown |

## Estados de incertidumbre

| Estado | Definición | Cuándo usarlo |
|---|---|---|
| `unknown` | Falta evidencia suficiente | No hay información suficiente |
| `not_applicable` | El campo no aplica al ejercicio | La dimensión no es relevante |
| `contradictory_evidence` | Las fuentes se contradicen | `target` y `muscle_group` entran en conflicto |
| `not_represented` | El concepto no está contemplado por el vocabulario | Falta un ID, por ejemplo dorsiflexión o flexión de cadera |

## Reglas

1. No confundir confianza global con confianza por campo.
2. Un ejercicio con confianza global `high` puede tener campos `unknown`.
3. `accepted` requiere aprobación humana explícita.
4. E4 no puede ser fuente única para músculo principal, patrón o implemento.
5. No implementar interfaces ni contratos.

## Ejemplo conceptual

Un ejercicio puede tener:

- `pattern_family=high`
- `muscle_primary=medium`
- `muscle_stabilizers=unknown`
- `primary_joint_action=unknown`

Esto no es una contradicción; representa granularidad de evidencia.

## Incertidumbres

- La representación final de estados de incertidumbre dependerá de una fase posterior.
- No se ha implementado persistencia.
- No se han validado los estados con datos reales más allá del piloto.

## Limitaciones

- Propuesta documental únicamente.
- No modifica la matriz.

## Conclusión

La confianza por campo permite representar incertidumbre sin degradar artificialmente toda la clasificación del ejercicio.
