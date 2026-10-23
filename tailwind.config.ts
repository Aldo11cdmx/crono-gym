import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired neutral scale for dark mode.
        // 950 is true black so OLED panels switch those pixels off entirely,
        // and so the amber accents read with maximum contrast against it.
        neutral: {
          // Pure white, not Apple's off-white `#f5f5f7`. `tokens.test.ts` pins
          // `neutral[50]` to `TEXT.primary`, and the redesign asks for `#FFFFFF`.
          50: "#FFFFFF",
          100: "#e8e8ed",
          200: "#d2d2d7",
          300: "#b1b1b7",
          400: "#8e8e93",
          500: "#6e6e73",
          600: "#48484a",
          700: "#2c2c2e",
          800: "#1c1c1e",
          900: "#0f0f11",
          950: "#000000",
        },
        // Accent: Cronos red, used sparingly (Apple-style).
        // Must stay equal to `ACCENT.base` in src/design/tokens.ts, which is the
        // source of truth. `tokens.test.ts` asserts the two agree, because a
        // token that is red in one file and orange in the other is the exact
        // drift this duplication invites.
        accent: {
          DEFAULT: "#FF3B30",
          soft: "#FF6961",
          muted: "rgba(255, 59, 48, 0.12)",
        },
        // Amber, and only amber: warnings, PR callouts, never the primary action.
        // Equals `ACCENT.secondary` / `STATUS.warning.base`; asserted by the same test.
        amber: {
          DEFAULT: "#FF9F0A",
          soft: "#f7b955",
        },
        /*
         * No `gold` scale. It existed for the logo gradient, which was the one warm-gold
         * thing in the product, and the logo now reads `logoGradient.ts`. Leaving it would
         * have been a second copy of the brand that nothing renders -- the exact drift
         * `tokens.test.ts` exists to prevent, one layer down.
         *
         * The rank ladder's gold is unrelated and lives in `rankConfig.ts`.
         */
      },
      fontFamily: {
        sans: ["-apple-system", "SF Pro Text", "Inter", "system-ui", "sans-serif"],
      },
      /*
       * Motion defaults, so a bare `transition` *is* the token.
       *
       * Roughly forty call sites write `className="... transition"` with no duration and no
       * curve. Each was silently taking Tailwind's stock 150ms / `cubic-bezier(0.4,0,0.2,1)`
       * -- which happens to be exactly `MOTION.fast` and `MOTION.standard`. Adding
       * `duration-fast` to forty class names would document a value that was already
       * correct and would make the next diff noisy with no behaviour change.
       *
       * So the defaults are set here instead: the bare class now resolves through
       * `MOTION`, and changing the token changes the forty call sites in one edit.
       *
       * Duplicated rather than imported because this file is loaded by Tailwind's config
       * loader, not by the app's module graph, and the established pattern in this repo is
       * to duplicate and pin: see the accent and `boxShadow` entries above. `tokens.test.ts`
       * asserts these agree with `MOTION`, so the copy cannot drift silently.
       */
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        normal: "250ms",
        slow: "400ms",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        easeOut: "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
        easeIn: "cubic-bezier(0.4, 0.0, 1.0, 1.0)",
        standard: "cubic-bezier(0.4, 0.0, 0.2, 1.0)",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        // Equals `GLASS.shadow` in tokens.ts: an inset top-edge highlight over a
        // diffuse cast. Duplicated rather than composed because Tailwind cannot read
        // the TS module; `tokens.test.ts` checks the two agree.
        glass: "0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 8px 32px rgba(0, 0, 0, 0.4)",
        // Equals `ACCENT.ring`. The two halves are the raised centre action's hairline
        // and its cast, and they only ever ship together.
        glow: "0 0 0 1px rgba(255, 59, 48, 0.3), 0 4px 16px rgba(255, 59, 48, 0.4)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // The "a session is running" pulse on the centre action. Exists once, here and
        // in `index.css`, because a pulse is only meaningful on an active control: a
        // second copy is how an idle button ended up glowing.
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 59, 48, 0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(255, 59, 48, 0)" },
        },
      },
      animation: {
        /*
         * Durations and curves from `MOTION`: `fade-in` is `MOTION.normal` +
         * `MOTION.easeOut`, `pulse-ring` is `MOTION.loop.ring` +
         * `MOTION.standard`. `ease-out` in `fade-in` was the CSS keyword, which is
         * `cubic-bezier(0, 0, 0.58, 1)` -- a different curve from the design system's
         * `easeOut`, so that declaration was quietly using motion nobody had chosen.
         * `pulse-ring` used `ease-in-out`, which is the keyword for
         * `cubic-bezier(0.4, 0, 0.2, 1)` -- the same curve as `MOTION.standard`, now said
         * by name.
         */
        "fade-in": "fade-in 250ms cubic-bezier(0.0, 0.0, 0.2, 1.0)",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0.0, 0.2, 1.0) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;