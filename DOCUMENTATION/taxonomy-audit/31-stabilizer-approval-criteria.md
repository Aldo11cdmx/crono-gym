# Fase 3A.3 - Criterios de aprobación del rol estabilizador

## Objetivo

Establecer criterios de aprobación para el rol `stabilizer`, sin asignar estabilizadores a los 49 ejercicios.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/23-stabilizer-evidence-rules.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `DOCUMENTATION/taxonomy-audit/16-high-confidence-validation.md`

## Criterios mínimos de aprobación

Un músculo puede asignarse como `stabilizer` solo si existe evidencia de al menos una de las siguientes funciones:

1. Estabilización isométrica documentada.
2. Estabilización dinámica documentada.
3. Antirrotación documentada.
4. Estabilización postural documentada.
5. Co-contracción documentada.
6. Estabilización de articulaciones adyacentes documentada.

## Fuentes de evidencia

- Instrucciones explícitas.
- Descripción suficientemente detallada.
- Regla biomecánica experta documentada.
- Otra fuente verificable identificada expresamente.

## Lo que no es evidencia suficiente

- Aparición en `secondary_muscles`.
- Participación general en un movimiento compuesto.
- Lista genérica de músculos implicados en un patrón.
- Nombre del ejercicio.
- Imagen aislada.

## Distinciones

| Concepto | Definición |
|---|---|
| Función motora principal | Genera la acción principal |
| Sinergia | Ayuda a la acción principal |
| Estabilización | Mantiene posición o control sin ser motor principal |

## Aplicación al piloto

- 31 de 49 registros mantienen `muscle_stabilizers=unknown`.
- Los 11 registros high mantienen `muscle_stabilizers=unknown`.
- No se asignaron estabilizadores por intuición.

## Incertidumbres

- Muchas instrucciones no documentan estabilización.
- La distinción entre sinergista y estabilizador puede requerir revisión experta.
- La evidencia E2 puede ser insuficiente para movimientos complejos.

## Limitaciones

- No se modificó la matriz.
- No se asignaron estabilizadores nuevos.
- No se validó con biomecánica externa.

## Conclusión

El rol `stabilizer` requiere evidencia específica. La ausencia de evidencia se registra como `unknown`.
