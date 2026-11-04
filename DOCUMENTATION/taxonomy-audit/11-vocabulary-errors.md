# Fase 3A - Registro de errores del vocabulario

| ID | Error | Impacto | Corrección propuesta | Estado |
|---|---|---|---|---|
| V-01 | `pattern_family` y `primary_joint_action` se podían confundir | Mezcla de nivel global y articular | Separar en dimensiones independientes | Corregido en Fase 2 |
| V-02 | `implement_type` y `resistance_system` se podían confundir | Mezcla de objeto y mecanismo de carga | Separar implemento, resistencia y accesorio | Corregido en Fase 2 |
| V-03 | `knee_flexion_extension` agrupaba sentadilla, extensión y curl | Acción articular imprecisa | Separar en flexión, extensión y complejo | Corregido en Fase 2 |
| V-04 | `shoulder_abduction_adduction` agrupaba elevación y cruce | Acción articular imprecisa | Separar abducción, aducción y complejo | Corregido en Fase 2 |
| V-05 | `trunk_flexion_extension_lateral` agrupaba crunch, hiperextensión y flexión lateral | Acción articular imprecisa | Separar flexión, extensión, lateral y complejo | Corregido en Fase 2 |
| V-06 | `muscle.back.upper_back` mezclaba retractores, dorsales y trapecio | Musculo primario impreciso | Separar categorías musculares | Corregido en Fase 2 |
| V-07 | `muscle.core.abs` mezclaba abdomen e hip flexors | Musculo primario impreciso | Separar abdomen, oblicuos e hip flexors | Corregido en Fase 2 |
| V-08 | `muscle.cardio.cardiovascular` podía interpretarse como musculo esqueletico | Objetivo y musculo mezclados | Definir como sistema cardiovascular | Corregido en Fase 2 |
| V-09 | `accepted` no exigía aprobación humana explícita | Riesgo de aceptación automática | Regla documentada | Corregido en Fase 2 |
| V-10 | 41 ejercicios kettlebell tienen contradicción de disponibilidad | Disponibilidad no concluyente | Mantener incidencia abierta | Pendiente |
| V-11 | 41 hallazgos UNRESOLVED siguen sin clasificación | Incertidumbre documentada | Mantener registro de incertidumbres | Pendiente |
| V-12 | 5 pares SAME_EXERCISE requieren conservación de IDs | Riesgo de fusión accidental | Documentar relación semántica sin fusionar | Corregido en Fase 2 |
| V-13 | `muscle_stabilizers` tiene alta incertidumbre | 63.27% unknown en piloto | Exigir E1/E2/E3 documentada | Regla vigente |
| V-14 | `primary_joint_action` tiene alta incertidumbre | 30.61% unknown en piloto | Usar `unknown` o `*_complex` | Regla vigente |

No se modificó el catálogo para resolver estos errores.
