# COMPARACIÓN PROPUESTA ANTERIOR vs CORREGIDA (primeros 20)

## 0001 | 3/4 sit-up

### Propuesta anterior
- Movimiento: Flexión del tronco (curl) con flexión parcial de cadera
- Articulaciones: columna vertebral (flexión toracolumbar), cadera (flexión)
- Segmentos: tronco, cadera
- Músculos principales: recto abdominal
- Músculos secundarios: flexores de cadera (psoas ilíaco, recto femoral)
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors (según fuente)
- Información insuficiente: 
- Confianza: media
- Justificación: Instrucciones ES indican flexión de tronco hasta ~45°; pasos ES confirman curl; target/muscle_group difieren en fuente.

### Problema detectado
- Se atribuye flexión de cadera sin evidencia demostrada en pasos/instrucciones ES.
- Se infiere participación de flexores de cadera como secundarios sin justificación.

### Corrección aplicada
- Movimiento: Flexión del tronco (curl) en decúbito supino
- Articulaciones: columna vertebral (flexión toracolumbar)
- Segmentos: tronco
- Músculos principales: recto abdominal
- Músculos secundarios: desconocido
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors (sin evidencia de flexión de cadera predominante)
- Información insuficiente: Flexión de cadera no demostrada por pasos/instrucciones ES; no se atribuye como principal
- Confianza: media
- Justificación: Pasos ES describen curvatura del tronco hasta ~45° con activación abdominal; no hay indicación de elevar cadera como movimiento principal.

### Justificación biomecánica
- El patrón 3/4 sit-up se caracteriza por curl toracolumbar; la elevación de cadera no está descrita en los pasos ES. Se mantiene la distinción entre target/metadatos contradictorios sin forzar una atribución no demostrada.

### Dudas que siguen abiertas
- ¿Existe evidencia distinta en otras fuentes que demuestre participación activa de flexores de cadera como principales? No se dispone con la información actual.

## 0002 | 45° side bend

### Propuesta anterior
- Movimiento: Flexión lateral de columna vertebral
- Articulaciones: columna vertebral (flexión lateral)
- Segmentos: tronco
- Músculos principales: oblicuos (externo/interno)
- Músculos secundarios: cuadrado lumbar
- Confianza: media

### Problema detectado
- Sin problemas mayores; verificar ausencia de rotación axial.

### Corrección aplicada
- Movimiento: Flexión lateral de columna vertebral
- Articulaciones: columna vertebral (flexión lateral)
- Segmentos: tronco
- Músculos principales: oblicuos (externo/interno)
- Músculos secundarios: cuadrado lumbar
- Confianza: media
- Justificación: Instrucciones/pasos ES indican flexión lateral únicamente.

### Justificación biomecánica
- Los pasos ES describen inclinación lateral; no hay indicación de rotación axial intencional.

### Dudas que siguen abiertas
- Ninguna relevante con la evidencia disponible.

## 0003 | air bike

### Propuesta anterior
- Movimiento: Flexión alternada de tronco y flexión alternada de cadera
- Músculos principales: recto abdominal, oblicuos
- Músculos secundarios: flexores de cadera
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors

### Problema detectado
- Se mezclaba movimiento troncal con movimiento de cadera sin distinguir acompañante vs principal.

### Corrección aplicada
- Movimiento: Flexión y rotación alternadas del tronco; movimiento alternado de cadera (acompañante)
- Articulaciones: columna vertebral (flexión, rotación), cadera (flexión)
- Segmentos: tronco, cadera
- Músculos principales: recto abdominal, oblicuos
- Músculos secundarios: flexores de cadera (sinergistas)
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors (distinción: flexores acompañantes, no grupo principal)
- Confianza: media
- Justificación: Pasos ES indican aproximación codo-rodilla alternada; se distingue componente troncal (flexión/rotación) del movimiento de cadera.

### Justificación biomecánica
- El acercamiento codo-rodilla implica flexión/rotación troncal y flexión de cadera como movimiento acompañante; no se justifica clasificar flexores de cadera como principales con la evidencia disponible.

### Dudas que siguen abiertas
- Grado exacto de participación relativa entre flexores de cadera y tronco según ejecución específica.

## 1512 | all fours squad stretch

