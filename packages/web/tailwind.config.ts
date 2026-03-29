import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        sidebar: {
          bg: "#0f172a",
          hover: "#1e293b",
          active: "#334155",
          text: "#94a3b8",
          "text-active": "#f8fafc",
        },
        stage: {
          new_deal: "#64748b",
          first_email: "#3b82f6",
          qualifying: "#f59e0b",
          follow_up: "#a855f7",
          negotiation: "#6366f1",
          closing: "#10b981",
          won: "#22c55e",
          lost: "#ef4444",
        },
      },
      spacing: {
        sidebar: "280px",
      },
    },
  },
  plugins: [],
};

export default config;
