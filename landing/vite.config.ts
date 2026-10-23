import { resolve } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { pages, type PageDef } from './src/templates/pages';

/**
 * Renders every page from TS templates at build time (static, crawlable HTML per language) without
 * keeping generated .html files in the source tree. Dev serves the same render via middleware.
 */
const root = resolve(__dirname);
const fileOf = (page: PageDef) => resolve(root, page.file);

function landingPages(): Plugin {
    let server: ViteDevServer | undefined;

    const render = async (page: PageDef): Promise<string> => {
        const mod = server
            ? await server.ssrLoadModule('/src/templates/render.ts')
            : await import('./src/templates/render');
        return mod.renderPage(page) as string;
    };

    return {
        name: 'landing-pages',
        config: () => ({
            build: {
                rollupOptions: {
                    input: Object.fromEntries(pages.map((page) => [page.file, fileOf(page)])),
                },
            },
        }),
        resolveId(id) {
            const page = pages.find((p) => fileOf(p) === id);
            return page ? id : null;
        },
        async load(id) {
            const page = pages.find((p) => fileOf(p) === id);
            return page ? render(page) : null;
        },
        configureServer(devServer) {
            server = devServer;
            devServer.watcher.on('change', (file) => {
                if (file.includes('/src/templates/') || file.includes('/src/content/')) {
                    devServer.moduleGraph.invalidateAll();
                    devServer.ws.send({ type: 'full-reload' });
                }
            });
            devServer.middlewares.use(async (req, res, next) => {
                const url = (req.url ?? '/').split('?')[0];
                if (url.startsWith('/@') || url.startsWith('/src/') || url.startsWith('/node_modules/')) return next();
                const page = pages.find((p) => p.url === url || `${p.url}/` === url)
                    ?? (url.includes('.') ? undefined : pages.find((p) => p.kind === 'notFound'));
                if (!page || (req.headers.accept ?? '').includes('application/json')) return next();
                try {
                    const html = await devServer.transformIndexHtml(url, await render(page), fileOf(page));
                    res.statusCode = page.kind === 'notFound' ? 404 : 200;
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.end(html);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

export default defineConfig({
    plugins: [landingPages()],
    optimizeDeps: { include: ['gsap', 'gsap/ScrollTrigger'] },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
    build: { target: 'es2020', cssCodeSplit: true, assetsInlineLimit: 2048 },
    server: { port: 4300, strictPort: true },
    preview: { port: 4300, strictPort: true },
});
