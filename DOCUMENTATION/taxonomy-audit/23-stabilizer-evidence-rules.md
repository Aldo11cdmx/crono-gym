# Fase 3A.2 - Reglas de evidencia para músculos estabilizadores

## Objetivo

Definir reglas independientes para asignar el rol `stabilizer`, sin modificar la matriz piloto.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`
- `DOCUMENTATION/taxonomy-audit/18-vocabulary-corrections.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Definiciones

| Rol | Definición |
|---|---|
| `primary` | Músculo que genera la acción principal del movimiento |
| `secondary` | Músculo que contribuye directamente a la acción, pero no es el principal |
| `stabilizer` | Músculo que estabiliza una articulación, segmento o postura para permitir la acción principal |
| `unknown` | No existe evidencia suficiente para asignar el rol |

## Reglas de asignación

Un músculo puede asignarse como `stabilizer` solo si existe evidencia específica de una de las siguientes funciones:

1. Estabilización isométrica documentada.
2. Estabilización dinámica documentada.
3. Antirrotación documentada.
4. Estabilización postural documentada.
5. Co-contracción documentada.
6. Estabilización de articulaciones adyacentes documentada.

## Fuentes de evidencia permitidas

- Instrucciones explícitas.
- Descripción suficientemente detallada.
- Regla biomecánica experta documentada.
- Otra fuente verificable identificada expresamente.

## Reglas de exclusión

No asignar `stabilizer` cuando:

- El músculo solo aparece como `secondary_muscles`.
- El músculo participa en el movimiento pero no se documenta su función estabilizadora.
- El ejercicio es compuesto pero no existe evidencia específica.
- La estabilidad se infiere por una lista genérica de músculos.
- El nombre del ejercicio sugiere estabilidad sin evidencia.

## Distinciones

| Concepto | Diferencia |
|---|---|
| Participación muscular | El músculo interviene en el movimiento |
| Función motora principal | El músculo genera la acción principal |
| Función sinérgica | El músculo ayuda a la acción principal |
| Función estabilizadora | El músculo mantiene posición o control sin ser el motor principal |

## Aplicación al piloto

- 31 de 49 registros mantienen `muscle_stabilizers=unknown`.
- Los 11 registros high mantienen `muscle_stabilizers=unknown`.
- No se asignaron estabilizadores por intuición.
- La regla reduce falsos positivos, pero no aumenta cobertura artificialmente.

## Incertidumbres

- Muchas instrucciones no documentan estabilización.
- La distinción entre sinergista y estabilizador puede requerir revisión experta.
- La evidencia E2 puede ser insuficiente para movimientos complejos.

## Limitaciones

- No se modificó la matriz.
- No se asignaron estabilizadores nuevos.
- No se validó con biomecánica externa.

## Conclusión

La asignación de `stabilizer` debe exigir evidencia específica. La ausencia de evidencia se registra como `unknown`.
