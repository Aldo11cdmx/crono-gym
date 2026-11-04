# Fase 3A.3.1.2 - Auditoría final de trazabilidad de evidencia

## Objetivo

Mejorar la trazabilidad de evidencia mediante referencias concretas y verificables.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/45-evidence-schema-correction.md`
- `DOCUMENTATION/taxonomy-audit/47-master-approval-matrix-corrected.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `src/data/exercisesCatalog.json`

## Método

Se revisaron las referencias genéricas de la matriz y se identificaron fuentes concretas disponibles.

## Fuentes localizables

| Referencia genérica | Fuente concreta disponible |
|---|---|
| target | `exercisesCatalog.json[target]` |
| muscle_group | `exercisesCatalog.json[muscle_group]` |
| secondary_muscles | `exercisesCatalog.json[secondary_muscles]` |
| equipment | `exercisesCatalog.json[equipment]` |
| instructions | `exercisesCatalog.json[instructions.es]` |
| body_part | `exercisesCatalog.json[body_part]` |
| availableInCronosGym | `exercisesCatalog.json[availableInCronosGym]` |
| Reglas biomecánicas | `23-stabilizer-evidence-rules.md` |
| Criterios de aprobación | `31-stabilizer-approval-criteria.md` |

## Evidencia no localizada

| Decisión o dimensión | Evidencia faltante | Estado |
|---|---|---|
| D-STAB-L2-APPLICATION | Instrucciones específicas que documenten estabilización | `evidence_status: unavailable` |
| D-STAB-L3-APPROVAL | Evidencia individual de estabilización | `evidence_status: unavailable` |
| D-ASSIST-IND-1708 | Implemento asistido exacto | `evidence_status: unavailable` |
| D-ASSIST-IND-1709 | Implemento asistido exacto | `evidence_status: unavailable` |
| D-ASSIST-IND-1710 | Implemento asistido exacto | `evidence_status: unavailable` |
| D-ASSIST-IND-1713 | Implemento asistido exacto | `evidence_status: unavailable` |
| D-ASSIST-IND-1714 | Implemento asistido exacto | `evidence_status: unavailable` |
| D-MUSCLE-0518 | Resolución del conflicto target/muscle_group | `evidence_status: unavailable` |
| D-MUSCLE-1512 | Resolución del conflicto target/muscle_group | `evidence_status: unavailable` |
| D-MUSCLE-1714 | Resolución del conflicto target/muscle_group | `evidence_status: unavailable` |
| D-MUSCLE-0003 | Resolución del conflicto target/muscle_group | `evidence_status: unavailable` |
| D-MUSCLE-1368 | Resolución del conflicto target/muscle_group | `evidence_status: unavailable` |

## Regla

Cuando no se pueda localizar una fuente específica:

- Registrar `evidence_status: "unavailable"`.
- Explicar qué falta.
- No inventar referencias.
- No elevar el nivel de evidencia.
- No convertir inferencias en hechos.

## Incertidumbres

- Muchas instrucciones no documentan estabilización.
- El equipo asistido exacto no está documentado.
- Los conflictos musculares no se resuelven con la evidencia actual.

## Limitaciones

- No se modificó el catálogo.
- No se creó una matriz corregida con referencias textuales completas.

## Conclusión

Las referencias concretas mejoran la trazabilidad. La evidencia faltante se declara explícitamente.
