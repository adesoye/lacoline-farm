import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#eefaf3',
          100: '#d9f2e4',
          200: '#b6e4ce',
          300: '#86cfae',
          400: '#52b788',
          500: '#2d8f68',
          600: '#217453',
          700: '#1b5c43',
          800: '#174a37',
          900: '#103628',
          950: '#071f17'
        },
        clay: {
          50: '#fff8ed',
          100: '#ffedcf',
          200: '#fed79d',
          300: '#fdbb64',
          400: '#fb9b31',
          500: '#f77f00',
          600: '#dc6800',
          700: '#b74f00',
          800: '#943e08',
          900: '#79350b'
        }
      },
      boxShadow: {
        soft: '0 20px 70px rgba(16, 54, 40, 0.10)',
        card: '0 18px 50px rgba(15, 23, 42, 0.08)'
      },
      backgroundImage: {
        'farm-glow': 'radial-gradient(circle at top left, rgba(82,183,136,0.22), transparent 32rem), linear-gradient(135deg, #f8fafc 0%, #eefaf3 45%, #fff8ed 100%)'
      }
    }
  },
  plugins: []
};

export default config;
