# Fase 3A.3.1.2 - Cierre de plantilla de estabilizadores

## Objetivo

Separar definitivamente la aprobación de reglas, la plantilla de aplicación, la instancia individual y la aprobación de clasificación para el rol `stabilizer`.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/23-stabilizer-evidence-rules.md`
- `DOCUMENTATION/taxonomy-audit/31-stabilizer-approval-criteria.md`
- `DOCUMENTATION/taxonomy-audit/35-stabilizer-approval-breakdown.md`
- `DOCUMENTATION/taxonomy-audit/46-stabilizer-application-schema.md`
- `DOCUMENTATION/taxonomy-audit/47-master-approval-matrix-corrected.md`

## Resultados

### L1 - Reglas generales

`D-STAB-L1-RULES` es una decisión conceptual global.

Su aprobación únicamente habilitaría futuras evaluaciones. No aprueba clasificaciones.

### L2 - Plantilla de aplicación

`D-STAB-L2-APPLICATION` se identifica como `application_template`.

Características:

- Tipo: `application_template`.
- Estado: `PROPOSED`.
- Ejercicio asociado: `null`.
- Clasificación ejecutada: ninguna.
- Resultado: no evaluado.

No representa una evaluación real ni una decisión individual ya ejecutada.

### Instancias futuras

El esquema futuro es:

- `application_id`
- `exercise_id`
- `muscle_id`
- `evidence`
- `evidence_level`
- `confidence`
- `proposed_role`
- `review_status`

Cada instancia debe tener trazabilidad propia.

No se generan instancias para los 49 ejercicios en esta fase.

### L3 - Aprobación individual

`D-STAB-L3-APPROVAL` se refiere a aprobar o rechazar una propuesta individual ya evaluada.

No equivale a aprobar todas las futuras instancias.

Diferencias obligatorias:

1. Aprobación de reglas.
2. Ejecución de evaluación.
3. Propuesta de clasificación.
4. Aceptación humana de la clasificación.

## Reglas

- Aprobar reglas no aprueba clasificaciones.
- Aplicar reglas no equivale a aceptar resultados.
- Sin evidencia suficiente, conservar `unknown`.
- No es obligatorio asignar estabilizadores a todos los ejercicios.
- Diferenciar sinergista y estabilizador según función biomecánica.

## Incertidumbres

- Muchas instrucciones no documentan estabilización.
- La distinción entre sinergista y estabilizador puede requerir revisión experta.

## Limitaciones

- No se clasificaron ejercicios.
- No se creó un contrato de datos.
- No se modificó la matriz.

## Conclusión

La plantilla L2 queda separada de la ejecución individual y de la aprobación L3.
