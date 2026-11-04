# Fase 3A.6 - Mapeo piloto real de ejercicios y maquinaria
## Lote 1: nueve identidades físicas confirmadas

## Objetivo

Construir la primera matriz documental de relaciones ejercicio-equipo para los nueve IDs físicos confirmados previamente, sin modificar el catálogo ni el runtime.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `src/data/equipmentMap.ts`
- `public/images/gym-equipment/`
- `DOCUMENTATION/taxonomy-audit/03-semantic-duplicates.md`
- `DOCUMENTATION/taxonomy-audit/04-kettlebell-review.md`
- Auditoría previa de identidad física de equipos.

## Método

1. Se verificó que los nueve IDs existen en `equipmentMap.ts` y tienen vistas fotográficas.
2. Se consultaron los ejercicios cuyo campo `equipment_id` coincide exactamente con cada ID.
3. Cada relación se clasificó como `provisional`, porque `equipment_id` es un dato de partida y no demuestra por sí solo la identidad física del equipo.
4. No se asociaron ejercicios por similitud de nombres, etiquetas, proximidad anatómica ni apariencia visual genérica.
5. No se fusionaron IDs ni se modificó el catálogo.

## Verificación de identidades físicas confirmadas

| equipment_id | Nombre en equipmentMap | Vistas | Estado de identidad |
|---|---|---:|---|
| CG-EQP-0013 | Maquina Curl Biceps Predicador | 3 | Confirmado por auditoría previa |
| CG-EQP-0019 | Maquina Smith | 2 | Confirmado por auditoría previa |
| CG-EQP-0025 | Maquina Smith | 2 | Confirmado por auditoría previa |
| CG-EQP-0026 | Maquina Curl Biceps Predicador | 1 | Confirmado por auditoría previa |
| CG-EQP-0034 | Maquina Smith | 2 | Confirmado por auditoría previa |
| CG-EQP-0065 | Maquina Eliptica | 1 | Confirmado por auditoría previa |
| CG-EQP-0066 | Maquina Eliptica | 1 | Confirmado por auditoría previa |
| CG-EQP-0067 | Caminadora Electrica | 1 | Confirmado por auditoría previa |
| CG-EQP-0071 | Caminadora Electrica | 1 | Confirmado por auditoría previa |

Nota: la confirmación física proviene de la auditoría previa de identidad. Esta fase no reevalúa ni reasigna identidades físicas.

## Matriz de relaciones ejercicio-equipo

Total de relaciones documentadas: 32.

| exercise_id | exercise_name | equipment_id | physical_equipment_identity | functional_equipment_type | relationship_type | evidence | evidence_level | confidence | review_status | review_notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 0059 | barbell lying preacher curl | CG-EQP-0013 | confirmado | barbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `barbell` |
| 0070 | barbell preacher curl | CG-EQP-0013 | confirmado | barbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `barbell` |
| 0081 | barbell reverse preacher curl | CG-EQP-0013 | confirmado | barbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `barbell` |
| 1633 | cable one arm preacher curl | CG-EQP-0013 | confirmado | cable / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `cable` |
| 1635 | cable one arm reverse preacher curl | CG-EQP-0013 | confirmado | cable / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `cable` |
| 0195 | cable preacher curl | CG-EQP-0013 | confirmado | cable / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `cable` |
| 0209 | cable reverse preacher curl | CG-EQP-0013 | confirmado | cable / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `cable` |
| 1639 | cable rope hammer preacher curl | CG-EQP-0013 | confirmado | cable / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `cable` |
| 1640 | cable rope one arm hammer preacher curl | CG-EQP-0013 | confirmado | cable / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `cable` |
| 1646 | dumbbell alternate hammer preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 1647 | dumbbell alternate preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 1663 | dumbbell one arm hammer preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 1414 | dumbbell one arm reverse preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 1672 | dumbbell one arm zottman preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 0372 | dumbbell preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 1673 | dumbbell preacher curl over exercise ball | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 0384 | dumbbell reverse preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 0402 | dumbbell seated preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 0428 | dumbbell standing preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 2293 | dumbbell standing zottman preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 2294 | dumbbell zottman preacher curl | CG-EQP-0013 | confirmado | dumbbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `dumbbell` |
| 1627 | ez barbell close grip preacher curl | CG-EQP-0013 | confirmado | ez barbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `ez barbell` |
| 0452 | ez barbell reverse grip preacher curl | CG-EQP-0013 | confirmado | ez barbell / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `ez barbell` |
| 1615 | lever hammer grip preacher curl | CG-EQP-0013 | confirmado | leverage machine / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `leverage machine` |
| 0592 | lever preacher curl | CG-EQP-0013 | confirmado | leverage machine / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `leverage machine` |
| 1614 | lever preacher curl v. 2 | CG-EQP-0013 | confirmado | leverage machine / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `leverage machine` |
| 1616 | lever reverse grip preacher curl | CG-EQP-0013 | confirmado | leverage machine / preacher curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `leverage machine` |
| 1683 | smith machine bicep curl | CG-EQP-0025 | confirmado | smith machine / curl | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=biceps`, `muscle_group=forearms`; raw equipment `smith machine` |
| 1625 | smith machine decline close grip bench press | CG-EQP-0025 | confirmado | smith machine / bench press | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=triceps`, `muscle_group=chest`; raw equipment `smith machine` |
| 1752 | smith machine incline tricep extension | CG-EQP-0025 | confirmado | smith machine / tricep extension | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=triceps`, `muscle_group=shoulders`; raw equipment `smith machine` |
| 1626 | smith machine reverse decline close grip bench press | CG-EQP-0025 | confirmado | smith machine / bench press | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=pectorals`, `muscle_group=triceps`; raw equipment `smith machine` |
| 0770 | smith squat | CG-EQP-0025 | confirmado | smith machine / squat | provisional | `exercisesCatalog.json[equipment_id]`; `equipmentMap.ts` name/views | E1 | low | needs_human_review | `target=glutes`, `muscle_group=quadriceps`; raw equipment `smith machine` |

