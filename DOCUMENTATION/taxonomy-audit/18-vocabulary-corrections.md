# Fase 3A.1 - Revisión de vocabulario V-06, V-07, V-08, V-13 y V-14

## Objetivo

Revisar los errores de vocabulario documentados y confirmar que las correcciones siguen vigentes.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`
- `DOCUMENTATION/taxonomy-audit/11-vocabulary-errors.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Resultados

### V-06 - Upper back

- `upper_back` no debe usarse como sustituto de músculos específicos.
- La propuesta mantiene `upper_back` como región/grupo, no como músculo anatómico único.
- Los registros del piloto que usan `muscle.back.upper_back` deben refinarse cuando la evidencia permita distinguir retractores, dorsales o trapecio.

### V-07 - Abs e hip flexors

- `abs` y `hip flexors` no son equivalentes.
- `hip flexors` no debe tratarse como músculo anatómico individual.
- Los conflictos 0003 y 1714 permanecen pendientes por evidencia insuficiente.

### V-08 - Sistema cardiovascular

- El sistema cardiovascular no aparece como músculo esquelético.
- En el piloto se usa como dimensión fisiológica/funcional para ejercicios de cardio.
- Los músculos secundarios se mantienen separados.

### V-13 - Muscle stabilizers

- La participación muscular general no demuestra función estabilizadora.
- En el piloto, `muscle_stabilizers` permanece `unknown` salvo evidencia específica.
- 31 de 49 registros mantienen `unknown`.

### V-14 - Primary joint action

- `unknown` significa evidencia insuficiente.
- `*_complex` significa varias acciones relevantes y documentadas.
- No se usó `complex` como solución genérica para movimientos ambiguos.
- 15 registros mantienen `unknown`.

## Conclusiones

- Las correcciones de V-06, V-07, V-08, V-13 y V-14 siguen vigentes.
- Las incertidumbres restantes son delimitadas y documentadas.
- No se requiere cambio de runtime ni de catálogo.

## Limitaciones

- La refinación muscular depende de evidencia futura.
- No se clasificó el catálogo completo.
