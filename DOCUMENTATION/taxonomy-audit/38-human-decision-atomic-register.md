# Fase 3A.3.1 - Registro atómico de decisiones humanas

## Objetivo

Separar en decisiones atómicas las decisiones musculares y de lateralidad.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/24-human-decision-register.md`
- `DOCUMENTATION/taxonomy-audit/14-target-muscle-conflicts.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Decisiones musculares atómicas

| ID de decisión | Ejercicio | Campo en conflicto | Pregunta concreta | Opciones | Consecuencias |
|---|---|---|---|---|---|
| D-MUSCLE-0518 | 0518 kettlebell alternating hang clean | target vs muscle_group | ¿Cuál es el músculo primario? | `forearms`, `shoulders`, `unknown` | Afecta únicamente a 0518 |
| D-MUSCLE-1512 | 1512 all fours squad stretch | target vs muscle_group | ¿Cuál es el músculo primario? | `quadriceps`, `hamstrings`, `unknown` | Afecta únicamente a 1512 |
| D-MUSCLE-1714 | 1714 assisted prone rectus femoris stretch | target vs muscle_group | ¿Cuál es el músculo primario? | `abs`, `quadriceps`, `unknown` | Afecta únicamente a 1714 |
| D-MUSCLE-0003 | 0003 air bike | target vs muscle_group | ¿Cuál es el músculo primario? | `abs`, `hip flexors`, `unknown` | Afecta únicamente a 0003 |
| D-MUSCLE-1368 | 1368 ankle circles | target vs muscle_group | ¿Cuál es el músculo primario? | `calves`, `ankle stabilizers`, `unknown` | Afecta únicamente a 1368 |

## Decisiones de lateralidad atómicas

| ID de decisión | Caso | Pregunta concreta | Opciones | Consecuencias |
|---|---|---|---|---|
| D-LAT-0002 | 0002 45° side bend | ¿Cuál es la lateralidad? | `unilateral`, `alternating`, `unknown` | Afecta únicamente a 0002 |
| D-LAT-1368 | 1368 ankle circles | ¿Cuál es la lateralidad? | `unilateral`, `alternating`, `unknown` | Afecta únicamente a 1368 |
| D-LAT-CARDIO | Cardio no determinable | ¿La lateralidad puede determinarse? | `bilateral`, `unilateral`, `alternating`, `unknown` | Afecta únicamente a los casos documentados |

## Reglas de atomicidad

1. Una decisión no establece precedente automático para otra.
2. La aprobación de un músculo primario no aprueba músculos secundarios ni estabilizadores.
3. La aprobación de lateralidad no implica aprobación de patrón ni acción articular.
4. Los estados permanecen `PROPOSED`.

## Incertidumbres

- La evidencia actual no resuelve los conflictos musculares.
- La lateralidad de cardio depende de la ejecución descrita.

## Limitaciones

- No se modificó la matriz.
- No se asignó músculo primario definitivo.
- No se asignó lateralidad definitiva.

## Conclusión

Las decisiones musculares y de lateralidad son atómicas y no se propagan automáticamente.
