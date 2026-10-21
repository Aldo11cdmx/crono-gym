# Cronos Gym — Índice de agentes
> Se carga siempre. Define el protocolo común, la precedencia y los comandos canónicos.

## Contexto del repo (verificado en la rama `fix/p0-timer-and-session-draft`)
React 18 + Vite 5 + TypeScript estricto + Tailwind 3 + Supabase (Postgres/RLS + Edge Functions `coach-assistant`, `coach-auth`) + IndexedDB (`cronos-offline` v5). Alias: `@/*` → `src/*`, `@lib/*` → `src/lib/*`. Windows + PowerShell. Idioma de UI: español.

## Protocolo común (aplica a TODOS los agentes)
1. **Lee antes de escribir.** Abre el archivo y su test vecino. Nada de nombres de tokens, tablas, campos o rutas "de memoria": verifícalos con búsqueda.
2. **Responde así:** (a) diagnóstico en 1-3 líneas, (b) cambio concreto, (c) verificación realmente ejecutada con su resultado, (d) máx. 3 `[Sugerencia]` separadas del cambio.
3. **Lo proactivo se propone, no se aplica**, salvo fixes triviales en líneas que ya tocas (literal → token, import sin usar). Nunca refactorices archivos ajenos a la tarea.
4. **Nunca borres ni purgues datos de usuario.** Datos inválidos: cuarentena + log sin PII.
5. **Plan primero** (riesgo + rollback) si el cambio toca: esquema/RLS, `sessionSync.ts`, `offlineStore.ts`, `idb.ts` (`DB_VERSION`), `sw.js`, auth/roles de coach.
6. **Nunca afirmes "pasa" sin haberlo corrido.** `npm test` completo tarda ~5 min: corre primero los tests del área (`npx vitest run <ruta>`) y el completo antes de dar por cerrado un cambio amplio.
7. **Los informes `reports/architecture-research/` son una foto del 19-20 oct.** Úsalos como mapa de riesgos y dirección, pero verifica contra el código antes de citar una cifra o un hallazgo.

## Precedencia en conflictos (1 = gana)
1. `cybersecurity-and-hardening-sentinel`, `domain-fitness-guardian`, `transactional-sync-and-rls-guardian`
2. `offline-first-architect`, `active-workout-and-timer-guardian`, `supabase-data-and-migrations-guardian`
3. `cronos-architecture-context`, `state-and-flow-architect`
4. `gym-ux-mobile-specialist`, `a11y-and-i18n-guardian`
5. `design-system-enforcer` > `apple-ui-architect` > `routines-and-planner-craftsman` > `button-and-ui-craftsman` > `motion-and-haptics-guardian`
6. `bundle-and-chunk-governor`, `performance-optimizer`, `qa-test-guardian`, `catalog-and-equipment-curator`, `pwa-delivery-and-update-flow`, `error-handling-and-observability | try/catch, async, sync status | Degradaci�n elegante sin crash y telemetr�a clara |
| code-simplifier-and-pruner | a�adir c�digo, abstracciones, migraciones, eliminaci�n | M�nima complejidad razonable, reutilizaci�n, eliminaci�n segura de c�digo muerto |

## Comandos canónicos (PowerShell)
```powershell
npm run typecheck                 # 0 errores de TypeScript
npx vitest run src/design         # validación de tokens y diseño (rápido, ~4s)
npm test                          # suite completa (~5 min)
npm run build                     # tsc -b && vite build (auditoría de chunks)
npm run equipment:map             # regenera src/data/equipmentMap.ts
npm run verify:mapping            # valida muscleMap
```

## Agentes Especializados (23 Agentes)
| Agente | Se activa cuando | Superpoder |
|---|---|---|
| apple-ui-architect | pantallas, layout, jerarquía visual | Convierte una pantalla cargada en una calmada y cara estilo Apple |
| button-and-ui-craftsman | botones, tarjetas clicables, estados | Un solo primario, 44px, todos los estados interactivos |
| routines-and-planner-craftsman | `RoutinesPage`, `WeeklyPlanner`, planes | Gestión de rutinas limpia, modular, sin ruido visual y con deshacer |
| motion-and-haptics-guardian | keyframes, curvas de `MOTION`, háptica, beeps | Fluidez nativa iOS a 60/120fps sin dependencias externas pesadas |
| active-workout-and-timer-guardian | `ActiveWorkout`, `RestTimer`, borradores, wake lock | Temporizador inmune al background y recuperación infalible de sesión |
| bundle-and-chunk-governor | `vite.config.ts`, dependencias, `router.tsx` | Presupuesto estricto de chunks (< 300 kB gzip) y 0 JSONs en bundle inicial |
| transactional-sync-and-rls-guardian | `supabase/`, migraciones, RLS, RPCs | Escrituras atómicas "todo o nada" y RLS hermético multi-tenant |
| cybersecurity-and-hardening-sentinel | formularios, auth, Edge Functions, `.env` | Audita seguridad y aislamiento sin que se lo pidan |
| cronos-architecture-context | nuevo módulo/store/capa | Mapa canónico; rechaza capas duplicadas o islas de código |
| dev-hygiene-pwa | encoding, dev server, `sw.js` en dev | Evita módulos viejos y U+FFFD |
| qa-test-guardian | cualquier cambio de código | Typecheck 0 + tests de regresión ejecutados de verdad |
| offline-first-architect | escrituras de entrenamiento, sync, IndexedDB | Todo se registra sin red y la cola es idempotente |
| gym-ux-mobile-specialist | flujo de entrenamiento activo | Serie en ≤ 2 taps, usabilidad a una mano en el gym |
| domain-fitness-guardian | series, volumen, PRs, rangos, RPE | Progresión científica y cero campos inventados |
| performance-optimizer | listas, virtualización, re-renders, profiling | 60 fps con medición antes/después |
| state-and-flow-architect | contextos, hooks, flujos de estado | Cada dato con un solo dueño y ciclo de vida limpio |
| design-system-enforcer | color, tipografía, spacing, tokens | Cero valores mágicos; pasa `tokens.test.ts` |
| catalog-and-equipment-curator | catálogo, equipo del gym, medios | Solo ejercicios viables y carga bajo demanda |
| supabase-data-and-migrations-guardian | `supabase/`, tipos, queries | Migraciones reversibles y tipos sincronizados |
| pwa-delivery-and-update-flow | `sw.js`, manifest, actualizaciones | Updates silenciosos que jamás rompen un workout activo |
| a11y-and-i18n-guardian | textos, iconos, foco, contraste | Español coherente, WCAG AA y soporte TalkBack/VoiceOver |
| git-and-delivery-discipline | commits, ramas, limpieza | Historial atómico, limpio y reversible |
| error-handling-and-observability | try/catch, async, sync status | Degradaci�n elegante sin crash y telemetr�a clara |
| code-simplifier-and-pruner | a�adir c�digo, abstracciones, migraciones, eliminaci�n | M�nima complejidad razonable, reutilizaci�n, eliminaci�n segura de c�digo muerto |
