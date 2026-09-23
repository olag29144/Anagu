import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          base: '#020305',
          secondary: '#05080D',
          surface: '#0A0F16',
          elevated: '#0D141D',
          primaryText: '#F4F7FB',
          secondaryText: '#94A3B8',
          mutedText: '#526174',
          neonBlue: '#38BDF8',
          brightCyan: '#67E8F9',
          deepBlue: '#0B4F78',
        },
        // Keep compatibility with existing admin/status pages while styling
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#38BDF8',
          700: '#0284c7',
          900: '#0369a1',
        },
      },
      borderColor: {
        'cyber-default': 'rgba(91, 133, 167, 0.20)',
        'cyber-luminous': 'rgba(56, 189, 248, 0.30)',
        'cyber-cyan': 'rgba(103, 232, 249, 0.45)',
      },
      boxShadow: {
        'subtle-blue': '0 0 20px rgba(56, 189, 248, 0.08)',
        'interactive-blue': '0 0 24px rgba(56, 189, 248, 0.18)',
        'focused-cyan': '0 0 0 3px rgba(56, 189, 248, 0.12)',
        'card-glow': '0 0 25px rgba(56, 189, 248, 0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
