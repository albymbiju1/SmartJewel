/******** Tailwind CSS Configuration (CJS) ********/
/** Use Tailwind v3.4.x (stable) */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        fraunces: ['Fraunces', 'serif'],
      },
      colors: {
        brand: {
          gold: '#d97706',
          burgundy: '#832729',
        },
      },
    },
  },
  plugins: [],
};

