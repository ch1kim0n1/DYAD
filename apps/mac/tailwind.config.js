/** Tailwind v3 config for DYAD (tech-stack.md). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Match the existing CSS palette so a future Tailwind migration is mechanical
        bg:      '#0a0a0c',
        fg:      '#e8e8ed',
        muted:   '#8a8a92',
        card:    '#16161a',
        border:  '#26262c',
        accent:  '#5b8def',
        self:    '#5b8def',
        partner: '#f97316',
        green:   '#22c55e',
        amber:   '#f59e0b',
        red:     '#ef4444',
        // shadcn-style semantic tokens
        primary: { DEFAULT: '#5b8def', foreground: '#ffffff' },
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '14px',
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%':       { opacity: '0.85' },
        },
      },
    },
  },
  plugins: [],
};