### Propuesta anterior
- Categorizado como estiramiento con confusión entre cuádriceps/isquiotibiales

### Problema detectado
- Contradicción target=quads vs muscle_group=hamstrings; nombre ambiguo.

### Corrección aplicada
- Movimiento: Estiramiento pasivo/estático de cuádriceps
- Articulaciones: rodilla (extensión/flexión según posición), cadera
- Segmentos: muslo
- Músculos principales: cuádriceps (estiramiento)
- Músculos secundarios: desconocido
- Inconsistencias: nombre_ambiguo_sin_evidencia; contradiccion_target_muscle_group: target=quads vs muscle_group=hamstrings
- Información insuficiente: No hay evidencia para atribuir isquiotibiales como principales/secundarios; conservar como desconocido lo no demostrado.
- Confianza: media
- Justificación: Instrucciones ES dicen explícitamente "sintiendo un estiramiento en los cuádriceps"; pasos confirman estiramiento en cuadrupedia.

### Justificación biomecánica
- Se trata de estiramiento, no ejercicio concéntrico principal; se corrige hacia cuádriceps con base en texto ES explícito.

### Dudas que siguen abiertas
- Detalles precisos de posición/ángulo no completamente explícitos en pasos ES.

## 0006 | alternate heel touchers

### Propuesta anterior
- Podía inferirse movimiento de hombro

### Problema detectado
- Sin evidencia para atribuir hombro como principal/secundario.

### Corrección aplicada
- Movimiento: Flexión lateral del tronco con alcance lateral
- Articulaciones: columna vertebral (flexión lateral)
- Segmentos: tronco
- Músculos principales: oblicuos
- Músculos secundarios: desconocido
- Información insuficiente: Movimiento del hombro no demostrado como principal/secundario; no se inventa.
- Confianza: media
- Justificación: Pasos ES indican flexión lateral para alcanzar talón; no hay evidencia suficiente para atribuir hombro.

### Justificación biomecánica
- El alcance lateral es consecuencia de flexión lateral troncal, no acción dinámica demostrada del hombro.

### Dudas que siguen abiertas
- Ninguna relevante.

## 0007 | alternate lateral pulldown

### Propuesta anterior
- Movimiento como jalón con posible jerarquización errónea

### Problema detectado
- Nombre dice "alternate" pero instrucciones ES son bilaterales; equipo cable genérico (no identificar máquina CG-EQP); contradicción target/muscle_group.

### Corrección aplicada
- Movimiento: Tracción (adducción/extensión hombro) + flexión codo (bilateral)
- Articulaciones: hombro (adducción/extensión), codo (flexión)
- Segmentos: brazo, tronco
- Músculos principales: dorsal ancho
- Músculos secundarios: rhomboides, bíceps braquial (sinergistas)
- Inconsistencias: nombre_ambiguo_sin_evidencia: 'alternate lateral pulldown' vs instrucciones ES bilaterales; equipo_ambiguo (cable genérico); contradiccion_target_muscle_group: target=lats vs muscle_group=biceps
- Información insuficiente: No se identifica máquina concreta solo por 'cable'.
- Confianza: media
- Justificación: Pasos ES describen tracción bilateral hacia pecho con retracción escapular; nombre dice 'alternado' pero instrucciones indican movimiento bilateral.

### Justificación biomecánica
- Patrón de jalón compatible con dorsal ancho; bíceps como sinergista. Se mantiene cable como genérico sin asignar CG-EQP.

### Dudas que siguen abiertas
- ¿Movimiento realmente alternado o bilateral? Con evidencia actual se considera bilateral.

## 1368 | ankle circles

### Propuesta anterior
- Se atribuían músculos principales (gemelos) incorrectamente

### Problema detectado
- Ejercicio de movilidad articular, no contracción concéntrica demostrada.

### Corrección aplicada
- Movimiento: Circunducción de tobillo (movilidad)
- Articulaciones: tobillo (articulación talocrural/subtalar)
- Segmentos: pie
- Músculos principales: desconocido
- Músculos secundarios: desconocido
- Inconsistencias: target_impreciso: target=calves vs naturaleza articular/movilidad
- Información insuficiente: No hay evidencia para atribuir músculos principales; ejercicio de movilidad/estabilización.
- Confianza: media
- Justificación: Instrucciones/pasos ES describen circunducción articular, no contracción concéntrica de gemelos.

