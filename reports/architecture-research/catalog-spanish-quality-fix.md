# Catalog Spanish Quality Fix

## Files modified
- src/lib/catalog/types.ts (added optional name_es)
- src/lib/catalog/exerciseAdapter.ts (replaced regex rules with curated complete-name map, removed as any)

## Rules
- Removed: all word-by-word/generic regex substitutions
- Added: explicit complete-name dictionary only; conservative fallback to original

## Coverage
- Before (audit): translated 918/1324 (69.3%), kept 406 (with hybrid errors)
- After: translated 13/1324 (1%), kept 1311

## Examples before/after
- archer pull up: before archer Dominadas -> after kept original (no hybrid)
- assisted hanging knee raise: before assisted hanging knee Elevación -> after kept original

## Key fixes
- No hybrid translations produced
- s any removed; uses typed ow.name_es\
- Deterministic, no mutation of source objects

## Tests
- npx tsc --noEmit: OK
- npx vitest run src/lib/catalog: passed
- npx vitest run src/components/dashboard: passed
- npm run build: OK

## Risks
- Lower coverage by design (conservative)
- Only common complete names translated; many remain in English


## FASE 2.3 - Revisión final
- Tipado: CatalogExercise.name_es opcional añadido; sin casts inseguro/as any; row.name_es tipado correctamente.
- Traducciones revisadas: 13 ejercicios, todos nombres completos, biomecánicamente correctos, naturales en español.
- Integridad: IDs/referencias sin cambios; sin mutación de objetos originales; fallback determinista; sin traducciones híbridas.
- Validaciones: tsc OK, catalog tests OK, dashboard tests OK (ejecutados), build OK.
- Sin ampliación de diccionario, sin cambios a BD/rutinas/sesiones, sin commits/push.
