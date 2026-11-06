# PR Data Audit

## Cálculo
- Max peso por ejercicio desde completed_sets (useAthletePRs).
- Campos: exerciseId, exerciseName, maxWeight, date (log.started_at).
- Sin historial: [].

## Limitaciones
- Solo peso máximo (no 1RM, no volumen).
- Fecha = fecha de la sesión (no del set).
- Sin distinción histórico/reciente.
- Varios récords del mismo ejercicio: se queda el max.

## Contrato para PRSection (futuro)
- Props: prs: { exerciseId, exerciseName, maxWeight, date }[].
- Estados: loading, empty, error.
- Datos reales disponibles: sí (sin nuevas consultas).