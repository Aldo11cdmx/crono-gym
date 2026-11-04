# Fase 3A - Selección reproducible de muestra piloto

Fuente: `src/data/exercisesCatalog.json`
Hash SHA-256: `6c0e796dd6c914c126f47ba8dbcbbb9e93b446027b6f0160d3f541c76569eec3`
Registros totales: `1324`

## Algoritmo determinista

1. Cargar el catálogo ordenado por `id` ascendente.
2. Excluir IDs ya seleccionados en estratos anteriores.
3. Tomar los primeros registros que cumplan cada predicado.
4. Registrar estrato de origen en `sample_stratum`.

Predicados y cantidades:

| Estrato | Predicado | Cantidad |
|---|---|---:|
| `semantic_duplicates` | IDs de los 6 pares documentados | 12 |
| `kettlebell` | `equipment == "kettlebell"` | 6 |
| `cardio` | `body_part == "cardio"` | 6 |
| `mobility` | `name` contiene `stretch` o `mobility` | 6 |
| `bodyweight` | `equipment == "body weight"` | 6 |
| `free_weight` | `equipment in {dumbbell, barbell, ez barbell, olympic barbell, trap bar}` | 5 |
| `cable` | `equipment == "cable"` | 4 |
| `machine` | `equipment in {leverage machine, smith machine}` o contiene `machine` | 4 |

Total seleccionado: `49` (`3.70%` del catálogo).

## IDs seleccionados

| ID | Estrato |
|---|---|
| 0088 | semantic_duplicates |
| 1371 | semantic_duplicates |
| 0454 | semantic_duplicates |
| 1628 | semantic_duplicates |
| 0577 | semantic_duplicates |
| 0576 | semantic_duplicates |
| 0655 | semantic_duplicates |
| 0656 | semantic_duplicates |
| 0763 | semantic_duplicates |
| 1394 | semantic_duplicates |
| 0697 | semantic_duplicates |
| 1766 | semantic_duplicates |
| 0517 | kettlebell |
| 0518 | kettlebell |
| 0520 | kettlebell |
| 0519 | kettlebell |
| 0521 | kettlebell |
| 0522 | kettlebell |
| 3220 | cardio |
| 3672 | cardio |
| 3360 | cardio |
| 1160 | cardio |
| 2331 | cardio |
| 1201 | cardio |
| 1512 | mobility |
| 1708 | mobility |
| 1709 | mobility |
| 1710 | mobility |
| 1713 | mobility |
| 1714 | mobility |
| 0001 | bodyweight |
| 0002 | bodyweight |
| 0003 | bodyweight |
| 0006 | bodyweight |
| 1368 | bodyweight |
| 3293 | bodyweight |
| 0023 | free_weight |
| 0024 | free_weight |
| 0025 | free_weight |
| 0026 | free_weight |
| 1316 | free_weight |
| 0007 | cable |
| 0148 | cable |
| 0149 | cable |
| 3235 | cable |
| 0009 | machine |
| 0015 | machine |
| 0017 | machine |
| 1431 | machine |

## Excepciones aplicadas

- Los 12 IDs de duplicados semánticos se incluyen completos para no perder casos de equivalencia.
- Los 6 ejercicios kettlebell se incluyen con contradicción de disponibilidad abierta.
- No se fusionan IDs.
- No se modifica disponibilidad.
