import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Separate from `vite.config.ts` on purpose.
 *
 * Keeping the `test` block out of the app config means the production build
 * never has to reference Vitest's config types, and the app's `manualChunks`
 * split stays untouched by test-only concerns.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    // Node by default: the pure-logic suites are thousands of arithmetic
    // assertions, and booting jsdom for each file costs more than it buys.
    // Component tests opt into jsdom with a per-file docblock.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // The DOM suite uses Testing Library's auto-cleanup, which needs a global
    // afterEach; declaring globals here keeps every suite consistent.
    globals: false,
    restoreMocks: true,
  },
});