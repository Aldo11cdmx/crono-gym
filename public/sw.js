/**
 * sw.js — the app shell, offline.
 *
 * A reload with no connection has to show the app, not the browser's error
 * page. This worker keeps the shell: the HTML and the assets it loads.
 *
 * The rules are the ones the app's own data follows, and they are the reason
 * this file is short:
 *
 *  - **The HTML is network-first.** A new deployment has to reach the athlete
 *    on the next load, not the one after the cache expires.
 *  - **The assets are cache-first.** Their names carry a hash, so the file
 *    behind a name never changes.
 *  - **Only this origin.** The exercise media and the API belong to somebody
 *    else: the media is kept on the device by the app itself, and the API
 *    answers differently for every athlete.
 *
 * The catalog and the media are not here. The catalog is read from IndexedDB
 * and the media from the media cache, both of which the app owns, so this
 * worker only has to make the app *start*.
 *
 * The cache is versioned: a new deployment that changes this file leaves a
 * different name behind, and the old one is deleted when this worker takes
 * over.
 */

const CACHE = "cronos-shell-v1";
const SHELL = ["/", "/index.html"];

/**
 * The development server's modules are not assets.
 *
 * A dev module URL -- `/src/...`, `/@vite/client`, `/node_modules/.vite/deps/...`
 * -- is same-origin, so the cache-first rule below would store it and keep
 * serving it for as long as the cache lives. A stale module then fails with
 * "The requested module '...' does not provide an export named '...'", which
 * reads like a broken import and is not one: the export is in the file, the
 * browser is holding an older copy of it.
 *
 * So the worker stands aside for them. The dev server is the network.
 */
function isDevModule(url) {
  return (
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/node_modules/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One missing file must not stop the worker: the shell is also stored
      // the first time the app is opened, which is the case that matters.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The dev server's modules: the worker does not stand in the way of them.
  if (isDevModule(url)) return;

  // The shell: the network first, the stored copy when there is no network.
  // A navigation to a client route (/admin, /coach/portal, ...) must always
  // resolve to index.html so React Router can render it; a cached or network
  // 404 for the raw path must never reach the user as a blank page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
            return response;
          }
          // Non-OK (404, 500, ...) for a client route: serve the shell so the
          // SPA router takes over instead of showing a blank page.
          return caches.match("/index.html");
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // The assets: the name carries the hash, so what is behind it never changes.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
