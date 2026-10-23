# Dev Hygiene (PWA en desarrollo)
> Se activa cuando: errores raros de módulos ("does not provide an export", "Invalid or unexpected token"), encoding, `vite.config.ts`, `public/sw.js`, `index.html`.

## Misión
Entorno de desarrollo estable: ningún módulo viejo, ningún service worker pegado, encoding limpio.

## Framework de Decisión
1. ¿El error persiste tras recarga forzada? Entonces sospecha de un SW viejo, no del código.
2. ¿El archivo tiene BOM o U+FFFD (�)?
3. ¿El plugin `cronos:dev-module-hygiene` sigue activo en `vite.config.ts`?

## Patrones Obligatorios
- `vite.config.ts` conserva `devModuleHygiene()` (`name: "cronos:dev-module-hygiene"`, `apply: "serve"`): `/sw.js` → **404**; `/src/*` y `/@*` con `Cache-Control: no-store`.
- `index.html` desinstala SW viejos en dev antes de cargar el grafo de módulos. No lo quites.
- `registerServiceWorker` solo se activa con `enabled: !import.meta.env.DEV`.
- Archivos UTF-8 **sin BOM**; cero U+FFFD. Busca antes de commitear:
```powershell
Select-String -Path src\**\*.ts,src\**\*.tsx -Pattern "\uFFFD" -List
```
- Si editas con scripts de PowerShell, escribe con `[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding $false))`.
- Comandos de shell en las respuestas: PowerShell, no bash.

## Cómo debe responder Kilo
Diagnostica con evidencia (cabecera, estado del SW, archivo con BOM). Da el comando exacto de PowerShell para reparar.

## Comportamiento Proactivo
- Ante errores de módulo: primero pide/ejecuta el reset del SW (Application > Service Workers > Unregister + Clear site data) antes de tocar código.
- Detecta mojibake (`Ã³`, `â€”`) en textos en español y lo corrige a UTF-8.
- Propone `.editorconfig`/`.gitattributes` (utf-8, `eol`) si no existen.

## Anti-patrones
- Registrar el SW en dev; quitar `no-store`; "arreglar" un export que en realidad solo está cacheado.
- Guardar archivos con encodings de Windows (ANSI/UTF-16).
- Scripts ad hoc en `tmp/` versionados (ver `git-and-delivery-discipline.md`).

## Checklist
- [ ] `/sw.js` devuelve 404 en dev
- [ ] Sin BOM ni U+FFFD en archivos tocados
- [ ] Plugin de higiene presente
- [ ] Comandos entregados en PowerShell
