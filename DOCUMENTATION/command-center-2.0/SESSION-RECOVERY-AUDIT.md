# Session Recovery Audit

## Estados reales (ActiveSessionContext)
- Sin sesión: session=null, rehydrating puede ser true/false.
- Sesión activa: session≠null, isActive=true.
- Rehidratando: rehydrating=true (inicia true).
- Borrador recuperable: recoverableDraft≠null.
- Recuperación en curso: effect ejecutando loadRecoverableDraft.
- Sesión finalizada: end() limpia todo.
- Error de recuperación: .catch → rehydrating=false, borrador preservado.

## Campos expuestos
- session, isActive, start, end, warmups, enqueueWarmup, resolveWarmup, recoverableDraft, rehydrating, rehydrate, retryRehydrate, restoreDraft, discardDraft, discardSession, recoveredLogId, pendingRestEndsAt.

## Guards
- rehydratingRef (sincrónico), sessionRef, draftRef.
- start() rechaza si rehydrating, sesión activa o borrador pendiente.

## Cambio de usuario
- rehydrate(userId|null): si userId cambia, invalida (requestIdRef++), limpia estado en memoria (sin borrar drafts de otra cuenta).

## Sin conexión
- loadRecoverableDraft resuelve null si IndexedDB no disponible; no rompe workout.

## Responsabilidades de DashboardPage
- Orquestación y composición. No inicia sesiones directamente (delega a handlePrimary → data.startSession).