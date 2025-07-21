/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tribal: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0f0f0f',
        }
      },
      fontFamily: {
        'cinzel': ['Cinzel', 'serif'],
      },
      backgroundImage: {
        'tribal-pattern': "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1000 1000\"><defs><pattern id=\"tribal\" patternUnits=\"userSpaceOnUse\" width=\"100\" height=\"100\"><path d=\"M20,20 Q30,10 40,20 T60,20 Q70,30 60,40 T40,40 Q30,50 40,60 T60,60 Q70,70 60,80 T40,80 Q30,90 20,80 T20,60 Q10,50 20,40 T20,20\" fill=\"none\" stroke=\"rgba(245,158,11,0.1)\" stroke-width=\"1\"/></pattern></defs><rect width=\"100%\" height=\"100%\" fill=\"url(%23tribal)\"/></svg>')",
      }
    },
  },
  plugins: [],
}
