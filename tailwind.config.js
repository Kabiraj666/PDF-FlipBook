/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          50: "#EEF1F8",
          200: "#C7CEE0",
          400: "#5B6785",
          600: "#232C42",
          700: "#1A2136",
          800: "#121729",
          900: "#0B0E1B",
          950: "#06080F"
        },
        beam: {
          300: "#FCD34D", // warm light gold
          400: "#F59E0B", // rich yellow gold
          500: "#D97706"  // bronze gold
        },
        brass: {
          300: "#FCD34D",
          400: "#F59E0B",
          500: "#D97706"
        },
        signal: {
          400: "#F59E0B"
        },
        paper: {
          DEFAULT: "#FBF8F1",
          dim: "#F1ECDE"
        }
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      },
      boxShadow: {
        book: "0 30px 60px -20px rgba(0,0,0,0.6)",
        glow: "0 0 40px -8px rgba(245,158,11,0.45)",
        glass: "0 8px 32px rgba(0,0,0,0.35)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};

