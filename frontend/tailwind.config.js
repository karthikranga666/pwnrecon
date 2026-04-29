/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080B0F',
        surface: '#0D1117',
        border: '#1C2333',
        green: { DEFAULT: '#00FF88', dim: '#00CC6A' },
        red: { DEFAULT: '#FF4444', dim: '#CC3333' },
        amber: { DEFAULT: '#FFB800', dim: '#CC9200' },
        blue: { DEFAULT: '#4D9FFF', dim: '#3A7ACC' },
        text: { primary: '#E6EDF3', muted: '#7D8590' }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['Syne', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'grid-pulse': 'gridPulse 4s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite'
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #00FF88, 0 0 10px #00FF88' },
          '100%': { boxShadow: '0 0 10px #00FF88, 0 0 20px #00FF88, 0 0 40px #00FF88' }
        },
        gridPulse: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' }
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        }
      }
    }
  },
  plugins: []
};