### Justificación biomecánica
- Circunducción es movimiento articular; sin evidencia de activación concéntrica predominante, no se asignan músculos principales.

### Dudas que siguen abiertas
- Participación estabilizadora en ciertos contextos, no demostrada como principal.

## 3293 | archer pull up

### Propuesta anterior
- Jerarquización sin documentar discrepancia

### Problema detectado
- Discrepancia entre target=lats y muscle_group=biceps sin resolver.

### Corrección aplicada
- Movimiento: Tracción vertical asimétrica (adducción/extensión hombro, flexión codo unilateral)
- Articulaciones: hombro (adducción/extensión), codo (flexión)
- Segmentos: brazo, tronco
- Músculos principales: dorsal ancho
- Músculos secundarios: bíceps braquial, braquial, antebrazos, core (sinergistas)
- Inconsistencias: contradiccion_target_muscle_group: target=lats vs muscle_group=biceps (discrepancia documentada, sin resolver)
- Información insuficiente: Relación bíceps vs dorsal requiere mayor evidencia; se documenta discrepancia.
- Confianza: media
- Justificación: Pasos ES indican tracción asimétrica con un brazo recto y otro flexionado; patrón compatible con dorsal ancho.

### Justificación biomecánica
- Patrón asimétrico compatible con dorsal ancho; bíceps documentados como sinergistas. Discrepancia queda registrada sin forzar cambio de principal.

### Dudas que siguen abiertas
- Distribución exacta de carga entre dorsal/bíceps según ejecución.

## 3294 | archer push up

### Propuesta anterior
- Discrepancia no resuelta

### Problema detectado
- target=pectorals vs muscle_group=triceps sin evidencia suficiente para cambiar jerarquía.

### Corrección aplicada
- Movimiento: Empuje asimétrico (flexión/extensión hombro, extensión codo unilateral)
- Articulaciones: hombro (flexión/horizontal adduction), codo (extensión)
- Segmentos: brazo, tronco
- Músculos principales: pectorales mayores
- Músculos secundarios: tríceps braquial, deltoides anterior, core (sinergistas)
- Inconsistencias: contradiccion_target_muscle_group: target=pectorals vs muscle_group=triceps (sin resolver arbitrariamente)
- Información insuficiente: Discrepancia muscular documentada sin evidencia suficiente para cambiar principal.
- Confianza: media
- Justificación: Pasos ES indican empuje asimétrico con un brazo extendido lateral; patrón compatible con pectorales mayores.

### Justificación biomecánica
- Patrón compatible con pectorales mayores; tríceps como sinergistas. Se documenta discrepancia sin resolución arbitraria.

### Dudas que siguen abiertas
- Distribución relativa pectorales/tríceps.

## 2355 | arm slingers hanging bent knee legs

### Propuesta anterior
- Nombre ambiguo, jerarquización confusa

### Problema detectado
- target=abs vs muscle_group=shoulders; soporte isométrico de hombros no es trabajo principal.

### Corrección aplicada
- Movimiento: Flexión de cadera; estabilización abdominal; soporte isométrico de hombros
- Articulaciones: cadera (flexión), columna vertebral (estabilización)
- Segmentos: cadera, tronco
- Músculos principales: flexores de cadera (psoas-ilíaco, recto femoral), recto abdominal
- Músculos secundarios: oblicuos; estabilizadores escapulares/hombros (soporte isométrico)
- Inconsistencias: nombre_ambiguo_sin_evidencia: 'arm slingers'; contradiccion_target_muscle_group: target=abs vs muscle_group=shoulders
- Información insuficiente: Soporte isométrico de hombros distinto a trabajo principal; se distingue del trabajo dinámico.
- Confianza: media
- Justificación: Pasos ES: colgado, rodillas hacia pecho; trabajo primario flexión de cadera + estabilización abdominal, hombros principalmente soporte isométrico.

### Justificación biomecánica
- Elevación de rodillas colgado es principalmente flexión de cadera con estabilización abdominal; agarre requiere soporte isométrico de hombros, no trabajo principal.

### Dudas que siguen abiertas
- Contribución exacta relativa entre flexores de cadera y recto abdominal según ejecución.

## 2333 | arm slingers hanging straight legs

