# Biomechanical Exercise Mapping — Master

## 1. Objetivo

Construir un mapeo biomecánico confiable de los ejercicios del dataset externo, identificando patrones de movimiento, acciones articulares, músculos y evidencia textual.

Este documento consolida el análisis realizado durante la revisión manual de ejercicios.

## 2. Fuente de datos

Dataset:
https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json

Total de ejercicios recuperados: 1324.

## 3. Criterios de revisión

- Analizar instrucciones y pasos en español.
- Separar identidad física del equipo, mecanismo y movimiento biomecánico.
- No asignar máquinas CG-EQP por similitud de nombres.
- No inferir acciones articulares sin evidencia.
- Conservar contradicciones entre nombre, instrucciones y músculos declarados.
- Utilizar unknown cuando la evidencia sea insuficiente.
- No modificar el catálogo ni el runtime durante esta auditoría documental.

## 4. Estado histórico de revisión

Registros revisados históricamente: 310.

Lotes documentados en el historial:
- Lotes 1–9: primeros 170 registros.
- Lote 10: registros 211–230.
- Lote 11: registros 231–270.
- Lote 12: registros 271–310.

Nota: la secuencia y el contenido detallado de los lotes deben reconstruirse desde las conversaciones anteriores. No asumir continuidad de rangos que todavía no se haya verificado.

## 5. Discrepancia del dataset

Recuperación actual:
- Total descargado: 1324.
- Total con instrucciones en español: 1324.
- Total con pasos en español: 1324.
- Total con equipo machine, leverage, cable o smith: 304.
- Total con el filtro combinado: 304.

El historial anterior reportaba 310 registros revisados.

Estado: discrepancia pendiente de reconciliación.

No utilizar Skip 310 sobre el filtro actual hasta resolver la diferencia.

## 6. Hallazgos y contradicciones conocidas

- 0206: cable reverse curl; contradicción entre nombre, agarre e instrucciones.
- 0199: cable pushdown straight arm; las instrucciones describen straight-arm pulldown.
- 0215: cable seated rear lateral raise; las instrucciones describen elevación lateral.
- 0232: cable standing pulldown; target biceps no coincide claramente con el movimiento.
- 0236: cable standing twist row; incluye rotación de torso.
- 1325: nombre behind neck, instrucciones describen barra al pecho.
- 1351: T-bar reverse grip row; instrucciones describen agarre pronado.
- 0754 y 0758: reverse grip en el nombre, pero instrucciones con agarre pronado.
- 1396: nombre toe raise, instrucciones describen elevación de talones.

Estos hallazgos son referencias históricas y deben contrastarse con sus lotes originales.

## 7. Separación respecto al inventario FTS

El mapeo biomecánico externo y la auditoría de identidad física FTS son trabajos independientes.

No se considera confirmada una relación ejercicio-equipo únicamente por:
- Nombre parecido.
- Categoría muscular.
- Campo equipment.
- Similitud visual genérica.

La evidencia del inventario físico debe documentarse por separado.

## 8. Registro de lotes

Cada lote deberá registrar:
- Número y rango.
- IDs y nombres de ejercicios.
- Patrón biomecánico.
- Acciones articulares.
- Músculos implicados.
- Evidencia textual.
- Contradicciones.
- Decisiones y estado de revisión.

## 9. Próximas tareas

1. Recuperar las observaciones originales de los lotes 1–12.
2. Reconciliar los 310 registros históricos con los 304 actuales.
3. Validar el orden y los rangos.
4. Continuar con nuevos lotes de 60 registros.
5. Mantener la auditoría en modo documental.

## 10. Restricciones de seguridad

No modificar:
- src/data/exercisesCatalog.json
- src/data/equipmentMap.ts
- SmartSwap.
- exerciseSwap.
- Contratos ni migraciones.

Cualquier cambio futuro requiere autorización independiente.

## 11. Reconstrucción del historial

- Filtro histórico confirmado: instructions.es, instruction_steps.es y equipment -match 'machine|leverage|cable|smith'.
- Dataset actual: 1324 ejercicios.
- Resultados del filtro actual: 304.
- Rangos solicitados en el historial: posiciones 1–310.
- Se localizaron consultas para las posiciones 171–210.
- Las consultas históricas no demuestran por sí solas que todos los ejercicios fueran analizados individualmente.
- Posiciones 305–310: no disponibles en el conjunto actual.
- Causa de la discrepancia: desconocida; una versión anterior del dataset es solo una hipótesis.
- No continuar con Skip 310 hasta reconciliar la trazabilidad.


## 11. Reconstrucción del historial

- Fuente actual: 1324 ejercicios.
- Filtro aplicado: instrucciones en español, pasos en español y equipo de tipo máquina, palanca, cable o Smith.
- Resultados actuales: 304 ejercicios.
- El historial contiene consultas hasta la posición 310.
- Las posiciones 305 a 310 no aparecen en el conjunto actual.
- La causa de la diferencia todavía es desconocida.
- No asumir que los 310 ejercicios fueron analizados individualmente.
- No continuar con nuevos lotes hasta resolver la trazabilidad.

