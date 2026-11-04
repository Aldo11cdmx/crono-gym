# Fase 3A.1 - Revisión de 15 acciones articulares unknown

## Objetivo

Revisar los quince registros con `primary_joint_action=unknown`, usando instrucciones y campos estructurados, sin forzar clasificaciones.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`

## Método

Se examinaron descripción e instrucciones. `unknown` se mantiene cuando la evidencia es insuficiente. `*_complex` solo se propone cuando existen varias acciones relevantes y documentadas.

## Resultados

| ID | Nombre | Evidencia disponible | Acción candidata | Conclusión |
|---|---|---|---|---|
| 3220 | astride jumps (male) | Sentadilla, salto explosivo, separación de piernas y brazos | Ninguna acción única dominante | Mantener `unknown`; movimiento multiarticular combinado |
| 3672 | back and forth step | Paso adelante, flexión de rodilla, zancada, retorno | `knee_flexion_extension` o `*_complex` | Candidata documentada; requiere decisión humana |
| 3360 | bear crawl | Desplazamiento en cuatro apoyos con manos y pies | Ninguna acción única dominante | Mantener `unknown`; movimiento multiarticular combinado |
| 1160 | burpee | Sentadilla, flexión de brazos, salto explosivo | Ninguna acción única dominante | Mantener `unknown`; movimiento multiarticular combinado |
| 2331 | cycle cross trainer | Pedaleo continuo en máquina | `knee_flexion_extension` o `*_complex` | Candidata documentada; resistencia sin resolver |
| 1201 | dumbbell burpee | Sentadilla, flexión de brazos, salto con mancuernas | Ninguna acción única dominante | Mantener `unknown`; movimiento multiarticular combinado |
| 1512 | all fours squad stretch | Extensión de pierna, flexión de rodilla, descenso de caderas | `knee_flexion` o `hip_extension` | Candidata documentada; conflicto muscular pendiente |
| 1708 | assisted lying calves stretch | Flexión de rodilla y tracción de dedos hacia el cuerpo | `ankle_dorsiflexion` no existe en el vocabulario | Mantener `unknown`; hueco de vocabulario |
| 1709 | assisted lying glutes stretch | Flexión de rodilla y tracción del muslo hacia el pecho | `hip_flexion` no existe en el vocabulario | Mantener `unknown`; hueco de vocabulario |
| 1710 | assisted lying gluteus and piriformis stretch | Flexión de rodilla y tracción del muslo hacia el pecho | `hip_flexion` no existe en el vocabulario | Mantener `unknown`; hueco de vocabulario |
| 1713 | assisted prone lying quads stretch | Flexión de rodilla y tracción del pie hacia los glúteos | `knee_flexion` | Candidata documentada |
| 1714 | assisted prone rectus femoris stretch | Flexión de rodilla y tracción del pie hacia los glúteos | `knee_flexion` | Candidata documentada; conflicto muscular pendiente |
| 0003 | air bike | Flexión de tronco y pedaleo alternado | `trunk_flexion` o `*_complex` | Candidata documentada; conflicto muscular pendiente |
| 1368 | ankle circles | Rotación circular del tobillo | `ankle_circumduction` no existe en el vocabulario | Mantener `unknown`; hueco de vocabulario |
| 1316 | barbell bent arm pullover | Descenso y elevación de barra detrás de la cabeza con brazos flexionados | `shoulder_extension` o `shoulder_flexion` no existen en el vocabulario | Mantener `unknown`; hueco de vocabulario |

## Conclusiones

- 15 registros mantienen `unknown` o candidatas no forzadas.
- Ninguna clasificación se elevó por nombre del ejercicio.
- Se identificaron huecos del vocabulario para dorsiflexión, flexión de cadera, circunducción de tobillo y flexión/extensión de hombro.
- `*_complex` no se usó como solución genérica.

## Limitaciones

- No se modificó el vocabulario ni el catálogo.
- Las candidatas requieren validación humana.
