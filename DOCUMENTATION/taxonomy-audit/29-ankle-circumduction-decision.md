# Fase 3A.3 - Decisión sobre circunducción de tobillo

## Objetivo

Evaluar las alternativas para representar la circunducción de tobillo sin aprobar automáticamente una opción.

## Fuentes consultadas

- `DOCUMENTATION/taxonomy-audit/21-joint-action-vocabulary-extension.md`
- `DOCUMENTATION/taxonomy-audit/15-joint-action-review.md`
- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`

## Alternativas

### Alternativa 1: Identificador propio

`action.ankle_circumduction`

Ventajas:
- Representa directamente el movimiento observado.
- Facilita la clasificación de ejercicios de movilidad.

Desventajas:
- Puede ser anatómicamente impreciso si se trata como acción única.
- Puede duplicar combinaciones de flexión, extensión, abducción y aducción.

### Alternativa 2: Combinación de acciones existentes

Representar la circunducción como combinación de acciones articulares.

Ventajas:
- Mayor precisión anatómica.
- Evita redundancia.

Desventajas:
- Puede complicar la clasificación.
- Requiere definir reglas de combinación.

### Alternativa 3: Concepto descriptivo sin ID taxonómico

Mantener la circunducción como descripción, sin identificador canónico.

Ventajas:
- Evita introducir un ID potencialmente redundante.
- Mantiene el vocabulario más pequeño.

Desventajas:
- Puede perder trazabilidad.
- Dificulta comparación entre ejercicios.

## Comparación

| Criterio | ID propio | Combinación | Concepto descriptivo |
|---|---|---|---|
| Precisión anatómica | Media | Alta | Alta |
| Independencia semántica | Alta | Media | Baja |
| Facilidad de clasificación | Alta | Media | Baja |
| Capacidad de representar ejercicios reales | Alta | Alta | Media |
| Riesgo de duplicidad | Alto | Bajo | Bajo |
| Compatibilidad con vocabulario existente | Media | Alta | Alta |

## Recomendación propuesta

Recomendación conceptual: representar la circunducción como combinación de acciones existentes o como concepto descriptivo, salvo que se demuestre que funciona como acción independiente en la clasificación real.

Esta recomendación no constituye aprobación.

## Evidencia

- La instrucción de `1368` describe rotación circular del tobillo.
- El vocabulario actual no contiene dorsiflexión, flexión plantar, abducción ni aducción de tobillo como acciones independientes.
- La circunducción es un movimiento combinado.

## Incertidumbres

- No se ha probado la opción de combinación en una regresión documental.
- No se ha validado su uso en todo el catálogo.

## Limitaciones

- No se modificó el vocabulario.
- No se asignó ID definitivo.

## Conclusión

La circunducción de tobillo requiere decisión humana sobre si debe ser ID independiente, combinación o concepto descriptivo.
