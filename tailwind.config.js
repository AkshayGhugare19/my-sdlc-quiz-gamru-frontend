/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0B1220',
        deep: '#0F1B33',
        neon: '#22D3EE',
        royal: '#0B3D91',
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 10px 40px rgba(34, 211, 238, 0.18)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
