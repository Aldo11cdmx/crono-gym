# Fase 2 - Diccionarios controlados (diseno documental)

Modo: READ-ONLY. No se modifican catalogos, codigo, migraciones, disponibilidad ni IDs.

## 1. Principios de evidencia

| Nivel | Fuente | Uso permitido |
|---|---|---|
| E1 | Campo estructurado del dataset | Fuente principal para musculo, equipo, grupo y objetivo |
| E2 | Texto de instrucciones o descripcion | Refuerzo o desambiguacion documentada |
| E3 | Regla experta explicita y documentada | Solo si esta registrada en esta fase |
| E4 | Nombre del ejercicio | Solo desempate; nunca unica fuente de musculo principal, patron o implemento |

Regla: si un valor solo puede derivarse de E4, el valor es `unknown`.

## 2. Taxonomia muscular

Identificador estable propuesto: `muscle.*` en ingles snake_case. Etiqueta de presentacion en `es-MX`.

| ID | Nombre canonico | Grupo | Definicion | Inclusion | Exclusion | Sinonimos conocidos | Ejemplos | Casos ambiguos |
|---|---|---|---|---|---|---|---|---|
| muscle.chest.pectorals | Pectorals | chest | Musculo principal del pecho | Presses, fondos, aperturas, flexiones | Deltoides anteriores y triceps son secundarios | chest, pectorals, upper chest | barbell bench press, push-up | No distinguir pectoral superior/inferior sin evidencia E1/E2 |
| muscle.shoulders.delts | Deltoids | shoulders | Musculo principal del hombro | Presses, elevaciones, remos al menton | Trapecio y triceps son secundarios | shoulders, deltoids, delts | barbell shoulder press, lateral raise | No separar anterior/medio/posterior sin evidencia explicita |
| muscle.arms.biceps | Biceps | upper arms | Flexores principales del codo | Curls, dominadas supinas, remos con agarre supino | Braquial y braquiorradial son secundarios | biceps, brachialis | barbell curl, hammer curl | Hammer curl puede enfatizar braquiorradial; no forzar |
| muscle.arms.triceps | Triceps | upper arms | Extensores principales del codo | Extensiones, fondos, presses cerrados | Anconeo y deltoides posteriores son secundarios | triceps | triceps dip, skull crusher | No confundir extension de codo con press de hombro |
| muscle.arms.forearms | Forearms | lower arms | Flexores/extensores de muneca y agarre | Curls de muneca, farmer carry, agarres | Biceps y triceps son primarios en otros movimientos | forearms, wrist flexors, wrist extensors | wrist curl, farmer carry | No convertir agarre en musculo principal sin evidencia |
| muscle.back.upper_back | Upper back | back | Retractores y estabilizadores escapulares | Remos, face pulls, retracciones | Lats y trapecios pueden ser primarios o secundarios | upper back, rhomboids, traps, trapezius | barbell row, seated row | No fusionar lats y upper back sin evidencia |
| muscle.back.lats | Latissimus dorsi | back | Principal en traccion vertical y adduccion del hombro | Dominadas, jalones, remos cerrados | Biceps y teres major son secundarios | lats, latissimus dorsi | pull-up, lat pulldown | Dominadas y jalones no son identicos por implemento |
| muscle.back.spine | Spine / lower back | waist/back | Extension y estabilizacion del tronco | Hiperextensiones, good mornings, deadlifts | Gluteos e isquiotibiales son primarios en bisagra | lower back, spine, lumbar | back extension, good morning | No convertir estabilizacion en musculo principal |
| muscle.core.abs | Abdominals | waist | Flexion y estabilizacion del tronco | Crunches, sit-ups, planchas | Oblicuos e hip flexors son secundarios | abs, abdominals, core, lower abs | crunch, plank | No convertir core en abs sin evidencia |
| muscle.core.obliques | Obliques | waist | Rotacion y flexion lateral del tronco | Woodchoppers, side bends, rotaciones | Abs y quadratus lumborum son secundarios | obliques | russian twist, side bend | No inferir rotacion solo por nombre |
| muscle.legs.quadriceps | Quadriceps | upper legs | Extension de rodilla | Sentadillas, prensas, extensiones | Gluteos e isquiotibiales son secundarios | quadriceps, quads | squat, leg extension | No asumir cuadriceps primario en toda sentadilla |
| muscle.legs.hamstrings | Hamstrings | upper legs | Flexion de rodilla y extension de cadera | Curl femoral, RDL, good mornings | Gluteos y pantorrillas son secundarios | hamstrings | leg curl, romanian deadlift | No confundir hip thrust con bisagra |
| muscle.legs.glutes | Glutes | upper legs | Extension y abduccion de cadera | Hip thrust, sentadillas, zancadas | Isquiotibiales y cuadriceps son secundarios | glutes, gluteus | hip thrust, lunge | No asumir gluteo primario sin evidencia |
| muscle.legs.adductors | Adductors | upper legs | Aduccion de cadera | Aduccion, sentadillas sumo | Abductores y gluteos son secundarios | adductors, inner thighs, groin | adductor machine, sumo squat | No inferir aduccion solo por stance |
| muscle.legs.abductors | Abductors | upper legs | Abduccion de cadera | Abduccion, clamshells | Gluteos y aductores son secundarios | abductors, gluteus medius | abductor machine | No confundir abduccion con gluteo |
| muscle.legs.calves | Calves | lower legs | Flexion plantar | Elevaciones de talon | Soleo y tibial anterior son secundarios | calves, soleus | calf raise, seated calf raise | No confundir seated y standing sin evidencia |
| muscle.neck.neck | Neck | neck | Flexion, extension y rotacion cervical | Flexiones y extensiones de cuello | Trapecio es secundario | neck, sternocleidomastoid | neck flexion | No convertir trapecio en cuello |
| muscle.cardio.cardiovascular | Cardiovascular system | cardio | Sistema cardiovascular como objetivo de ejercicio | Cardio y acondicionamiento | No es musculo esqueletico | cardiovascular system | running, cycling | No clasificar cardio como musculo principal esqueletico |

