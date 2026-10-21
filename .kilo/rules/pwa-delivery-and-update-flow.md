# PWA Delivery and Update Flow
> Se activa cuando: `public/sw.js`, `src/lib/pwa/*`, instalación/actualización de la app, caché offline del shell, manifest, iconos. (Higiene en desarrollo: `dev-hygiene-pwa.md`.)

## Misión
Que la PWA arranque sin red y que una actualización jamás rompa ni interrumpa un entrenamiento en curso.

## Framework de Decisión
1. ¿Qué cachea el SW y con qué estrategia? ¿Qué ve un usuario con la versión vieja?
2. ¿Una activación inmediata puede ocurrir en medio de una sesión activa (`ActiveSessionContext.isActive`)?
3. ¿Las respuestas autenticadas/por usuario se quedan fuera de la caché del SW?
4. ¿Se probó en producción local (`npm run build` + `npm run preview`), no en el dev server?

## Estado actual (verificado)
- `public/sw.js`: caché `cronos-shell-v1`; HTML network-first; assets con hash cache-first; solo mismo origen (API y medios ajenos no se tocan); ignora módulos de dev; limpia cachés viejas al activar.
- Usa `skipWaiting()` en `install` y `clients.claim()` en `activate`: una versión nueva toma el control de inmediato.
- `src/lib/pwa/registerServiceWorker.ts`: registra tras `load`, solo fuera de dev, traga errores; tiene vía de desinstalación. Tests en `src/lib/pwa/*.test.ts`.
- Catálogo y medios viven en IndexedDB/`lib/media/*`, no en el SW.
- No hay `manifest` ni iconos PWA en el repo (verifica antes de afirmarlo): no es instalable como app todavía.

## Patrones Obligatorios
- Versiona la caché (`cronos-shell-v<N>`) y sube `N` cuando cambie la estrategia o el shell.
- Aplica la actualización solo fuera de una sesión activa: avisar "Hay una versión nueva" y activar al terminar el workout o en la siguiente carga fría. Si cambias `skipWaiting`, hazlo con plan y pruebas.
- Manifest completo: `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`/`background_color` desde tokens (`SURFACE.base`), iconos 192/512 + maskable; `lang: "es"`.
- Nunca cachees llamadas a Supabase ni respuestas por usuario.
- Prueba offline real: DevTools > Network > Offline y recarga; Lighthouse PWA.

## Cómo debe responder Kilo
Describe qué pasa en 3 casos: primera visita, visita con versión vieja instalada, visita con sesión activa durante una actualización.

## Comportamiento Proactivo
- Propone el flujo de "actualización disponible" con un componente de aviso discreto (tokens, 44px).
- Detecta si un cambio de assets deja usuarios con un HTML cacheado que apunta a hashes borrados.
- Sugiere el manifest/iconos si faltan.

## Anti-patrones
- `skipWaiting` + recarga forzada durante un workout.
- Cachear indefinidamente HTML o respuestas autenticadas.
- Registrar el SW en dev (ver `dev-hygiene-pwa.md`).
- Cambiar `sw.js` sin subir la versión de caché.

## Checklist
- [ ] Caché versionada y limpieza de antiguas
- [ ] Actualización no interrumpe sesión activa
- [ ] Probado en `build` + `preview` y en modo offline
- [ ] Sin respuestas autenticadas en caché
- [ ] Tests de `src/lib/pwa` en verde
