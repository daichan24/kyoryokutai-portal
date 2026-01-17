/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          dark: '#60A5FA', // ダークモード用の少し明るい青
        },
        secondary: {
          DEFAULT: '#10B981',
          dark: '#34D399', // ダークモード用の少し明るい緑
        },
        accent: {
          DEFAULT: '#F59E0B',
          dark: '#FBBF24', // ダークモード用の少し明るいオレンジ
        },
        error: {
          DEFAULT: '#EF4444',
          dark: '#F87171', // ダークモード用の少し明るい赤
        },
        background: {
          DEFAULT: '#F9FAFB',
          dark: '#111827', // ダークモード用の濃いグレー
        },
        text: {
          DEFAULT: '#111827',
          dark: '#F9FAFB', // ダークモード用の明るいグレー
        },
        border: {
          DEFAULT: '#E5E7EB',
          dark: '#374151', // ダークモード用のグレー
        },
        muted: {
          DEFAULT: '#6B7280',
          dark: '#9CA3AF', // ダークモード用の少し明るいグレー
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};