Roles musculares:
- `primary`: musculo principal declarado por E1 o E2.
- `secondary`: sinergista o musculo de apoyo con evidencia E1 o E2.
- `stabilizer`: solo con evidencia E1, E2 o E3 documentada. Si solo se infiere, usar `unknown`.

## 3. Patrones de movimiento

### 3.1 Familia de patron (`pattern_family`)

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Sinonimos | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|---|
| pattern.push | Push | Empuje de una carga alejandola del cuerpo | Presses, fondos, flexiones | Traccion o elevacion sin empuje | press, push | bench press, push-up | No inferir solo por nombre |
| pattern.pull | Pull | Traccion de una carga hacia el cuerpo | Remos, jalones, dominadas | Empuje o elevacion | row, pull, pulldown | barbell row, pull-up | No inferir solo por nombre |
| pattern.squat | Squat | Flexion y extension de rodilla con carga axial o vertical | Sentadillas, prensas, hack squat | Bisagra de cadera o zancada | squat, press | back squat, leg press | No asumir sentadilla por nombre |
| pattern.hinge | Hinge | Extension de cadera con carga | Peso muerto, RDL, good morning | Sentadilla o extension de rodilla | deadlift, hinge, good morning | romanian deadlift | No confundir con hip thrust |
| pattern.lunge_unilateral | Lunge / unilateral | Zancadas, split squats y trabajo unilateral de pierna | Zancadas, step-ups, split squats | Sentadilla bilateral | lunge, split squat, step-up | walking lunge | No inferir unilateralidad solo por nombre |
| pattern.carry_load | Carry / load | Transporte o carga sostenida | Farmer carry, yoke, sled push | Levantamiento sin desplazamiento | carry, load, sled | farmer carry | No clasificar transporte como fuerza maxima |
| pattern.core | Core | Estabilizacion o flexion del tronco | Planchas, crunches, rotaciones | Movimiento de extremidades sin tronco | core, crunch, plank | plank, russian twist | No convertir todo abdomen en core |
| pattern.isolation | Isolation | Movimiento monoarticular de un musculo | Curls, extensiones, elevaciones | Movimientos compuestos | curl, extension, raise | biceps curl, leg extension | No asumir aislamiento por nombre |
| pattern.locomotion_cardio | Locomotion / cardio | Desplazamiento o acondicionamiento cardiovascular | Caminar, correr, remar, bici, eliptica | Fuerza con cardio incidental | run, walk, bike, row, cardio | treadmill run, cycling | No clasificar cardio como fuerza |
| pattern.mobility_stretch | Mobility / stretch | Movilidad, estiramiento o recuperacion | Estiramientos, movilidad articular | Ejercicio con carga | stretch, mobility | hamstring stretch | No clasificar estiramiento con carga |
| pattern.plyometric | Plyometric | Accion explosiva o de rebote | Saltos, bounds, clap push-ups | Fuerza lenta o cardio | jump, plyometric, bound | jump squat | No inferir explosividad solo por nombre |
| pattern.other | Other | Movimiento no clasificable con evidencia actual | Casos residuales | Todo lo clasificable | - | - | Usar solo con unresolved question |

