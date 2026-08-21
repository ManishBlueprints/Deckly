import tailwindAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ui: {
          canvas: "rgb(var(--ui-canvas) / <alpha-value>)",
          surface: "rgb(var(--ui-surface) / <alpha-value>)",
          subtle: "rgb(var(--ui-surface-subtle) / <alpha-value>)",
          elevated: "rgb(var(--ui-surface-elevated) / <alpha-value>)",
          text: "rgb(var(--ui-text) / <alpha-value>)",
          muted: "rgb(var(--ui-text-muted) / <alpha-value>)",
          border: "rgb(var(--ui-border) / <alpha-value>)",
          primary: "rgb(var(--ui-primary) / <alpha-value>)",
          "primary-text": "rgb(var(--ui-primary-text) / <alpha-value>)",
          info: "rgb(var(--ui-info) / <alpha-value>)",
          destructive: "rgb(var(--ui-destructive) / <alpha-value>)",
          warning: "rgb(var(--ui-warning) / <alpha-value>)",
          scrim: "rgb(var(--ui-scrim) / <alpha-value>)",
          mint: "rgb(var(--ui-mint) / <alpha-value>)",
          disabled: "rgb(var(--ui-disabled) / <alpha-value>)",
          focus: "rgb(var(--ui-focus) / <alpha-value>)",
          selection: "rgb(var(--ui-selection) / <alpha-value>)",
          chart: {
            1: "rgb(var(--ui-chart-1) / <alpha-value>)",
            2: "rgb(var(--ui-chart-2) / <alpha-value>)",
            3: "rgb(var(--ui-chart-3) / <alpha-value>)",
            4: "rgb(var(--ui-chart-4) / <alpha-value>)",
            5: "rgb(var(--ui-chart-5) / <alpha-value>)",
            6: "rgb(var(--ui-chart-6) / <alpha-value>)",
            7: "rgb(var(--ui-chart-7) / <alpha-value>)",
            8: "rgb(var(--ui-chart-8) / <alpha-value>)",
          },
        },
        deckly: {
          primary: "hsl(var(--brand-primary) / <alpha-value>)",
          secondary: "hsl(var(--brand-secondary) / <alpha-value>)",
          accent: "hsl(var(--brand-tertiary) / <alpha-value>)",
          background: "hsl(var(--brand-neutral) / <alpha-value>)",
          card: "rgba(38, 38, 38, 0.7)", /* #262626 at 0.7 */
        },
        // Semantic Aliases mapped to HSL Variables
        "on-surface": "hsl(var(--foreground))",
        "on-surface-variant": "hsl(var(--muted-foreground))",
        "on-primary": "hsl(var(--primary-foreground))",
        "outline-variant": "hsl(var(--border))",

        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        surface: {
          lowest: "hsl(var(--surface-lowest, var(--background)))",
          low: "hsl(var(--surface-low))",
          card: "hsl(var(--surface-card))",
          container: "hsl(var(--surface-container))",
          high: "hsl(var(--surface-high))",
          highest: "hsl(var(--surface-highest))",
          bright: "hsl(var(--surface-bright))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["Onest Variable", "Onest", "sans-serif"],
        headline: ["Onest Variable", "Onest", "sans-serif"],
        mono: ["Geist Mono Variable", "Geist Mono", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "glass-gradient":
          "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))",
      },
      borderRadius: {
        lg: "var(--ui-radius-surface, var(--radius))",
        md: "var(--ui-radius-control, calc(var(--radius) - 2px))",
        sm: "var(--ui-radius-compact, calc(var(--radius) - 4px))",
        card: "var(--ui-radius-surface, 24px)",
      },
      boxShadow: {
        control: "var(--ui-shadow-control)",
        surface: "var(--ui-shadow-surface)",
        overlay: "var(--ui-shadow-overlay)",
      },
    },
  },
  plugins: [tailwindAnimate],
};
