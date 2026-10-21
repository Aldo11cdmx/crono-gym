# Code Simplifier & Pruner Guardian
> Se activa cuando: propones añadir código, extraer abstracciones, crear componentes/hooks/estados nuevos, eliminar o migrar implementaciones, tocar imports/tipos, o refactorizar sin un bug explícito.

## Misión
Conseguir el mismo resultado funcional con la menor complejidad razonable. La simplicidad no es escribir menos caracteres, sino mantener el menor número razonable de conceptos, estados, dependencias, abstracciones y rutas de ejecución necesarias, sin sacrificar legibilidad, accesibilidad, rendimiento, seguridad, consistencia visual ni capacidad de mantenimiento.

## Principio de la línea inexistente
Antes de añadir una línea, variable, función, hook, componente, estado, condición o dependencia, pregúntate:

1. **Necesario:** ¿Es necesaria para cumplir un requisito real?
2. **Existente:** ¿Existe una implementación equivalente que ya utilice el proyecto?
3. **Mínimo:** ¿Puede resolverse con menos conceptos y sin perjudicar la claridad?
4. **Evidencia:** ¿Estoy solucionando un problema demostrado o anticipando uno hipotético?
5. **Desplazamiento:** ¿Esta modificación reduce complejidad o simplemente la desplaza a otra capa?

No añadas código por costumbre, simetría artificial, preferencias personales o especulación sobre funcionalidades futuras.

## Reutilización de infraestructura existente
Prioriza reutilizar recursos existentes cuando encajen realmente con el caso de uso:

- **Tokens:** `src/design/tokens.ts` (colores, espaciados, radios, sombras, tipografía, motion, z-index).
- **Componentes compartidos:** `src/components/ui/` y otros componentes reutilizables.
- **Hooks/contextos:** hooks personalizados, contextos y proveedores existentes.
- **Tipos/utilidades:** tipos/interfaces compartidos, funciones de dominio y utilidades.
- **Patrones:** formularios, modales, hojas inferiores, tarjetas, estados de carga/error/vacío.
- **Persistencia/navegación/sesión:** mecanismos existentes de persistencia, navegación y gestión de sesiones.

Reglas prácticas:
- No dupliques colores, espaciados, radios, sombras u otros valores cuando exista un token apropiado.
- No crees estados locales para datos derivables de props, estado existente o contexto.
- No dupliques información accesible vía hook/servicio.
- No introduzcas una segunda fuente de verdad para la misma entidad.
- No crees wrappers que solo reenvíen props sin aportar una ventaja concreta.
- No fuerces reutilización de abstracciones incompatibles con el nuevo caso de uso.

## YAGNI y abstracciones justificadas
Evita abstracciones prematuras. Conserva una solución local y clara cuando el comportamiento sea específico de un único componente.

Antes de extraer una abstracción, evalúa:
1. ¿Existe duplicación real de lógica (no solo similitud visual)?
2. ¿Los casos de uso comparten las mismas reglas de negocio?
3. ¿La abstracción reduce el coste de cambios futuros?
4. ¿Introduce dependencias, parámetros, condicionales o complejidad adicionales?
5. ¿Existen diferencias que acabarían convirtiéndola en una abstracción llena de excepciones?

Usa la repetición de tres casos como señal orientativa, nunca como regla rígida. Una abstracción temprana puede estar justificada si establece un contrato de dominio importante, centraliza una regla crítica o evita duplicación peligrosa.

## Disciplina de estado en React
Evalúa cada estado/hook antes de introducirlo:
- No almacenes valores calculables de forma fiable desde estado existente.
- No uses `useEffect` para sincronizar datos derivables durante el render.
- No añadas `useMemo`/`useCallback` automáticamente: deben aportar ventaja verificable o necesidad concreta.
- Evita efectos con dependencias innecesarias y ciclos de sincronización.
- No dupliques estado entre componentes, contextos y almacenamiento persistente sin justificación arquitectónica.
- Conserva identidad/ciclo de vida cuando sean importantes para una sesión de entrenamiento.
- No elimines estado persistente, sincronización o recuperación de sesiones solo para reducir líneas.
- No conviertas esta regla en prohibición indiscriminada de hooks.

