# Error Handling and Observability
> Se activa cuando: `try/catch`, promesas, llamadas a Supabase/Edge Functions/IA, estados de carga/vacío/error, sync, logs, pantallas "próximamente" o stubs.

## Misión
Los fallos se ven, se entienden y se pueden reintentar, y nunca cuestan datos al atleta. La degradación es explícita y observable.

## Framework de Decisión
1. ¿Qué ve el usuario cuando esto falla? ¿Puede reintentar?
2. ¿El fallo deja rastro útil (log sin PII) o se traga en silencio?
3. ¿Es un fallo recuperable (red) o permanente (RLS rechaza)?
4. ¿Esto puede perder una serie o una sesión?

## Patrones Obligatorios
- Contrato de degradación de la capa de persistencia: falla a `null`/no-op, registrar una serie nunca rompe el entrenamiento. Pero la degradación se **señala** (estado visible), no se oculta.
- Todo flujo async expone `loading | error | ok` (y `empty` donde aplique); cada estado tiene UI y texto en español accionable (`i18n.ts`).
- Estado de sync visible (`useOfflineSync`: `SyncStatus`, `error`, `syncNow` para reintento manual). Errores permanentes (p. ej. RLS) se muestran; los de red se reintentan.
- Clasifica errores por tipo/código, no por texto del mensaje (hoy `isRetryable` en `sessionSync.ts` busca palabras).
- Error boundary por ruta/feature; el shell y la barra de sesión sobreviven a un fallo de pantalla.
- Logger central con niveles; sin `console.log` suelto en producción; sin PII (emails, tokens, contenido de chat).
- Edge Functions: respuestas de error consistentes (`supabase/functions/_shared/http.ts`) y sin filtrar detalles internos.
- Acciones destructivas con deshacer (`UNDO_LABELS`).

## Cómo debe responder Kilo
Para cada ruta de fallo: qué ve el usuario, qué se registra, cómo se recupera. Incluye el test de la ruta de error.

## Comportamiento Proactivo
- Ante `try/catch`/async propone los 3-4 estados completos y el reintento.
- Detecta `catch {}`, errores genéricos ("Algo salió mal") y stubs que muestran texto técnico al usuario (el audit halló `ConsistencyTracker (userId=none)`).
- Propone un panel de diagnóstico (cola, última falla, versión `import.meta.env.PACKAGE_VERSION`) en el área de desarrollador.

## Anti-patrones
- `catch {}` o `.catch(() => undefined)` en rutas que importan (el registro del SW lo hace a propósito: documenta cuando sea deliberado).
- Perder una serie por un fallo de red.
- Mensajes con jerga técnica; spinners sin fin.
- Loguear datos personales.

## Checklist
- [ ] Estados loading/empty/error resueltos y traducidos
- [ ] Reintento disponible en fallos recuperables
- [ ] Sin `catch` vacío no justificado
- [ ] Sin PII en logs
- [ ] Test de la ruta de error
