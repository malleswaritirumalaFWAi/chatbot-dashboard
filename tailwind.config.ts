import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0d1b2e",
        "navy-light": "#162540",
      },
    },
  },
  plugins: [],
};
export default config;