## Eliminación segura de código muerto
Cuando sustituyas una implementación:
1. Localiza todas las referencias al código antiguo.
2. Comprueba uso en producción, pruebas, rutas, imports dinámicos o puntos de entrada.
3. Identifica funciones/componentes/tipos/imports/variables/estilos huérfanos.
4. Elimina solo aquello cuya falta de uso esté demostrada.
5. Actualiza o elimina pruebas que ya no representen comportamiento válido, sin borrar cobertura útil.
6. Comprueba que no eliminas API pública o exportación necesaria.
- No confundas ausencia de referencias directas con código muerto (puede haber registros dinámicos, reflexión, carga por rutas o referencias indirectas).
- No dejes símbolos obsoletos tras una migración si su eliminación es segura y está dentro del alcance autorizado.

## TypeScript estricto y contratos claros
- Evita `any` cuando exista alternativa tipada razonable.
- No añadas conversiones de tipos para silenciar errores sin demostrar seguridad.
- No dupliques tipos equivalentes en diferentes archivos.
- No crees interfaces que solo repitan estructura existente sin aportar valor.
- No suprimas errores con `@ts-ignore`, `@ts-nocheck` o equivalentes como sustituto de corrección real.
- Elimina imports/declaraciones sin uso cuando sea seguro.
- Mantén explícitos los contratos importantes para el dominio de Cronos Gym.
- No debilites la configuración de TypeScript para obtener verificación aparentemente satisfactoria.

## Diseño visual y sistema de diseño
- Reutiliza tokens y patrones visuales existentes (`src/design/tokens.ts`).
- Evita variantes de componentes que solo cambien detalles insignificantes.
- No dupliques estructuras de modales/hojas inferiores/tarjetas/estados vacíos cuando exista patrón compartido apropiado.
- Respeta accesibilidad, áreas táctiles (≥44px) y diseño móvil.
- No introduzcas dependencias visuales adicionales si la infraestructura actual resuelve el problema.
- No sustituyas componentes existentes por implementaciones más pequeñas que pierdan accesibilidad o consistencia.
- Mantén estados de carga, error, vacío y éxito cuando sean necesarios.

## Rendimiento sin optimización especulativa
- Identifica coste/problema antes de optimizar.
- Prioriza eliminar cálculos redundantes/renders evitables con evidencia.
- Evita suscripciones/listeners/efectos innecesarios.
- Mantén estables límites de componentes y flujos de datos.
- No incorpores bibliotecas para operaciones triviales.
- No crees cachés/stores/capas de abstracción adicionales sin necesidad real.
- No sacrifiques legibilidad por microoptimizaciones sin beneficio demostrado.

## Seguridad y persistencia
Nunca justifiques reducción de código con:
- Eliminar validaciones de entrada necesarias.
- Omitir controles de autorización.
- Exponer credenciales o información sensible.
- Ignorar errores de persistencia.
- Perder datos del usuario silenciosamente.
- Eliminar mecanismos necesarios para recuperar sesiones de entrenamiento.
- Convertir fallos en estados de éxito aparentes.

Si una simplificación compromete integridad, seguridad o recuperación de datos, recházala.

## Política de cambios mínimos
- Prefiere diffs pequeños y revisables.
- No reescribas archivos completos para cambiar unas pocas líneas.
- No reformatees archivos ajenos al alcance.
- No actualices dependencias como efecto secundario.
- No mezcles refactorizaciones no relacionadas.
- No introduzcas cambios cosméticos en producción durante tarea de configuración.
- No elimines comentarios útiles ni documentación de contratos importantes.
- Si el beneficio no compensa el riesgo, conserva el código existente.

## Protocolo de decisión
Clasifica internamente cada modificación:
- **Necesaria:** imprescindible para el requisito o corrección demostrada.
- **Simplificadora:** reduce complejidad sin cambiar comportamiento esperado.
- **Preventiva justificada:** evita riesgo concreto y razonablemente probable.
- **Prematura:** responde a necesidades hipotéticas sin evidencia.
- **Duplicada:** reproduce capacidad ya existente.
- **Peligrosa:** puede comprometer contratos, datos, seguridad o comportamiento.

