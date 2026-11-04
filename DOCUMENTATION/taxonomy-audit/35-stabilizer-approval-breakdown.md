# Fase 3A.3.1 - Descomposición de la aprobación de estabilizadores

## Objetivo

Separar la aprobación de reglas, la aplicación individual y la aprobación de clasificación para el rol `stabilizer`.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/23-stabilizer-evidence-rules.md`
- `DOCUMENTATION/taxonomy-audit/31-stabilizer-approval-criteria.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`

## Nivel 1 - Aprobación de reglas

| ID de decisión | Alcance | Propuesta | Estado |
|---|---|---|---|
| D-STAB-L1-RULES | Criterios biomecánicos para asignar `stabilizer` | Aprobar o rechazar las reglas de evidencia | PROPOSED |

Aprobar las reglas no aprueba clasificaciones.

## Nivel 2 - Aplicación individual

| ID de decisión | Alcance | Propuesta | Estado |
|---|---|---|---|
| D-STAB-L2-APPLICATION | Evaluación independiente de cada ejercicio | Aplicar las reglas aprobadas a un ejercicio concreto | PROPOSED |

Cada ejercicio requiere evidencia específica. Una clasificación no se propaga automáticamente a ejercicios similares.

## Nivel 3 - Aprobación de clasificación

| ID de decisión | Alcance | Propuesta | Estado |
|---|---|---|---|
| D-STAB-L3-APPROVAL | Aceptación explícita de una propuesta de estabilizador | Marcar una propuesta como `accepted` | PROPOSED |

La ausencia de evidencia conserva `unknown`. No se debe exigir que todos los ejercicios tengan estabilizadores.

## Cómo se generarían decisiones individuales

Si se autoriza aplicar las reglas, se generarán decisiones individuales con formato:

- `D-STAB-<id>-<muscle>`
- Ejercicio.
- Músculo propuesto.
- Evidencia.
- Nivel de evidencia.
- Confianza.
- Estado `PROPOSED`.

No se generan 49 aprobaciones ficticias en esta fase.

## Dependencias

- D-STAB-L2-APPLICATION depende de D-STAB-L1-RULES.
- D-STAB-L3-APPROVAL depende de D-STAB-L2-APPLICATION.

## Incertidumbres

- Muchas instrucciones no documentan estabilización.
- La distinción entre sinergista y estabilizador puede requerir revisión experta.

## Limitaciones

- No se aplicaron reglas a los 49 registros.
- No se asignaron estabilizadores.

## Conclusión

La aprobación de reglas, la aplicación y la aceptación son decisiones separadas.
