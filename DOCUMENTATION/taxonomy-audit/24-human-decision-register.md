# Fase 3A.2 - Registro de decisiones humanas

## Objetivo

Documentar las decisiones humanas pendientes para músculo primario y lateralidad, sin resolverlas automáticamente.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/13-low-confidence-review.md`
- `DOCUMENTATION/taxonomy-audit/14-target-muscle-conflicts.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `src/data/exercisesCatalog.json`

## Decisiones de músculo primario

| ID | Campo en conflicto | Interpretaciones | Evidencia | Decisión pendiente |
|---|---|---|---|---|
| 0518 | target vs muscle_group | `forearms` como objetivo declarado; `shoulders` como grupo muscular; clean multiarticular | E1: target, muscle_group, secondary_muscles. E2: extensión de cadera y tracción hacia hombros | Definir músculo primario o mantener `unknown` |
| 1512 | target vs muscle_group | `quads` como objetivo declarado; `hamstrings` como grupo muscular; instrucción describe estiramiento de cuádriceps | E1: target, muscle_group, secondary_muscles. E2: estiramiento de cuádriceps | Definir músculo primario o mantener `unknown` |
| 1714 | target vs muscle_group | `abs` como objetivo declarado; `quadriceps` como grupo muscular; instrucción describe parte frontal del muslo | E1: target, muscle_group, secondary_muscles. E2: estiramiento de recto femoral | Definir músculo primario o mantener `unknown` |
| 0003 | target vs muscle_group | `abs` como objetivo declarado; `hip flexors` como grupo muscular; instrucción combina crunch y pedaleo | E1: target, muscle_group, secondary_muscles. E2: flexión de tronco y pedaleo | Definir músculo primario o mantener `unknown` |
| 1368 | target vs muscle_group | `calves` como objetivo declarado; `ankle stabilizers` como grupo muscular; instrucción describe rotación de tobillo | E1: target, muscle_group, secondary_muscles. E2: rotación de tobillo | Definir músculo primario o mantener `unknown` |

## Decisiones de lateralidad

| Caso | Interpretaciones | Evidencia | Decisión pendiente |
|---|---|---|---|
| 0002 | Side bend puede ejecutarse con un lado a la vez o alternando | E1: nombre y body_part. E2: no documenta lateralidad | Definir `unilateral`, `alternating` o `unknown` |
| 1368 | Circunducción de tobillo puede realizarse con una pierna o alternando | E1: nombre y body_part. E2: no documenta lateralidad | Definir `unilateral`, `alternating` o `unknown` |
| Cardio simultáneo | Ambos lados se mueven al mismo tiempo | E2: instrucciones de salto o desplazamiento | Confirmar `bilateral` |
| Cardio cíclico | Los lados se alternan en un ciclo repetitivo | E2: instrucciones de pedaleo o pasos | Confirmar `alternating` |
| Cardio unilateral | Solo un lado ejecuta el movimiento principal | E2: instrucciones específicas | Confirmar `unilateral` |
| Cardio no determinable | No se puede establecer lateralidad con seguridad | E2 insuficiente | Mantener `unknown` |

## Regla de aprobación

Ningún agente puede resolver estos casos por votación. La decisión debe registrarse como aprobación humana explícita.

## Incertidumbres

- Los conflictos musculares no se resuelven con la evidencia actual.
- La lateralidad de cardio depende de la ejecución descrita.
- La lateralidad de 0002 y 1368 no está documentada.

## Limitaciones

- No se modificó la matriz.
- No se asignó músculo primario definitivo.
- No se asignó lateralidad definitiva.

## Conclusión

Las decisiones permanecen pendientes y deben registrarse como decisiones humanas explícitas.
