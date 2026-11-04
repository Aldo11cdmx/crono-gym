# Fase 3A.3.1.1 - Matriz maestra de aprobación corregida

## Objetivo

Proporcionar una matriz corregida con 27 decisiones atómicas, IDs reconciliados, dependencias concretas y campos de evidencia separados conceptualmente.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/40-master-approval-matrix.md`
- `DOCUMENTATION/taxonomy-audit/42-decision-reconciliation.md`
- `DOCUMENTATION/taxonomy-audit/44-dependency-normalization.md`
- `DOCUMENTATION/taxonomy-audit/45-evidence-schema-correction.md`

## Matriz corregida

| decision_id | decision_type | scope | document_version | proposal | evidence | evidence_level | confidence | status | approval_question | possible_options | consequences | dependencies | approval_date | approved_by |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| D-STAB-L1-RULES | rule | stabilizer role | 3A.3.1.1 | Aprobar criterios biomecánicos | Instrucciones, reglas documentadas | E2, E3 | medium | PROPOSED | ¿Se aprueban las reglas? | approve, reject | Habilita evaluación individual | none | null | null |
| D-STAB-L2-APPLICATION | application | stabilizer role | 3A.3.1.1 | Aplicar reglas a un ejercicio | Instrucciones, campos estructurados | E1, E2, E3 | low-medium | PROPOSED | ¿Se evalúa el ejercicio? | approve, reject | No acepta automáticamente | D-STAB-L1-RULES | null | null |
| D-STAB-L3-APPROVAL | approval | stabilizer role | 3A.3.1.1 | Aceptar propuesta individual | Evidencia específica | E1, E2, E3 | variable | PROPOSED | ¿Se acepta la propuesta? | approve, reject | Afecta solo al ejercicio | D-STAB-L2-APPLICATION | null | null |
| D-JOINT-ANKLE-DORSIFLEXION | vocabulary | joint action | 3A.3.1.1 | Aprobar dorsiflexión de tobillo | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject, combine | Permite uso futuro | none | null | null |
| D-JOINT-HIP-FLEXION | vocabulary | joint action | 3A.3.1.1 | Aprobar flexión de cadera | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject, combine | Permite uso futuro | none | null | null |
| D-JOINT-SHOULDER-FLEXION | vocabulary | joint action | 3A.3.1.1 | Aprobar flexión de hombro | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject | Permite uso futuro | none | null | null |
| D-JOINT-SHOULDER-EXTENSION | vocabulary | joint action | 3A.3.1.1 | Aprobar extensión de hombro | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject | Permite uso futuro | none | null | null |
| D-CIRC-ANKLE | vocabulary | joint action | 3A.3.1.1 | Decidir circunducción | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿ID, combinación o descriptivo? | independent, combined, descriptive | Define representación | none | null | null |
| D-ASSIST-DIM-IMPLEMENT | vocabulary | assistance | 3A.3.1.1 | Aprobar implemento principal | equipment, instrucciones | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | none | null | null |
| D-ASSIST-DIM-AUXILIARY | vocabulary | assistance | 3A.3.1.1 | Aprobar implemento auxiliar | equipment, instrucciones | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-IMPLEMENT | null | null |
| D-ASSIST-DIM-SUPPORT | vocabulary | assistance | 3A.3.1.1 | Aprobar soporte | equipment, instrucciones | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-IMPLEMENT | null | null |
| D-ASSIST-DIM-RESISTANCE | vocabulary | assistance | 3A.3.1.1 | Aprobar sistema de resistencia | equipment, instrucciones | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | none | null | null |
| D-ASSIST-DIM-MECHANISM | vocabulary | assistance | 3A.3.1.1 | Aprobar mecanismo de asistencia | equipment, instrucciones | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-RESISTANCE | null | null |
| D-ASSIST-DIM-TYPE | vocabulary | assistance | 3A.3.1.1 | Aprobar tipo de asistencia | equipment, instrucciones | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-MECHANISM | null | null |
| D-ASSIST-IND-1708 | individual | assistance | 3A.3.1.1 | Evaluar implemento asistido | equipment, instrucciones | E1, E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1708 | D-ASSIST-DIM-IMPLEMENT, D-ASSIST-DIM-RESISTANCE | null | null |
| D-ASSIST-IND-1709 | individual | assistance | 3A.3.1.1 | Evaluar implemento asistido | equipment, instrucciones | E1, E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1709 | D-ASSIST-DIM-IMPLEMENT, D-ASSIST-DIM-RESISTANCE | null | null |
| D-ASSIST-IND-1710 | individual | assistance | 3A.3.1.1 | Evaluar implemento asistido | equipment, instrucciones | E1, E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1710 | D-ASSIST-DIM-IMPLEMENT, D-ASSIST-DIM-RESISTANCE | null | null |
| D-ASSIST-IND-1713 | individual | assistance | 3A.3.1.1 | Evaluar implemento asistido | equipment, instrucciones | E1, E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1713 | D-ASSIST-DIM-IMPLEMENT, D-ASSIST-DIM-RESISTANCE | null | null |
| D-ASSIST-IND-1714 | individual | assistance | 3A.3.1.1 | Evaluar implemento asistido | equipment, instrucciones | E1, E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1714 | D-ASSIST-DIM-IMPLEMENT, D-ASSIST-DIM-RESISTANCE | null | null |
| D-MUSCLE-0518 | individual | muscle | 3A.3.1.1 | Resolver músculo primario | target, muscle_group, instructions | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | forearms, shoulders, unknown | Afecta solo a 0518 | none | null | null |
| D-MUSCLE-1512 | individual | muscle | 3A.3.1.1 | Resolver músculo primario | target, muscle_group, instructions | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | quadriceps, hamstrings, unknown | Afecta solo a 1512 | none | null | null |
| D-MUSCLE-1714 | individual | muscle | 3A.3.1.1 | Resolver músculo primario | target, muscle_group, instructions | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | abs, quadriceps, unknown | Afecta solo a 1714 | none | null | null |
| D-MUSCLE-0003 | individual | muscle | 3A.3.1.1 | Resolver músculo primario | target, muscle_group, instructions | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | abs, hip flexors, unknown | Afecta solo a 0003 | none | null | null |
| D-MUSCLE-1368 | individual | muscle | 3A.3.1.1 | Resolver músculo primario | target, muscle_group, instructions | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | calves, ankle stabilizers, unknown | Afecta solo a 1368 | none | null | null |
| D-LAT-0002 | individual | laterality | 3A.3.1.1 | Definir lateralidad | instructions | E2 | low | PROPOSED | ¿Cuál es la lateralidad? | unilateral, alternating, unknown | Afecta solo a 0002 | none | null | null |
| D-LAT-1368 | individual | laterality | 3A.3.1.1 | Definir lateralidad | instructions | E2 | low | PROPOSED | ¿Cuál es la lateralidad? | unilateral, alternating, unknown | Afecta solo a 1368 | none | null | null |
| D-LAT-CARDIO | individual | laterality | 3A.3.1.1 | Definir lateralidad de cardio | instructions | E2 | low | PROPOSED | ¿Puede determinarse? | bilateral, unilateral, alternating, unknown | Afecta solo a casos documentados | none | null | null |

## Incertidumbres

- La evidencia de algunas decisiones es de nivel E2.
- Las dependencias son documentales, no técnicas.

## Limitaciones

- No se modificó la matriz original.
- No se creó un contrato de datos.

## Conclusión

La matriz corregida contiene 27 decisiones atómicas, con dependencias concretas y campos de aprobación semánticamente válidos.
