# Fase 3A.1 - Validación de los 11 registros high

## Objetivo

Validar campo por campo los once registros con confianza global `high`, distinguiendo confianza global de confianza por campo.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Método

Para cada registro se revisaron valor propuesto, evidencia, fuente exacta, nivel E1-E4, confianza individual y coherencia biomecánica. E4 no se usó como fuente única para músculo, patrón o implemento.

## Resultados

| ID | Nombre | Campos validados | Campos con unknown | Observación |
|---|---|---|---|---|
| 0454 | ez barbell spider curl | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers; accessory | Accesorio no determinable entre banco Scott y balón |
| 1628 | ez barbell spider curl | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers; accessory | Mismo caso que 0454 |
| 0577 | lever chest press | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0576 | lever chest press | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0520 | kettlebell alternating press | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida; contradicción de disponibilidad sigue abierta |
| 0001 | 3/4 sit-up | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0023 | barbell alternate biceps curl | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0025 | barbell bench press | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0007 | alternate lateral pulldown | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0148 | cable alternate shoulder press | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |
| 0149 | cable alternate triceps extension | pattern, joint, plane, resistance, implement, kinetic, laterality, muscle primary/secondary | stabilizers | Confianza alta válida para campos estructurados |

## Conclusiones

- La confianza global `high` es válida para los campos estructurados y textuales revisados.
- `muscle_stabilizers` permanece `unknown` en los once registros porque no existe evidencia específica.
- El accesorio permanece `unknown` en los registros de spider curl.
- La confianza global alta no implica certeza de todos los campos.

## Limitaciones

- No se verificó estabilización mediante biomecánica externa.
- No se modificó la matriz original.
