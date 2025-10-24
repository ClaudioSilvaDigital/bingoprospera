/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "prospera-primary": "#166534",
        "prospera-accent": "#22c55e",
        "prospera-mist": "#F6FAF7",
      },
      boxShadow: {
        // gera a classe `shadow-soft`
        soft: "0 8px 24px rgba(16,24,40,.08), 0 4px 12px rgba(16,24,40,.06)",
      },
    },
  },
  plugins: [],
};
