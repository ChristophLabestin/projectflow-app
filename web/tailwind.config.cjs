const forms = require('@tailwindcss/forms');
const typography = require('@tailwindcss/typography');
const containerQueries = require('@tailwindcss/container-queries');

const rgbVar = (name) => `rgba(var(${name}), <alpha-value>)`;

module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './App.tsx',
        './AppProviders.tsx',
        './Router.tsx',
        './components/**/*.{ts,tsx}',
        './context/**/*.{ts,tsx}',
        './hooks/**/*.{ts,tsx}',
        './screens/**/*.{ts,tsx}',
        './services/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
        './utils/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: rgbVar('--color-primary-rgb'),
                'primary-text': 'var(--color-primary-text)',
                'on-primary': 'var(--color-primary-text)',
                'primary-hover': 'var(--color-primary-hover)',
                main: 'var(--color-text-main)',
                muted: 'var(--color-text-muted)',
                subtle: 'var(--color-text-subtle)',
                ondark: 'var(--color-text-ondark)',
                canvas: 'var(--color-surface-bg)',
                paper: 'var(--color-surface-paper)',
                card: rgbVar('--color-surface-card-rgb'),
                line: 'var(--color-surface-border)',
                surface: {
                    DEFAULT: rgbVar('--color-surface-card-rgb'),
                    bg: rgbVar('--color-surface-bg-rgb'),
                    card: rgbVar('--color-surface-card-rgb'),
                    paper: rgbVar('--color-surface-paper-rgb'),
                    hover: rgbVar('--color-surface-hover-rgb'),
                    border: 'var(--color-surface-border)',
                },
                border: 'var(--color-surface-border)',
                success: rgbVar('--color-success-rgb'),
                warning: rgbVar('--color-warning-rgb'),
                error: rgbVar('--color-error-rgb'),
                ink: 'var(--color-text-main)',
            },
            borderRadius: {
                sm: 'var(--radius-sm)',
                md: 'var(--radius-md)',
                lg: 'var(--radius-lg)',
                xl: 'var(--radius-xl)',
                '2xl': 'var(--radius-2xl)',
                '3xl': 'var(--radius-3xl)',
            },
            boxShadow: {
                soft: 'var(--shadow-soft)',
                lift: 'var(--shadow-lg)',
            },
            fontFamily: {
                display: ['Plus Jakarta Sans', 'sans-serif'],
                body: ['Plus Jakarta Sans', 'sans-serif'],
            },
        },
    },
    plugins: [
        forms({ strategy: 'class' }),
        typography,
        containerQueries,
    ],
};
