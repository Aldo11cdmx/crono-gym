# Fase 3A.3.1 - Mapa de dependencias de aprobación

## Objetivo

Documentar dependencias entre decisiones de aprobación humana.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/32-human-approval-matrix.md`
- `DOCUMENTATION/taxonomy-audit/35-stabilizer-approval-breakdown.md`
- `DOCUMENTATION/taxonomy-audit/36-joint-action-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/37-assisted-equipment-approval-register.md`
- `DOCUMENTATION/taxonomy-audit/38-human-decision-atomic-register.md`

## Dependencias

| Decisión | Depende de | Efecto |
|---|---|---|
| D-STAB-L2-APPLICATION | D-STAB-L1-RULES | Permite evaluar ejercicios, no aceptarlos automáticamente |
| D-STAB-L3-APPROVAL | D-STAB-L2-APPLICATION | Permite aceptar propuestas individuales |
| D-ASSIST-IND-* | D-ASSIST-DIM-* | Permite evaluar implementos individuales |
| D-JOINT-* | Ninguna | Puede aprobarse o rechazarse independientemente |
| D-CIRC-ANKLE | Ninguna | Puede aprobarse o rechazarse independientemente |
| D-MUSCLE-* | Ninguna | Afecta únicamente al ejercicio correspondiente |
| D-LAT-* | Ninguna | Afecta únicamente al caso correspondiente |

## Decisiones independientes

- D-JOINT-ANKLE-DORSIFLEXION
- D-JOINT-HIP-FLEXION
- D-JOINT-SHOULDER-FLEXION
- D-JOINT-SHOULDER-EXTENSION
- D-CIRC-ANKLE
- D-MUSCLE-0518
- D-MUSCLE-1512
- D-MUSCLE-1714
- D-MUSCLE-0003
- D-MUSCLE-1368
- D-LAT-0002
- D-LAT-1368
- D-LAT-CARDIO

## Dependencias circulares

No se identifican dependencias circulares.

## Riesgos de aprobación implícita

- Aprobar una regla de estabilizadores no aprueba clasificaciones.
- Aprobar una dimensión de asistencia no aprueba implementos individuales.
- Aprobar una acción articular no aprueba automáticamente su uso en todos los ejercicios.
- Aprobar un músculo primario no aprueba músculos secundarios ni estabilizadores.

## Incertidumbres

- Las dependencias son documentales, no técnicas.
- No se ha aplicado ninguna decisión.

## Limitaciones

- No se modificó la matriz.
- No se crearon contratos.

## Conclusión

Las dependencias son explícitas y no circulares. La aprobación es atómica.
