# Cronos Gym — Auditoría de preparación para implementación de equipamiento

**Estado:** LISTO CON CONDICIONES
**Tipo de auditoría:** Solo lectura
**Rama reportada:** `fix/p0-timer-and-session-draft`
**Documento arquitectónico de referencia:** `reports/architecture-research/equipment-catalog-integration-design.md`
**Implementación:** No autorizada por esta auditoría

> Este informe consolida los resultados comunicados para la auditoría de solo lectura. No sustituye la inspección del repositorio ni afirma verificaciones adicionales que no estén incluidas en el resultado recibido.

---

## 1. Resumen ejecutivo

La auditoría de preparación para integrar el catálogo de equipamiento fue reportada como completada en modo de solo lectura.

Resultados comunicados:

- Rama: `fix/p0-timer-and-session-draft`.
- 28 cambios preexistentes preservados.
- 11 referencias relacionadas con `equipmentMap`.
- 2 referencias relacionadas con los motores de reemplazo.
- Contrato conceptual de disponibilidad: `available | unavailable | unknown`.
- `CG-EQP-0022` contiene 8 vistas que representan estaciones o configuraciones funcionales.
- `CG-EQP-0058` está ausente y no fue creado.
- `smartSwap` y `exerciseSwap` permanecen separados.
- Los pesos biomecánicos permanecen intactos.
- No se creó ningún archivo durante la auditoría, porque todavía no existía autorización para ello.

**Resolución:** LISTO CON CONDICIONES. La implementación requiere aprobación expresa del propietario. La creación de este informe es una acción documental separada y no autoriza cambios de código.

## 2. Alcance y límites

### Incluido

- Consolidación de resultados de la auditoría de solo lectura.
- Registro del estado reportado del repositorio.
- Registro de los contratos y decisiones arquitectónicas relevantes.
- Identificación de condiciones previas a la implementación.
- Propuesta de secuencia incremental y criterios de aceptación.

### No incluido

- Cambios en código, interfaces o pruebas.
- Migraciones SQL o cambios en Supabase.
- Cambios en IndexedDB o sincronización offline.
- Cambios de UI.
- Instalación de dependencias.
- Commits, pushes, merges o deploys.
- Aprobación automática de la implementación.

## 3. Estado del repositorio

| Elemento | Resultado comunicado |
|---|---|
| Rama | `fix/p0-timer-and-session-draft` |
| Cambios preexistentes | 28 preservados |
| Modificaciones de código durante la auditoría | Ninguna reportada |
| Archivos nuevos durante la auditoría | Ninguno |
| Commits o deploys | Ninguno reportado |

Los 28 cambios preexistentes deben permanecer intactos. Cualquier fase posterior deberá registrar su propio estado inicial y distinguir los cambios nuevos de los ya existentes.

**Limitación de evidencia:** el resumen recibido no incluye el listado de los 28 archivos ni una captura completa de `git status --short`. No se reproducen nombres de archivos ni estados individuales que no fueron proporcionados.

## 4. Mapa de referencias reportado

| Área | Referencias reportadas | Observación |
|---|---:|---|
| `equipmentMap` | 11 | No se proporcionó el desglose por archivo y línea |
| Motores de reemplazo | 2 | No se proporcionó el desglose por archivo y línea |

Estas cifras se conservan como resultados comunicados. No deben interpretarse como número total de consumidores, módulos o dependencias hasta disponer del inventario detallado de referencias.

Antes de implementar, cada dependencia que pueda verse afectada deberá documentarse con ruta, símbolo y líneas verificadas.

## 5. Contrato de disponibilidad

El modelo conceptual adoptado en el diseño arquitectónico es:

```ts
type EquipmentAvailability =
  | 'available'
  | 'unavailable'
  | 'unknown';
```

| Estado | Significado | Tratamiento conceptual |
|---|---|---|
| `available` | Disponibilidad confirmada por una fuente válida para el contexto | Puede satisfacer requisitos y recibir preferencia positiva |
| `unavailable` | Indisponibilidad confirmada | No satisface requisitos de disponibilidad |
| `unknown` | Información insuficiente, parcial o contradictoria | No debe tratarse como disponibilidad confirmada |

### 5.1 Conjuntos completos y parciales

Un `ReadonlySet` no declara por sí mismo la completitud ni el alcance del inventario.

Contrato futuro recomendado:

- Declarar explícitamente el alcance del conjunto.
- Declarar si el conjunto es completo o parcial.
- La pertenencia solo confirma disponibilidad dentro del alcance definido.
- La ausencia en un conjunto completo y confiable puede representar `unavailable`.
- La ausencia en un conjunto parcial representa `unknown`.
- Un conjunto vacío no significa automáticamente que el gimnasio carezca de equipamiento.

Este contrato es una recomendación futura; no se afirma que esté implementado.

### 5.2 Compatibilidad booleana

