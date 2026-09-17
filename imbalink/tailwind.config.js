/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'desktop-page': 'var(--bg-page)',
        'desktop-sidebar': 'var(--bg-sidebar)',
        'desktop-header': 'var(--bg-header)',
        'desktop-card': 'var(--bg-card)',
        'desktop-filter': 'var(--bg-filter)',
        'desktop-border': 'var(--border-soft)',
        'desktop-primary': 'var(--text-primary)',
        'desktop-muted': 'var(--text-muted)',
        'desktop-burgundy': 'var(--accent-burgundy)',
        'desktop-blush': 'var(--accent-blush)',
      },
      boxShadow: {
        'desktop-soft': 'var(--shadow-soft)',
        'desktop-card': 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
