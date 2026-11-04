# Fase 0 - Reconocimiento de taxonomia biomecanica

## 1. Fuente del catalogo

- Archivo: `src/data/exercisesCatalog.json`
- Formato: array JSON de 1,324 registros.
- Hash SHA-256: `6c0e796dd6c914c126f47ba8dbcbbb9e93b446027b6f0160d3f541c76569eec3`
- Campos por registro: `id`, `name`, `category`, `body_part`, `equipment`, `instructions`, `instruction_steps`, `muscle_group`, `secondary_muscles`, `target`, `image`, `gif_url`, `media_id`, `created_at`, `attribution`, `availableInCronosGym`, `equipment_id`, `equipment_name`, `image_urls`.
- Idioma principal del texto: ingles en `name`, `instructions` e `instruction_steps`; espanol presente en `instructions.es`.
- No se encontro una segunda fuente de catalogo dentro del repositorio; los scripts de `src/data` y `scripts/` son transformaciones o auxiliares, no la fuente.

## 2. Transformaciones y derivaciones observadas

- `equipment_id` y `equipment_name` vinculan cada ejercicio con un registro `CG-EQP` y un area de equipo.
- `availableInCronosGym` es un campo derivado o curado presente en el catalogo; no se asume su algoritmo.
- `src/data/equipmentCatalog.ts` define `EQUIPMENT_RULES`, incluyendo un comodin `/.*/`; esto afecta asignacion de equipo, no taxonomia muscular.
- `src/data/myGymEquipment.ts` define tags disponibles y excluidos, pero no IDs `CG-EQP`.
- `src/data/availableEquipment.ts` mapea slugs de ejercicio a IDs `CG-EQP`.

## 3. SmartSwap y exerciseSwap actuales

### SmartSwap (`src/utils/smartSwap.ts`)

Campos comparados: `primaryMuscle`, `secondaryMuscles`, `pattern`, `equipment`, `available` / `equipmentAvailability`.

Puntuacion actual:
- mismo musculo primario: +40
- mismo patron: +25
- musculos secundarios coincidentes: +5, maximo +15
- disponibilidad confirmada: +10
- exclusion: -100

### exerciseSwap (`src/lib/routines/exerciseSwap.ts`)

- Califica si comparte `body_part` (primario) o `target` (secundario).
- Ordena por coincidencia primaria antes que secundaria.
- Usa disponibilidad como criterio de ordenamiento cuando se proporciona el conjunto aplicable.
- No compara patron de movimiento, plano, lateralidad, cadena cinetica ni complejidad.

## 4. Cinco casos reales de mala propuesta actual

| Caso | Fuente | Propuesta actual | Problema biomecanico |
|---|---|---|---|
| 1 | `0025` barbell bench press | `0009` assisted chest dip (kneeling) | Mismo musculo primario, pero distinto patron y distinto implemento |
| 2 | `0027` barbell bent over row | `0015` assisted parallel close grip pull-up | Mismo musculo primario, pero remo horizontal vs traccion vertical |
| 3 | `0032` barbell deadlift | `0090` barbell seated good morning | Mismo musculo primario, pero bisagra de cadera vs extension de tronco sentado |
| 4 | `0001` 3/4 sit-up | `0010` assisted hanging knee raise with throw down | Mismo musculo primario, pero flexion de tronco vs elevacion de rodillas colgando |
| 5 | `0009` assisted chest dip (kneeling) | `0025` barbell bench press | Mismo musculo primario, pero fondos vs press horizontal |

Estos casos son de aceptacion para la futura taxonomia.

## 5. Identificadores y crosswalk actual

- Mapa anatomico: `src/lib/muscleMap.ts` (`MUSCLE_DEFINITIONS`, `enabledSlugs`, `muscleMatchLevel`).
- Etiquetas de musculos: `src/lib/i18n.ts` (`MUSCLE_LABELS_ES`).
- Filtro muscular: `src/lib/muscleFilter.ts`.
- Chips de musculos: `src/components/MuscleSelector.tsx`.
- Mapa de equipamiento: `src/data/equipmentMap.ts` (`CG-EQP-####`).
- Catalogo unificado de equipamiento: `src/data/equipmentCatalog.ts`.
- Tags de equipo del gym: `src/data/myGymEquipment.ts`.
- Mapeo slug de ejercicio a IDs: `src/data/availableEquipment.ts`.
- Ayuda de lookup por nombre: `src/lib/equipmentHelpers.ts`.

La taxonomia futura debe tener crosswalk hacia estos identificadores, sin asignar todavia IDs `CG-EQP` a ejercicios.

## 6. Plan (maximo 12 lineas)

1. Cerrar Fase 0 con fuentes, esquema, transformaciones y crosswalk documentados.
2. Ejecutar Fase 1 con script determinista y CSV de hallazgos.
3. Detenerse en Gate 1 hasta aprobacion explicita.
4. No clasificar ejercicios ni modificar motores en esta fase.
5. No crear migraciones, tablas ni cambios de UI.
6. Conservar `unknown` como valor valido.
7. Usar evidencia E1 a E4 con prioridad documentada.
8. No fusionar duplicados potenciales.
9. Generar solo archivos nuevos en `DOCUMENTATION/taxonomy-audit/`.
10. Usar scripts desechables en `.tmp/taxonomy-audit/`.
11. Reportar hash SHA-256 de la fuente y conteos reproducibles.
12. Esperar aprobacion antes de vocabularios, clasificacion o contrato.