## Resultados del lote

- IDs físicos confirmados auditados: 9.
- IDs con ejercicios asociados: 2.
- IDs sin ejercicios asociados: 7 (`CG-EQP-0019`, `CG-EQP-0026`, `CG-EQP-0034`, `CG-EQP-0065`, `CG-EQP-0066`, `CG-EQP-0067`, `CG-EQP-0071`).
- Relaciones documentadas: 32.
- Relaciones confirmadas: 0.
- Relaciones provisionales: 32.
- Relaciones pendientes: 0.
- Relaciones desconocidas: 0.
- Ejercicios con conflicto `target` / `muscle_group`: 32.
- Ejercicios con disponibilidad `true`: 32.

## Ejercicios que apuntan a equipos confirmados pero presentan contradicciones

Todos los 32 ejercicios del lote presentan conflicto entre `target` y `muscle_group`.

Ejemplos:
- 0059: `target=biceps`, `muscle_group=forearms`.
- 1625: `target=triceps`, `muscle_group=chest`.
- 1752: `target=triceps`, `muscle_group=shoulders`.
- 1626: `target=pectorals`, `muscle_group=triceps`.
- 0770: `target=glutes`, `muscle_group=quadriceps`.

Estos conflictos requieren revisión humana antes de cualquier clasificación definitiva.

## Ejercicios que no pueden asociarse con seguridad

No aplica a este lote: todos los ejercicios referenciados por los nueve IDs fueron documentados.

Sin embargo, la asociación no se considera confirmada porque `equipment_id` es un dato de partida y no demuestra por sí solo la identidad física del equipo.

## Métricas de cobertura del lote

| Métrica | Valor |
|---|---:|
| IDs confirmados auditados | 9 |
| IDs con ejercicios asociados | 2 |
| IDs sin ejercicios asociados | 7 |
| Relaciones documentadas | 32 |
| Relaciones confirmadas | 0 |
| Relaciones provisionales | 32 |
| Relaciones pendientes | 0 |
| Relaciones desconocidas | 0 |
| Ejercicios con conflicto muscular | 32 |
| Ejercicios con disponibilidad true | 32 |

## Registro de decisiones que requieren revisión humana

1. Confirmar si `CG-EQP-0013` corresponde físicamente a todos los ejercicios de preacher curl que lo referencian.
2. Confirmar si `CG-EQP-0025` corresponde físicamente a todos los ejercicios de Smith machine que lo referencian.
3. Resolver los conflictos `target` / `muscle_group` en los 32 ejercicios.
4. Determinar si `CG-EQP-0019`, `CG-EQP-0026`, `CG-EQP-0034`, `CG-EQP-0065`, `CG-EQP-0066`, `CG-EQP-0067` y `CG-EQP-0071` deben permanecer sin ejercicios asociados o si existe evidencia no registrada.
5. Confirmar si los nombres normalizados en `equipmentMap.ts` corresponden a identidades físicas únicas.

## Propuesta del siguiente lote

Basado en los resultados reales:

Lote 2 debería incluir IDs con mayor número de ejercicios asociados y evidencia textual clara, por ejemplo:

- `CG-EQP-0013`: 27 ejercicios.
- `CG-EQP-0025`: 5 ejercicios.

Antes de ampliar el lote, resolver o documentar los conflictos musculares y la ambigüedad de asociación física.

No ampliar automáticamente a los 64 IDs restantes.

## Verificación de seguridad

- No se modificó `src/`.
- No se modificó `exercisesCatalog.json`.
- No se modificaron SmartSwap ni exerciseSwap.
- No se crearon migraciones ni contratos.
- No se ejecutó regresión.
- No se crearon instancias definitivas.

## Dictamen final

`READY WITH BLOCKERS`

Motivos:
- Las 32 relaciones están documentadas con evidencia E1.
- Ninguna relación se elevó a confirmada sin evidencia física suficiente.
- Los 32 ejercicios presentan conflicto muscular que requiere revisión humana.
- 7 de los 9 IDs no tienen ejercicios asociados en el catálogo.

Detenerse para revisión humana. No iniciar el siguiente lote automáticamente.
