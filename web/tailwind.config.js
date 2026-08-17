/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fairytale beauty counter — antique vanity, not a clinic.
        ground: '#FFFDF9', // milk cream
        surface: '#FBF3EA', // warm parchment
        powder: '#F6D7DD', // powder pink
        wisteria: '#DFD0EC', // wisteria
        sky: '#D6E4F0', // faint sky
        // Ornament only: hairlines, borders, flourishes, small icons.
        // NEVER body text and never text on light ground — it fails contrast.
        gold: '#C6A15B',
        ink: '#4E323B', // deep rose-brown, used instead of black
        'ink-soft': '#6B4A54', // muted ink for secondary text (audited in Phase 4)
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Nunito Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      maxWidth: {
        yincol: '100rem',
        reading: '60ch',
      },
      boxShadow: {
        // Soft emboss — like pressed powder. Faint inner highlight, faint outer shadow.
        emboss:
          'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(78,50,59,0.06), 0 2px 6px rgba(78,50,59,0.10)',
        'emboss-press':
          'inset 0 2px 4px rgba(78,50,59,0.14), inset 0 -1px 0 rgba(255,255,255,0.6)',
        card: '0 4px 18px rgba(78,50,59,0.07)',
      },
      keyframes: {
        // Soft and slow. Nothing bouncy.
        'swatch-rise': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'swatch-rise': 'swatch-rise 520ms ease-out both',
        'soft-fade': 'soft-fade 420ms ease-out both',
        // One sweep when the look card is saved — once, never looping.
        shimmer: 'shimmer 1400ms ease-in-out 1 both',
        'slide-in-right': 'slide-in-right 380ms ease-out both',
        'slide-in-left': 'slide-in-left 380ms ease-out both',
      },
    },
  },
  plugins: [],
};
