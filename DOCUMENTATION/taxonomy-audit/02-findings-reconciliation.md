# Fase 1.1 - Reconciliacion de hallazgos

## Validacion de integridad

- Fuente: `src/data/exercisesCatalog.json`
- Hash SHA-256 verificado: `6c0e796dd6c914c126f47ba8dbcbbb9e93b446027b6f0160d3f541c76569eec3`
- Registros: 1,324
- IDs unicos: 1,324
- IDs nulos: 0
- Campos obligatorios vacios: 0
- Cambio de hash respecto a Fase 1: no

## Clasificacion de los 53 hallazgos

| Clasificacion | Cantidad | Detalle |
|---|---:|---|
| CONFIRMED | 12 | Nombres exactos y normalizados duplicados |
| PROVISIONAL | 0 | - |
| FALSE_POSITIVE | 0 | - |
| UNRESOLVED | 41 | Contradiccion de disponibilidad para ejercicios con `equipment = kettlebell` |

No se descarto ningun hallazgo sin justificacion.

## Impacto

- Los 12 hallazgos de nombres duplicados afectan identidad semantica y deduplicacion futura.
- Los 41 hallazgos de kettlebell afectan la interpretacion de disponibilidad, pero no alteran IDs, nombres ni instrucciones.
- No se detectaron campos obligatorios vacios ni IDs invalidos.

## Resolucion propuesta

- Conservar todos los registros duplicados hasta revision humana.
- Documentar la contradiccion de kettlebell sin cambiar `availableInCronosGym`.
- Verificar la fuente o algoritmo de `availableInCronosGym` antes de usarlo como verdad de inventario.
- No fusionar, renombrar ni eliminar ejercicios en esta fase.
