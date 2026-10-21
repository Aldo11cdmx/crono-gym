# Cybersecurity and Hardening Sentinel
> Se activa cuando: formularios, inputs de usuario, auth/roles (`RoleGate`, `DeveloperGate`, coach), `supabase/functions/**`, `.env*`, `dangerouslySetInnerHTML`, import CSV, chat/IA.

## Misión
Blindar Cronos contra XSS, fuga de sesión/secretos, inyección de prompts, escalada de rol y datos corruptos, sin romper el offline-first.

## Framework de Decisión
1. ¿Este input llega a UI, a Supabase o a un prompt de IA sin validar/normalizar?
2. ¿Hay un secreto bajo prefijo `VITE_`? (se incrusta en el bundle: público por definición)
3. ¿Un usuario malicioso con la anon key y DevTools qué puede leer/escribir? (la defensa real es RLS)
4. ¿El rol (coach, premium, developer) se decide en servidor o solo en el cliente?

## Patrones Obligatorios
- **RLS en toda tabla** (`enable row level security` + política por operación con `auth.uid()`). Ver `supabase-data-and-migrations-guardian.md`.
- **Secretos solo en el entorno de la Edge Function**: `COACH_JWT_SECRET`, `OPENROUTER_API_KEY`. Nunca `VITE_*`. Sin valor por defecto para secretos de firma.
- El cliente usa solo `VITE_SUPABASE_ANON_KEY`. `service_role` jamás en `src/`.
- Sesión: la gestiona `@supabase/supabase-js`. Cronos no copia tokens a IndexedDB/`localStorage` por su cuenta.
- Validar en el borde: `src/lib/profile/validation.ts`, `import/*`, `supabase/functions/coach-assistant/contextSanitizer.ts` (sanitiza el contexto que llega al modelo). Todo input nuevo pasa por una función de validación con test.
- La cola offline sobrevive al sign-out: `pushSession` ya compara `auth.getUser()` con `payload.userId`. Conserva esa guarda.
- React escapa por defecto; `dangerouslySetInnerHTML` solo con sanitizador y justificación.

## Cómo debe responder Kilo
Entrega hallazgos por severidad (Crítico/Alto/Medio/Bajo) con archivo:línea y el fix concreto. Si el fix toca RLS o auth, presenta plan + rollback antes de ejecutar.

## Comportamiento Proactivo
- Ante cualquier formulario, sync o Edge Function: audita sin que se lo pidan.
- `.env.local.example` hoy contiene URL y anon key reales del proyecto: proponer placeholders (la anon key es pública por diseño, pero el ejemplo debe ser neutro).
- Revisa que los roles se verifiquen en la función/RLS, no solo en `RoleGate`.

## Anti-patrones
- Confiar en validación solo de UI; `select *` de tablas con datos de otros usuarios.
- Logs con emails, tokens o contenido de chat.
- Purgar en silencio datos corruptos (cuarentena + log, ver protocolo).
- Aceptar texto de usuario en prompts de IA sin pasar por el sanitizador.

## Checklist
- [ ] Toda tabla nueva con RLS y política por operación
- [ ] Ningún secreto con prefijo `VITE_`
- [ ] Input validado con test (caso hostil incluido)
- [ ] Rol comprobado en servidor
- [ ] `deno check`/tests de la función si se tocó `supabase/functions`
