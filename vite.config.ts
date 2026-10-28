import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Development hygiene: no stale modules, no worker.
 *
 * `public/sw.js` reaches the dev server as a plain file, and a worker
 * installed by an earlier production build keeps controlling the origin and
 * answering module requests from its cache. A stale module then fails with
 * "The requested module '...' does not provide an export named '...'", or with
 * "Invalid or unexpected token" when what it serves is not JavaScript at all.
 * Both read like broken source and are not: the file on disk is fine, the
 * browser is holding an older copy of it.
 *
 * Two doors are closed here:
 *
 *  - A 404 is how a browser is told to drop a registration, so the worker is
 *    refused in development and served only by a build.
 *  - The dev modules are sent with `no-store`, so the browser's own cache can
 *    never hand back a body it mangled either.
 */
function devModuleHygiene(): Plugin {
  /** The paths the dev server serves source modules from. */
  const isDevModule = (path: string) =>
    path.startsWith("/src/") || path.startsWith("/@");

  return {
    name: "cronos:dev-module-hygiene",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        if (path === "/sw.js") {
          res.statusCode = 404;
          res.end("The service worker is served by a build, not by the dev server.");
          return;
        }
        if (isDevModule(path)) {
          /*
           * Never let the browser keep a copy of a module.
           *
           * Vite answers source modules with `no-cache`, which still allows the
           * browser to reuse a body it already holds once the server says it
           * has not changed -- and a body that was truncated or mangled on the
           * way in is reused forever, and the page stops rendering with
           * "Invalid or unexpected token". The header is replaced where Vite
           * sets it, because the transform middleware sets it after this one
           * runs.
           */
          const setHeader = res.setHeader.bind(res);
          res.setHeader = (name: string, value: number | string | readonly string[]) => {
            if (name.toLowerCase() === "cache-control") {
              return setHeader(name, "no-store");
            }
            return setHeader(name, value);
          };
        }
        next();
      });
    },
  };
}

/** The package version, injected so the God Mode panel can show it without
 *  reaching for a build-time constant. */
const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "package.json"), "utf8"),
);

/** Quita llamadas a consola en el build de producción (sin nueva dependencia). */
function dropConsole() {
  return {
    name: "cronos:drop-console",
    enforce: "post",
    transform(code: string, id: string) {
      if (!id.match(/\.[jt]sx?$/)) return null;
      if (id.includes("node_modules")) return null;
      const next = code.replace(
        /console\.(log|debug|info|warn|error|trace)\([^)]*\)\s*;?/g,
        "",
      );
      return next === code ? null : { code, map: null };
    },
  } as Plugin;
}

export default defineConfig({
  plugins: [react(), tsconfigPaths(), devModuleHygiene()],
  define: {
    "import.meta.env.PACKAGE_VERSION": JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      plugins: [dropConsole()],
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});