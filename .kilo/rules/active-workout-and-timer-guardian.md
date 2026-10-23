# Active Workout & Timer Guardian
> Se activa cuando: tocas `ActiveWorkout.tsx`, `ActiveWorkoutView.tsx`, `RestTimer.tsx`, temporizadores de descanso, cálculo de tiempo transcurrido, persistencia de borradores (`SessionDraft`), recuperación tras recarga, o la barra flotante de sesión activa (`ActiveWorkoutPill`).

## Misión
Proteger el corazón de la experiencia de entrenamiento: el atleta nunca pierde una serie registrada, el temporizador de descanso nunca se descalibra al apagar la pantalla o cambiar de app, y la sesión activa sobrevive a recargas, cierres y reinicios del navegador.

## Framework de Decisión
1. **¿El temporizador está anclado a un deadline absoluto?** (Nunca un `setInterval` acumulativo: el tiempo restante es siempre `Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))`).
2. **¿Se resincroniza al volver a primer plano?** (Escuchar `visibilitychange` y `focus` para recalcular el estado real sin esperar al siguiente tick).
3. **¿La sesión sobrevive a una recarga de página?** (Si hay un borrador activo en IndexedDB, la app debe rehidratar `ActiveSessionContext` y montar la pantalla activa, nunca abandonar al usuario en `HomeView`).
4. **¿Se guarda el borrador antes de morir?** (Eventos `pagehide`, `beforeunload` y tras cada set registrado ejecutando `saveDraft`).
5. **¿La pantalla se mantiene despierta en el gym?** (Integración con Screen Wake Lock API `navigator.wakeLock` mientras haya un entrenamiento en curso).

## Patrones Obligatorios
- **Una Sola Implementación de Temporizador:**
  - El temporizador canónico es `src/components/RestTimer.tsx` (y su motor en `src/lib/workout/restTimer.ts`).
  - Prohibido crear contadores paralelos con `setInterval` inline dentro de `ActiveWorkout.tsx` o sub-componentes.
- **Estructura del Borrador Recuperable (`SessionDraft`):**
  - Debe contener: `sessionId`, `routineId`, `startedAt` (fijo en epoch ms, nunca reiniciado a 00:00), `completedSets`, `exercises`, `note`, `activeTimer` (con `endsAt` absoluto).
  - Al restaurar un borrador: adoptar el `logId` existente, rehidratar el contexto y limpiar cualquier borrador huérfano.
- **Audio y Vibración en Fin de Descanso:**
  - Disparar `playRestBeep()` (Web Audio API) y `navigator.vibrate([40, 60, 80])` exactamente cuando `endsAt <= Date.now()`.
- **Formato Numérico y Layout Stability:**
  - Los tiempos y pesos deben usar `TYPE.mono` o la clase `font-mono` con `tabular-nums` (`NUMERIC.transform`) para evitar que el reloj mueva los elementos adyacentes al cambiar de segundo.
- **Tokens Visuales Obligatorios:**
  - Header de sesión: `GLASS.fillRaised` + `backdrop-filter: blur(16px)` + `RADIUS.card`.
  - Botón "Terminar": `GlassButton` variante `primary` (`ACCENT.base`), touch target mínimo 44px (`MOTION.minTouchTarget`).
  - Botón cancelar / descartar: `GlassButton` variante `destructive` (`DANGER.base`).

## Cómo debe responder Kilo
1. Explica cómo se comporta el temporizador al minimizar la app por 2 minutos.
2. Demuestra que el estado no se pierde si se fuerza una recarga (F5) en medio del workout.
3. Cita el test unitario / de integración que valida el deadline o la recuperación del draft.

## Comportamiento Proactivo
- Si encuentra un `setInterval(..., 1000)` contando segundos hacia arriba o hacia abajo en un componente de entrenamiento, lo refactoriza hacia el modelo de deadline (`Date.now() - startedAt` o `endsAt - Date.now()`).
- Si detecta que `App.tsx` o el router no montan la sesión activa cuando existe un borrador no finalizado en IndexedDB, propone la compuerta de recuperación inmediata.
- Sugiere añadir Wake Lock durante entrenamientos activos.

## Anti-patrones
- Usar `setInterval` para medir duración sin anclaje temporal: en móviles en segundo plano el intervalo se congela y desfasa.
- Reiniciar `startedAt` al restaurar una sesión recuperada.
- Bloquear la UI con spinners de red al completar una serie (las series van inmediatamente a memoria + IndexedDB).
- Dejar borradores huérfanos tras terminar o descartar el entrenamiento.

## Checklist
- [ ] Temporizador basado en `endsAt` (epoch timestamp)
- [ ] Evento `visibilitychange` refresca la UI de inmediato
- [ ] Borrador persistido en IndexedDB tras cada serie y en `pagehide`
- [ ] `loadRecoverableDraft` probado tras recarga limpia
- [ ] Tipografía monoespaciada con `tabular-nums` en el reloj
- [ ] `npx vitest run src/components/RestTimer.test.tsx` en verde
