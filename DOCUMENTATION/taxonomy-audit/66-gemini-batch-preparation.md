# 66 - Preparacion de lotes para Gemini

Gemini es asistente de clasificacion, no fuente de verdad. Lotes pequenos por grupo anatomico.

## Lotes recomendados

- **ABDOMEN Y CORE**: 169 ejercicios -> 4 lotes de hasta 50
- **BRAZOS Y ANTEBRAZOS**: 329 ejercicios -> 7 lotes de hasta 50
- **CARDIO**: 29 ejercicios -> 1 lotes de hasta 50
- **CUELLO**: 2 ejercicios -> 1 lotes de hasta 50
- **ESPALDA**: 203 ejercicios -> 5 lotes de hasta 50
- **HOMBROS**: 143 ejercicios -> 3 lotes de hasta 50
- **PECHO**: 163 ejercicios -> 4 lotes de hasta 50
- **PIERNAS Y GLUTEOS**: 286 ejercicios -> 6 lotes de hasta 50

Total lotes aprox: 31

## Contenido por lote

- exercise_id, name, instructions (es/en), category, body_part, muscle_group, target, secondary_muscles, equipment, equipment_id, equipment_name, availableInCronosGym.
- Referencias a fotografias CG-EQP (equipment_id).
- No enviar los 1,324 en una sola solicitud.
