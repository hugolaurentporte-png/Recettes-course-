import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f0f9f1", 100: "#dcf0de", 500: "#2f9e44", 600: "#237a35", 700: "#1d622c" },
        warm: { 50: "#fff8f0", 100: "#ffedd5", 500: "#f08c00", 600: "#d9480f" },
      },
    },
  },
  plugins: [],
};
export default config;
