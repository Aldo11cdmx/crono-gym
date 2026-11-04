# Fase 3A.4.1 - Formalización de aprobaciones humanas, Bloque A: Estabilizadores

## Objetivo

Registrar formalmente las tres decisiones aprobadas explícitamente por el propietario del proyecto para el Bloque A — Estabilizadores.

## Autoridad de aprobación

- `approval_type`: human
- `approved_by`: project_owner
- `approval_date`: 2026-11-03
- `approval_scope`: aprobación conceptual con ajustes
- `implementation_status`: NOT_IMPLEMENTED

La aprobación fue expresada por el propietario del proyecto en esta conversación. No se atribuye a Kilo, a un agente ni a un modelo.

## Decisiones formalizadas

### D-STAB-L1-RULES

Estado: `APPROVED WITH ADJUSTMENTS`

Funciones estabilizadoras aprobadas:

1. Estabilización isométrica documentada.
2. Estabilización dinámica documentada.
3. Antirrotación documentada.
4. Estabilización postural documentada.
5. Co-contracción documentada.
6. Estabilización de articulaciones adyacentes documentada.

Condiciones obligatorias:

- Identificar el músculo y la función estabilizadora concreta.
- Identificar la articulación, segmento o postura estabilizada.
- Exigir evidencia aplicable al ejercicio específico.
- `secondary_muscles` no es evidencia suficiente por sí solo.
- Las reglas biomecánicas expertas deben estar documentadas.
- Ante ambigüedad entre sinergia y estabilización, conservar `unknown`.
- Un músculo puede tener diferentes roles según el ejercicio o la fase del movimiento.
- No convertir el rol muscular en una propiedad universal del músculo.

Co-contracción y estabilización no son equivalentes automáticamente. La proximidad anatómica tampoco demuestra estabilización de una articulación adyacente.

### D-STAB-L2-APPLICATION

Estado: `APPROVED WITH ADJUSTMENTS`

Se aprobó el modelo conceptual de aplicación individual.

Esquema base:

- `application_id`
- `exercise_id`
- `muscle_id`
- `evidence`
- `evidence_level`
- `confidence`
- `proposed_role`
- `review_status`

Campos adicionales aprobados:

- `stabilization_function`
- `stabilized_structure`
- `evidence_context`
- `review_notes`

Condiciones:

- Una aplicación corresponde a un ejercicio y un músculo concretos.
- La evidencia debe poder rastrearse.
- La confianza no sustituye la evidencia.
- Una propuesta no equivale a una clasificación aceptada.
- `unknown` debe conservarse cuando no exista evidencia suficiente.
- `accepted` requiere aprobación humana explícita.

Semántica de estados:

- `proposed`: propuesta sin revisión.
- `needs_human_review`: requiere revisión humana.
- `reviewed`: fue revisada, sin implicar aceptación.
- `accepted`: aceptada explícitamente por una persona.

No se generan instancias individuales. No se convierte este esquema en un contrato de datos de runtime.

### D-STAB-L3-APPROVAL

Estado: `APPROVED WITH ADJUSTMENTS`

Una clasificación individual solo puede aceptarse cuando cumpla todos estos requisitos:

1. Identidad inequívoca del ejercicio y del músculo.
2. Función estabilizadora específica.
3. Identificación de la estructura estabilizada.
4. Evidencia concreta, verificable y aplicable a la ejecución.
5. Diferenciación entre función sinérgica y estabilizadora.
6. Revisión humana documentada.

Condiciones adicionales:

- `confidence` no sustituye evidencia.
- E4 (nombre del ejercicio) nunca permite aceptar una clasificación.
- E2 puede requerir corroboración en movimientos complejos.
- Los desacuerdos biomecánicos mantienen la propuesta pendiente.
- La aceptación registra responsable, fecha y justificación.
- No se aceptan clasificaciones automáticamente.

## Exclusiones

Esta formalización no implica:

- Clasificación de los 49 ejercicios.
- Creación de instancias de estabilizadores.
- Modificación de `muscle_stabilizers`.
- Modificación de `exercisesCatalog.json`.
- Implementación en runtime.
- Creación de migraciones.
- Modificación de SmartSwap o exerciseSwap.
- Ejecución de regresión.
- Aprobación de otras decisiones.

## Limitaciones

- Las reglas aprobadas no se han aplicado a los ejercicios.
- No se crearon instancias individuales.
- No se implementó el esquema en runtime.
- La evidencia de estabilización sigue siendo insuficiente en muchos casos.

## Estado de implementación

`NOT_IMPLEMENTED`

## Conclusión

Las tres decisiones del Bloque A quedan formalmente aprobadas con ajustes. Las 24 decisiones restantes permanecen `PROPOSED`.
