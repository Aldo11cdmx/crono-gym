# Diseño Técnico de Integración Equipamiento — Cronos Gym

> Estado: LISTO PARA APROBACIÓN ARQUITECTÓNICA (documental, sin implementación).
> Único archivo modificado en esta fase: este Markdown.

---

## 0. Resumen ejecutivo

- `src/data/myGymEquipment.ts`: `GymMachine { name, group, tags }`, `MY_GYM_MACHINES` (32 entradas), `MY_GYM_EQUIPMENT_TAGS`, `UNAVAILABLE_EQUIPMENT` (16 tags), `MY_GYM_GROUPS`, `isAvailableInMyGym(equipment)`, `FREE_WEIGHTS_AVAILABLE`.
- `src/data/equipmentMap.ts`: generado (`// Generated from equipment images`), `equipmentMap: Record<string, EquipmentData>` con claves `CG-EQP-####`, `getEquipmentViews(id)`. 73 claves únicas; `CG-EQP-0058` ausente.
- `src/utils/smartSwap.ts`: scoring biomecánico (primario +40, patrón +25, secundarios +5 máx 15, available +10, exclude -100).
- `src/lib/routines/exerciseSwap.ts`: swap por músculo (body_part/target) con ranking por disponibilidad.
- Dos motores separados, no unificados. Pesos son contrato de regresión.

Leyenda: [HECHO] verificado en código; [INFERENCIA] deducido; [RECOMENDACIÓN] propuesta no implementada; [PENDIENTE] sin evidencia suficiente.

---

## 1. Rutas y referencias de código

| Archivo | Símbolo | Uso real |
|---|---|---|
| `src/data/myGymEquipment.ts:13` | `GymMachine` | inventario físico declarado |
| `src/data/myGymEquipment.ts:25` | `FREE_WEIGHTS_AVAILABLE` | switch de free weights |
| `src/data/myGymEquipment.ts:27` | `MY_GYM_MACHINES` | 32 entradas |
| `src/data/myGymEquipment.ts:72` | `MY_GYM_EQUIPMENT_TAGS` | set de tags disponibles |
| `src/data/myGymEquipment.ts:79` | `UNAVAILABLE_EQUIPMENT` | 16 tags (export muerto) |
| `src/data/myGymEquipment.ts:98` | `MY_GYM_GROUPS` | grupos (export muerto) |
| `src/data/myGymEquipment.ts:100` | `isAvailableInMyGym` | consumido por exerciseSwap y UnifiedExerciseSelectorSheet |
| `src/data/equipmentMap.ts:7` | `EquipmentData { id, name, views }` | media por registro |
| `src/data/equipmentMap.ts:614` | `getEquipmentViews` | resolución de vistas |
| `src/lib/equipmentHelpers.ts:3` | `getEquipmentIdByName` | lookup por nombre exacto |
| `src/lib/routines/exerciseSwap.ts:16` | `SwapCandidate.equipmentAvailable` | compatibilidad booleana |
| `src/lib/routines/exerciseSwap.ts:31` | `availableEquipment` | conjunto opcional |
| `src/lib/routines/exerciseSwap.ts:51` | `findSwapCandidates` | swap por músculo + equipo |
| `src/lib/routines/exerciseSwap.ts:115` | `findAllSwapCandidates` | sin filtro de equipo |
| `src/lib/routines/exerciseSwap.ts:132` | `filterByEquipment` | filtro posterior |
| `src/lib/routines/exerciseSwap.ts:144` | `exerciseAvailableInMyGym` | conveniencia |
| `src/utils/smartSwap.ts:7` | `ExerciseLite.available` | compatibilidad booleana |
| `src/utils/smartSwap.ts:20` | `smartSwap` | scoring biomecánico |
| `src/components/UnifiedExerciseSelectorSheet.tsx:273` | filtro `onlyMyGym` | filtro UI |

---

## 2. Interfaces actuales

- `GymMachine { name, group, tags }` (`myGymEquipment.ts:13-18`).
- `EquipmentData { id, name, views }`, `EquipmentView { id, src }` (`equipmentMap.ts:7-11`).
- `ExerciseLite { id, name, primaryMuscle, secondaryMuscles?, pattern?, equipment?, available? }` (`smartSwap.ts:1-9`).
- `SwapCandidate { exercise, primaryMatch, secondaryMatch, equipmentAvailable }` (`exerciseSwap.ts:16-24`).

