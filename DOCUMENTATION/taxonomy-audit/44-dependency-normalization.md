# Fase 3A.3.1.1 - Normalización de dependencias

## Objetivo

Normalizar las dependencias de la matriz de aprobación y eliminar comodines.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/39-approval-dependency-map.md`
- `DOCUMENTATION/taxonomy-audit/40-master-approval-matrix.md`

## Método

Se reemplazaron las referencias comodín por IDs concretos. Cada relación se clasificó como `required`, `informational` o `independent`.

## Dependencias normalizadas

| Decisión dependiente | Prerequisito | Tipo | Justificación |
|---|---|---|---|
| D-STAB-L2-APPLICATION | D-STAB-L1-RULES | required | No puede aplicarse una regla no aprobada |
| D-STAB-L3-APPROVAL | D-STAB-L2-APPLICATION | required | No puede aprobarse una clasificación no evaluada |
| D-ASSIST-DIM-AUXILIARY | D-ASSIST-DIM-IMPLEMENT | required | Un implemento auxiliar requiere distinguir el implemento principal |
| D-ASSIST-DIM-SUPPORT | D-ASSIST-DIM-IMPLEMENT | informational | El soporte puede identificarse por sí mismo, pero la distinción mejora con el implemento principal |
| D-ASSIST-DIM-MECHANISM | D-ASSIST-DIM-RESISTANCE | required | Un mecanismo de asistencia se define respecto a la resistencia principal |
| D-ASSIST-DIM-TYPE | D-ASSIST-DIM-MECHANISM | required | El tipo depende del mecanismo |
| D-ASSIST-IND-1708 | D-ASSIST-DIM-IMPLEMENT | required | Requiere la dimensión de implemento principal |
| D-ASSIST-IND-1708 | D-ASSIST-DIM-RESISTANCE | required | Requiere la dimensión de resistencia |
| D-ASSIST-IND-1709 | D-ASSIST-DIM-IMPLEMENT | required | Requiere la dimensión de implemento principal |
| D-ASSIST-IND-1709 | D-ASSIST-DIM-RESISTANCE | required | Requiere la dimensión de resistencia |
| D-ASSIST-IND-1710 | D-ASSIST-DIM-IMPLEMENT | required | Requiere la dimensión de implemento principal |
| D-ASSIST-IND-1710 | D-ASSIST-DIM-RESISTANCE | required | Requiere la dimensión de resistencia |
| D-ASSIST-IND-1713 | D-ASSIST-DIM-IMPLEMENT | required | Requiere la dimensión de implemento principal |
| D-ASSIST-IND-1713 | D-ASSIST-DIM-RESISTANCE | required | Requiere la dimensión de resistencia |
| D-ASSIST-IND-1714 | D-ASSIST-DIM-IMPLEMENT | required | Requiere la dimensión de implemento principal |
| D-ASSIST-IND-1714 | D-ASSIST-DIM-RESISTANCE | required | Requiere la dimensión de resistencia |

## Decisiones independientes

- D-JOINT-ANKLE-DORSIFLEXION
- D-JOINT-HIP-FLEXION
- D-JOINT-SHOULDER-FLEXION
- D-JOINT-SHOULDER-EXTENSION
- D-CIRC-ANKLE
- D-MUSCLE-0518
- D-MUSCLE-1512
- D-MUSCLE-1714
- D-MUSCLE-0003
- D-MUSCLE-1368
- D-LAT-0002
- D-LAT-1368
- D-LAT-CARDIO

## Consecuencia de rechazo del prerequisito

Si se rechaza un prerequisito `required`, la decisión dependiente no puede evaluarse con ese prerequisito.

Si se rechaza un prerequisito `informational`, la decisión dependiente puede evaluarse con una justificación documentada.

## Validación de ciclos

No se detectan ciclos.

## Incertidumbres

- Las dependencias son documentales, no técnicas.
- La distinción entre `required` e `informational` puede requerir revisión humana.

## Limitaciones

- No se modificó la matriz original.
- No se crearon contratos.

## Conclusión

Las dependencias se normalizan sin comodines y sin ciclos.
