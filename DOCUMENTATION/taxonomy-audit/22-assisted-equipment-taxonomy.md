# Fase 3A.2 - Taxonomía conceptual de implementos asistidos

## Objetivo

Separar implemento principal, implemento auxiliar, soporte, sistema de resistencia, mecanismo de asistencia y tipo de asistencia, sin modificar la matriz piloto.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/13-low-confidence-review.md`
- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `src/data/exercisesCatalog.json`

## Dimensiones propuestas

| Dimensión | Definición | Ejemplos conceptuales |
|---|---|---|
| `implement_primary` | Objeto principal manipulado o usado para ejecutar el ejercicio | Mancuerna, barra, kettlebell, cable, máquina |
| `implement_auxiliary` | Objeto secundario que modifica la ejecución | Banda de asistencia, contrapeso, tobillera |
| `support_surface` | Superficie o soporte que estabiliza el cuerpo | Banco, plataforma, suelo, balón |
| `resistance_system` | Mecanismo que genera la carga principal | Peso libre, cable, máquina, banda, peso corporal |
| `assistance_mechanism` | Mecanismo que reduce la carga o asiste el movimiento | Contrapeso, banda elástica, palanca asistida |
| `assistance_type` | Tipo de asistencia cuando es demostrable | `counterweight`, `band_assist`, `machine_assist`, `manual_assist`, `unknown` |

## Reglas conceptuales

1. La asistencia no es resistencia.
2. Un mecanismo puede asistir sin ser el sistema de resistencia principal.
3. El soporte no es implemento principal.
4. El accesorio no redefine el implemento principal.
5. Si un elemento no puede identificarse con evidencia, debe registrarse como `unknown`.
6. El nombre del ejercicio no es evidencia suficiente para asignar implemento.

## Análisis de los siete ejercicios asistidos

| ID | Nombre | Evidencia disponible | Elementos identificables | Elementos desconocidos | Dimensión afectada | Propuesta conceptual | Confianza |
|---|---|---|---|---|---|---|---|
| 1708 | assisted lying calves stretch | Instrucción describe estiramiento con manos o toalla | Estiramiento de pantorrilla | Implemento, resistencia, asistencia, lateralidad | resistance_system; implement_type; assistance | `resistance_system=unknown`, `implement_type=unknown`, `assistance_mechanism=unknown` | low |
| 1709 | assisted lying glutes stretch | Instrucción describe estiramiento con agarre del muslo | Estiramiento de glúteo | Implemento, resistencia, asistencia, lateralidad | resistance_system; implement_type; assistance | `resistance_system=unknown`, `implement_type=unknown`, `assistance_mechanism=unknown` | low |
| 1710 | assisted lying gluteus and piriformis stretch | Instrucción describe estiramiento con agarre del muslo | Estiramiento de glúteo y piriforme | Implemento, resistencia, asistencia, lateralidad, piriforme no modelado | resistance_system; implement_type; assistance; muscle model | `resistance_system=unknown`, `implement_type=unknown`, `assistance_mechanism=unknown` | low |
| 1713 | assisted prone lying quads stretch | Instrucción describe estiramiento prono con mano o toalla | Estiramiento de cuádriceps | Implemento, resistencia, asistencia, lateralidad | resistance_system; implement_type; assistance | `resistance_system=unknown`, `implement_type=unknown`, `assistance_mechanism=unknown` | low |
| 1714 | assisted prone rectus femoris stretch | Instrucción describe estiramiento prono con mano o toalla | Estiramiento de parte frontal del muslo | Implemento, resistencia, asistencia, lateralidad, músculo primario | resistance_system; implement_type; assistance; muscle_primary | `resistance_system=unknown`, `implement_type=unknown`, `assistance_mechanism=unknown` | low |

La lista original incluye siete ejercicios asistidos. En la muestra actual, los registros 1708-1714 son cinco. Los IDs 1711 y 1712 no forman parte de la muestra de 49 y no se analizan aquí para no inventar registros. Si se requiere cobertura de siete casos, debe definirse una muestra reproducible adicional.

## Conclusiones

- `assisted` como valor de `equipment` no identifica implemento, resistencia ni asistencia.
- La separación propuesta evita confundir asistencia con resistencia.
- Los cinco casos permanecen con valores `unknown` por evidencia insuficiente.

## Incertidumbres

- No se conoce el equipo asistido exacto.
- No se conoce si la asistencia es manual, con banda, contrapeso o máquina.
- No se conoce la lateralidad.

## Limitaciones

- No se modificó la matriz.
- No se asignó implemento por nombre.

## Conclusión

La taxonomía conceptual permite representar la incertidumbre sin forzar implementos. Los casos requieren documentación adicional antes de clasificarse.
