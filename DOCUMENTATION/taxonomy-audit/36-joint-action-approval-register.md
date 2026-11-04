# Fase 3A.3.1 - Registro de aprobación de acciones articulares

## Objetivo

Separar en decisiones independientes las cuatro extensiones articulares propuestas.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/21-joint-action-vocabulary-extension.md`
- `DOCUMENTATION/taxonomy-audit/15-joint-action-review.md`

## Decisiones independientes

### D-JOINT-ANKLE-DORSIFLEXION

| Campo | Detalle |
|---|---|
| ID propuesto | `action.ankle_dorsiflexion` |
| Definición | Movimiento del pie hacia la tibia en el plano sagital |
| Articulación | Tibiotalar |
| Inclusión | El dorso del pie se acerca a la pierna |
| Exclusión | Flexión plantar, circunducción, inversión, eversión, flexión de muñeca |
| Evidencia mínima | Instrucción explícita o descripción biomecánica equivalente |
| Redundancias | Opuesto conceptual de `action.ankle_plantarflexion` |
| Dependencias | Ninguna |
| Consecuencia de aprobar | Permite usar el concepto en futuras clasificaciones |
| Consecuencia de rechazar | El movimiento permanece `unknown` o como combinación |
| Estado | PROPOSED |

### D-JOINT-HIP-FLEXION

| Campo | Detalle |
|---|---|
| ID propuesto | `action.hip_flexion` |
| Definición | Disminución del ángulo entre muslo y tronco por movimiento coxofemoral |
| Articulación | Coxofemoral |
| Inclusión | Elevación del muslo o aproximación del muslo al tronco |
| Exclusión | Flexión del tronco, flexión de rodilla, elevación por inercia |
| Evidencia mínima | Instrucción explícita o descripción equivalente |
| Redundancias | Puede solaparse con `action.trunk_flexion` |
| Dependencias | Ninguna |
| Consecuencia de aprobar | Permite usar el concepto en futuras clasificaciones |
| Consecuencia de rechazar | El movimiento permanece `unknown` o como combinación |
| Estado | PROPOSED |

### D-JOINT-SHOULDER-FLEXION

| Campo | Detalle |
|---|---|
| ID propuesto | `action.shoulder_flexion` |
| Definición | Movimiento del brazo en el plano sagital alrededor de la articulación glenohumeral |
| Articulación | Glenohumeral |
| Inclusión | Elevación anterior del brazo |
| Exclusión | Abducción, aducción, rotación, movimiento escapular |
| Evidencia mínima | Instrucción explícita o descripción equivalente |
| Redundancias | Distinto de `action.shoulder_abduction` |
| Dependencias | Ninguna |
| Consecuencia de aprobar | Permite usar el concepto en futuras clasificaciones |
| Consecuencia de rechazar | El movimiento permanece `unknown` |
| Estado | PROPOSED |

### D-JOINT-SHOULDER-EXTENSION

| Campo | Detalle |
|---|---|
| ID propuesto | `action.shoulder_extension` |
| Definición | Movimiento del brazo en el plano sagital alrededor de la articulación glenohumeral |
| Articulación | Glenohumeral |
| Inclusión | Elevación posterior del brazo |
| Exclusión | Abducción, aducción, rotación, movimiento escapular |
| Evidencia mínima | Instrucción explícita o descripción equivalente |
| Redundancias | Distinto de `action.shoulder_adduction` |
| Dependencias | Ninguna |
| Consecuencia de aprobar | Permite usar el concepto en futuras clasificaciones |
| Consecuencia de rechazar | El movimiento permanece `unknown` |
| Estado | PROPOSED |

## Circunducción

La circunducción de tobillo se mantiene como decisión independiente en `D-CIRC-ANKLE`, separada de las cuatro acciones anteriores.

## Incertidumbres

- Las propuestas no se han aplicado a los 49 registros.
- La utilidad de cada acción depende de evidencia real.

## Limitaciones

- No se modificó el vocabulario consolidado.
- No se asignaron IDs definitivos.

## Conclusión

Las cuatro acciones articulares son decisiones independientes y pueden aprobarse o rechazarse por separado.
