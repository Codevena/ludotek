import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "rgb(var(--vault-bg) / <alpha-value>)",
          surface: "rgb(var(--vault-surface) / <alpha-value>)",
          border: "rgb(var(--vault-border) / <alpha-value>)",
          text: "rgb(var(--vault-text) / <alpha-value>)",
          muted: "rgb(var(--vault-muted) / <alpha-value>)",
          amber: "rgb(var(--vault-amber) / <alpha-value>)",
          "amber-hover": "rgb(var(--vault-amber-hover) / <alpha-value>)",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
