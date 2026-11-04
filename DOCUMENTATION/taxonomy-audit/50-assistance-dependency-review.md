# Fase 3A.3.1.2 - Revisión de dependencias de asistencia

## Objetivo

Revisar y justificar las dependencias entre dimensiones de asistencia y casos individuales.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/22-assisted-equipment-taxonomy.md`
- `DOCUMENTATION/taxonomy-audit/30-assisted-equipment-decision.md`
- `DOCUMENTATION/taxonomy-audit/37-assisted-equipment-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/44-dependency-normalization.md`

## Principio

Una relación conceptual no implica dependencia obligatoria.

## Revisión por dimensión

| ID de origen | ID de destino | Tipo | Justificación |
|---|---|---|---|
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-DIM-AUXILIARY | required | Un implemento auxiliar requiere distinguir el implemento principal |
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-DIM-SUPPORT | informational | El soporte puede identificarse por sí mismo, pero la distinción mejora con el implemento principal |
| D-ASSIST-DIM-RESISTANCE | D-ASSIST-DIM-MECHANISM | required | Un mecanismo de asistencia se define respecto a la resistencia principal |
| D-ASSIST-DIM-MECHANISM | D-ASSIST-DIM-TYPE | required | El tipo depende del mecanismo |
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-IND-1708 | required | Requiere la dimensión de implemento principal |
| D-ASSIST-DIM-RESISTANCE | D-ASSIST-IND-1708 | required | Requiere la dimensión de resistencia |
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-IND-1709 | required | Requiere la dimensión de implemento principal |
| D-ASSIST-DIM-RESISTANCE | D-ASSIST-IND-1709 | required | Requiere la dimensión de resistencia |
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-IND-1710 | required | Requiere la dimensión de implemento principal |
| D-ASSIST-DIM-RESISTANCE | D-ASSIST-IND-1710 | required | Requiere la dimensión de resistencia |
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-IND-1713 | required | Requiere la dimensión de implemento principal |
| D-ASSIST-DIM-RESISTANCE | D-ASSIST-IND-1713 | required | Requiere la dimensión de resistencia |
| D-ASSIST-DIM-IMPLEMENT | D-ASSIST-IND-1714 | required | Requiere la dimensión de implemento principal |
| D-ASSIST-DIM-RESISTANCE | D-ASSIST-IND-1714 | required | Requiere la dimensión de resistencia |

## Casos individuales

Los cinco casos individuales solo pueden evaluarse después de contar con dimensiones conceptuales suficientemente definidas.

Sin embargo, no se imponen dependencias artificiales entre todas las dimensiones.

Una clasificación individual puede conservar `unknown`.

## Consecuencia de rechazo del prerequisito

Si se rechaza un prerequisito `required`, la decisión dependiente no puede evaluarse con ese prerequisito.

Si se rechaza un prerequisito `informational`, la decisión dependiente puede evaluarse con una justificación documentada.

## Validación de ciclos

No se detectan ciclos.

## Incertidumbres

- Las dimensiones de asistencia pueden solaparse en casos reales.
- La evidencia de los casos individuales es insuficiente.

## Limitaciones

- No se clasificaron ejercicios.
- No se modificó la matriz.

## Conclusión

Las dependencias de asistencia son justificadas, explícitas y sin ciclos.
