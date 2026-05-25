/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./entrypoints/**/*.{html,ts,tsx}",
    "./components/**/*.{html,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro"',
          '"Inter"',
          '"Helvetica Neue"',
          "Arial",
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro"',
          '"Inter"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          "ui-monospace",
          '"Menlo"',
          "monospace",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
      },
      borderRadius: {
        xl: `calc(var(--radius) + 6px)`,
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Apple soft layered shadows
        "apple-xs":
          "0 1px 2px hsl(var(--shadow-color) / 0.04), 0 1px 1px hsl(var(--shadow-color) / 0.03)",
        "apple-sm":
          "0 1px 2px hsl(var(--shadow-color) / 0.05), 0 2px 6px hsl(var(--shadow-color) / 0.05)",
        "apple-md":
          "0 1px 2px hsl(var(--shadow-color) / 0.06), 0 4px 12px hsl(var(--shadow-color) / 0.08)",
        "apple-lg":
            "0 4px 8px hsl(var(--shadow-color) / 0.06), 0 16px 40px hsl(var(--shadow-color) / 0.12)",
        "apple-xl":
          "0 10px 24px hsl(var(--shadow-color) / 0.08), 0 24px 56px hsl(var(--shadow-color) / 0.16)",
        // Inset hairline above backdrop-blur sheets
        "apple-inset":
          "inset 0 0 0 1px hsl(var(--border) / 0.7)",
      },
      keyframes: {
        // Spring-like fade + lift (used for cards entering)
        "spring-in": {
          "0%": { opacity: 0, transform: "translateY(8px) scale(0.985)" },
          "60%": { opacity: 1, transform: "translateY(-2px) scale(1.005)" },
          "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "scale-in": {
          "0%": { opacity: 0, transform: "scale(0.96)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        // Streaming text blink (used while AI explanation is loading)
        "ai-pulse": {
          "0%,100%": { opacity: 0.35 },
          "50%": { opacity: 1 },
        },
        spark: {
          "0%": { color: "#fff" },
          "100%": { color: "gray" },
        },
        scaleUp: {
          "0%": { transform: "scale(0.4)" },
          "100%": { transform: "scale(1)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
      animation: {
        "spring-in": "spring-in 320ms cubic-bezier(.2,.8,.2,1)",
        "fade-in": "fade-in 200ms ease-out",
        "scale-in": "scale-in 180ms cubic-bezier(.2,.8,.2,1)",
        "ai-pulse": "ai-pulse 1.4s ease-in-out infinite",
        scaleUp: "scaleUp 1s ease-in-out",
        fadeIn: "fadeIn 1s ease-in-out",
        spark: "spark 1s ease-in-out infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
