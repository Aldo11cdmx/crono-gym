# Fase 1.1 - Duplicados semanticos

## Comparacion de las 6 parejas

| IDs | Nombre | Grupo muscular | Objetivo (`target`) | Equipamiento | Secundarios | Clasificacion |
|---|---|---|---|---|---|---|
| 0088 / 1371 | barbell seated calf raise | lower legs | calves | barbell | hamstrings, quadriceps vs hamstrings | SAME_EXERCISE |
| 0454 / 1628 | ez barbell spider curl | upper arms | biceps | ez barbell | forearms | SAME_EXERCISE |
| 0577 / 0576 | lever chest press | chest | pectorals | leverage machine | triceps, shoulders | SAME_EXERCISE |
| 0655 / 0656 | push-up (on stability ball) | chest | pectorals | stability ball | triceps, shoulders, core | SAME_EXERCISE |
| 0697 / 1766 | self assisted inverse leg curl | upper legs | hamstrings | body weight vs leverage machine | glutes, calves | DIFFERENT_EXERCISE |
| 0763 / 1394 | smith reverse calf raises | lower legs | calves | smith machine | hamstrings | SAME_EXERCISE |

## Criterio aplicado

- `SAME_EXERCISE`: mismo nombre, mismo grupo muscular, mismo objetivo, mismo equipamiento y instrucciones equivalentes o identicas.
- `DIFFERENT_EXERCISE`: mismo nombre, pero la instruccion describe una ejecucion distinta y un implemento distinto.

## Observaciones

- `0454` y `1628` tienen instrucciones identicas.
- `0577` y `0576` tienen instrucciones identicas.
- `0655` y `0656` tienen instrucciones identicas.
- `0088` y `1371` comparten la misma preparacion; la diferencia es de detalle textual.
- `0763` y `1394` comparten la misma preparacion; la diferencia es de detalle textual.
- `0697` y `1766` no deben tratarse como el mismo ejercicio: una es con peso corporal y otra en maquina de curl femoral.

No se fusionan, eliminan ni renombran registros.
