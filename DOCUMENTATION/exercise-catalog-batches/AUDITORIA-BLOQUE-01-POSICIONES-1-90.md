# AUDITORÍA DE CIERRE - BLOQUE 1 (POSICIONES 1-90)

## Resumen de métricas
- Total registros: 90
- IDs coinciden con JSON en orden: SI
- Registros con campos biomécánicos clave vacíos: 17
- Asignaciones CG-EQP detectadas: 0
- Estado 'En revisión': TODOS (verificado por revisión)

## Distribución de nivel de confianza
- media: 64
- baja: 9

## Posibles duplicidades (por nombre original normalizado)

## Principales inconsistencias detectadas en fuente original
- Equipos genéricos (band, cable, leverage machine, assisted, stability ball) sin especificación de anclaje/vector/resistencia
- Contradicciones target vs muscle_group vs instructions
- Ejercicios compuestos con co-dominancia difícil de jerarquizar
- Ejercicios de estabilización/movilidad mal clasificados como dinámicos
- Nombres ambiguos (alternate, push sit-up, arm slingers, etc.)

## Dudas biomecánicas consolidadas
- Configuración exacta de implementos elásticos/cable
- Jerarquización en patrones combinados
- Participación relativa según trayectoria/técnica/posición articular
- Duplicidad entre estiramientos similares (1709/1710)
- Clasificación estabilización vs movimiento dinámico

## Integridad de datos
- Datos originales (ID, nombre, target, bodyPart, equipment, muscle_group, instructions) preservados por mapeo por ID
- 90/90 registros procesados en orden JSON
- Sin asignaciones CG-EQP
- Todos en estado En revisión
