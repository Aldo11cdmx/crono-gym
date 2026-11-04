# Fase 3A.1 - Análisis de conflictos entre target y muscle_group

## Objetivo

Analizar los cinco registros del piloto que presentan conflicto entre `target` y `muscle_group`, sin establecer precedencia automática entre ambos campos.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Método

Para cada caso se recuperaron los valores originales, la descripción y las instrucciones en español. Se compararon los campos con la propuesta de `muscle_primary` del piloto. No se modificó el catálogo.

## Resultados

| ID | Nombre | target | muscle_group | secondary_muscles | Interpretación | Conclusión |
|---|---|---|---|---|---|---|
| 0518 | kettlebell alternating hang clean | forearms | shoulders | shoulders, traps, core | `target` y `muscle_group` nombran regiones distintas; el texto describe extensión de cadera y tracción hacia los hombros | Conflicto real; músculo primario permanece `unknown` |
| 1512 | all fours squad stretch | quads | hamstrings | hamstrings, glutes | El texto describe estiramiento de cuádriceps, pero `muscle_group` indica isquiotibiales | Conflicto real; requiere decisión humana |
| 1714 | assisted prone rectus femoris stretch | abs | quadriceps | quadriceps | El texto describe estiramiento de la parte frontal del muslo, no del abdomen | Conflicto real; músculo primario permanece `unknown` |
| 0003 | air bike | abs | hip flexors | hip flexors | El texto combina flexión de tronco y pedaleo; ambos campos son parcialmente compatibles pero no equivalentes | Conflicto parcial; requiere decisión humana |
| 1368 | ankle circles | calves | ankle stabilizers | ankle stabilizers | El texto describe rotación de tobillo; `target` y `muscle_group` nombran niveles distintos | Conflicto real o diferencia de nivel taxonómico; requiere decisión humana |

## Evidencia y procedencia

- `target`, `muscle_group` y `secondary_muscles` son campos E1.
- Las instrucciones en español son E2.
- No se usó el nombre del ejercicio como evidencia suficiente.

## Conclusiones

- Existen cinco conflictos documentados.
- No se estableció precedencia automática entre `target` y `muscle_group`.
- Tres casos se consideran conflicto real.
- Dos casos requieren decisión humana adicional.
- Todos permanecen con músculo primario `unknown` o pendiente.

## Limitaciones

- La evidencia disponible no permite resolver todos los conflictos sin intervención humana.
