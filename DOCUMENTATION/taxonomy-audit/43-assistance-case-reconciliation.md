# Fase 3A.3.1.1 - Reconciliación de casos asistidos 1708-1714

## Objetivo

Verificar la existencia y el estado de los casos asistidos mencionados en la Fase 3A.2.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `DOCUMENTATION/taxonomy-audit/13-low-confidence-review.md`
- `DOCUMENTATION/taxonomy-audit/37-assisted-equipment-approval-register.md`

## Método

Se consultó el catálogo original en modo lectura para los IDs 1708-1714 y se verificó su presencia en la matriz piloto de 49 ejercicios.

## Resultados

| ID | Existencia en catálogo | Presencia en piloto | Nombre original | Evidencia disponible | Estado de revisión | Decisión requerida | Motivo |
|---|---|---|---|---|---|---|---|
| 1708 | Sí | Sí | assisted lying calves stretch | Instrucción de estiramiento con manos o toalla | needs_human_review | Implemento, resistencia, asistencia, lateralidad | Evidencia insuficiente |
| 1709 | Sí | Sí | assisted lying glutes stretch | Instrucción de estiramiento con agarre del muslo | needs_human_review | Implemento, resistencia, asistencia, lateralidad | Evidencia insuficiente |
| 1710 | Sí | Sí | assisted lying gluteus and piriformis stretch | Instrucción de estiramiento con agarre del muslo | needs_human_review | Implemento, resistencia, asistencia, lateralidad, modelado de piriforme | Evidencia insuficiente |
| 1711 | No | No | No existe en el catálogo | Ninguna | No aplica | Ninguna | ID inexistente en la fuente |
| 1712 | Sí | No | assisted side lying adductor stretch | Instrucción de estiramiento lateral con superficie de apoyo | No revisado en el piloto | No incluido en la muestra de 49 | Fuera del piloto, no es decisión pendiente de la matriz |
| 1713 | Sí | Sí | assisted prone lying quads stretch | Instrucción de estiramiento prono con mano o toalla | needs_human_review | Implemento, resistencia, asistencia, lateralidad | Evidencia insuficiente |
| 1714 | Sí | Sí | assisted prone rectus femoris stretch | Instrucción de estiramiento prono con mano o toalla | needs_human_review | Implemento, resistencia, asistencia, lateralidad, músculo primario | Evidencia insuficiente |

## Conclusiones

- El intervalo `1708`-`1714` no corresponde a siete decisiones válidas en el piloto.
- `1711` no existe en el catálogo y no puede ser una decisión.
- `1712` existe, pero no forma parte de la muestra de 49 y no tiene decisión pendiente en la matriz.
- Los cinco casos incluidos en el piloto permanecen pendientes por evidencia insuficiente.

## Incertidumbres

- No se conoce el equipo asistido exacto para los cinco casos.
- No se conoce la lateralidad.
- No se conoce el sistema de resistencia.

## Limitaciones

- No se modificó el catálogo.
- No se clasificaron ejercicios nuevos.

## Conclusión

Los casos asistidos válidos en el piloto son cinco. `1711` es inexistente y `1712` está fuera de la muestra.
