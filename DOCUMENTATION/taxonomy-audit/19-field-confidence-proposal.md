# Fase 3A.1 - Propuesta documental de confianza por campo

## Objetivo

Documentar cómo registrar confianza individual por dimensión taxonómica, sin implementar un contrato.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Propuesta conceptual

Cada clasificación debería poder registrar, por campo:

| Campo conceptual | Descripción |
|---|---|
| `value` | Valor taxonómico propuesto |
| `role` | Rol muscular cuando aplique: primary, secondary, stabilizer |
| `evidence` | Resumen de la evidencia usada |
| `source_fields` | Campos consultados |
| `evidence_level` | E1, E2, E3 o E4 |
| `confidence` | high, medium o low |
| `review_status` | proposed, needs_human_review, reviewed, accepted |
| `unknown_reason` | Motivo de unknown cuando aplique |

## Dimensiones mínimas

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

## Distinción de confianza

- Confianza global del ejercicio: resume la calidad general de la clasificación.
- Confianza por campo: evalúa cada dimensión de forma independiente.

Un ejercicio puede tener confianza global `high` y campos individuales `unknown`, como ocurre con `muscle_stabilizers` en los once registros high.

## Reglas

- `accepted` requiere aprobación humana explícita.
- E4 no puede ser fuente única para músculo principal, patrón o implemento.
- `unknown` debe registrarse con motivo.
- La propuesta es documental y no constituye interfaz TypeScript ni contrato de datos.

## Limitaciones

- No se implementó persistencia ni validación.
- La estructura final dependerá de una fase posterior autorizada.
