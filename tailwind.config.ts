import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F1729',
        surface: '#162035',
        surface2: '#1e2a4a',
        accent: '#6366F1',
        'accent-hover': '#4f46e5',
        text: '#F8FAFC',
        'text-muted': '#94a3b8',
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
        'glow-accent': '0 0 20px rgba(99,102,241,0.3)',
      },
      backdropBlur: {
        navbar: '16px',
      },
    },
  },
  plugins: [],
}

export default config
