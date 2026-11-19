/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — amber (#F2A900) is the 10% accent for primary actions,
        // burnt orange (#CC6E02) for links/active text, dark brown (#4A2700)
        // for the sidebar and headings, light cream (#F8E4A8) for highlights.
        brand: {
          50: '#FEF9EA',
          100: '#FCF1CF',
          200: '#F8E4A8',
          300: '#F5CF5E',
          400: '#F4B92A',
          500: '#F2A900',
          600: '#CC6E02',
          700: '#A65A02',
          800: '#7A4101',
          900: '#4A2700',
        },
        // Warm neutral surfaces (70% of the screen).
        cream: {
          DEFAULT: '#F7F4EE',
          50: '#FBF9F5',
          100: '#FBF9F5',
          200: '#F1EBDF',
          300: '#E2D9C8',
        },
        // "Warm Site" neutrals: the grey scale is tinted brown so text, borders
        // and dark-mode surfaces all sit in the brand's warm family.
        slate: {
          50: '#FBF9F5',
          100: '#F3EEE5',
          200: '#ECE6DA',
          300: '#D9CFBD',
          400: '#9A8B78',
          500: '#7D6E5C',
          600: '#5B4B3A',
          700: '#3A3026',
          800: '#1D1812',
          900: '#14100B',
          950: '#0D0A07',
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(31,20,8,.04), 0 4px 16px rgba(31,20,8,.05)',
        pop: '0 12px 40px rgba(31,20,8,.18)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