Los consumidores booleanos existentes no pueden representar los tres estados. Cualquier adaptación deberá documentar la pérdida de información y evitar interpretar `unknown` como disponibilidad confirmada.

## 6. Identidad del catálogo y equipamiento físico

El diseño distingue los siguientes conceptos:

- **Máquina física:** objeto tangible instalado en el gimnasio.
- **Estación:** punto de trabajo funcional.
- **Configuración:** forma concreta de utilizar una estación.
- **Accesorio:** elemento físico intercambiable o compartido.
- **Registro CG-EQP:** registro identificado mediante `CG-EQP-####`.
- **Vista:** recurso visual contenido en un registro.

Un registro CG-EQP no demuestra por sí solo la existencia de una máquina física ni equivale necesariamente a una estación o fotografía individual.

### 6.1 Caso CG-EQP-0022

Resultado arquitectónico reportado:

- El registro contiene 8 vistas.
- Las vistas representan estaciones o configuraciones funcionales distintas de una torre de poleas.
- No deben interpretarse como ocho máquinas físicas independientes.
- Tampoco deben interpretarse como ocho ángulos de una única estación.
- La correspondencia exacta entre cada vista y cada estación sigue requiriendo evidencia.

### 6.2 CG-EQP-0058

El identificador está ausente. No fue creado durante la auditoría y no debe generarse, reservarse ni asignarse automáticamente.

### 6.3 Identidad y nombres

La coincidencia textual o la normalización de nombres puede ayudar a localizar candidatos, pero no demuestra identidad física inequívoca. Los nombres repetidos no deben fusionarse sin evidencia.

## 7. Motores de reemplazo

Los motores permanecen separados:

- `smartSwap`: scoring biomecánico.
- `exerciseSwap`: coincidencia muscular y criterios de disponibilidad.

No se aprobó una unificación como requisito de implementación.

Los pesos biomecánicos reportados para `smartSwap` deben conservarse como contrato de regresión:

| Criterio | Peso |
|---|---:|
| Coincidencia de músculo primario | +40 |
| Coincidencia de patrón | +25 |
| Músculos secundarios | +5 por coincidencia, máximo +15 |
| Disponibilidad | +10 según el contrato aplicable |
| Exclusión | -100 según el contexto aplicable |

La auditoría reportó que los pesos permanecen intactos. Cualquier cambio futuro deberá demostrar equivalencia mediante pruebas antes de modificar el comportamiento.

**Condición importante:** el comportamiento actual y el contrato futuro de disponibilidad deben mantenerse diferenciados. No se debe atribuir al código actual una semántica triestado que todavía no esté implementada.

## 8. Persistencia y funcionamiento offline

El resumen de auditoría recibido no incluye resultados detallados de tablas, políticas RLS, stores IndexedDB o sincronización.

Por tanto, este informe no concluye que exista o no exista una estructura reutilizable de persistencia por usuario.

Antes de proponer una migración o almacenamiento persistente deberán verificarse:

1. Esquema SQL y tablas existentes.
2. Políticas RLS y aislamiento por usuario.
3. Tipos generados y servicios de acceso.
4. Stores IndexedDB y estrategia de sincronización.
5. Comportamiento sin conexión y resolución de conflictos.
6. Posibilidad de resolver el caso de uso con el inventario estático actual.

No se autoriza crear tablas, modificar datos ni cambiar la persistencia en esta fase.

## 9. Impacto en UI/UX

El resumen recibido no contiene hallazgos detallados de interacción, accesibilidad o estados visuales del selector.

Antes de implementar cambios en `UnifiedExerciseSelectorSheet.tsx`, se deberán verificar al menos:

- Comportamiento del filtro Mi Gym.
- Estado sin resultados.
- Equipamiento desconocido o sin correspondencia.
- Recursos visuales faltantes.
- Comportamiento en pantallas móviles.
- Accesibilidad y estados de carga.
- Compatibilidad con el sistema visual vigente.

No se propone una modificación visual concreta sin evidencia de los flujos actuales.

## 10. Estrategia de pruebas requerida

Las pruebas siguientes son criterios propuestos; no se afirma que hayan sido ejecutadas.

| Nivel | Escenarios mínimos | Criterio |
|---|---|---|
| Unitarias de disponibilidad | `available`, `unavailable`, `unknown`, conjunto vacío, completo y parcial | No confundir ausencia con indisponibilidad cuando el conjunto es parcial |
| SmartSwap | Pesos, bonificación, exclusión, empates y orden | Conservar los pesos y rankings esperados |
| exerciseSwap | Coincidencia primaria/secundaria y disponibilidad | Mantener el comportamiento documentado |
| Catálogo | IDs ausentes, nombres duplicados, vistas múltiples | No fusionar identidades ni inventar correspondencias |
| Integración | Selector Mi Gym y filtros | No perder ejercicios válidos ni mostrar disponibilidad no confirmada |
| Offline | Lectura y cambios de configuración sin conexión | No perder ni sobrescribir datos |
| Regresión | Consumidores booleanos y flujos existentes | No romper compatibilidad |

