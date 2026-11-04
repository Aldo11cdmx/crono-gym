# Fase 3A.4.2 - Formalización de aprobaciones humanas, Bloque B: decisiones articulares y circunducción

## Objetivo

Registrar formalmente las cinco decisiones aprobadas explícitamente por el propietario del proyecto para el Bloque B — decisiones articulares y circunducción.

## Autoridad de aprobación

- `approval_type`: human
- `approved_by`: project_owner
- `approval_date`: 2026-11-03
- `approval_scope`: conceptual con ajustes
- `implementation_status`: NOT_IMPLEMENTED

La aprobación fue expresada por el propietario del proyecto en esta conversación. No se atribuye a Kilo, a un agente ni a un modelo.

## Decisiones formalizadas

### D-JOINT-ANKLE-DORSIFLEXION

Estado: `APPROVED WITH ADJUSTMENTS`

Ajustes registrados:

- La dorsiflexión ocurre en la articulación del tobillo, no únicamente en los dedos.
- Exigir evidencia del movimiento del pie hacia la tibia.
- Conservar `unknown` cuando no esté claro.

### D-JOINT-HIP-FLEXION

Estado: `APPROVED WITH ADJUSTMENTS`

Ajustes registrados:

- La flexión ocurre entre el muslo y la pelvis en la articulación coxofemoral.
- No inferirla únicamente por elevación de rodillas.
- Permitir acciones simultáneas de cadera y tronco cuando estén documentadas.
- Si no se distinguen, conservar `unknown`.

### D-JOINT-SHOULDER-FLEXION

Estado: `APPROVED WITH ADJUSTMENTS`

Ajustes registrados:

- Definir la flexión como desplazamiento anterior del húmero respecto al tronco mediante la articulación glenohumeral.
- Permitir la participación escapular fisiológica sin convertirla automáticamente en `unknown`.
- Diferenciarla de elevación y retracción escapular.
- Permitir acciones combinadas de flexión y abducción cuando estén documentadas.
- Si no se identifica el movimiento, conservar `unknown`.

### D-JOINT-SHOULDER-EXTENSION

Estado: `APPROVED WITH ADJUSTMENTS`

Ajustes registrados:

- Definir la extensión como desplazamiento posterior del húmero respecto al tronco mediante la articulación glenohumeral, en el plano sagital.
- Permitir la participación escapular fisiológica sin convertirla automáticamente en `unknown`.
- Diferenciar extensión glenohumeral de retracción escapular y aducción.
- Permitir acciones simultáneas de extensión y aducción cuando estén documentadas.
- No confundir el movimiento del tronco con extensión de hombro.
- Si no se identifica el movimiento glenohumeral, conservar `unknown`.

### D-CIRC-ANKLE

Estado: `APPROVED WITH ADJUSTMENTS`

Ajustes registrados:

- Mantener la circunducción de tobillo como concepto descriptivo.
- No crear todavía un ID taxonómico independiente.
- Representar acciones componentes solo cuando estén documentadas y el modelo permita expresarlas.
- No inferir automáticamente los cuatro movimientos por observar una trayectoria circular.
- Si no se identifican los componentes, conservar el concepto descriptivo y `unknown` para las acciones no demostradas.

IMPORTANTE: D-CIRC-ANKLE aprueba la representación descriptiva. NO aprueba crear `action.ankle_circumduction`.

## Exclusiones

Esta formalización no implica:

- Clasificación de los 49 ejercicios.
- Creación de instancias individuales.
- Creación de IDs taxonómicos nuevos.
- Implementación de acciones articulares en runtime.
- Modificación de `exercisesCatalog.json`.
- Ejecución de regresión.
- Aprobación de otras decisiones.
- Inicio de Fase 3B.

## Limitaciones

- Las reglas aprobadas no se han aplicado a los ejercicios.
- No se han creado instancias individuales.
- No se ha implementado el vocabulario en runtime.
- La evidencia de estabilización y acciones articulares sigue siendo insuficiente en muchos casos.

## Estado de implementación

`NOT_IMPLEMENTED`

## Conclusión

Las cinco decisiones del Bloque B quedan formalmente aprobadas con ajustes. Las 19 decisiones restantes permanecen `PROPOSED`.
