import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/pages/**/*.{ts,tsx}",
    "./components.json",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          page: "var(--color-bg-page)",
          base: "var(--color-bg-page)",
          surface: "var(--color-bg-surface)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          from: "var(--color-accent-from)",
          to: "var(--color-accent-to)",
        },
        "accent-blue": "var(--color-accent-blue)",
        "accent-blue-bg": "var(--color-accent-blue-bg)",
        "accent-pink": "var(--color-accent-pink)",
        "accent-pink-bg": "var(--color-accent-pink-bg)",
        "accent-orange": "var(--color-accent-orange)",
        "accent-orange-bg": "var(--color-accent-orange-bg)",
        border: "var(--color-border)",
        risk: {
          high: "var(--color-risk-high)",
          "high-bg": "var(--color-risk-high-bg)",
          medium: "var(--color-risk-medium)",
          "medium-bg": "var(--color-risk-medium-bg)",
          low: "var(--color-risk-low)",
          "low-bg": "var(--color-risk-low-bg)",
        },
        positive: "var(--color-positive)",
        "positive-bg": "var(--color-positive-bg)",
        negative: "var(--color-negative)",
        "negative-bg": "var(--color-negative-bg)",
        "badge-nuevo": "var(--color-badge-nuevo)",
        "badge-nuevo-bg": "var(--color-badge-nuevo-bg)",
        "badge-en-ruta": "var(--color-badge-en-ruta)",
        "badge-en-ruta-bg": "var(--color-badge-en-ruta-bg)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
};

export default config;