Antes de ejecutar pruebas, verificar que no alteren archivos, datos locales o estado persistente fuera del alcance autorizado.

## 11. Riesgos y condiciones

| Riesgo | Prioridad propuesta | Mitigación |
|---|---|---|
| Tratar `unknown` como `available` | P1 | Contrato explícito y pruebas triestado |
| Interpretar ausencia en conjunto parcial como `unavailable` | P1 | Declarar alcance y completitud |
| Cambiar rankings de reemplazo | P1 | Pruebas de regresión y conservación de pesos |
| Confundir registro visual con máquina física | P1 | Mantener separados identidad, estación y vista |
| Resolver identidad solo por nombre | P2 | Mapeo explícito y tratamiento de ambigüedad |
| Alterar el filtro Mi Gym | P1 | Pruebas de integración del selector |
| Introducir persistencia innecesaria | P2 | Demostrar primero que el inventario estático no satisface el caso de uso |

Las prioridades son una clasificación propuesta para planificar el trabajo, no severidades confirmadas por una prueba de seguridad.

## 12. Plan incremental recomendado

### Fase A — Cierre de evidencia

- Recuperar el desglose de referencias por archivo y línea.
- Confirmar el comportamiento real de los consumidores de disponibilidad.
- Documentar las dependencias entre inventario, catálogo y selector.
- Completar la inspección de persistencia y offline si el caso de uso lo requiere.

**Criterio de salida:** evidencia suficiente para definir contratos sin suposiciones.

### Fase B — Contrato de disponibilidad

- Definir cómo se expresa alcance y completitud.
- Definir la adaptación a consumidores booleanos.
- Establecer pruebas para conjuntos completos, parciales y vacíos.

**Criterio de salida:** ningún consumidor interpreta información desconocida como disponibilidad confirmada.

### Fase C — Identidad y mapeo

- Determinar si basta un mapeo explícito mínimo.
- Mantener separados los registros CG-EQP y las máquinas físicas.
- Resolver duplicados y ambigüedades sin fusionar registros.
- Mantener pendiente cualquier relación vista-estación sin evidencia.

**Criterio de salida:** cada asociación propuesta tiene identidad y evidencia trazables.

### Fase D — Integración de motores y selector

- Mantener ambos motores separados.
- Introducir cambios mínimos y aditivos, si fueran necesarios.
- Preservar los pesos biomecánicos.
- Probar los flujos del selector Mi Gym.

**Criterio de salida:** pruebas de regresión en verde y rankings esperados conservados.

### Fase E — Persistencia opcional

Solo considerar persistencia por usuario si la auditoría específica demuestra que el inventario estático es insuficiente.

**Criterio de salida:** diseño de datos, RLS, offline, sincronización y rollback aprobados antes de cualquier migración.

## 13. Decisiones que requieren aprobación expresa

Antes de implementar deberán aprobarse, según corresponda:

1. El contrato técnico concreto para declarar alcance y completitud de `availableEquipment`.
2. La evolución aditiva de `SwapCandidate`, si se necesita preservar el estado triestado.
3. El mapeo explícito entre inventario y registros CG-EQP.
4. La normalización de nombres, sin usarla como identidad definitiva.
5. Cualquier modificación de `smartSwap`, `exerciseSwap` o del selector.
6. Cualquier persistencia por usuario, migración o política RLS.
7. Cualquier cambio de UI/UX.
8. El alcance y los criterios de aceptación de cada fase de implementación.

## 14. Resolución final

# LISTO CON CONDICIONES

La auditoría de solo lectura fue reportada como completada y no autorizó implementación.

Condiciones para avanzar:

- Obtener el desglose verificable de referencias y dependencias.
- Cerrar el contrato implementable de disponibilidad.
- Mantener la identidad del catálogo separada de la identidad física.
- Definir pruebas de regresión antes de cambiar motores o selector.
- Evaluar persistencia únicamente si existe una necesidad demostrada.
- Obtener aprobación expresa del propietario para cada alcance de implementación.

La aprobación arquitectónica previa permite utilizar el diseño como referencia, pero no autoriza por sí sola cambios de código, datos, infraestructura o despliegue.

---

## Registro de control

| Control | Estado reportado |
|---|---|
| Auditoría de solo lectura | Completada |
| Cambios preexistentes | 28 preservados |
| Motores de reemplazo | Separados |
| Pesos biomecánicos | Intactos |
| CG-EQP-0058 | No creado |
| Archivos de implementación modificados | Ninguno reportado |
| Informe de readiness | Documento documental |
| Implementación | Requiere aprobación expresa |
