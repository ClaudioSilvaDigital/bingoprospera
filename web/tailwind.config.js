/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        prospera: {
          primary: "#1B5E20",   // verde escuro (sustentabilidade)
          accent:  "#00A86B",   // jade
          sun:     "#F2C94C",   // amarelo celebração
          mist:    "#F5F7F5",   // cinza-claro esverdeado
        }
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        soft: "0 6px 24px rgba(0,0,0,0.08)",
      }
    },
  },
  plugins: [],
}
