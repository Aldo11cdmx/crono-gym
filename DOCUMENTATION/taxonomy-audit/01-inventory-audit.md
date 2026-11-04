# Fase 1 - Inventario y auditoria determinista

## Fuente auditada

- Archivo: `src/data/exercisesCatalog.json`
- Registros: 1,324
- Hash SHA-256: `6c0e796dd6c914c126f47ba8dbcbbb9e93b446027b6f0160d3f541c76569eec3`
- Script: `.tmp/taxonomy-audit/audit_catalog.py`
- Fecha de ejecucion: 2026-11-03

## Inventario base

| Control | Resultado |
|---|---:|
| Total de registros | 1,324 |
| IDs unicos | 1,324 |
| IDs nulos | 0 |
| IDs duplicados | 0 |
| Nombres exactos unicos | 1,318 |
| Nombres exactos duplicados | 6 pares |
| Nombres normalizados unicos | 1,318 |
| Nombres normalizados duplicados | 6 pares |
| Registros sin grupo muscular | 0 |
| Registros sin equipo | 0 |
| Registros sin instrucciones | 0 |
| Registros sin GIF | 0 |
| Registros sin imagen | 0 |

## Distribucion de campos categoricos

| Campo | Valores distintos |
|---|---:|
| category / body_part | 10 |
| equipment | 28 |
| muscle_group | 29 |
| target | 19 |
| secondary_muscles | 40 |

La distribucion completa esta en `DOCUMENTATION/taxonomy-audit/vocabulary-distribution.csv`.

## Hallazgos

Archivo: `DOCUMENTATION/taxonomy-audit/findings.csv`

| Tipo de hallazgo | Registros afectados | Severidad |
|---|---:|---|
| Nombres exactos y normalizados duplicados | 12 filas (6 pares) | warn |
| Contradiccion entre `availableInCronosGym` y tags de `MY_GYM_EQUIPMENT_TAGS` | 41 | warn |
| Campos obligatorios vacios | 0 | - |

### Duplicados de nombre

Los 6 pares duplicados exactos y normalizados son:

- `barbell seated calf raise`: `0088`, `1371`
- `ez barbell spider curl`: `0454`, `1628`
- `lever chest press`: `0577`, `0576`
- `push-up (on stability ball)`: `0655`, `0656`
- `self assisted inverse leg curl`: `0697`, `1766`
- `smith reverse calf raises`: `0763`, `1394`

No se fusionan ni renombran en esta fase.

### Contradiccion de disponibilidad

Se detectaron 41 ejercicios con `equipment = kettlebell` y `availableInCronosGym = false`, aunque `kettlebell` aparece en `MY_GYM_EQUIPMENT_TAGS` cuando `FREE_WEIGHTS_AVAILABLE = true`.

Esto puede ser una regla adicional no documentada o un error de derivacion. No se corrige en esta fase.

## Distribucion de vocabulario

El archivo `DOCUMENTATION/taxonomy-audit/vocabulary-distribution.csv` contiene conteos por valor para:

- `category`
- `body_part`
- `muscle_group`
- `target`
- `equipment`
- `secondary_muscles`

Se detectan sinonimos y variantes en `muscle_group`, por ejemplo `shoulders` frente a `deltoids`, `trapezius` frente a `traps`, `abs` frente a `abdominals` y `core`, y `lats` frente a `latissimus dorsi` y `upper back`.

## Gate 1

Fase 0 y Fase 1 quedan documentadas. La clasificacion taxonomica, los vocabularios y el contrato de datos no se han generado.

Pendiente de aprobacion explicita antes de continuar con Fase 2.
