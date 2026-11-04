# Fase 3A.3 - Evaluación de la taxonomía de asistencia y equipamiento

## Objetivo

Evaluar la propuesta de `22-assisted-equipment-taxonomy.md` sin convertirla en vocabulario aprobado.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/22-assisted-equipment-taxonomy.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `src/data/exercisesCatalog.json`

## Casos de referencia

Los ejercicios `1708`-`1714` se usan como referencia documental. Sus clasificaciones no se modifican.

## Evaluación

| Concepto | Suficientemente definido | Redundante | Solapado | Requiere aprobación humana |
|---|---|---|---|---|
| implement_primary | Sí | No | No | No |
| implement_auxiliary | Parcial | No | Sí, con implement_primary | Sí |
| support_surface | Sí | No | Sí, con implement_auxiliary | Sí |
| resistance_system | Sí | No | No | No |
| assistance_mechanism | Parcial | No | Sí, con resistance_system | Sí |
| assistance_type | Parcial | No | Sí, con assistance_mechanism | Sí |

## Conceptos suficientemente definidos

- `implement_primary`
- `resistance_system`

## Conceptos redundantes

No se identifican redundancias completas, pero `implement_auxiliary` y `support_surface` pueden solaparse en ejercicios donde el soporte también modifica la ejecución.

## Conceptos que se solapan

- `assistance_mechanism` y `resistance_system` pueden confundirse si el mecanismo de asistencia también genera carga.
- `implement_auxiliary` y `support_surface` pueden confundirse si el accesorio también sirve de soporte.

## Casos de referencia

| ID | Evidencia disponible | Elementos desconocidos | Conclusión |
|---|---|---|---|
| 1708 | Estiramiento con manos o toalla | Implemento, resistencia, asistencia, lateralidad | Incertidumbre documentada |
| 1709 | Estiramiento con agarre del muslo | Implemento, resistencia, asistencia, lateralidad | Incertidumbre documentada |
| 1710 | Estiramiento con agarre del muslo | Implemento, resistencia, asistencia, lateralidad, piriforme no modelado | Incertidumbre documentada |
| 1713 | Estiramiento prono con mano o toalla | Implemento, resistencia, asistencia, lateralidad | Incertidumbre documentada |
| 1714 | Estiramiento prono con mano o toalla | Implemento, resistencia, asistencia, lateralidad, músculo primario | Incertidumbre documentada |

## Incertidumbres

- El equipo asistido exacto no está documentado.
- La asistencia puede ser manual, con banda, contrapeso o máquina.
- La lateralidad no está documentada.

## Limitaciones

- No se modificó la matriz.
- No se asignó implemento por nombre.

## Conclusión

La separación conceptual es útil, pero requiere aprobación humana y evidencia adicional antes de aplicarse.