### Propuesta anterior
- Similar a 2355 con mismas confusiones

### Problema detectado
- Mismas inconsistencias; mantener distinción soporte vs trabajo principal.

### Corrección aplicada
- Movimiento: Flexión de cadera; estabilización abdominal; soporte isométrico de hombros
- Articulaciones: cadera (flexión), columna vertebral (estabilización)
- Segmentos: cadera, tronco
- Músculos principales: flexores de cadera (psoas-ilíaco, recto femoral), recto abdominal
- Músculos secundarios: oblicuos; estabilizadores escapulares/hombros (soporte isométrico)
- Inconsistencias: nombre_ambiguo_sin_evidencia: 'arm slingers'; contradiccion_target_muscle_group: target=abs vs muscle_group=shoulders
- Información insuficiente: Soporte isométrico de hombros distinto a trabajo principal; no hay evidencia para atribuir hombros como principales.
- Confianza: media
- Justificación: Pasos ES: colgado, piernas rectas hacia paralelo al suelo; flexión cadera + activación abdominal. Hombros principalmente soporte isométrico.

### Justificación biomecánica
- Con piernas rectas, mayor demanda de flexores de cadera y mayor exigencia de estabilización; hombros siguen siendo soporte isométrico.

### Dudas que siguen abiertas
- Grado de estabilización abdominal vs flexores según rango.

## 3214 | arms apart circular toe touch (male)

### Propuesta anterior
- Complejo con jerarquización tentativa

### Problema detectado
- Movimiento combinado con evidencia insuficiente para asignar principal único; posible confusión con pierna trasera/extensión de cadera.

### Corrección aplicada
- Movimiento: Flexión de tronco desde cintura; extensión/estabilización de cadera de pierna trasera (balanceo alternado)
- Articulaciones: columna vertebral (flexión), cadera (flexión/estabilización), tobillo
- Segmentos: tronco, cadera, pierna
- Músculos principales: desconocido
- Músculos secundarios: desconocido
- Inconsistencias: contradiccion_target_muscle_group: target=glutes vs muscle_group=hamstrings (movimiento combinado); sin evidencia para principal único
- Información insuficiente: Confianza baja. No se afirma extensión activa de cadera demostrada; no se inventa pierna trasera. Acciones desconocidas; requiere mayor evidencia para asignar principales.
- Confianza: baja
- Justificación: Pasos ES indican flexión troncal hacia dedos con pierna trasera recta levantada; no existe evidencia suficiente para jerarquizar músculos sin inferencias no demostradas.

### Justificación biomecánica
- Movimiento complejo (flexión troncal + balanceo). Sin evidencia clara de extensión activa de cadera, no se asignan músculos principales.

### Dudas que siguen abiertas
- ¿Es extensión activa o estabilización? ¿Participación de isquiotibiales/glúteos? Requiere mayor detalle de ejecución.

## 3204 | arms overhead full sit-up (male)

### Propuesta anterior
- Discrepancia target/muscle_group

### Problema detectado
- No se debe asumir incorporación exclusivamente vertebral; flexión de cadera no demostrada como principal.

### Corrección aplicada
- Movimiento: Flexión completa del tronco (curl) hasta posición erguida
- Articulaciones: columna vertebral (flexión toracolumbar)
- Segmentos: tronco
- Músculos principales: recto abdominal
- Músculos secundarios: desconocido
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors
- Información insuficiente: Flexión de cadera no demostrada como principal; no se asume incorporación exclusivamente vertebral sin evidencia completa.
- Confianza: media
- Justificación: Pasos ES indican flexión del tronco hasta torso erguido con brazos extendidos sobre cabeza.

### Justificación biomecánica
- Full sit-up implica mayor rango toracolumbar; con evidencia actual se mantiene recto abdominal como principal sin atribuir flexores de cadera como principales.

### Dudas que siguen abiertas
- Grado de participación de flexores de cadera según técnica/ritmo.

## 0009 | assisted chest dip (kneeling)

### Propuesta anterior
- Jerarquización con posibles confusiones

### Problema detectado
- Necesario distinguir acciones hombro/codo en subida/bajada; jerarquía no definitiva.