### 3.2 Accion articular fina (`primary_joint_action`)

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|
| action.push_horizontal | Push horizontal | Empuje en plano horizontal | Bench press, push-up | Press vertical o fly | bench press, push-up | No inferir solo por nombre |
| action.push_vertical | Push vertical | Empuje en plano vertical | Shoulder press, dip | Press horizontal | shoulder press, dip | No inferir solo por nombre |
| action.pull_horizontal | Pull horizontal | Traccion en plano horizontal | Barbell row, seated row | Jalones verticales | row | bent over row | No inferir solo por nombre |
| action.pull_vertical | Pull vertical | Traccion en plano vertical | Pull-up, lat pulldown | Remos horizontales | pull-up, pulldown | lat pulldown | No inferir solo por nombre |
| action.hip_extension | Hip extension | Extension de cadera | Deadlift, hip thrust, good morning | Flexion de rodilla aislada | deadlift, hip thrust | romanian deadlift | No confundir con sentadilla |
| action.knee_flexion_extension | Knee flexion/extension | Flexion o extension de rodilla | Squat, leg extension, leg curl | Bisagra de cadera | squat, leg extension, leg curl | leg press | No asumir rodilla primaria |
| action.elbow_flexion_extension | Elbow flexion/extension | Flexion o extension de codo | Curl, triceps extension | Movimiento de hombro | curl, triceps extension | skull crusher | No asumir codo primario |
| action.shoulder_abduction_adduction | Shoulder abduction/adduction | Abduccion o aduccion de hombro | Lateral raise, cable crossover | Flexion/extension de hombro | lateral raise, fly | cable crossover | No inferir plano solo por nombre |
| action.scapular_elevation_retraction | Scapular elevation/retraction | Elevacion o retraccion escapular | Shrugs, face pulls | Remo general | shrug, face pull | shrug | No convertir trapecio en patron principal |
| action.ankle_plantarflexion | Ankle plantarflexion | Flexion plantar | Calf raise | Dorsiflexion | calf raise | seated calf raise | No confundir seated y standing |
| action.wrist_flexion_extension | Wrist flexion/extension | Flexion o extension de muneca | Wrist curl | Agarre o flexion de codo | wrist curl | wrist roller | No convertir agarre en accion principal |
| action.rotation | Rotation | Rotacion del tronco o cadera | Russian twist, woodchopper | Flexion lateral | twist, rotation | russian twist | No inferir rotacion solo por nombre |
| action.anti_rotation | Anti-rotation | Resistencia a la rotacion | Pallof press | Rotacion dinamica | pallof | pallof press | No confundir con rotacion |
| action.trunk_flexion_extension_lateral | Trunk flexion/extension/lateral | Flexion, extension o flexion lateral del tronco | Crunch, back extension, side bend | Rotacion | crunch, back extension, side bend | cable crunch | No inferir solo por nombre |

## 4. Planos de movimiento

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Sinonimos | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|---|
| plane.sagittal | Sagittal | Movimiento en plano sagital | Flexion/extension, sentadillas, bisagras | Abduccion/aduccion | sagittal | squat, deadlift | No inferir por nombre |
| plane.frontal | Frontal | Movimiento en plano frontal | Abduccion/aduccion, elevaciones laterales | Flexion/extension | frontal | lateral raise | No inferir por nombre |
| plane.transverse | Transverse | Movimiento en plano transverso | Rotaciones | Flexion o abduccion | transverse | russian twist | No inferir por nombre |
| plane.multi | Multi-plane | Combinacion de planos | Movimientos complejos o multiarticulares | Movimiento claramente uniplanar | multi-plane | snatch, clean | No forzar un plano unico |
| plane.unknown | Unknown | No determinable con evidencia | Casos sin E1/E2/E3 | Todo lo determinable | unknown | - | Usar cuando falte evidencia |

