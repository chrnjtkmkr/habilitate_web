/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          50: '#EDEDFB',
          100: '#DCDCF7',
          200: '#B9B8EF',
          300: '#9695E6',
          400: '#7B79DE',
          500: '#6260D6',
          600: '#6260D6',
          700: '#5250C0',
          800: '#4240A8',
          900: '#333090',
        },
        surface: '#FFFFFF',
        background: '#F8FAFC',
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#94A3B8',
          inverse: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        success: '#059669',
        warning: '#D97706',
        danger: '#E11D48',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Noto Sans Devanagari', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
