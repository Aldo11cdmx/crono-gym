# Integration Matrix

## Flujos existentes
- A. Inicio de entrenamiento → sesión activa: FUNCIONA (RoutinesPage.start → ActiveSessionContext → pill).
- B. Finalización → persistencia → historial → métricas → Today: PARCIAL (finalize_session idempotente; Today no muestra historial/PRs).
- C. Registro de PR → Progress/Today: PARCIAL (PRs calculados en modelo, no renderizados).
- D. Modificación de rutina → planificación → entrenamiento: FUNCIONA.
- E. Sustitución de ejercicio → sesión sin pérdida: NO VERIFICADO.
- F. Sesión interrumpida → borrador → recuperación: FUNCIONA (ActiveSessionContext).
- G. Asignación Coach → planificación atleta: NO VERIFICADO (RLS pendiente).

## Conexiones pendientes
- Today → Progress (CTA "Ver historial" ya navega).
- Today → Coach (CoachBanner ya existe).
- Today → Profile (sin enlace directo actual).