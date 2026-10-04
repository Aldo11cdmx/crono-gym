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
        "fade-in": "fade-in 250ms ease-out",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;