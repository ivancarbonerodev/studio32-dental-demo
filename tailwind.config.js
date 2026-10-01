/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0F14',
        paper: '#FAF9F5',
        // mint.text: verde oscuro para TEXTO sobre fondos claros (contraste ≥ 4,5:1)
        mint: { DEFAULT: '#00D9A3', dark: '#00B589', light: '#E3FBF3', text: '#007A5A' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
};
