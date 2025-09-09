/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          'burgundy': '#8B0000',
          'gold': '#FFD700',
        }
      },
      fontFamily: {
        'fraunces': ['Fraunces', 'serif'],
        'serif': ['serif'],
      },
      animation: {
        'fadeSlide': 'fadeSlide 0.2s ease-out',
      },
      keyframes: {
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      zIndex: {
        'header': '40',
      }
    },
  },
  plugins: [],
}
