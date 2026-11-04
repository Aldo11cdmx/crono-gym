# Fase 3A.3 - Matriz maestra del vocabulario taxonómico

## Objetivo

Consolidar las dimensiones taxonómicas propuestas en las fases 3A, 3A.1 y 3A.2, sin modificar el catálogo ni la matriz piloto.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`
- `DOCUMENTATION/taxonomy-audit/18-vocabulary-corrections.md`
- `DOCUMENTATION/taxonomy-audit/21-joint-action-vocabulary-extension.md`
- `DOCUMENTATION/taxonomy-audit/22-assisted-equipment-taxonomy.md`
- `DOCUMENTATION/taxonomy-audit/23-stabilizer-evidence-rules.md`
- `DOCUMENTATION/taxonomy-audit/25-field-confidence-refinement.md`

## Método

Se consolidaron las dimensiones existentes y las propuestas nuevas. Cada concepto se marca como `PROPOSED`, porque no existe aprobación humana explícita.

## Resultados

### A. Anatomía y músculos

| Dimensión | Identificador propuesto | Etiqueta es-MX | Definición | Inclusión | Exclusión | Evidencia mínima | Ejemplos | Estado | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| Región corporal | `body_region` | Región corporal | Área anatómica general | chest, back, waist, upper legs | Músculos específicos | E1 body_part | chest, upper legs | PROPOSED | Ninguna |
| Grupo muscular | `muscle_group` | Grupo muscular | Agrupación anatómica o funcional | upper back, hip flexors | Músculo individual | E1 muscle_group | upper back, hip flexors | PROPOSED | body_region |
| Músculo anatómico | `muscle.*` | Músculo | Músculo esquelético específico | pectorals, lats, quadriceps | Sistemas fisiológicos | E1 target, E2 instrucciones | pectorals, lats | PROPOSED | muscle_group |
| Sistema fisiológico | `physiological_system` | Sistema fisiológico | Sistema no muscular usado como objetivo funcional | cardiovascular system | Músculos esqueléticos | E1 target | cardiovascular system | PROPOSED | Ninguna |
| Rol muscular | `muscle_role` | Rol muscular | Función del músculo en el ejercicio | primary, secondary, stabilizer | Participación no demostrada | E1, E2 o E3 documentada | primary, stabilizer | PROPOSED | muscle.* |

Regla: `target`, `muscle_group` y `secondary_muscles` son fuentes E1, pero no se fusionan automáticamente.

### B. Patrón de movimiento

| Dimensión | Identificador propuesto | Etiqueta es-MX | Definición | Inclusión | Exclusión | Evidencia mínima | Ejemplos | Estado | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| Patrón biomecánico | `pattern_family` | Patrón de movimiento | Movimiento global del ejercicio | push, pull, squat, hinge | Acciones articulares específicas | E1 o E2 | push, pull | PROPOSED | Ninguna |
| Clasificación funcional | `functional_classification` | Clasificación funcional | Intención de entrenamiento | strength, hypertrophy, power, endurance, mobility, stability, skill, recovery, mixed | Patrón biomecánico | E2 o E3 documentada | strength, mobility | PROPOSED | pattern_family |

Regla: `pattern_family` y `functional_classification` son dimensiones independientes.

### C. Acciones articulares

| Dimensión | Identificador propuesto | Etiqueta es-MX | Definición | Inclusión | Exclusión | Evidencia mínima | Ejemplos | Estado | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| Acción articular | `primary_joint_action` | Acción articular principal | Articulación y movimiento principal | push_horizontal, knee_flexion, hip_extension | Patrón global | E1 o E2 | knee_flexion | PROPOSED | pattern_family |
| Acciones secundarias | `secondary_joint_actions` | Acciones articulares secundarias | Otras acciones relevantes | knee_extension, hip_extension | Acción principal única | E2 o E3 | hip_extension | PROPOSED | primary_joint_action |

Acciones propuestas en Fase 3A.2:

- `action.ankle_dorsiflexion`
- `action.hip_flexion`
- `action.ankle_circumduction`
- `action.shoulder_flexion`
- `action.shoulder_extension`

Estado de estas propuestas: `PROPOSED`, pendientes de aprobación humana.

### D. Implementos y equipamiento

| Dimensión | Identificador propuesto | Etiqueta es-MX | Definición | Inclusión | Exclusión | Evidencia mínima | Ejemplos | Estado | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| Implemento principal | `implement_type` | Implemento principal | Objeto físico principal | dumbbell, barbell, kettlebell, cable | Soportes y accesorios | E1 o E2 | dumbbell | PROPOSED | Ninguna |
| Implemento auxiliar | `implement_auxiliary` | Implemento auxiliar | Objeto secundario que modifica la ejecución | band, counterweight | Implemento principal | E1 o E2 | band | PROPOSED | implement_type |
| Soporte | `support_surface` | Soporte | Superficie o soporte que estabiliza el cuerpo | bench, platform, floor | Implemento principal | E1 o E2 | bench | PROPOSED | implement_type |
| Sistema de resistencia | `resistance_system` | Sistema de resistencia | Mecanismo que genera la carga principal | free_weight, cable, machine, band, bodyweight | Asistencia | E1 o E2 | cable | PROPOSED | implement_type |
| Mecanismo de asistencia | `assistance_mechanism` | Mecanismo de asistencia | Mecanismo que reduce la carga o asiste | counterweight, band_assist, machine_assist | Resistencia principal | E1 o E2 | band_assist | PROPOSED | resistance_system |
| Tipo de asistencia | `assistance_type` | Tipo de asistencia | Tipo de asistencia cuando es demostrable | counterweight, band_assist, machine_assist, manual_assist, unknown | Resistencia | E1 o E2 | unknown | PROPOSED | assistance_mechanism |

Regla: la asistencia no es resistencia.

### E. Dimensiones de ejecución

| Dimensión | Identificador propuesto | Etiqueta es-MX | Definición | Inclusión | Exclusión | Evidencia mínima | Ejemplos | Estado | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| Plano | `movement_plane` | Plano de movimiento | Plano anatómico principal | sagittal, frontal, transverse, multi_plane | Plano inferido por nombre | E1 o E2 | sagittal | PROPOSED | primary_joint_action |
| Lateralidad | `laterality` | Lateralidad | Uso de uno o ambos lados | bilateral, unilateral, alternating, unknown | Lateralidad inferida por nombre | E2 | alternating | PROPOSED | Ninguna |
| Cadena cinética | `kinetic_chain` | Cadena cinética | Relación entre extremidad distal y carga | open, closed, mixed, unknown | Cadena inferida por patrón | E1 o E2 | closed | PROPOSED | primary_joint_action |
| Complejidad | `complexity` | Complejidad | Nivel de complejidad del movimiento | 1, 2, 3 | Complejidad inferida por nombre | E2 | 2 | PROPOSED | pattern_family |

### F. Evidencia y confianza

| Dimensión | Identificador propuesto | Etiqueta es-MX | Definición | Inclusión | Exclusión | Evidencia mínima | Ejemplos | Estado | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| Fuente | `source_fields` | Campos fuente | Campos usados para clasificar | name, body_part, target, equipment | Campos no consultados | E1 o E2 | target, equipment | PROPOSED | Ninguna |
| Nivel de evidencia | `evidence_level` | Nivel de evidencia | Calidad de la fuente | E1, E2, E3, E4 | E4 como fuente única para músculo, patrón o implemento | E1-E4 | E1 | PROPOSED | source_fields |
| Confianza por campo | `field_confidence` | Confianza por campo | Confianza de cada dimensión | high, medium, low | Confianza global generalizada | E1-E4 | medium | PROPOSED | evidence_level |
| Confianza global | `global_confidence` | Confianza global | Confianza general del ejercicio | high, medium, low | Certeza de todos los campos | E1-E4 | medium | PROPOSED | field_confidence |
| Estado de revisión | `review_status` | Estado de revisión | Estado de la propuesta | proposed, needs_human_review, reviewed, accepted | Aceptación automática | Revisión humana | needs_human_review | PROPOSED | Ninguna |
| Motivo de unknown | `unknown_reason` | Motivo de unknown | Razón de ausencia de valor | falta de información, no aplicable, evidencia contradictoria, no representado | unknown sin motivo | E1-E4 | evidencia contradictoria | PROPOSED | evidence_level |

## Incertidumbres

- Ninguna dimensión está aprobada por humano.
- Las propuestas nuevas de acciones articulares no se han aplicado a los 49 registros.
- La taxonomía de asistencia no se ha validado en todo el catálogo.
- Las reglas de estabilizadores no han sido aplicadas a los 49 registros.

## Limitaciones

- Documento consolidado, no contrato de producción.
- No modifica el catálogo.
- No autoriza clasificación ampliada.

## Conclusión

La matriz maestra consolida las dimensiones propuestas, pero todos los conceptos permanecen en estado `PROPOSED`.