## 5. Tipos de resistencia

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Sinonimos | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|---|
| resistance.bodyweight | Bodyweight | Resistencia corporal | Ejercicios sin carga externa | Carga externa obligatoria | body weight | push-up, plank | `weighted` puede modificarlo |
| resistance.free_weight | Free weight | Resistencia con peso libre | Mancuernas, barras, kettlebells, discos | Maquinas guiadas | dumbbell, barbell, kettlebell | dumbbell curl | No confundir con machine |
| resistance.cable | Cable | Resistencia por polea | Ejercicios con cable/polea | Peso libre o maquina guiada | cable, pulley | cable row | Accesorio no define resistencia |
| resistance.plate_loaded | Plate-loaded machine | Maquina cargada con discos | Maquinas con brazos y discos | Selectorizadas | leverage machine, plate-loaded | leg press | No asumir por nombre |
| resistance.selectorized | Selectorized machine | Maquina con selector de peso | Maquinas con stack de pesas | Carga libre | selectorized machine | chest press machine | No asumir por nombre |
| resistance.band | Band | Resistencia elastica | Bandas y ligas | Peso libre o maquina | band, resistance band | band squat | No confundir con cable |
| resistance.other | Other | Resistencia no clasificable | Casos residuales | Todo lo clasificable | - | - | Usar con unresolved question |
| resistance.unknown | Unknown | No determinable | Sin evidencia suficiente | Todo lo determinable | unknown | - | No inferir por nombre |

## 6. Lateralidad

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Sinonimos | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|
| laterality.bilateral | Bilateral | Ambos lados simultaneamente | Movimiento simetrico | Unilateral o alterno | bilateral | barbell squat | No inferir por nombre |
| laterality.unilateral | Unilateral | Un solo lado por repeticion | Ejercicio de un lado | Bilateral o alterno | unilateral, one arm, one leg | single arm row | No inferir por nombre |
| laterality.alternating | Alternating | Lados alternos por repeticion | Movimiento alterno | Bilateral o unilateral fijo | alternating, alternate | alternating curl | No inferir por nombre |
| laterality.unknown | Unknown | No determinable | Sin evidencia suficiente | Todo lo determinable | unknown | - | No inferir por nombre |

## 7. Cadena cinetica

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Sinonimos | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|---|
| kinetic_chain.open | Open | Extremidad distal libre | Extensiones, curls, elevaciones | Pies o manos fijos | open chain | leg extension | No inferir por nombre |
| kinetic_chain.closed | Closed | Extremidad distal fija | Sentadillas, fondos, flexiones | Extremidad distal libre | closed chain | squat, push-up | No inferir por nombre |
| kinetic_chain.mixed | Mixed | Combinacion o transicion | Movimientos mixtos | Claramente abierto o cerrado | mixed | lunge with rotation | No forzar clasificacion |
| kinetic_chain.unknown | Unknown | No determinable | Sin evidencia suficiente | Todo lo determinable | unknown | - | No inferir por nombre |

## 8. Tipos de implementos

| ID | Nombre canonico | Definicion | Inclusion | Exclusion | Sinonimos | Ejemplos | Ambiguedad |
|---|---|---|---|---|---|---|---|
| implement.bodyweight | Bodyweight | Sin implemento externo | Ejercicios de peso corporal | Carga externa obligatoria | body weight | push-up, plank | `weighted` puede anadir carga |
| implement.dumbbell | Dumbbell | Mancuerna | Ejercicios con mancuerna | Barra, polea, maquina | dumbbell | dumbbell curl | No confundir con kettlebell |
| implement.straight_barbell | Straight barbell | Barra recta | Ejercicios con barra recta | Barra Z, hexagonal, maquina | barbell | barbell bench press | No asumir por nombre |
| implement.olympic_barbell | Olympic barbell | Barra olimpica | Ejercicios con barra olimpica | Barra recta generica | olympic barbell | deadlift | No asumir por nombre |
| implement.ez_barbell | EZ barbell | Barra Z | Ejercicios con barra Z | Barra recta | ez barbell | spider curl | No asumir por nombre |
| implement.hex_bar | Hex bar | Barra hexagonal | Ejercicios con trap bar | Barra recta | trap bar, hex bar | hex bar deadlift | No asumir por nombre |
| implement.kettlebell | Kettlebell | Pesa rusa | Ejercicios con kettlebell | Mancuerna o barra | kettlebell | kettlebell swing | No asumir por nombre |
| implement.cable_attachment | Cable attachment | Polea con accesorio | Ejercicios con cable y accesorio | Peso libre o maquina guiada | cable, rope, bar | cable row | El accesorio no define resistencia |
| implement.plate_loaded_machine | Plate-loaded machine | Maquina cargada con discos | Maquinas con brazos y discos | Selectorizadas | leverage machine | leg press | No asumir por nombre |
| implement.selectorized_machine | Selectorized machine | Maquina con selector de peso | Maquinas con stack | Carga libre | selectorized machine | chest press machine | No asumir por nombre |
| implement.smith_machine | Smith machine | Maquina Smith | Ejercicios en Smith | Barra libre | smith machine | smith squat | No asumir por nombre |
| implement.bench | Bench | Banco como implemento o soporte | Ejercicios sobre banco | Maquina guiada | bench | bench press | Subtipo: flat, incline, decline, adjustable |
| implement.band | Band | Banda elastica | Ejercicios con banda | Cable o peso libre | band, resistance band | band squat | No confundir con cable |
| implement.accessory | Accessory | Accesorio no principal | Cinturon, tobillera, barra de dominadas | Implemento principal | belt, cuff, pull-up bar | weighted pull-up | No convertir accesorio en implemento principal |
| implement.cardio_machine | Cardio machine | Maquina cardiovascular | Cardio y acondicionamiento | Fuerza | treadmill, bike, elliptical | treadmill run | No clasificar cardio como fuerza |
| implement.unknown | Unknown | No determinable | Sin evidencia suficiente | Todo lo determinable | unknown | - | No inferir por nombre |

