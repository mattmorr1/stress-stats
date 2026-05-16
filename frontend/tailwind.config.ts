import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'whoop-green': '#00ff94',
        'whoop-amber': '#ffb800',
        'whoop-red':   '#ff4444',
        'whoop-bg':    '#0a0a0a',
        'whoop-card':  '#141414',
        'whoop-border':'#1e1e1e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
} satisfies Config
