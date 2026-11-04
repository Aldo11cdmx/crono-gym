# Fase 3A.3.1.1 - Corrección del esquema de evidencia

## Objetivo

Separar la evidencia concreta del nivel de evidencia en la matriz de aprobación.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/40-master-approval-matrix.md`
- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Regla

`evidence` debe referenciar la fuente concreta:

- Campo del catálogo.
- Instrucción del ejercicio.
- Fragmento descriptivo.
- Documento fuente.
- Regla biomecánica documentada.

`evidence_level` debe contener únicamente:

- `E1`: campo estructurado.
- `E2`: instrucciones o descripción.
- `E3`: regla experta explícita y documentada.
- `E4`: nombre del ejercicio, solo como desempate.

No se debe usar `E1`, `E2` o `E3` como si fueran evidencia concreta.

## Ejemplo de corrección

En la matriz original, una fila puede contener:

- `evidence = E1, E2`
- `evidence_level = E1, E2`

La corrección conceptual es:

- `evidence = target, muscle_group, instructions.es`
- `evidence_level = E1, E2`

## Aplicación a las decisiones

| Tipo de decisión | Evidencia típica | Nivel típico |
|---|---|---|
| Reglas de estabilizadores | Instrucciones y reglas biomecánicas | E2, E3 |
| Acciones articulares | Instrucciones | E2 |
| Implementos asistidos | Instrucciones y campos equipment | E1, E2 |
| Músculo primario | target, muscle_group, instructions | E1, E2 |
| Lateralidad | Instrucciones | E2 |

## Incertidumbres

- Algunas instrucciones no documentan estabilización.
- Algunos campos estructurados son contradictorios.
- No se verificó cada fragmento textual en esta fase.

## Limitaciones

- No se modificó la matriz original.
- No se creó una matriz corregida con evidencia textual completa en esta sección; se proporciona la corrección conceptual.

## Conclusión

La evidencia concreta y el nivel de evidencia deben registrarse en campos separados.
