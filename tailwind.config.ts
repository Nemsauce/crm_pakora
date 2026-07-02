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
        "accent-blue": "#3B82F6",
        "accent-blue-bg": "#DBEAFE",
        "accent-pink": "#EC4899",
        "accent-pink-bg": "#FCE7F3",
        "accent-orange": "#F97316",
        "accent-orange-bg": "#FFEDD5",
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
        negative: "var(--color-negative)",
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
