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
    /*
     * CSS processing, off by default in Vitest.
     *
     * On because `design/tokens.test.ts` asserts on `index.css` as text, and with this
     * off Vitest replaces every `.css` module with an empty string *before* the `?raw`
     * query is resolved. The `?raw` import therefore yields `""` -- silently, and only
     * visible to a positive assertion. The negative guards ("the stylesheet must not
     * contain X") pass against an empty string and prove nothing, which is the worst
     * possible failure for a rule whose job is to fail.
     *
     * The cost is that CSS now goes through the pipeline in tests. Measured on this
     * project: no meaningful difference in duration, and the design suite is the only
     * consumer.
     */
    css: true,
    // The DOM suite uses Testing Library's auto-cleanup, which needs a global
    // afterEach; declaring globals here keeps every suite consistent.
    globals: false,
    env: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key-for-tests",
    },
    restoreMocks: true,
  },
});