Compatibilidad: `SwapCandidate.equipmentAvailable: boolean` no distingue `unavailable` de `unknown`. Evolución futura aditiva: añadir `equipmentAvailability?: 'available'|'unavailable'|'unknown'` manteniendo el booleano. No se modifican interfaces en esta fase.

---

## 3. Conteos verificados (fuente única de verdad)

| Elemento | Resultado |
|---|---:|
| Entradas en `MY_GYM_MACHINES` | 32 |
| Claves únicas en `equipmentMap` | 73 |
| Identificador ausente | `CG-EQP-0058` |
| Vistas de `CG-EQP-0022` | 8 |

Reglas: las 32 entradas no demuestran 32 máquinas físicas únicas; las 73 claves son registros CG-EQP, no fotografías ni máquinas; no se infiere número de fotografías ni de máquinas físicas; `CG-EQP-0058` se documenta ausente, no se crea, reserva ni asigna automáticamente; no se fusionan registros por nombres repetidos.

---

## 4. Disponibilidad — contrato canónico

`EquipmentAvailability = available | unavailable | unknown`

- **available**: disponibilidad confirmada por una fuente válida para el contexto consultado.
- **unavailable**: indisponibilidad confirmada.
- **unknown**: información insuficiente, incompleta o contradictoria.

### 4.1 Alcance de `availableEquipment` (ReadonlySet)

`ReadonlySet<string>` no expresa por sí mismo si el inventario es completo o parcial.

Tres escenarios:

- **A. Conjunto completo y explícito**: pertenencia → available; ausencia puede ser unavailable solo si la completitud es confiable.
- **B. Conjunto parcial o de preferencias**: pertenencia confirma disponibilidad solo si el contrato del consumidor lo garantiza; ausencia → unknown.
- **C. Conjunto vacío**: no se interpreta automáticamente como gimnasio sin equipamiento; depende de si fue declarado completo o parcial; si no hay información → unknown.

[RECOMENDACIÓN] Contrato futuro: declarar alcance y completitud explícitamente (p. ej. `{ tags: ReadonlySet<string>; complete: boolean }`). Interpretación: pertenencia confirma disponibilidad solo si el contrato lo garantiza; ausencia en conjunto completo → unavailable; ausencia en conjunto parcial → unknown; conjunto vacío → unknown salvo declaración de completitud. Esto es propuesta, no implementación existente.

### 4.2 Precedencia de fuentes (por alcance, no universal)

| Fuente | Qué demuestra | Qué no demuestra |
|---|---|---|
| `availableEquipment` | disponibilidad dentro del alcance declarado | inventario completo si no se declara |
| `MY_GYM_EQUIPMENT_TAGS` | presencia de tags derivados del inventario estático | existencia de cada máquina física |
| `UNAVAILABLE_EQUIPMENT` | exclusión explícita de tags | ausencia física universal fuera de contexto |
| `cgEqpId` / `equipmentMap` | identidad o localización de un registro visual | disponibilidad física |
| Fallback por nombre normalizado | posible coincidencia textual | identidad física inequívoca |

Reglas: fuentes con alcances distintos no se comparan como equivalentes; contradicción entre fuentes aplicables → unknown; ausencia no demuestra indisponibilidad si la fuente no es completa; identidad visual no confirma existencia física; nombre normalizado no garantiza identidad.

### 4.3 Compatibilidad con booleanos

Traducción conservadora (pérdida de información, solo para consumidores antiguos): available→true, unavailable→false, unknown→false. No es el modelo interno canónico.

### 4.4 Filtros, penalizaciones y preferencias

- **Filtro obligatorio**: `requireEquipment` exige disponibilidad confirmada cuando el contrato lo establece.
- **Penalización de scoring**: `excludeEquipment` aplica -100 cuando la exclusión está confirmada y corresponde al contexto. No es descarte absoluto garantizado (verificar si existe filtro posterior).
- **Preferencia de ordenamiento**: `availableEquipment` prioriza candidatos; no debe convertirse en filtro obligatorio.

| Estado | requireEquipment | excludeEquipment | Preferencia | +10 SmartSwap |
|---|---|---|---|---|
| available | cumple | sin penalización | puede priorizarse | sí, si el contrato lo confirma |
| unavailable | no cumple | -100 si aplica | prioridad inferior | no |
| unknown | no cumple requisito que exige confirmación | sin penalización no confirmada | sin promoción positiva | no |

Pesos biomecánicos no se modifican.

### 4.5 SmartSwap — comportamiento actual vs contrato futuro

