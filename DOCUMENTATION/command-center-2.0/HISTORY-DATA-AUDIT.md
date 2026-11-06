# History Data Audit

## Hook: useDashboardSessions
- Retorna: sessions (DashboardSession[]), loading, error, refresh.
- DashboardSession: id, startedAt, completedAt, routineId, routineTitle, sets[].
- Set: id, exerciseId, exerciseName, bodyPart, weight, reps, isWarmup, set_number.
- Orden: startedAt desc.
- Límite: 30 sesiones.
- Invalidación: requestIdRef.
- Error handling: setError + setLoading false; catch en try.

## Contrato para HistorySection (futuro)
- Props: sessions: DashboardSession[].
- Estados: loading, empty, error.
- Sin nuevas consultas: datos ya cargados.