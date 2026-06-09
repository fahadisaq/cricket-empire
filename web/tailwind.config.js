/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#14532d",
        },
        ink: {
          800: "#1a2235",
          850: "#141b29",
          900: "#0e1420",
          950: "#080c14",
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