[HECHO] En `src/utils/smartSwap.ts:35`, la bonificación se aplica con `if (b.available !== false) { s += 10; }`. Esto otorga +10 cuando `available` es `true` o `undefined`. Por tanto, el comportamiento actual puede bonificar candidatos cuya disponibilidad no está confirmada.

[RECOMENDACIÓN] Contrato futuro: únicamente `available` confirmado recibe +10; `unavailable` y `unknown` no lo reciben. Esto es una propuesta, no el comportamiento actual.

---

## 5. CG-EQP — definición canónica

- **Máquina física**: objeto tangible instalado en el gimnasio.
- **Estación**: punto de trabajo funcional.
- **Configuración**: forma concreta de utilizar una estación.
- **Accesorio**: elemento físico intercambiable o compartido.
- **Registro CG-EQP**: entrada identificada por `CG-EQP-####` en `equipmentMap`.
- **Vista**: recurso visual contenido en un registro.

Regla fundamental: un registro CG-EQP no equivale necesariamente a una máquina física, una estación o una fotografía individual.

`EquipmentData { id, name, views }`, `EquipmentView { id, src }`. Hechos: un registro contiene un conjunto de vistas (relación estructural 1:N); no se conoce qué estación representa cada vista; el registro no equivale a máquina física; no se asume que cada vista es una fotografía independiente de una misma estación. `EquipmentData.id` es la identidad del registro CG-EQP; `EquipmentData.name` es el nombre del registro; `EquipmentView.src` es la ruta del recurso visual.

### Caso CG-EQP-0022

Contiene 8 vistas que representan estaciones o configuraciones funcionales distintas de la torre de poleas (poleas individuales, jalón al pecho, remo sentado, polea alta). No son 8 máquinas físicas independientes ni 8 ángulos de una sola estación. No se inventa correspondencia vista→estación.

### Cardinalidades

- Máquina física 1:N estaciones: conceptual.
- Estación 1:N configuraciones: conceptual.
- Configuración N:M accesorios: conceptual.
- Registro CG-EQP N:M estaciones: posible, pendiente de mapeo.
- Registro CG-EQP 1:N vistas: estructural.
- Vista → estación: pendiente de evidencia.

Parsimonia: **alternativa A** (estructura actual + mapeo explícito mínimo). Alternativa B (estructura intermedia) futura, no requisito.

---

## 6. SmartSwap vs exerciseSwap

Motores separados, sin unificación inmediata.

**smartSwap** (`src/utils/smartSwap.ts`): primario +40, patrón +25, secundarios +5 c/u máx +15, disponibilidad confirmada +10, exclusión -100.

**exerciseSwap** (`src/lib/routines/exerciseSwap.ts`): coincidencia primaria antes que secundaria; disponibilidad como criterio de ordenamiento cuando se proporciona el conjunto aplicable; comportamiento actual mantenido.

Cualquier unificación futura requiere tests de equivalencia, comparación de rankings, conservación de criterios musculares y pesos, y aprobación explícita.

---

## 7. Identidad y mapeo (propuesta futura)

- `cgEqpId?: string` opcional en `GymMachine`.
- Mapa versionado `MACHINE_TO_CG_EQP`.
- Fallback normalizado (lowercase, trim, normalización de espacios, eliminación de acentos) para búsqueda textual.

Normalizar nombres no garantiza identidad. Coincidencia ambigua → unknown. ID inexistente no genera disponibilidad. Nombres repetidos no se fusionan. No se modifican interfaces en esta fase.

---

## 8. Relaciones entre myGymEquipment y equipmentMap

[HECHO] No hay relación directa por ID ni foreign key. `myGymEquipment` trabaja con tags de catálogo y nombres de máquina; `equipmentMap` con IDs `CG-EQP-####` y nombres de archivo de foto. Conexión indirecta y manual. `getEquipmentIdByName` hace match por `data.name === name` exacto, frágil. `equipmentMap` es generado por `scripts/generate-map.cjs`; `myGymEquipment` mantenido a mano. `EquipmentData.name` es el nombre del registro; `EquipmentView.src` es la ruta del recurso visual; no se afirma que `name` contenga nombres de archivos.

---

## 9. Flujo de disponibilidad y persistencia