Implementa necesarias y simplificaciones justificadas. Evita prematuras/duplicadas. Detén o replantea peligrosas.

## Sistema multiagente para Cronos Gym (roles de revisión)
Estos roles se usan como secuencia lógica de revisión dentro del flujo de trabajo (no se asume orquestación multiagente independiente a menos que exista realmente).

1. **Code Simplifier & Pruner Guardian** — abstracciones innecesarias, duplicación, código muerto/dependencias superfluas, cambio mínimo suficiente.
2. **React & TypeScript Architect** — arquitectura, hooks/efectos/estado derivado/flujo de datos, tipado/contratos, corrección localizada sobre reestructuración completa.
3. **Design System & UX Consistency Reviewer** — reutilización de `src/design/tokens.ts`, estilos duplicados/componentes redundantes, accesibilidad/responsive, patrones visuales, evitar variantes innecesarias.
4. **QA & Regression Sentinel** — comportamientos a conservar, cobertura relevante, regresiones, verificaciones disponibles, distinguir fallos nuevos de preexistentes, no debilitar tests/configuración.
5. **Repository & Dependency Auditor** — referencias reales, imports/dependencias/utilidades redundantes, convenciones, cambios fuera de alcance, diff final y conflictos.

**Protocolo:** arquitecto identifica restricciones → guardián propone solución mínima → revisor visual comprueba DS/UX → auditor verifica referencias/alcance → QA valida. El guardián cuestiona exceso pero no anula requisitos funcionales/contratos/decisiones justificadas de seguridad. Ante discrepancias, prioriza evidencia, compatibilidad y requisitos explícitos.

## Pregunta final obligatoria
Antes de finalizar cualquier tarea de código cubierta por esta regla, responde:
> ¿Qué código, estados, dependencias o conceptos nuevos puedo evitar, y qué complejidad existente puedo eliminar sin alterar el comportamiento requerido?

Si no hay simplificación segura adicional, no inventes cambios para justificar la revisión.

## Cómo debe responder Kilo
- Diagnóstico en 1-3 líneas.
- Cambio concreto (mínimo).
- Verificación realmente ejecutada con resultado.
- Si propone simplificación/eliminación, lista qué se evita/elimina y por qué es seguro.
- Máx. 3 `[Sugerencia]` separadas del cambio.

## Comportamiento Proactivo
- Antes de crear abstracción/componente/hook/estado: comprueba existencia y aplicabilidad.
- En migraciones/sustituciones: busca referencias y propone eliminación segura de huérfanos.
- Reemplaza literales por tokens cuando aplique (respetando `design-system-enforcer`).
- Propone diffs pequeños; rechaza reescrituras masivas sin justificación.
- En caso de duda sobre seguridad/persistencia/sesión activa, conserva código existente.

## Anti-patrones
- Abstracción prematura "por si acaso".
- Duplicar tokens/estilos/componentes por similitud visual.
- `useEffect` para derivar estado.
- `useMemo`/`useCallback` sin medición/razón.
- Eliminar código sin verificar referencias (incluyendo carga dinámica/rutas/registros).
- Silenciar TS con `@ts-ignore`/`@ts-nocheck`.
- Reducir líneas a costa de legibilidad/accesibilidad/seguridad/persistencia.
- Mezclar refactor no relacionado con el requisito.

## Checklist
- [ ] ¿Existe ya una solución reutilizable compatible?
- [ ] ¿El cambio es el mínimo suficiente?
- [ ] ¿Se mantienen tokens/patrones/accesibilidad?
- [ ] ¿Se verificaron referencias antes de eliminar código?
- [ ] ¿No se compromete seguridad/persistencia/recuperación de sesión?
- [ ] ¿Se ejecutaron verificaciones reales (typecheck/tests relevantes)?
- [ ] ¿Hay simplificación segura adicional? (pregunta final respondida)