### Corrección aplicada
- Movimiento: Empuje vertical (extensión codo, flexión hombro horizontal)
- Articulaciones: hombro (flexión horizontal), codo (extensión)
- Segmentos: brazo, tronco
- Músculos principales: pectorales mayores
- Músculos secundarios: tríceps braquial, deltoides anterior
- Inconsistencias: contradiccion_target_muscle_group: target=pectorals vs muscle_group=triceps
- Información insuficiente: Asistencia genérica ('leverage machine'); distinguir extensión hombro/codo en subida/bajada. Jerarquía no definitiva si evidencia insuficiente.
- Confianza: media
- Justificación: Pasos ES indican fondos asistidos con rodillas; patrón empuje compatible con pectorales mayores y tríceps como participantes.

### Justificación biomecánica
- Patrón empuje compatible con pectorales mayores; tríceps/deltoides anterior como participantes. Se mantiene equipo como genérico (leverage machine) sin asignar CG-EQP concreto.

### Dudas que siguen abiertas
- Distribución relativa según máquina/asistencia exacta.

## 0011 | assisted hanging knee raise

### Propuesta anterior
- Contradicción target/muscle_group

### Problema detectado
- Distinguir flexores de cadera (motores) vs estabilización abdominal; soporte isométrico de hombros.

### Corrección aplicada
- Movimiento: Flexión de cadera; estabilización abdominal
- Articulaciones: cadera (flexión)
- Segmentos: cadera, tronco
- Músculos principales: flexores de cadera, recto abdominal
- Músculos secundarios: oblicuos; estabilizadores escapulares (soporte isométrico)
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors
- Información insuficiente: Equipo 'assisted' identidad física desconocida. Distinguir flexores de cadera (motores) vs estabilización abdominal. Hombros principalmente soporte isométrico.
- Confianza: media
- Justificación: Pasos ES indican flexión cadera/rodillas hacia pecho con activación abdominal.

### Justificación biomecánica
- Elevación rodillas colgado asistido es principalmente flexión de cadera con estabilización abdominal; soporte escapular isométrico.

### Dudas que siguen abiertas
- Contribución relativa flexores/recto abdominal según asistencia.

## 0010 | assisted hanging knee raise with throw down

### Propuesta anterior
- Componente explosivo no analizado

### Problema detectado
- "throw down" requiere cautela; no inventar acciones musculares en descenso; distinguir concéntrico/excéntrico.

### Corrección aplicada
- Movimiento: Flexión de cadera (concéntrico) + extensión controlada/explosiva de cadera/piernas (descenso)
- Articulaciones: cadera (flexión/extensión), rodilla
- Segmentos: cadera, pierna, tronco
- Músculos principales: flexores de cadera, recto abdominal
- Músculos secundarios: oblicuos; estabilizadores (isométricos)
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors
- Información insuficiente: Componente 'throw down' requiere cautela. No se registra extensión dinámica de rodilla si no está descrita; no se inventan acciones musculares en descenso.
- Confianza: media
- Justificación: Pasos ES describen levantar rodillas y lanzar piernas hacia abajo con control/explosividad; flexión de cadera predominante.

### Justificación biomecánica
- Fase concéntrica es flexión de cadera; fase excéntrica/descenso es controlada; no se atribuyen acciones dinámicas no demostradas.

### Dudas que siguen abiertas
- Naturaleza exacta del "throw down" (controlado vs balístico) y su implicación muscular.

## 1708 | assisted lying calves stretch

### Propuesta anterior
- Confusión con isquiotibiales

### Problema detectado
- Contradicción target=calves vs muscle_group=hamstrings; rodilla flexionada modifica participación.

### Corrección aplicada
- Movimiento: Estiramiento estático de tríceps sural
- Articulaciones: tobillo (dorsiflexión)
- Segmentos: pierna
- Músculos principales: tríceps sural (gastrocnemio/soleo) (estiramiento)
- Músculos secundarios: desconocido
- Inconsistencias: contradiccion_target_muscle_group: target=calves vs muscle_group=hamstrings
- Información insuficiente: Rodilla flexionada modifica participación gastrocnemio/soleo; no se atribuye tensión idéntica sin evidencia. Sin evidencia para isquiotibiales.
- Confianza: media
- Justificación: Pasos ES indican tracción dedos hacia cuerpo con rodilla flexionada/posición supina para estirar pantorrilla.