[HECHO] Flujo actual:
1. `MY_GYM_MACHINES` → `MY_GYM_EQUIPMENT_TAGS`.
2. `isAvailableInMyGym(equipment)` consulta el set.
3. `UnifiedExerciseSelectorSheet` filtra con `onlyMyGym`.
4. `findSwapCandidates` marca `equipmentAvailable` usando `availableEquipment` o fallback.
5. `smartSwap` usa `b.available !== false` para bonificar +10.

[HECHO] No hay persistencia de equipo por usuario verificada: no se encontró tabla Supabase ni store IndexedDB. `availableEquipment` es `ReadonlySet` opcional inyectado. La configuración del gym es estática y compilada.

---

## 10. Modelo de datos propuesto (futuro, no implementado)

[RECOMENDACIÓN] Entidad intermedia que vincule `cgEqpId` ↔ `machineName` ↔ `catalogTags`, con configuraciones para la torre de poleas. Persistencia opcional futura: tabla `user_gym_equipment` con RLS (sin migración en esta fase).

---

## 11. Archivos afectados (si se implementara)

`src/data/myGymEquipment.ts`, `src/data/equipmentMap.ts` (generado), `src/lib/equipmentHelpers.ts`, `src/lib/routines/exerciseSwap.ts`, `src/utils/smartSwap.ts`, `src/components/UnifiedExerciseSelectorSheet.tsx`, `scripts/generate-map.cjs`, tests (`exerciseSwap.test.ts`, `smartSwap.test.ts`, catalog tests).

`UNAVAILABLE_EQUIPMENT` y `MY_GYM_GROUPS` son exports muertos: no eliminar sin verificar referencias dinámicas.

---

## 12. Riesgos

- Romper el filtro "Mi Gym" si se cambia la semántica de tags.
- `equipmentMap` generado: edición manual se sobrescribe.
- Nombres no normalizados → lookups fallan.
- Compatibilidad offline: equipo estático, sin cola.
- Torre de poleas: 8 vistas = estaciones/configuraciones, no 8 máquinas.
- Conjuntos incompletos interpretados como indisponibilidad.

---

## 13. Matriz de pruebas propuestas (no ejecutadas)

**Disponibilidad**: equipo disponible, no disponible, desconocido, ID inexistente, tag desconocido, cgEqpId ausente, consumidor booleano antiguo, undefined sin +10.

**SmartSwap**: pesos exactos 40/25/15/10/-100; unknown sin bonificación; exclusión confirmada; exclusión desconocida; requerimiento obligatorio; empates orden estable; sin alteración de ranking.

**exerciseSwap**: primaria antes de secundaria; disponible confirmado antes que desconocido; sin/con availableEquipment; compatibilidad equipmentAvailable.

**Inventario**: CG-EQP-0022 con 8 vistas; varias estaciones por registro; accesorios compartidos; nombres repetidos con IDs distintos; ID faltante CG-EQP-0058; GymMachine sin cgEqpId.

**Integración**: filtro onlyMyGym; catálogo real; compatibilidad offline; ausencia de cambios en persistencia.

Criterios de aceptación: typecheck 0, tests del área en verde, pesos biomecánicos sin cambios.

---

## 14. Plan incremental (propuesto, no ejecutado)

1. Documentar modelo y contrato (este informe) — hecho.
2. Normalizar lookup (case/acento-insensitive) — futuro.
3. Unificar smartSwap/exerciseSwap — futuro, con tests de equivalencia.
4. Persistencia por usuario (migración + RLS) — futuro, requiere aprobación.
5. UI de configuración de equipo — futuro.

---

## 15. Validación documental

- Caracteres de control: 0 (verificado por lectura de bytes).
- Nombres corruptos corregidos: body_part, target, requireEquipment, availableEquipment, findSwapCandidates.
- `git status --short` ejecutado: cambio propio únicamente en este Markdown; cambios preexistentes en `src/` preservados sin modificación.

---

## 16. Decisiones pendientes (aprobación humana)

1. Adopción del modelo estación/configuración/accesorio.
2. Unificación de motores (con tests de equivalencia).
3. Añadir `cgEqpId` aditivo a `GymMachine`.
4. Normalizar lookup de nombres.
5. Crear o documentar el hueco `CG-EQP-0058`.
6. Mapeo vista→estación para CG-EQP-0022.

---

## 17. Entrega

Estado final: LISTO PARA APROBACIÓN ARQUITECTÓNICA.

No se declaró la Fase 3 aprobada automáticamente. La aprobación corresponde exclusivamente al propietario del repositorio. No se implementó código, no se instalaron dependencias, no se ejecutaron migraciones, no se hicieron commits ni deploys.
