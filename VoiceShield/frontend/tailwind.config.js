/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        shield: {
          DEFAULT: "#10b981",
          dark: "#0f766e",
        },
        surface: {
          DEFAULT: "#0b1220",
          light: "#111c33",
        },
      },
    },
  },
  plugins: [],
};
