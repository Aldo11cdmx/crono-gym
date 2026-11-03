# Cronos Gym — Índice de agentes

Se carga siempre. Define el protocolo común, la precedencia y los comandos canónicos.

## Contexto del repositorio

Verificado originalmente en la rama `fix/p0-timer-and-session-draft`.

- React 18 + Vite 5 + TypeScript estricto + Tailwind 3.
- Supabase: PostgreSQL, RLS y Edge Functions `coach-assistant` y `coach-auth`.
- IndexedDB: base local `cronos-offline`, versión 5.
- Alias: `@/*` → `src/*` y `@lib/*` → `src/lib/*`.
- Entorno de trabajo: Windows y PowerShell.
- Idioma de la interfaz: español.

Verifica este contexto contra los archivos actuales antes de asumir que sigue vigente.

## Protocolo común (aplica a todos los agentes)

1. **Lee antes de escribir.** Abre el archivo y su test vecino. No supongas nombres de tokens, tablas, campos ni rutas: verifícalos mediante búsqueda en el repositorio.
2. **Estructura la respuesta:** (a) diagnóstico en 1–3 líneas, (b) cambio concreto, (c) verificación realmente ejecutada con su resultado y (d) máximo 3 sugerencias, claramente separadas del cambio.
3. **Lo proactivo se propone, no se aplica**, salvo correcciones triviales en líneas que ya estás modificando, como sustituir un literal por un token existente o retirar un import sin uso. No refactorices archivos ajenos a la tarea.
4. **Nunca borres ni purgues datos de usuario.** Los datos inválidos deben ponerse en cuarentena y registrarse sin incluir información personal identificable (PII).
5. **Planifica primero el riesgo y el rollback** si el cambio toca el esquema o RLS, `sessionSync.ts`, `offlineStore.ts`, `idb.ts` (`DB_VERSION`), `sw.js` o la autenticación y los roles de coach.
6. **Nunca afirmes que algo pasa sin haberlo ejecutado.** La suite completa `npm test` puede tardar aproximadamente 5 minutos. Ejecuta primero los tests del área (`npx vitest run <ruta>`) y la suite completa antes de cerrar un cambio amplio.
7. **Los informes de `reports/architecture-research/` son una fotografía del 19–20 de octubre.** Úsalos como mapa de riesgos y dirección, pero verifica el código actual antes de citar cifras o hallazgos.

## Precedencia en conflictos (1 = mayor prioridad)

1. `cybersecurity-and-hardening-sentinel`, `domain-fitness-guardian`, `transactional-sync-and-rls-guardian`.
2. `offline-first-architect`, `active-workout-and-timer-guardian`, `supabase-data-and-migrations-guardian`.
3. `cronos-architecture-context`, `state-and-flow-architect`.
4. `gym-ux-mobile-specialist`, `a11y-and-i18n-guardian`.
5. `design-system-enforcer` > `apple-ui-architect` > `routines-and-planner-craftsman` > `button-and-ui-craftsman` > `motion-and-haptics-guardian` > `impeccable-ui-craftsman`.
6. `bundle-and-chunk-governor`, `performance-optimizer`, `qa-test-guardian`, `catalog-and-equipment-curator`, `pwa-delivery-and-update-flow`, `error-handling-and-observability`, `code-simplifier-and-pruner`, `dev-hygiene-pwa`, `git-and-delivery-discipline`.

La precedencia ayuda a resolver conflictos; no autoriza a ignorar requisitos compatibles de otros agentes.

## Catálogo de agentes (25 agentes)

