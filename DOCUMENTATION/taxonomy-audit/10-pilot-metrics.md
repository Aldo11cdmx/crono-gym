# Fase 3A - Métricas del piloto

Muestra: `49` ejercicios (`3.70%` de `1324`).

## Cobertura por estrato

| Estrato | Registros | Porcentaje de la muestra |
|---|---:|---:|
| semantic_duplicates | 12 | 24.49% |
| kettlebell | 6 | 12.24% |
| cardio | 6 | 12.24% |
| mobility | 6 | 12.24% |
| bodyweight | 6 | 12.24% |
| free_weight | 5 | 10.20% |
| cable | 4 | 8.16% |
| machine | 4 | 8.16% |

## Confianza

| Confianza | Registros | Porcentaje |
|---|---:|---:|
| high | 11 | 22.45% |
| medium | 29 | 59.18% |
| low | 9 | 18.37% |

## Campos con `unknown`

| Campo | Registros unknown | Porcentaje |
|---|---:|---:|
| primary_joint_action | 15 | 30.61% |
| kinetic_chain | 11 | 22.45% |
| laterality | 7 | 14.29% |
| resistance_system | 5 | 10.20% |
| implement_type | 5 | 10.20% |
| muscle_primary | 5 | 10.20% |
| muscle_stabilizers | 31 | 63.27% |

Todos los registros tienen al menos un campo `unknown` documentado.

## Ambigüedad

- 12 registros pertenecen a pares de nombres duplicados.
- 6 registros kettlebell mantienen contradicción de disponibilidad abierta.
- 15 registros no tienen acción articular principal determinable con evidencia suficiente.
- 9 registros tienen confianza `low`.
- 5 registros tienen conflicto entre `target` y `muscle_group`.

## Observación

La alta proporción de `unknown` es esperada en un piloto read-only y evita clasificaciones forzadas. No indica fallo del vocabulario, sino falta de evidencia suficiente.
