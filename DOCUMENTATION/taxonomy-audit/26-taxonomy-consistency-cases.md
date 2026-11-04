# Fase 3A.2 - Casos de consistencia conceptual

## Objetivo

Construir casos de prueba documentales para verificar la coherencia del vocabulario, sin tests de código.

## Fuentes

- `DOCUMENTATION/taxonomy-audit/09-pilot-matrix.csv`
- `DOCUMENTATION/taxonomy-audit/06-controlled-vocabularies.md`
- `DOCUMENTATION/taxonomy-audit/07-fase2-review.md`

## Casos

### Caso 1 - Peso corporal

Ejemplo de referencia: `0001` (3/4 sit-up).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `pattern=core`, `resistance=bodyweight`, `implement=bodyweight`.
- Evidencia necesaria: E1 body_part, target, equipment; E2 instrucciones.
- Error posible: inferir estabilizadores por ser ejercicio compuesto.
- `unknown`: estabilizadores sin evidencia específica.

### Caso 2 - Peso libre

Ejemplo de referencia: `0025` (barbell bench press).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `pattern=push`, `resistance=free_weight`, `implement=straight_barbell`.
- Evidencia necesaria: E1 equipment; E2 instrucciones.
- Error posible: confundir implemento con soporte (banco).
- `unknown`: estabilizadores sin evidencia específica.

### Caso 3 - Máquina

Ejemplo de referencia: `0577` (lever chest press).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `pattern=push`, `resistance=plate_loaded`, `implement=plate_loaded_machine`.
- Evidencia necesaria: E1 equipment; E2 instrucciones.
- Error posible: tratar la máquina como implemento auxiliar.
- `unknown`: estabilizadores sin evidencia específica.

### Caso 4 - Polea

Ejemplo de referencia: `0007` (alternate lateral pulldown).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `pattern=pull`, `resistance=cable`, `implement=cable_attachment`.
- Evidencia necesaria: E1 equipment; E2 instrucciones.
- Error posible: confundir accesorio de cable con sistema de resistencia.
- `unknown`: estabilizadores sin evidencia específica.

### Caso 5 - Asistido

Ejemplo de referencia: `1708` (assisted lying calves stretch).

- Dimensiones: implement, resistance, assistance, kinetic, laterality, muscle.
- Resultado esperado: implemento, resistencia y asistencia `unknown` por evidencia insuficiente.
- Evidencia necesaria: descripción del equipo asistido.
- Error posible: asignar implemento por el nombre.
- `unknown`: todos los elementos no demostrables.

### Caso 6 - Cardio

Ejemplo de referencia: `1160` (burpee).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `pattern=plyometric` o `locomotion_cardio`, `resistance=bodyweight`.
- Evidencia necesaria: E1 body_part, target, equipment; E2 instrucciones.
- Error posible: forzar una acción articular única en un movimiento combinado.
- `unknown`: acción articular principal si no hay dominante.

### Caso 7 - Unilateral

Ejemplo de referencia: `3293` (archer pull up).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `laterality=unilateral`.
- Evidencia necesaria: E2 instrucciones.
- Error posible: inferir lateralidad por el nombre.
- `unknown`: si la ejecución no documenta lateralidad.

### Caso 8 - Bilateral

Ejemplo de referencia: `0025` (barbell bench press).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `laterality=bilateral`.
- Evidencia necesaria: E2 instrucciones.
- Error posible: asumir bilateral por simetría del nombre.
- `unknown`: si la ejecución no documenta lateralidad.

### Caso 9 - Varias acciones articulares

Ejemplo de referencia: `0024` (barbell bench front squat).

- Dimensiones: pattern, joint, plane, resistance, implement, kinetic, laterality, muscle.
- Resultado esperado: `primary_joint_action` como acción compleja si varias acciones relevantes están documentadas.
- Evidencia necesaria: E2 instrucciones.
- Error posible: reducir un movimiento complejo a una sola articulación.
- `unknown`: si no se puede identificar una acción dominante.

### Caso 10 - Músculo primario ambiguo

Ejemplo de referencia: `0518` (kettlebell alternating hang clean).

- Dimensiones: muscle_primary, pattern, joint, resistance, implement.
- Resultado esperado: `muscle_primary=unknown` por conflicto de fuentes.
- Evidencia necesaria: E1 target, muscle_group, secondary_muscles; E2 instrucciones.
- Error posible: elegir un músculo por intuición.
- `unknown`: cuando la evidencia es contradictoria.

## Conclusiones

- Los casos demuestran que `unknown` es un valor válido y necesario.
- La confianza por campo evita generalizar certeza.
- Las dimensiones separadas reducen ambigüedad.
- No se modificó la matriz ni el catálogo.

## Limitaciones

- Casos basados en una muestra de 49 registros.
- No se clasificó el catálogo completo.
- No se implementaron tests de código.

## Conclusión

La consistencia conceptual del vocabulario se mantiene cuando se usa `unknown` y confianza por campo.
