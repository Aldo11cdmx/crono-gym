# Fase 3A.1 - Revisión de los 9 registros con confianza low

## Objetivo

Revisar individualmente los nueve registros con confianza global `low` en `09-pilot-matrix.csv`, sin modificar el catálogo ni la matriz original.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`

## Método

Para cada registro se recuperaron los campos estructurados y la instrucción en español. Se compararon `target`, `muscle_group`, `secondary_muscles`, `body_part`, `equipment`, disponibilidad y texto. No se elevó la confianza por intuición.

## Resultados

| ID | Nombre | Propuesta piloto | Campos unknown | Motivo de confianza baja | Tipo de incertidumbre | Información adicional útil | Recomendación |
|---|---|---|---|---|---|---|---|
| 0518 | kettlebell alternating hang clean | `pattern_family=other`, `primary_joint_action=hip_extension`, `muscle_primary=unknown` | primary_joint_action; muscle_primary; conflicto target/muscle_group | `target=forearms` contradice `muscle_group=shoulders`; el movimiento es multiarticular | Semántica y biomecánica | Confirmación humana del músculo primario y del patrón | Conservar `unknown` para músculo primario; mantener `other` como patrón residual |
| 1512 | all fours squad stretch | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=unknown` | primary_joint_action; kinetic_chain; conflicto target/muscle_group | `target=quads` contradice `muscle_group=hamstrings`; el texto describe estiramiento de cuádriceps | Semántica y biomecánica | Confirmación humana del músculo objetivo y cadena cinética | Conservar `unknown` para músculo primario y acción articular |
| 1708 | assisted lying calves stretch | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=muscle.legs.calves` | primary_joint_action; resistance_system; implement_type; kinetic_chain; laterality | `equipment=assisted` no identifica implemento ni resistencia; lateralidad no documentada | Documental | Definición del equipo asistido y lateralidad | Conservar unknown en implemento, resistencia, cadena y lateralidad |
| 1709 | assisted lying glutes stretch | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=muscle.legs.glutes` | primary_joint_action; resistance_system; implement_type; kinetic_chain; laterality | `equipment=assisted` no identifica implemento ni resistencia; lateralidad no documentada | Documental | Definición del equipo asistido y lateralidad | Conservar unknown en implemento, resistencia, cadena y lateralidad |
| 1710 | assisted lying gluteus and piriformis stretch | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=muscle.legs.glutes` | primary_joint_action; resistance_system; implement_type; kinetic_chain; laterality; piriformis no está en la lista muscular | `equipment=assisted` no identifica implemento ni resistencia; piriforme no está modelado | Documental y taxonómica | Decisión humana sobre modelar piriforme y equipo asistido | Conservar unknown; registrar pregunta sobre piriforme |
| 1713 | assisted prone lying quads stretch | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=muscle.legs.quadriceps` | primary_joint_action; resistance_system; implement_type; kinetic_chain; laterality | `equipment=assisted` no identifica implemento ni resistencia; lateralidad no documentada | Documental | Definición del equipo asistido y lateralidad | Conservar unknown en implemento, resistencia, cadena y lateralidad |
| 1714 | assisted prone rectus femoris stretch | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=unknown` | primary_joint_action; resistance_system; implement_type; kinetic_chain; laterality; conflicto target/muscle_group | `target=abs` contradice `muscle_group=quadriceps`; el texto describe estiramiento de la parte frontal del muslo | Semántica y biomecánica | Confirmación humana del músculo objetivo | Conservar `unknown` para músculo primario |
| 0003 | air bike | `pattern_family=core`, `primary_joint_action=unknown`, `muscle_primary=unknown` | primary_joint_action; conflicto target/muscle_group | `target=abs` contradice `muscle_group=hip flexors`; el texto combina flexión de tronco y pedaleo | Semántica y biomecánica | Confirmación humana del músculo primario y acción dominante | Conservar `unknown` para músculo primario y acción articular |
| 1368 | ankle circles | `pattern_family=mobility_stretch`, `primary_joint_action=unknown`, `muscle_primary=unknown` | primary_joint_action; conflicto target/muscle_group; laterality | `target=calves` contradice `muscle_group=ankle stabilizers`; el texto describe rotación de tobillo | Semántica y biomecánica | Confirmación humana del músculo primario y lateralidad | Conservar `unknown` para músculo primario y acción articular |

## Conclusiones

- Ningún registro low justifica elevación de confianza por intuición.
- Las incertidumbres son principalmente documentales o de evidencia, no fallos de implementación.
- Los casos con conflicto `target` / `muscle_group` se mantienen sin precedencia automática.

## Limitaciones

- No se inspeccionaron campos fuera del catálogo y la matriz piloto.
- No se realizó clasificación del catálogo completo.
