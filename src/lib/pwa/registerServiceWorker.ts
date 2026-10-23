/**
 * registerServiceWorker.ts — the shell that starts without a connection.
 *
 * The worker itself is `public/sw.js`: a plain file the browser can install
 * without a build step. This module decides *whether* to install it and
 * swallows every failure, because a service worker that fails to register is
 * not a problem the athlete can do anything about.
 *
 * It is not registered in development: a cached module is a module that does
 * not hot-reload, and a developer would spend the afternoon wondering why.
 */

/** Where the worker lives. Stable, because the browser fetches it by URL. */
export const SERVICE_WORKER_URL = "/sw.js";

/**
 * The caches the worker owns.
 *
 * The prefix rather than the exact name, because the name is versioned: a
 * worker that is replaced leaves the previous cache behind, and that copy of
 * the shell is the one that keeps serving a build nobody is running.
 */
const SHELL_CACHE_PREFIX = "cronos-shell-v";

export interface RegisterServiceWorkerOptions {
  /** Whether to register at all. The app passes `!import.meta.env.DEV`. */
  enabled?: boolean;
  /** Where the worker is. */
  url?: string;
}

/**
 * Registers the worker.
 *
 * Registration happens after `load`: a worker that competes with the first
 * paint delays the first paint, and the first paint is what the athlete came
 * for.
 */
export function registerServiceWorker(options: RegisterServiceWorkerOptions = {}): void {
  const { enabled = true, url = SERVICE_WORKER_URL } = options;
  if (!enabled) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register(url).catch(() => undefined);
  };

  if (document.readyState === "complete") {
    register();
    return;
  }
  window.addEventListener("load", register, { once: true });
}

/**
 * Removes the worker.
 *
 * The escape hatch: a worker that keeps serving a shell nobody wants is
 * removed here, and the app goes back to the network on the next load.
 *
 * The caches go with it. A worker that is unregistered but whose cache
 * survives is half a worker: the shell is still on the device, and anything
 * that reads it directly -- a stale module, an old asset -- still answers from
 * the copy that was current when the worker was installed.
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.unregister();
  } catch {
    // Nothing to remove, or the browser would not let go of it.
  }
  await clearShellCaches();
}

/**
 * Deletes the caches the worker filled.
 *
 * Only the shell's own caches: a cache this app did not create is somebody
 * else's data, and the browser is the only thing that should decide how long
 * it lives.
 */
export async function clearShellCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(SHELL_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );
  } catch {
    // A browser that will not let go of its caches is not a problem to raise.
  }
}