| Agente | Se activa cuando | Responsabilidad principal |
|---|---|---|
| `a11y-and-i18n-guardian` | Textos, iconos, foco, teclado, contraste, fechas, números o unidades | Español coherente, WCAG AA y soporte TalkBack/VoiceOver |
| `active-workout-and-timer-guardian` | `ActiveWorkout`, `RestTimer`, borradores o wake lock | Temporizador basado en deadline y recuperación fiable de sesión |
| `apple-ui-architect` | Pantallas, layouts, jerarquía visual, GlassCard o tipografía | Interfaz premium, clara y consistente con patrones Apple |
| `bundle-and-chunk-governor` | Vite, dependencias, rutas, catálogos o medios | Presupuesto de chunks, carga diferida y reducción del bundle inicial |
| `button-and-ui-craftsman` | Botones, tarjetas clicables, chips, steppers o controles | Estados interactivos completos y objetivos táctiles adecuados |
| `catalog-and-equipment-curator` | Catálogo de ejercicios, equipamiento, imágenes o disponibilidad | Ejercicios viables, consistencia del catálogo y carga bajo demanda |
| `code-simplifier-and-pruner` | Nuevo código, abstracciones, componentes, hooks o limpieza | Complejidad mínima razonable, reutilización y eliminación segura de código muerto |
| `cronos-architecture-context` | Nuevos módulos, stores, capas o movimiento de lógica | Mapa arquitectónico canónico y prevención de capas duplicadas |
| `cybersecurity-and-hardening-sentinel` | Formularios, autenticación, roles, Edge Functions, secretos o entradas externas | Seguridad, validación, aislamiento y protección contra vulnerabilidades |
| `design-system-enforcer` | Colores, tipografía, espaciado, tokens o motion | Consistencia visual y eliminación de valores mágicos |
| `dev-hygiene-pwa` | Codificación, entorno de desarrollo, archivos legacy o service worker | Higiene del entorno, UTF-8 válido y prevención de caracteres corruptos |
| `domain-fitness-guardian` | Series, volumen, récords, rangos, RPE o importaciones | Exactitud del dominio fitness y rechazo de campos inventados |
| `error-handling-and-observability` | try/catch, operaciones async, sincronización o logs | Degradación elegante, errores visibles y telemetría útil |
| `git-and-delivery-discipline` | Commits, ramas, staging, limpieza o pull requests | Historial atómico, seguro y reversible |
| `gym-ux-mobile-specialist` | Entrenamiento activo, SetTable, RestTimer o flujos móviles | Uso con una mano, máximo dos taps para acciones frecuentes y targets adecuados |
| `impeccable-ui-craftsman` | Rediseños, jerarquía, microinteracciones o animaciones | Refinamiento visual con propósito, claridad y simplicidad |
| `motion-and-haptics-guardian` | Animaciones, keyframes, vibración, sonidos o feedback | Movimiento fluido, háptica controlada y respeto a reduce motion |
| `offline-first-architect` | Sets, sesiones, IndexedDB, offlineStore o sessionSync | Operación offline, colas idempotentes y sincronización robusta |
| `performance-optimizer` | Listas, timers, animaciones, imágenes o lentitud | Rendimiento medible, fluidez y reducción de trabajo innecesario |
| `pwa-delivery-and-update-flow` | Service worker, manifest, instalación o actualizaciones | Actualizaciones seguras que no interrumpan un entrenamiento activo |
| `qa-test-guardian` | Cambios de código, tipos, tokens o sincronización | Typecheck y pruebas de regresión ejecutadas realmente |
| `routines-and-planner-craftsman` | `RoutinesPage`, `WeeklyPlanner`, rutinas o planes | Gestión modular de rutinas, planificación clara y acciones reversibles |
| `state-and-flow-architect` | useState, reducers, context, hooks o asistentes por pasos | Un único dueño por dato y ciclo de vida de estado limpio |
| `supabase-data-and-migrations-guardian` | Esquema, migraciones, tipos Supabase, RLS, queries o Edge Functions | Migraciones seguras y tipos sincronizados |
| `transactional-sync-and-rls-guardian` | Migraciones, RPC, Edge Functions, sessionSync o pushSession | Escrituras transaccionales todo-o-nada y RLS multi-tenant |

## Comandos canónicos (PowerShell)

```powershell
npm run typecheck                 # 0 errores de TypeScript
npx vitest run src/design         # Validación de tokens y diseño
npm test                          # Suite completa; puede tardar ~5 min
npm run build                     # tsc -b && vite build; revisar chunks
npm run equipment:map             # Regenera src/data/equipmentMap.ts
npm run verify:mapping             # Valida muscleMap
```

Ejecuta únicamente los comandos pertinentes al cambio y reporta sus resultados reales.

## Regla final

Inspecciona primero el código y consulta al agente de dominio correspondiente. Conserva el alcance autorizado, evita cambios colaterales y no alteres datos ni historial Git sin autorización.
