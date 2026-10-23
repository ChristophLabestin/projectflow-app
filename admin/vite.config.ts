import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const webDir = fileURLToPath(new URL('../web', import.meta.url));

// Shares the ProjectFlow design base with web/ (tokens, brand, motion) by path, not by copy.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@pf/brand': `${webDir}/components/brand/index.ts`,
            '@pf/motion': `${webDir}/components/motion/index.ts`,
        },
        // web/components resolve `react` from web/node_modules otherwise → two Reacts.
        dedupe: ['react', 'react-dom'],
    },
    css: {
        preprocessorOptions: {
            scss: { loadPaths: [`${webDir}/styles`] },
        },
    },
    server: { port: 3141, strictPort: true, fs: { allow: ['..'] } },
    build: { sourcemap: false, target: 'es2022', chunkSizeWarningLimit: 900 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
