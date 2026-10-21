# Cronos Gym — Índice de agentes
> Se carga siempre. Define el protocolo común, la precedencia y los comandos canónicos.

## Contexto del repo (verificado en la rama `fix/p0-timer-and-session-draft`)
React 18 + Vite 5 + TypeScript estricto + Tailwind 3 + Supabase (Postgres/RLS + Edge Functions `coach-assistant`, `coach-auth`) + IndexedDB (`cronos-offline`). Alias: `@/*` → `src/*`, `@lib/*` → `src/lib/*`. Windows + PowerShell. Idioma de UI: español.

## Protocolo común (aplica a TODOS los agentes)
1. **Lee antes de escribir.** Abre el archivo y su test vecino. Nada de nombres de tokens, tablas, campos o rutas "de memoria": verifícalos con búsqueda.
2. **Responde así:** (a) diagnóstico en 1-3 líneas, (b) cambio concreto, (c) verificación realmente ejecutada con su resultado, (d) máx. 3 `[Sugerencia]` separadas del cambio.
3. **Lo proactivo se propone, no se aplica**, salvo fixes triviales en líneas que ya tocas (literal → token, import sin usar). Nunca refactorices archivos ajenos a la tarea.
4. **Nunca borres ni purgues datos de usuario.** Datos inválidos: cuarentena + log sin PII.
5. **Plan primero** (riesgo + rollback) si el cambio toca: esquema/RLS, `sessionSync.ts`, `offlineStore.ts`, `idb.ts` (`DB_VERSION`), `sw.js`, auth/roles de coach.
6. **Nunca afirmes "pasa" sin haberlo corrido.** `npm test` completo tarda ~5 min: corre primero los tests del área (`npx vitest run <ruta>`) y el completo antes de dar por cerrado un cambio amplio.
7. **Los informes `reports/architecture-research/` son una foto del 19-20 oct.** Úsalos como mapa de riesgos y dirección, pero verifica contra el código antes de citar una cifra o un hallazgo.

## Precedencia en conflictos (1 = gana)
1. `cybersecurity-and-hardening-sentinel`, `domain-fitness-guardian`
2. `offline-first-architect`, `supabase-data-and-migrations-guardian`
3. `cronos-architecture-context`, `state-and-flow-architect`
4. `gym-ux-mobile-specialist`, `a11y-and-i18n-guardian`
5. `design-system-enforcer` > `apple-ui-architect` > `button-and-ui-craftsman`
6. `performance-optimizer`, `qa-test-guardian`, `catalog-and-equipment-curator`, `pwa-delivery-and-update-flow`, `error-handling-and-observability`, `git-and-delivery-discipline`, `dev-hygiene-pwa`

## Comandos canónicos (PowerShell)
```powershell
npm run typecheck                 # 0 errores
npx vitest run src/design         # tokens (rápido)
npm test                          # suite completa (~5 min)
npm run build                     # tsc -b && vite build
npm run equipment:map             # regenera src/data/equipmentMap.ts
npm run verify:mapping            # valida muscleMap
```

## Agentes
| Agente | Se activa cuando | Superpoder |
|---|---|---|
| apple-ui-architect | pantallas, layout, jerarquía visual | Convierte una pantalla cargada en una calmada y cara |
| button-and-ui-craftsman | botones, tarjetas clicables, estados | Un solo primario, 44px, todos los estados |
| cybersecurity-and-hardening-sentinel | formularios, auth, Edge Functions, `.env` | Audita seguridad sin que se lo pidan |
| cronos-architecture-context | nuevo módulo/store/capa | Mapa canónico; rechaza capas duplicadas |
| dev-hygiene-pwa | encoding, dev server, `sw.js` en dev | Evita módulos viejos y U+FFFD |
| qa-test-guardian | cualquier cambio de código | Typecheck 0 + tests de regresión |
| offline-first-architect | escrituras de entrenamiento, sync | Todo se registra sin red y es reejecutable |
| gym-ux-mobile-specialist | flujo de entrenamiento activo | Serie en ≤ 2 taps, una mano |
| domain-fitness-guardian | series, volumen, PRs, rangos | Cero campos inventados |
| performance-optimizer | listas, timers, bundle, catálogo | 60 fps y bundle con presupuesto |
| state-and-flow-architect | contextos, hooks, flujos | Cada dato con un solo dueño |
| design-system-enforcer | color, tipografía, spacing, motion | Cero valores mágicos |
| catalog-and-equipment-curator | catálogo, equipo del gym, medios | Solo ejercicios que el gym puede hacer |
| supabase-data-and-migrations-guardian | `supabase/`, tipos, queries | Migraciones reversibles y RLS probado |
| pwa-delivery-and-update-flow | `sw.js`, manifest, actualizaciones | Updates que nunca rompen un workout |
| a11y-and-i18n-guardian | textos, iconos, foco, contraste | Español coherente y usable por todos |
| git-and-delivery-discipline | commits, ramas, limpieza | Historial atómico y limpio |
| error-handling-and-observability | try/catch, async, sync status | Los fallos se ven y no pierden datos |
