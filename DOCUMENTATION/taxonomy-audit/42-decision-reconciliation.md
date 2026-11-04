# Fase 3A.3.1.1 - Reconciliación de decisiones

## Objetivo

Reconciliar el inventario de decisiones de aprobación humana y corregir la inconsistencia entre el número declarado y las filas existentes.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/24-human-decision-register.md`
- `DOCUMENTATION/taxonomy-audit/32-human-approval-matrix.md`
- `DOCUMENTATION/taxonomy-audit/35-stabilizer-approval-breakdown.md`
- `DOCUMENTATION/taxonomy-audit/36-joint-action-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/37-assisted-equipment-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/38-human-decision-atomic-register.md`
- `DOCUMENTATION/taxonomy-audit/40-master-approval-matrix.md`

## Método

Se recontaron directamente las filas de la matriz `40-master-approval-matrix.md` y se contrastaron con los registros de origen. No se asumió el número declarado en el texto.

## Resultado de la reconciliación

La matriz `40-master-approval-matrix.md` declara 28 decisiones, pero contiene 27 filas.

El número real reconciliado es **27 decisiones atómicas**.

## Inventario reconciliado

| ID original | ID normalizado | Fuente de origen | Tipo | Alcance | Estado | Resultado |
|---|---|---|---|---|---|---|
| D-STAB-49 | D-STAB-L1-RULES | 35 | rule | Criterios de estabilizadores | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-STAB-49 | D-STAB-L2-APPLICATION | 35 | application | Evaluación individual | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-STAB-49 | D-STAB-L3-APPROVAL | 35 | approval | Aceptación individual | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-JOINT-EXT | D-JOINT-ANKLE-DORSIFLEXION | 36 | vocabulary | Acción articular | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-JOINT-EXT | D-JOINT-HIP-FLEXION | 36 | vocabulary | Acción articular | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-JOINT-EXT | D-JOINT-SHOULDER-FLEXION | 36 | vocabulary | Acción articular | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-JOINT-EXT | D-JOINT-SHOULDER-EXTENSION | 36 | vocabulary | Acción articular | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-CIRC-ANKLE | D-CIRC-ANKLE | 29, 32 | vocabulary | Circunducción de tobillo | PROPOSED | Conservada |
| D-ASSIST-1708-1714 | D-ASSIST-DIM-IMPLEMENT | 37 | vocabulary | Dimensión general | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-ASSIST-1708-1714 | D-ASSIST-DIM-AUXILIARY | 37 | vocabulary | Dimensión general | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-ASSIST-1708-1714 | D-ASSIST-DIM-SUPPORT | 37 | vocabulary | Dimensión general | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-ASSIST-1708-1714 | D-ASSIST-DIM-RESISTANCE | 37 | vocabulary | Dimensión general | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-ASSIST-1708-1714 | D-ASSIST-DIM-MECHANISM | 37 | vocabulary | Dimensión general | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-ASSIST-1708-1714 | D-ASSIST-DIM-TYPE | 37 | vocabulary | Dimensión general | PROPOSED | Agrupación original reemplazada por decisión atómica |
| D-ASSIST-1708-1714 | D-ASSIST-IND-1708 | 37 | individual | Implemento asistido | PROPOSED | Conservada |
| D-ASSIST-1708-1714 | D-ASSIST-IND-1709 | 37 | individual | Implemento asistido | PROPOSED | Conservada |
| D-ASSIST-1708-1714 | D-ASSIST-IND-1710 | 37 | individual | Implemento asistido | PROPOSED | Conservada |
| D-ASSIST-1708-1714 | D-ASSIST-IND-1713 | 37 | individual | Implemento asistido | PROPOSED | Conservada |
| D-ASSIST-1708-1714 | D-ASSIST-IND-1714 | 37 | individual | Implemento asistido | PROPOSED | Conservada |
| D-MUSCLE-0518 | D-MUSCLE-0518 | 38 | individual | Músculo primario | PROPOSED | Conservada |
| D-MUSCLE-1512 | D-MUSCLE-1512 | 38 | individual | Músculo primario | PROPOSED | Conservada |
| D-MUSCLE-1714 | D-MUSCLE-1714 | 38 | individual | Músculo primario | PROPOSED | Conservada |
| D-MUSCLE-0003 | D-MUSCLE-0003 | 38 | individual | Músculo primario | PROPOSED | Conservada |
| D-MUSCLE-1368 | D-MUSCLE-1368 | 38 | individual | Músculo primario | PROPOSED | Conservada |
| D-LAT-0002 | D-LAT-0002 | 38 | individual | Lateralidad | PROPOSED | Conservada |
| D-LAT-1368 | D-LAT-1368 | 38 | individual | Lateralidad | PROPOSED | Conservada |
| D-LAT-CARDIO | D-LAT-CARDIO | 38 | individual | Lateralidad | PROPOSED | Conservada |

## Decisiones omitidas o duplicadas

No se detectaron decisiones válidas omitidas respecto del inventario normalizado.

No se detectaron duplicados válidos en la matriz de 27 filas.

Las referencias parciales `D-STAB-`, `D-JOINT-`, `D-ASSIST-DIM-`, `D-ASSIST-IND-`, `D-MUSCLE-` y `D-LAT-` no son decisiones completas y no deben contarse.

## Observaciones

- La matriz declaraba 28 decisiones, pero contiene 27 filas.
- La diferencia se explica por un error de conteo en el texto, no por una decisión omitida.
- Las agrupaciones originales se reemplazaron por decisiones atómicas, lo cual es correcto.
- No existe aprobación humana registrada.

## Incertidumbres

- La evidencia de algunas decisiones es de nivel E2.
- La clasificación de 1711 y 1712 no se incluye porque 1711 no existe en el catálogo y 1712 no forma parte del piloto de 49.

## Limitaciones

- No se modificó la matriz original.
- No se ejecutó regresión.

## Conclusión

El número real reconciliado es 27 decisiones atómicas, todas en estado `PROPOSED`.
