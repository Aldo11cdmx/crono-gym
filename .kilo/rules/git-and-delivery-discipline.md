# Git and Delivery Discipline
> Se activa cuando: vas a commitear, crear ramas, limpiar el árbol, preparar un PR, o hay muchos cambios sin commitear.

## Misión
Historial limpio y entregas reproducibles: cada commit cuenta una cosa y deja el repo compilando y probado.

## Framework de Decisión
1. ¿Este commit tiene una sola intención (feat, fix, refactor, chore, test, docs)?
2. ¿Compila y pasa los tests del área en ese commit?
3. ¿Hay algo que no debe versionarse (secretos, originales pesados, scripts temporales)?
4. ¿Hay muchos cambios mezclados? Entonces primero un plan de commits por tema.

## Patrones Obligatorios
- Conventional Commits con alcance, como ya usa el repo: `feat(workout): ...`, `fix(sync): ...`, `chore(repo): ...`.
- Ramas por tema (`feat/…`, `fix/…`, `chore/…`); una rama no mezcla refactor con feature.
- Antes de commitear: `npm run typecheck` y los tests del área; antes de PR: `npm test` y `npm run build`.
- Staging selectivo (`git add -p` o rutas explícitas), nunca `git add .` a ciegas.
- Fuera de git: `.env*` (solo `.env.local.example` con placeholders), `originals/`, `dist/`, `node_modules/`.
- `.kilo/` está en `.gitignore`: las reglas viven en local. Si se quieren versionar, hay que quitar `/.kilo` del `.gitignore` (decisión del dueño).
- Cambios que tocan esquema/sync/SW van en commits propios con su descripción de riesgo.

## Cómo debe responder Kilo
Propón el plan de commits (lista ordenada: mensaje → archivos) antes de ejecutarlo. Pide confirmación antes de cualquier `reset`, `rebase`, `force-push` o borrado.

## Comportamiento Proactivo
- Detecta ruido versionado y lo lista, sin borrar: `tmp/*.ps1`, `testwrite.txt`, `*.backup.tsx`, `ActiveSessionContext.patch.ts`, y revisa si `.playwright-mcp/` debe ignorarse.
- Sugiere `.editorconfig` y `.gitattributes` (UTF-8, fin de línea) si faltan.
- Redacta mensajes de commit claros (qué y por qué, no cómo).

## Anti-patrones
- Commits "wip"/"fix" sin alcance; `--no-verify`; `git add .`.
- Mezclar formateo masivo con cambios de lógica.
- Commitear secretos o binarios pesados.
- Reescribir historia compartida sin avisar.

## Checklist
- [ ] Un commit = una intención, compila y pasa tests
- [ ] Mensaje Conventional Commit con alcance
- [ ] Sin secretos/originales/temporales en el diff
- [ ] Plan de commits aprobado antes de ejecutar
