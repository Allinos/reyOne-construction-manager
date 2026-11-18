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
          DEFAULT: '#FBF8F1',
          100: '#FDFBF6',
          200: '#F6F0E2',
          300: '#ECE2CC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
