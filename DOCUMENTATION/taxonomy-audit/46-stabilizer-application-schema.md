# Fase 3A.3.1.1 - Modelo de aplicación de estabilizadores

## Objetivo

Definir un modelo futuro de aplicación individual de reglas de estabilizadores, sin clasificar ejercicios.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/23-stabilizer-evidence-rules.md`
- `DOCUMENTATION/taxonomy-audit/31-stabilizer-approval-criteria.md`
- `DOCUMENTATION/taxonomy-audit/35-stabilizer-approval-breakdown.md`

## Esquema conceptual futuro

| Campo | Descripción |
|---|---|
| `application_id` | Identificador único de la aplicación |
| `exercise_id` | ID original del ejercicio |
| `muscle_id` | Identificador del músculo propuesto |
| `evidence` | Fuente concreta |
| `evidence_level` | E1, E2, E3 o E4 |
| `confidence` | high, medium o low |
| `proposed_role` | stabilizer |
| `review_status` | proposed, needs_human_review, reviewed, accepted |

## Niveles

### Nivel 1 - Reglas generales

Aprobar o rechazar los criterios biomecánicos.

### Nivel 2 - Aplicación individual

Evaluar un ejercicio con evidencia específica.

### Nivel 3 - Aprobación de clasificación

Aceptar o rechazar una propuesta individual.

## Reglas

1. Aprobar reglas no aprueba clasificaciones.
2. Aplicar reglas no equivale a aceptar resultados.
3. Sin evidencia suficiente, conservar `unknown`.
4. No es obligatorio asignar estabilizadores a todos los ejercicios.
5. Diferenciar sinergista y estabilizador según función biomecánica.

## Incertidumbres

- Muchas instrucciones no documentan estabilización.
- La distinción entre sinergista y estabilizador puede requerir revisión experta.

## Limitaciones

- No se clasificaron ejercicios.
- No se creó un contrato de datos.
- No se modificó la matriz.

## Conclusión

El modelo permite aplicar reglas individualmente sin propagar aprobaciones automáticamente.
