/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "prospera-primary": "#166534",
        "prospera-accent": "#22c55e"
      }
    },
  },
  plugins: [],
};