## 9. Evidencia y confianza

| Estado | Definicion | Uso |
|---|---|---|
| E1 | Campo estructurado del dataset | Fuente principal |
| E2 | Texto de instrucciones o descripcion | Refuerzo o desambiguacion |
| E3 | Regla experta explicita y documentada | Solo si esta registrada |
| E4 | Nombre del ejercicio | Solo desempate |

| Confianza | Definicion |
|---|---|
| high | E1 claro y sin contradiccion; o E2/E3 documentada que confirma |
| medium | E1 presente pero incompleto, o E2 coherente con E1 |
| low | Solo E4, contradiccion entre fuentes, o evidencia insuficiente |

| Estado de revision | Definicion |
|---|---|
| `needs_human_review` | Clasificacion asistida o evidencia insuficiente |
| `reviewed` | Revisado por humano |
| `accepted` | Aceptado como verdad de trabajo |

`unknown` es un valor valido y no debe convertirse en `available`, `unavailable`, ni en una clasificacion forzada.

## 10. Excepciones obligatorias

### Cinco pares SAME_EXERCISE

Se conservan sus IDs originales y se documentan como relacion `same_semantic_exercise`:

- `0088` y `1371`
- `0454` y `1628`
- `0577` y `0576`
- `0655` y `0656`
- `0763` y `1394`

No se fusionan, eliminan ni reasignan.

### Par DIFFERENT_EXERCISE

- `0697` y `1766` comparten nombre, pero describen ejecuciones distintas y no se tratan como el mismo ejercicio.

### 41 ejercicios kettlebell

La contradiccion de disponibilidad permanece abierta. No se modifica `availableInCronosGym` ni se usa como evidencia concluyente de disponibilidad fisica.

### 41 hallazgos UNRESOLVED

Se mantienen en el registro de incertidumbres. No se fuerzan clasificaciones.

## 11. Crosswalk hacia identificadores actuales

| Taxonomia futura | Identificador actual | Fuente |
|---|---|---|
| Musculo | Anatomy slug | `src/lib/muscleMap.ts` |
| Musculo | Etiqueta es-MX | `src/lib/i18n.ts` (`MUSCLE_LABELS_ES`) |
| Musculo | `body_part`, `target`, `muscle_group` | `src/data/exercisesCatalog.json` |
| Patron | No existe actualmente | Campo propuesto |
| Implemento | `equipment` | `src/data/exercisesCatalog.json` |
| Implemento | Tags de gym | `src/data/myGymEquipment.ts` |
| Equipo | `equipment_id`, `equipment_name` | `src/data/exercisesCatalog.json` |
| Equipo | `CG-EQP-####` | `src/data/equipmentMap.ts` |
| Equipo | Categorias | `src/data/equipmentCatalog.ts` |
| Equipo | Slugs de tipo de ejercicio | `src/data/availableEquipment.ts` |

## 12. Dictamen de preparacion

Estado: READY_WITH_CONDITIONS

Condiciones para avanzar:
1. No clasificar definitivamente los 1,324 ejercicios.
2. No implementar contratos de datos.
3. No modificar `SmartSwap` ni `exerciseSwap`.
4. No asignar IDs `CG-EQP` a ejercicios.
5. Conservar los 5 pares SAME_EXERCISE sin fusionar.
6. Mantener la contradiccion de kettlebell abierta.
7. Mantener los 41 hallazgos UNRESOLVED.
8. Usar `unknown` cuando la evidencia sea insuficiente.

Detenido en espera de aprobacion humana para Fase 3.
