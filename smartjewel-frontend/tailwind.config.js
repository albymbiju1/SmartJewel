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
          'rose': '#b74f4f',
          'rose-50': '#fff6f6',
          'amber-50': '#fff8eb',
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
      },
      borderRadius: {
        '2xl': '1rem',
        'pill': '9999px',
      },
      boxShadow: {
        'elevated': '0 10px 25px -10px rgba(0,0,0,0.15), 0 4px 12px -6px rgba(0,0,0,0.08)',
      }
    },
  },
  plugins: [],
}
