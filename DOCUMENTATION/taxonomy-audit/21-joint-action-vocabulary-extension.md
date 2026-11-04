# Fase 3A.2 - Extensión propuesta del vocabulario articular

## Objetivo

Analizar huecos detectados en `primary_joint_action` y proponer extensiones conceptuales sin modificar el vocabulario aprobado.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`
- `DOCUMENTATION/taxonomy-audit/15-joint-action-review.md`
- `src/data/exercisesCatalog.json`

## Método

Se revisaron instrucciones y campos estructurados de los quince casos con acción articular `unknown`. Cada propuesta se identifica como propuesta, no como vocabulario aprobado.

## Resultados

### 1. Dorsiflexión de tobillo

| Elemento | Detalle |
|---|---|
| ID propuesto | `action.ankle_dorsiflexion` |
| Etiqueta es-MX | Dorsiflexión de tobillo |
| Definición | Movimiento del pie hacia la tibia en el plano sagital |
| Articulación | Tibiotalar |
| Movimiento observable | El dorso del pie se acerca a la pierna |
| No debe clasificarse | Flexión plantar, circunducción, inversión, eversión, flexión de muñeca |
| Evidencia mínima | Instrucción explícita o descripción biomecánica equivalente |
| `unknown` | Si solo existe el nombre del ejercicio o una imagen aislada |

### 2. Flexión de cadera

| Elemento | Detalle |
|---|---|
| ID propuesto | `action.hip_flexion` |
| Etiqueta es-MX | Flexión de cadera |
| Definición | Disminución del ángulo entre muslo y tronco por movimiento de la articulación coxofemoral |
| Articulación | Coxofemoral |
| Movimiento observable | Elevación del muslo o aproximación del muslo al tronco |
| No debe clasificarse | Flexión del tronco, flexión de rodilla, elevación de piernas por inercia |
| Evidencia mínima | Instrucción explícita o descripción equivalente |
| `unknown` | Si la flexión de cadera no está documentada o no es distinguible de la flexión del tronco |

### 3. Circunducción de tobillo

| Elemento | Detalle |
|---|---|
| ID propuesto | `action.ankle_circumduction` |
| Etiqueta es-MX | Circunducción de tobillo |
| Definición | Movimiento combinado de flexión, extensión, abducción y aducción del tobillo en secuencia circular |
| Articulación | Tibiotalar y articulaciones adyacentes |
| Movimiento observable | Rotación circular del pie |
| No debe clasificarse | Flexión plantar aislada, dorsiflexión aislada, inversión o eversión |
| Evidencia mínima | Instrucción explícita de rotación circular |
| `unknown` | Si el movimiento no está descrito o puede representarse mejor como combinación de acciones existentes |

Observación: este ID es potencialmente redundante. Debe decidirse si se modela como acción independiente o como combinación de acciones existentes.

### 4. Flexión y extensión de hombro

| Elemento | Detalle |
|---|---|
| IDs propuestos | `action.shoulder_flexion`, `action.shoulder_extension` |
| Etiqueta es-MX | Flexión de hombro / Extensión de hombro |
| Definición | Movimiento del brazo en el plano sagital alrededor de la articulación glenohumeral |
| Articulación | Glenohumeral |
| Movimiento observable | Elevación anterior o posterior del brazo |
| No debe clasificarse | Abducción, aducción, rotación, elevación o retracción escapular |
| Evidencia mínima | Instrucción explícita o descripción equivalente |
| `unknown` | Si la escápula o el tronco dominan el movimiento |

## Relación con IDs existentes

| ID existente | Relación |
|---|---|
| `action.ankle_plantarflexion` | Opuesto conceptual a dorsiflexión |
| `action.knee_flexion` | Relacionado, pero no equivalente a flexión de cadera |
| `action.knee_extension` | Relacionado, pero no equivalente a extensión de cadera |
| `action.shoulder_abduction` | Distinto de flexión de hombro |
| `action.shoulder_adduction` | Distinto de extensión de hombro |
| `action.scapular_elevation_retraction` | Distinto del movimiento glenohumeral |

## Posibles redundancias

- `action.ankle_circumduction` puede ser redundante si se modela como combinación de dorsiflexión, flexión plantar, abducción y aducción.
- `action.hip_flexion` puede solaparse con `action.trunk_flexion` en ejercicios donde ambos movimientos ocurren simultáneamente.
- `action.shoulder_flexion` y `action.shoulder_extension` requieren separación clara respecto a movimientos escapulares.

## Casos que requieren decisión experta

- Si circunducción de tobillo debe ser acción independiente o combinación.
- Si flexión de cadera debe priorizarse sobre flexión del tronco en movimientos simultáneos.
- Si la extensión de hombro se distingue con suficiente claridad en instrucciones reales.

## Incertidumbres

- Las propuestas no se han aplicado a los 49 registros.
- No se ha validado su uso en todo el catálogo.
- La utilidad de circunducción como ID independiente no está demostrada.

## Limitaciones

- Propuesta documental únicamente.
- No modifica `06-controlled-vocabularies.md`.
- No crea contrato de datos.

## Conclusión

La extensión es conceptualmente útil para dorsiflexión, flexión de cadera y flexión/extensión de hombro. La circunducción de tobillo requiere decisión experta antes de aceptarse como ID independiente.
