# Fase 3A.1 - Validación de conservación de IDs y relaciones semánticas

## Objetivo

Verificar que los doce registros de duplicados del piloto conservan sus IDs originales y que la relación semántica esté documentada.

## Fuentes consultadas

- `src/data/exercisesCatalog.json`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `DOCUMENTATION/taxonomy-audit/03-semantic-duplicates.md`

## Método

Se compararon metadatos e instrucciones de cada par. No se fusionaron IDs ni se modificó el catálogo.

## Resultados

| Par | Relación documentada | Metadatos | Instrucciones | Observación |
|---|---|---|---|---|
| 0088 / 1371 | SAME_EXERCISE | No idénticos (`secondary_muscles` difiere) | No byte-idénticas | Conservar IDs; diferencia menor de metadatos |
| 0454 / 1628 | SAME_EXERCISE | Idénticos | No byte-idénticas | Conservar IDs; variación textual posible |
| 0577 / 0576 | SAME_EXERCISE | Idénticos | No byte-idénticas | Conservar IDs; variación textual posible |
| 0655 / 0656 | SAME_EXERCISE | Idénticos | No byte-idénticas | Conservar IDs; variación textual posible |
| 0763 / 1394 | SAME_EXERCISE | Idénticos | No byte-idénticas | Conservar IDs; variación textual posible |
| 0697 / 1766 | DIFFERENT_EXERCISE | Idénticos | Distintas | Misma metadata, ejecuciones distintas: supino con piernas vs prone leg curl en máquina |

## Conclusiones

- Los cinco pares `SAME_EXERCISE` conservan sus IDs originales.
- No se produjo fusión implícita.
- El par `DIFFERENT_EXERCISE` conserva su distinción.
- La similitud nominal no se convirtió en identidad física o funcional.
- Los pares `SAME_EXERCISE` no son necesariamente byte-idénticos; requieren diff textual si se busca deduplicación exacta.

## Limitaciones

- No se realizó diff completo de todas las traducciones.
- No se modificó el catálogo.
