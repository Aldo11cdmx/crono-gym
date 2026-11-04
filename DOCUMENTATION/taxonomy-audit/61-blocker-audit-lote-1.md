# Fase 3A.7 - Auditoría de bloqueadores del Lote 1

## Objetivo

Investigar por qué las 32 relaciones del Lote 1 quedaron provisionales y determinar si los bloqueadores son de datos, evidencia o metodología.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/60-pilot-mapping-lote-1-confirmed-identities.md`
- `src/data/exercisesCatalog.json`
- `src/data/equipmentMap.ts`
- `public/images/gym-equipment/`

## Método

Se recuperaron los 32 registros originales del catálogo mediante `exercise_id`. Se compararon `target`, `muscle_group`, `secondary_muscles`, `body_part`, `equipment`, `equipment_id`, `equipment_name` y `availableInCronosGym`. Se verificó la existencia de los IDs en `equipmentMap.ts` y el número de vistas fotográficas. No se modificó el catálogo ni se elevó ninguna relación a confirmada.

## 1. Auditoría de las 32 relaciones

| exercise_id | equipment_id | raw equipment | body_part | target | muscle_group | secondary_muscles | availability | equipmentMap name | views | relationship_type | Motivo de provisionalidad |
|---|---|---|---|---|---|---|---|---|---:|---|---|
| 0059 | CG-EQP-0013 | barbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es barra, no máquina |
| 0070 | CG-EQP-0013 | barbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es barra, no máquina |
| 0081 | CG-EQP-0013 | barbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es barra, no máquina |
| 1633 | CG-EQP-0013 | cable | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es cable, no máquina |
| 1635 | CG-EQP-0013 | cable | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es cable, no máquina |
| 0195 | CG-EQP-0013 | cable | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es cable, no máquina |
| 0209 | CG-EQP-0013 | cable | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es cable, no máquina |
| 1639 | CG-EQP-0013 | cable | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es cable, no máquina |
| 1640 | CG-EQP-0013 | cable | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es cable, no máquina |
| 1646 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 1647 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 1663 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 1414 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 1672 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 0372 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 1673 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 0384 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 0402 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 0428 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 2293 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 2294 | CG-EQP-0013 | dumbbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es mancuerna, no máquina |
| 1627 | CG-EQP-0013 | ez barbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es barra EZ, no máquina |
| 0452 | CG-EQP-0013 | ez barbell | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` es dato de partida; el equipo funcional declarado es barra EZ, no máquina |
| 1615 | CG-EQP-0013 | leverage machine | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` coincide con el nombre, pero la identidad física sigue confirmada solo por auditoría previa |
| 0592 | CG-EQP-0013 | leverage machine | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` coincide con el nombre, pero la identidad física sigue confirmada solo por auditoría previa |
| 1614 | CG-EQP-0013 | leverage machine | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` coincide con el nombre, pero la identidad física sigue confirmada solo por auditoría previa |
| 1616 | CG-EQP-0013 | leverage machine | upper arms | biceps | forearms | forearms | true | Maquina Curl Biceps Predicador | 3 | provisional | `equipment_id` coincide con el nombre, pero la identidad física sigue confirmada solo por auditoría previa |
| 1683 | CG-EQP-0025 | smith machine | upper arms | biceps | forearms | forearms | true | Maquina Smith | 2 | provisional | `equipment_id` coincide con el nombre, pero no se verificó la identidad física en esta auditoría |
| 1625 | CG-EQP-0025 | smith machine | upper arms | triceps | chest | chest, shoulders | true | Maquina Smith | 2 | provisional | `equipment_id` coincide con el nombre, pero no se verificó la identidad física en esta auditoría |
| 1752 | CG-EQP-0025 | smith machine | upper arms | triceps | shoulders | shoulders | true | Maquina Smith | 2 | provisional | `equipment_id` coincide con el nombre, pero no se verificó la identidad física en esta auditoría |
| 1626 | CG-EQP-0025 | smith machine | chest | pectorals | triceps | triceps, shoulders | true | Maquina Smith | 2 | provisional | `equipment_id` coincide con el nombre, pero no se verificó la identidad física en esta auditoría |
| 0770 | CG-EQP-0025 | smith machine | upper legs | glutes | quadriceps | quadriceps, hamstrings, calves | true | Maquina Smith | 2 | provisional | `equipment_id` coincide con el nombre, pero no se verificó la identidad física en esta auditoría |

## 2. Diagnóstico de los 32 conflictos musculares

### Métricas

- Relaciones auditadas: 32.
- Conflictos `target` vs `muscle_group`: 32/32.
- `secondary_muscles` contiene `muscle_group`: 32/32.
- `body_part` no coincide con `target` en 1 caso (`1626`: `body_part=chest`, `target=pectorals`).
- `body_part` no coincide con `muscle_group` en 1 caso (`0770`: `body_part=upper legs`, `muscle_group=quadriceps`).

### Clasificación

| Tipo de conflicto | Cantidad | IDs |
|---|---:|---|
| Diferencia de granularidad o semántica entre campos | 28 | 0059, 0070, 0081, 1633, 1635, 0195, 0209, 1639, 1640, 1646, 1647, 1663, 1414, 1672, 0372, 1673, 0384, 0402, 0428, 2293, 2294, 1627, 0452, 1615, 0592, 1614, 1616, 1683 |
| Contradicción real entre músculo principal aparente y grupo muscular declarado | 4 | 1625, 1752, 1626, 0770 |

### Interpretación

En los 28 casos de preacher curl y smith bicep curl, `target` nombra el músculo principal aparente (`biceps`), mientras que `muscle_group` nombra una región sinérgica (`forearms`). `secondary_muscles` coincide con `muscle_group`, lo que sugiere una diferencia de granularidad o semántica entre campos, no necesariamente una contradicción anatómica.

En los 4 casos restantes:

- `1625`: `target=triceps`, `muscle_group=chest`, con secundarios `chest, shoulders`. La instrucción describe un bench press de agarre cerrado, por lo que el grupo muscular principal parece ser pecho, no tríceps.
- `1752`: `target=triceps`, `muscle_group=shoulders`, con secundarios `shoulders`. La instrucción describe una extensión de tríceps, por lo que el grupo muscular principal parece ser tríceps, no hombros.
- `1626`: `target=pectorals`, `muscle_group=triceps`, con secundarios `triceps, shoulders`. La instrucción describe un bench press, por lo que el grupo muscular principal parece ser pecho, no tríceps.
- `0770`: `target=glutes`, `muscle_group=quadriceps`, con secundarios `quadriceps, hamstrings, calves`. La instrucción describe una sentadilla en Smith, por lo que el grupo muscular principal parece ser cuádriceps, no glúteos.

Estos cuatro casos requieren revisión biomecánica humana.

## 3. Explicación de disponibilidad

`availableInCronosGym = true` en los 32 registros significa que el catálogo declara el ejercicio como disponible en Cronos Gym.

No significa:

- que el equipo físico esté instalado;
- que el equipo pueda utilizarse actualmente;
- que el equipo esté en buen estado;
- que todas las vistas fotográficas correspondan al mismo equipo;
- que la disponibilidad física haya sido verificada.

El campo es un dato declarativo del catálogo. Además, globalmente existen 15 IDs físicos con disponibilidad mixta (`true` y `false`) para el mismo `equipment_id`, por lo que no puede interpretarse como inventario físico verificado.

Para estos 32 registros, `availableInCronosGym=true` indica disponibilidad declarada, no confirmación física.

## 4. Diagnóstico de los siete equipos sin ejercicios

Los siguientes IDs confirmados no tienen ejercicios asociados en el catálogo:

- `CG-EQP-0019`
- `CG-EQP-0026`
- `CG-EQP-0034`
- `CG-EQP-0065`
- `CG-EQP-0066`
- `CG-EQP-0067`
- `CG-EQP-0071`

Posibles causas:

1. Ausencia real de referencias: ningún registro tiene `equipment_id` igual a esos IDs.
2. Diferencias de representación: los ejercicios pueden usar etiquetas crudas (`smith machine`, `leverage machine`, etc.) sin haberse asignado a esos IDs.
3. Posibles asociaciones no documentadas: el catálogo no registra una relación explícita.
4. Información insuficiente: no hay evidencia suficiente para asociar esos IDs con ejercicios.

No se crearon asociaciones por similitud de nombres.

## 5. Evaluación del procedimiento

El criterio utilizado en Fase 3A.6 es correcto para evitar falsos positivos, pero incompleto para escalar.

Es correcto porque:

- No eleva una relación a confirmada solo por `equipment_id`.
- Exige evidencia concreta.
- Conserva `provisional` cuando la evidencia no conecta el ejercicio con la identidad física.

Es incompleto porque:

- No utiliza la compatibilidad funcional entre el equipo y el ejercicio.
- No utiliza las instrucciones como evidencia E2.
- No utiliza el estado de confirmación del equipo.
- No define un umbral reproducible para `confirmed`.

Propuesta de ajuste metodológico, sin implementar:

1. `confirmed`: `equipment_id` coincide con un equipo confirmado, el tipo funcional del ejercicio es compatible con el equipo y las instrucciones lo respaldan.
2. `provisional`: `equipment_id` coincide, pero falta compatibilidad funcional o evidencia textual.
3. `pending`: el equipo no está confirmado físicamente.
4. `unknown`: no existe `equipment_id` o no hay evidencia suficiente.

Este ajuste no debe aplicarse sin autorización humana.

## 6. Causas de los cero vínculos confirmados

Los cero vínculos confirmados no indican ausencia de datos, sino aplicación de un criterio conservador.

Causas principales:

1. `equipment_id` es un dato de partida, no una prueba de identidad física.
2. La identidad física de los equipos proviene de una auditoría previa, no del catálogo.
3. Los ejercicios referencian IDs de equipos cuya función no siempre coincide con su etiqueta cruda.
4. Los conflictos musculares reducen la confianza en la asociación.
5. No se utilizó evidencia E2 para conectar ejercicio e identidad física.
6. No existe una regla documentada para combinar E1 y E2 en relaciones confirmadas.

## 7. Recomendación sobre escalabilidad

El procedimiento puede escalar si se define una regla reproducible y se mantiene la revisión humana.

No es escalable manualmente a 1,324 ejercicios si cada relación requiere inspección individual sin reglas claras.

Recomendación:

1. Definir criterios de confirmación por evidencia.
2. Aplicar primero a equipos confirmados con mayor número de ejercicios.
3. Registrar conflictos musculares por separado.
4. Mantener `unknown` cuando falte evidencia.
5. No convertir coincidencias de nombres en identidad física.

## 8. Incertidumbres

- La identidad física de los 9 equipos proviene de una auditoría previa, no de una verificación reproducible en esta fase.
- Los conflictos musculares no se han resuelto.
- La evidencia E2 no se ha auditado individualmente para los 32 casos.
- Los 7 equipos sin referencias pueden tener asociaciones no documentadas.

## 9. Limitaciones

- No se modificó el catálogo.
- No se crearon asociaciones definitivas.
- No se clasificaron ejercicios.
- No se implementó ningún cambio.

## 10. Conclusión

Los bloqueadores del Lote 1 son principalmente de evidencia y metodología, no de ausencia total de datos.

Los 32 casos quedan provisionales por falta de evidencia que conecte el ejercicio con la identidad física del equipo.

Los conflictos musculares y la disponibilidad mixta impiden elevar la confianza.

El procedimiento es correcto para evitar falsos positivos, pero necesita una regla reproducible de confirmación para escalar.
