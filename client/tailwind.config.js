/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                navy: {
                    950: '#040d1a',
                    900: '#0a1628',
                    800: '#0f2040',
                    700: '#162a54',
                    500: '#2a4a82',
                    600: '#1e3a6e',
                },
                gold: {
                    400: '#f0c040',
                    500: '#d4af37',
                    600: '#b8960c',
                },
                slate: {
                    850: '#1a2433',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'pulse-slow': 'pulse 3s ease-in-out infinite',
                'shimmer': 'shimmer 1.5s infinite',
            },
            keyframes: {
                fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
                slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
            },
        },
    },
    plugins: [],
};
