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
          50: "#f5f5f7",
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
        // Accent: a single warm tone used sparingly (Apple-style)
        accent: {
          DEFAULT: "#ff9f0a",
          soft: "#ffb14d",
          muted: "rgba(255, 159, 10, 0.12)",
        },
        // Brighter gold, used for the logo gradient and highlight text only.
        gold: {
          light: "#ffd27a",
          DEFAULT: "#e07407",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "SF Pro Text", "Inter", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.35)",
        glow: "0 0 24px -4px rgba(255, 159, 10, 0.35)",
        // Soft amber halo used behind the logo and hero surfaces.
        gold: "0 0 32px -8px rgba(255, 210, 122, 0.45)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 159, 10, 0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(255, 159, 10, 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 250ms ease-out",
        "pulse-ring": "pulse-ring 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;