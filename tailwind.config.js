export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface-2)',
        line: 'var(--line)', fg: 'var(--fg)', muted: 'var(--muted)', dim: 'var(--dim)'
      },
      borderRadius: { card: 'var(--radius)' }
    }
  },
  plugins: []
};
