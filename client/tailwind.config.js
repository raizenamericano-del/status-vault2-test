/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0C0D0F',
        surface: '#151719',
        'surface-2': '#1B1E21',
        border: '#292D30',
        accent: {
          DEFAULT: '#7FAF8A',
          soft: '#96BFA0',
          muted: '#5E8A69',
          fg: '#0C0D0F',
        },
        text: {
          primary: '#F1F2F0',
          secondary: '#92979A',
          muted: '#6B7176',
        },
        danger: '#D46A6A',
        warning: '#D4A85A',
        success: '#7FAF8A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.25)',
        soft: '0 1px 2px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        xl: '14px',
        lg: '10px',
        md: '8px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
