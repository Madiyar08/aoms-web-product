import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16233A",
        "ink-2": "#0F1A2B",
        paper: "#F3F1E9",
        steel: "#DAD6C9",
        line: "#E7E3D6",
        brass: "#A9782F",
        "brass-bg": "#F1E4C9",
        "brass-dark": "#7A5620",
        route: "#2B6E63",
        "route-bg": "#DEEAE6",
        "st-orange": "#C97A2E",
        "st-orange-bg": "#F8E7D3",
        "st-amber": "#B8791E",
        "st-amber-bg": "#F6E7CC",
        "st-green": "#3C7A5E",
        "st-green-bg": "#DFEDE5",
        "st-white": "#8A8677",
        "st-white-bg": "#F1EFE7",
        "st-yellow": "#A98B1E",
        "st-yellow-bg": "#F7EFC9",
        "st-red": "#B23A3A",
        "st-red-bg": "#F8DEDE",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["SF Mono", "Consolas", "Liberation Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
