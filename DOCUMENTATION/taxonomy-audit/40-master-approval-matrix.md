# Fase 3A.3.1 - Matriz maestra de aprobación

## Objetivo

Normalizar todas las decisiones de aprobación humana en una matriz única.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/35-stabilizer-approval-breakdown.md`
- `DOCUMENTATION/taxonomy-audit/36-joint-action-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/37-assisted-equipment-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/38-human-decision-atomic-register.md`
- `DOCUMENTATION/taxonomy-audit/39-approval-dependency-map.md`

## Matriz normalizada

| decision_id | decision_type | scope | document_version | proposal | evidence | evidence_level | confidence | status | approval_question | possible_options | consequences | dependencies | approval_date | approved_by |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| D-STAB-L1-RULES | rule | stabilizer role | 3A.3.1 | Aprobar criterios biomecánicos | Instrucciones, reglas expertas | E2, E3 | medium | PROPOSED | ¿Se aprueban las reglas? | approve, reject | Habilita evaluación individual | none | pending | human |
| D-STAB-L2-APPLICATION | application | stabilizer role | 3A.3.1 | Aplicar reglas a un ejercicio | Evidencia específica | E1, E2, E3 | low-medium | PROPOSED | ¿Se evalúa el ejercicio? | approve, reject | No acepta automáticamente | D-STAB-L1-RULES | pending | human |
| D-STAB-L3-APPROVAL | approval | stabilizer role | 3A.3.1 | Aceptar propuesta individual | Evidencia específica | E1, E2, E3 | variable | PROPOSED | ¿Se acepta la propuesta? | approve, reject | Afecta solo al ejercicio | D-STAB-L2-APPLICATION | pending | human |
| D-JOINT-ANKLE-DORSIFLEXION | vocabulary | joint action | 3A.3.1 | Aprobar dorsiflexión de tobillo | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject, combine | Permite uso futuro | none | pending | human |
| D-JOINT-HIP-FLEXION | vocabulary | joint action | 3A.3.1 | Aprobar flexión de cadera | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject, combine | Permite uso futuro | none | pending | human |
| D-JOINT-SHOULDER-FLEXION | vocabulary | joint action | 3A.3.1 | Aprobar flexión de hombro | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject | Permite uso futuro | none | pending | human |
| D-JOINT-SHOULDER-EXTENSION | vocabulary | joint action | 3A.3.1 | Aprobar extensión de hombro | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿Se aprueba el concepto? | approve, reject | Permite uso futuro | none | pending | human |
| D-CIRC-ANKLE | vocabulary | joint action | 3A.3.1 | Decidir circunducción | Instrucciones, anatomía | E2 | medium | PROPOSED | ¿ID, combinación o descriptivo? | independent, combined, descriptive | Define representación | none | pending | human |
| D-ASSIST-DIM-IMPLEMENT | vocabulary | assistance | 3A.3.1 | Aprobar implemento principal | E1, E2 | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | none | pending | human |
| D-ASSIST-DIM-AUXILIARY | vocabulary | assistance | 3A.3.1 | Aprobar implemento auxiliar | E1, E2 | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-IMPLEMENT | pending | human |
| D-ASSIST-DIM-SUPPORT | vocabulary | assistance | 3A.3.1 | Aprobar soporte | E1, E2 | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-IMPLEMENT | pending | human |
| D-ASSIST-DIM-RESISTANCE | vocabulary | assistance | 3A.3.1 | Aprobar sistema de resistencia | E1, E2 | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | none | pending | human |
| D-ASSIST-DIM-MECHANISM | vocabulary | assistance | 3A.3.1 | Aprobar mecanismo de asistencia | E1, E2 | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-RESISTANCE | pending | human |
| D-ASSIST-DIM-TYPE | vocabulary | assistance | 3A.3.1 | Aprobar tipo de asistencia | E1, E2 | E1, E2 | medium | PROPOSED | ¿Se aprueba la dimensión? | approve, reject | Habilita evaluación | D-ASSIST-DIM-MECHANISM | pending | human |
| D-ASSIST-IND-1708 | individual | assistance | 3A.3.1 | Evaluar implemento asistido | E2 | E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1708 | D-ASSIST-DIM-* | pending | human |
| D-ASSIST-IND-1709 | individual | assistance | 3A.3.1 | Evaluar implemento asistido | E2 | E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1709 | D-ASSIST-DIM-* | pending | human |
| D-ASSIST-IND-1710 | individual | assistance | 3A.3.1 | Evaluar implemento asistido | E2 | E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1710 | D-ASSIST-DIM-* | pending | human |
| D-ASSIST-IND-1713 | individual | assistance | 3A.3.1 | Evaluar implemento asistido | E2 | E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1713 | D-ASSIST-DIM-* | pending | human |
| D-ASSIST-IND-1714 | individual | assistance | 3A.3.1 | Evaluar implemento asistido | E2 | E2 | low | PROPOSED | ¿Se clasifica el implemento? | assign, unknown | Afecta solo a 1714 | D-ASSIST-DIM-* | pending | human |
| D-MUSCLE-0518 | individual | muscle | 3A.3.1 | Resolver músculo primario | E1, E2 | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | forearms, shoulders, unknown | Afecta solo a 0518 | none | pending | human |
| D-MUSCLE-1512 | individual | muscle | 3A.3.1 | Resolver músculo primario | E1, E2 | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | quadriceps, hamstrings, unknown | Afecta solo a 1512 | none | pending | human |
| D-MUSCLE-1714 | individual | muscle | 3A.3.1 | Resolver músculo primario | E1, E2 | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | abs, quadriceps, unknown | Afecta solo a 1714 | none | pending | human |
| D-MUSCLE-0003 | individual | muscle | 3A.3.1 | Resolver músculo primario | E1, E2 | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | abs, hip flexors, unknown | Afecta solo a 0003 | none | pending | human |
| D-MUSCLE-1368 | individual | muscle | 3A.3.1 | Resolver músculo primario | E1, E2 | E1, E2 | low | PROPOSED | ¿Qué músculo es primario? | calves, ankle stabilizers, unknown | Afecta solo a 1368 | none | pending | human |
| D-LAT-0002 | individual | laterality | 3A.3.1 | Definir lateralidad | E1, E2 | E1, E2 | low | PROPOSED | ¿Cuál es la lateralidad? | unilateral, alternating, unknown | Afecta solo a 0002 | none | pending | human |
| D-LAT-1368 | individual | laterality | 3A.3.1 | Definir lateralidad | E1, E2 | E1, E2 | low | PROPOSED | ¿Cuál es la lateralidad? | unilateral, alternating, unknown | Afecta solo a 1368 | none | pending | human |
| D-LAT-CARDIO | individual | laterality | 3A.3.1 | Definir lateralidad de cardio | E2 | E2 | low | PROPOSED | ¿Puede determinarse? | bilateral, unilateral, alternating, unknown | Afecta solo a casos documentados | none | pending | human |

## Incertidumbres

- Ninguna decisión tiene fecha de aprobación.
- Ninguna propuesta está marcada como `APPROVED`.
- La aprobación de una dimensión no implica aprobación de las demás.

## Limitaciones

- No se inventaron fechas ni responsables.
- No se modificó la matriz.

## Conclusión

La matriz normalizada contiene 28 decisiones atómicas, todas en estado `PROPOSED`.