### Justificación biomecánica
- Estiramiento de pantorrilla; gastrocnemio más tensionado con rodilla extendida, soleo con rodilla flexionada. Se documenta variabilidad sin forzar atribución idéntica.

### Dudas que siguen abiertas
- Proporción gastrocnemio/soleo según posición exacta.

## 1709 | assisted lying glutes stretch

### Propuesta anterior
- Confusión con isquiotibiales

### Problema detectado
- Sin evidencia para atribuir isquiotibiales como principales; glúteo mayor/medio no separados sin evidencia.

### Corrección aplicada
- Movimiento: Estiramiento estático de glúteos
- Articulaciones: cadera (flexión/rotación)
- Segmentos: cadera
- Músculos principales: glúteos (estiramiento)
- Músculos secundarios: desconocido
- Inconsistencias: contradiccion_target_muscle_group: target=glutes vs muscle_group=hamstrings
- Información insuficiente: Sin evidencia clara para atribuir glúteo mayor/medio por separado. Sin evidencia para isquiotibiales como principales.
- Confianza: media
- Justificación: Posición figura 4 con tracción muslo hacia pecho indica estiramiento glúteo.

### Justificación biomecánica
- Figura 4 (hip flexion + external rotation) indica estiramiento glúteo; no se justifica subdivisión sin evidencia.

### Dudas que siguen abiertas
- Contribución relativa glúteo mayor/medio/piriforme.

## 1710 | assisted lying gluteus and piriformis stretch

### Propuesta anterior
- Piriforme atribuido sin evidencia suficiente

### Problema detectado
- Nombre indica piriforme pero pasos comparables a 1709; posible duplicidad.

### Corrección aplicada
- Movimiento: Estiramiento estático de glúteos/piriforme
- Articulaciones: cadera (flexión/rotación externa)
- Segmentos: cadera
- Músculos principales: glúteos (estiramiento)
- Músculos secundarios: piriforme (estiramiento, no confirmado como principal)
- Inconsistencias: contradiccion_target_muscle_group: target=glutes vs muscle_group=hamstrings; posible duplicidad con 1709
- Información insuficiente: Piriforme como objetivo no confirmado únicamente por nombre. Pasos ES idénticos/comparables a 1709; evidencia insuficiente para asignar como principal demostrado.
- Confianza: baja
- Justificación: Comparación con ID 1709 sugiere posible duplicidad; se mantiene piriforme como secundario/no confirmado sin evidencia suficiente.

### Justificación biomecánica
- Piriforme puede participar, pero con evidencia actual no se justifica como principal demostrado; se mantiene registro de posible duplicidad.

### Dudas que siguen abiertas
- ¿Son ejercicios idénticos? Requiere verificación cruzada completa. ¿Participación piriforme demostrada?

## 0012 | assisted lying leg raise with lateral throw down

### Propuesta anterior
- Nombre confuso (menciona "colgado" cuando es decúbito); trabajo oblicuo mal atribuido

### Problema detectado
- Ejecución en decúbito, no colgado; descenso lateral aporta estabilización, no trabajo dinámico demostrado de oblicuos.

### Corrección aplicada
- Movimiento: Flexión de cadera + descenso excéntrico lateral; estabilización troncal
- Articulaciones: cadera (flexión), columna vertebral (estabilización)
- Segmentos: cadera, tronco
- Músculos principales: flexores de cadera, recto abdominal
- Músculos secundarios: oblicuos (estabilizadores; no trabajo dinámico demostrado)
- Inconsistencias: contradiccion_target_muscle_group: target=abs vs muscle_group=hip flexors; nombre_confuso: no 'colgado' si decúbito
- Información insuficiente: Corregir nombre descriptivo (ejecución en decúbito). Descenso lateral aporta estabilización oblicua; no se atribuye trabajo dinámico de oblicuos. Equipo 'assisted' genérico.
- Confianza: media
- Justificación: Pasos ES indican elevar piernas rectas y bajarlas lateralmente; flexión cadera predominante con estabilización oblicua.

### Justificación biomecánica
- Elevación es flexión de cadera con estabilización abdominal; descenso lateral requiere control/estabilización oblicua, pero no se demuestra trabajo dinámico concéntrico predominante.

### Dudas que siguen abiertas
- Cuantificación de demanda oblicua según amplitud/control.
