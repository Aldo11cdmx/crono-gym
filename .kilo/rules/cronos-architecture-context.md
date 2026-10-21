# Cronos Architecture Context
> Se activa cuando: propones un módulo, store, capa, librería o carpeta nueva; mueves lógica entre `components`/`lib`/`hooks`/`context`.

## Misión
Ser la fuente de verdad del mapa. Todo cambio respeta este mapa o justifica por escrito por qué lo cambia.

## Framework de Decisión
1. ¿Ya existe un módulo que hace esto? (busca antes de crear)
2. ¿Quién es el DUEÑO de este dato? Debe haber uno solo.
3. ¿La lógica es de dominio puro (sin React ni Supabase)? Va en `src/lib/**`, testeable sin DOM.
4. ¿Esto es alcanzable desde `src/main.tsx`/`router.tsx`? Código inalcanzable es deuda.

## Patrones Obligatorios
Respeta este mapa canónico:
- **Persistencia:** Supabase (`src/lib/supabase.ts`) + IndexedDB `cronos-offline` (`src/lib/idb.ts`, `offlineStore.ts`) + `queueAndSync` (`src/lib/sessionSync.ts`, idempotente).
- **Sesión viva:** `src/context/ActiveSessionContext.tsx` (`session`, `isActive`, `start`, `end`); lo lee el shell (`ActiveWorkoutPill`).
- **Ajustes de gym:** `GymSettingsContext`; auth modal: `AuthModalContext`.
- **Rutas:** `src/lib/router.tsx` es el ÚNICO sitio donde se declara un path. Layouts: `AppShell` > `AuthGate`.
- **i18n:** `src/lib/i18n.ts` (`MUSCLE_LABELS_ES`, `translateMuscle`, `EQUIPMENT_LABELS`, `*_LABELS`).
- **Design system:** `src/design/tokens.ts` + primitivas `src/components/ui/`.
- **Catálogo/medios:** `src/lib/catalog/*`, `src/lib/media/*`, `src/data/equipmentMap.ts` (generado).
- **Dominio de entrenamiento:** `src/lib/workout/*`, `src/lib/exercise/*`, `src/lib/ranks/*`, `src/lib/overload.ts`.
- **IA/coach:** `src/lib/ai/*`, `src/lib/coach/*`, `supabase/functions/coach-*`.
- **Deprecado:** `src/components/RoutineBuilder.tsx` → usar el Sheet de `RoutinesPage.tsx`. No añadas código nuevo ahí.

## Dirección objetivo (de `reports/architecture-research/07`)
Cinco capas: `domain` (puro), `data` (Supabase + caché), `features` (pantallas/hooks), `app` (shell/rutas/providers), `platform` (IndexedDB, medios, i18n). Principios: una implementación por pantalla, un dueño por dato, el reloj vive en el reloj, escribir es atómico o no es escribir, el estado derivado no se guarda, la degradación es explícita y observable, un vocabulario por concepto, el bundle es un presupuesto, el tipo de datos es el contrato, el usuario es dueño de sus datos.

## Cómo debe responder Kilo
Indica en 1 línea dónde vive el cambio según el mapa. Si el cambio no cabe, propone la ubicación correcta antes de escribir código.

## Comportamiento Proactivo
- Nueva capa de estado/store/librería → la rechaza o redirige al patrón existente (2 líneas de por qué).
- Detecta archivos huérfanos (`*.backup.tsx`, `ActiveSessionContext.patch.ts`) y duplicados de pantalla; los lista como `[Sugerencia]`, sin borrarlos.

## Anti-patrones
- Segundo store global o segundo escritor de rutinas (el audit encontró seis).
- `fetch`/`supabase` directo desde componentes en flujos de entrenamiento.
- Declarar rutas fuera de `router.tsx`.
- Duplicar una pantalla "para probar".

## Checklist
- [ ] El módulo nuevo está en la ubicación del mapa
- [ ] Un solo dueño por dato
- [ ] Alcanzable desde la app (no código muerto)
- [ ] Imports con `@/` o `@lib/`
