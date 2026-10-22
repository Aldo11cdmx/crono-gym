# Cronos Gym â€” Ãndice de agentes
> Se carga siempre. Define el protocolo comÃºn, la precedencia y los comandos canÃ³nicos.

## Contexto del repo (verificado en la rama `fix/p0-timer-and-session-draft`)
React 18 + Vite 5 + TypeScript estricto + Tailwind 3 + Supabase (Postgres/RLS + Edge Functions `coach-assistant`, `coach-auth`) + IndexedDB (`cronos-offline` v5). Alias: `@/*` â†’ `src/*`, `@lib/*` â†’ `src/lib/*`. Windows + PowerShell. Idioma de UI: espaÃ±ol.

## Protocolo comÃºn (aplica a TODOS los agentes)
1. **Lee antes de escribir.** Abre el archivo y su test vecino. Nada de nombres de tokens, tablas, campos o rutas "de memoria": verifÃ­calos con bÃºsqueda.
2. **Responde asÃ­:** (a) diagnÃ³stico en 1-3 lÃ­neas, (b) cambio concreto, (c) verificaciÃ³n realmente ejecutada con su resultado, (d) mÃ¡x. 3 `[Sugerencia]` separadas del cambio.
3. **Lo proactivo se propone, no se aplica**, salvo fixes triviales en lÃ­neas que ya tocas (literal â†’ token, import sin usar). Nunca refactorices archivos ajenos a la tarea.
4. **Nunca borres ni purgues datos de usuario.** Datos invÃ¡lidos: cuarentena + log sin PII.
5. **Plan primero** (riesgo + rollback) si el cambio toca: esquema/RLS, `sessionSync.ts`, `offlineStore.ts`, `idb.ts` (`DB_VERSION`), `sw.js`, auth/roles de coach.
6. **Nunca afirmes "pasa" sin haberlo corrido.** `npm test` completo tarda ~5 min: corre primero los tests del Ã¡rea (`npx vitest run <ruta>`) y el completo antes de dar por cerrado un cambio amplio.
7. **Los informes `reports/architecture-research/` son una foto del 19-20 oct.** Ãšsalos como mapa de riesgos y direcciÃ³n, pero verifica contra el cÃ³digo antes de citar una cifra o un hallazgo.

## Precedencia en conflictos (1 = gana)
1. `cybersecurity-and-hardening-sentinel`, `domain-fitness-guardian`, `transactional-sync-and-rls-guardian`
2. `offline-first-architect`, `active-workout-and-timer-guardian`, `supabase-data-and-migrations-guardian`
3. `cronos-architecture-context`, `state-and-flow-architect`
4. `gym-ux-mobile-specialist`, `a11y-and-i18n-guardian`
5. `design-system-enforcer` > `apple-ui-architect` > `routines-and-planner-craftsman` > `button-and-ui-craftsman` > `motion-and-haptics-guardian`
6. `bundle-and-chunk-governor`, `performance-optimizer`, `qa-test-guardian`, `catalog-and-equipment-curator`, `pwa-delivery-and-update-flow`, `error-handling-and-observability | try/catch, async, sync status | Degradación elegante sin crash y telemetría clara |
| code-simplifier-and-pruner | añadir código, abstracciones, migraciones, eliminación | Mínima complejidad razonable, reutilización, eliminación segura de código muerto |

## Comandos canÃ³nicos (PowerShell)
```powershell
npm run typecheck                 # 0 errores de TypeScript
npx vitest run src/design         # validaciÃ³n de tokens y diseÃ±o (rÃ¡pido, ~4s)
npm test                          # suite completa (~5 min)
npm run build                     # tsc -b && vite build (auditorÃ­a de chunks)
npm run equipment:map             # regenera src/data/equipmentMap.ts
npm run verify:mapping            # valida muscleMap
```

## Agentes Especializados (23 Agentes)
| Agente | Se activa cuando | Superpoder |
|---|---|---|
| apple-ui-architect | pantallas, layout, jerarquÃ­a visual | Convierte una pantalla cargada en una calmada y cara estilo Apple |
| button-and-ui-craftsman | botones, tarjetas clicables, estados | Un solo primario, 44px, todos los estados interactivos |
| routines-and-planner-craftsman | `RoutinesPage`, `WeeklyPlanner`, planes | GestiÃ³n de rutinas limpia, modular, sin ruido visual y con deshacer |
| impeccable-ui-craftsman | micro-interacciones, gestos, transiciones, celebraciones, háptico | Pulido del último 5%: física creíble, cero libs de animación |
 keyframes, curvas de `MOTION`, hÃ¡ptica, beeps | Fluidez nativa iOS a 60/120fps sin dependencias externas pesadas |
| active-workout-and-timer-guardian | `ActiveWorkout`, `RestTimer`, borradores, wake lock | Temporizador inmune al background y recuperaciÃ³n infalible de sesiÃ³n |
| bundle-and-chunk-governor | `vite.config.ts`, dependencias, `router.tsx` | Presupuesto estricto de chunks (< 300 kB gzip) y 0 JSONs en bundle inicial |
| transactional-sync-and-rls-guardian | `supabase/`, migraciones, RLS, RPCs | Escrituras atÃ³micas "todo o nada" y RLS hermÃ©tico multi-tenant |
| cybersecurity-and-hardening-sentinel | formularios, auth, Edge Functions, `.env` | Audita seguridad y aislamiento sin que se lo pidan |
| cronos-architecture-context | nuevo mÃ³dulo/store/capa | Mapa canÃ³nico; rechaza capas duplicadas o islas de cÃ³digo |
| dev-hygiene-pwa | encoding, dev server, `sw.js` en dev | Evita mÃ³dulos viejos y U+FFFD |
| qa-test-guardian | cualquier cambio de cÃ³digo | Typecheck 0 + tests de regresiÃ³n ejecutados de verdad |
| offline-first-architect | escrituras de entrenamiento, sync, IndexedDB | Todo se registra sin red y la cola es idempotente |
| gym-ux-mobile-specialist | flujo de entrenamiento activo | Serie en â‰¤ 2 taps, usabilidad a una mano en el gym |
| domain-fitness-guardian | series, volumen, PRs, rangos, RPE | ProgresiÃ³n cientÃ­fica y cero campos inventados |
| performance-optimizer | listas, virtualizaciÃ³n, re-renders, profiling | 60 fps con mediciÃ³n antes/despuÃ©s |
| state-and-flow-architect | contextos, hooks, flujos de estado | Cada dato con un solo dueÃ±o y ciclo de vida limpio |
| design-system-enforcer | color, tipografÃ­a, spacing, tokens | Cero valores mÃ¡gicos; pasa `tokens.test.ts` |
| catalog-and-equipment-curator | catÃ¡logo, equipo del gym, medios | Solo ejercicios viables y carga bajo demanda |
| supabase-data-and-migrations-guardian | `supabase/`, tipos, queries | Migraciones reversibles y tipos sincronizados |
| pwa-delivery-and-update-flow | `sw.js`, manifest, actualizaciones | Updates silenciosos que jamÃ¡s rompen un workout activo |
| a11y-and-i18n-guardian | textos, iconos, foco, contraste | EspaÃ±ol coherente, WCAG AA y soporte TalkBack/VoiceOver |
| git-and-delivery-discipline | commits, ramas, limpieza | Historial atÃ³mico, limpio y reversible |
| error-handling-and-observability | try/catch, async, sync status | Degradación elegante sin crash y telemetría clara |
| code-simplifier-and-pruner | añadir código, abstracciones, migraciones, eliminación | Mínima complejidad razonable, reutilización, eliminación segura de código muerto |
