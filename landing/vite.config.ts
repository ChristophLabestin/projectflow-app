import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { pages, type PageDef } from './src/templates/pages';

/**
 * Renders every page from TS templates at build time (static, crawlable HTML per language) without
 * keeping generated .html files in the source tree. Dev serves the same render via middleware.
 */
const root = resolve(__dirname);
const fileOf = (page: PageDef) => resolve(root, page.file);

/**
 * Legal texts: the version published in the app (same API the pages used to load at runtime), fetched once per
 * build and baked into the HTML so the pages show instantly. Falls back to legal/<kind>.<lang>.md in the repo.
 */
const LEGAL_API = 'https://app.getprojectflow.com/api/legal';
async function loadLegalDocs() {
    const docs: Record<string, { type: string; version: number | string; effectiveAt?: string; title: string; markdown: string }> = {};
    await Promise.all(['imprint', 'privacy', 'terms'].flatMap((kind) => ['de', 'en'].map(async (lang) => {
        try {
            const res = await fetch(`${LEGAL_API}/${kind}?lang=${lang}`, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(String(res.status));
            docs[`${kind}.${lang}`] = await res.json();
        } catch {
            const markdown = await readFile(resolve(root, '..', 'legal', `${kind}.${lang}.md`), 'utf8').catch(() => '');
            if (markdown) docs[`${kind}.${lang}`] = { type: kind, version: 'repo', title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? kind, markdown };
            console.warn(`[landing] legal ${kind}.${lang}: API not reachable, using legal/${kind}.${lang}.md`);
        }
    })));
    return docs;
}

function landingPages(): Plugin {
    let server: ViteDevServer | undefined;

    let legal: ReturnType<typeof loadLegalDocs> | null = null;
    const render = async (page: PageDef): Promise<string> => {
        const mod = server
            ? await server.ssrLoadModule('/src/templates/render.ts')
            : await import('./src/templates/render');
        legal ??= loadLegalDocs();
        mod.setLegalDocs(await legal);
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
        // Generated files (see src/templates/seo-files.ts): always in sync with pages and copy.
        async generateBundle() {
            const seo = await import('./src/templates/seo-files');
            this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: seo.sitemapXml(new Date().toISOString().slice(0, 10)) });
            this.emitFile({ type: 'asset', fileName: 'llms.txt', source: seo.llmsTxt() });
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
                if (url === '/sitemap.xml' || url === '/llms.txt') {
                    const seo = await devServer.ssrLoadModule('/src/templates/seo-files.ts');
                    res.setHeader('Content-Type', url.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
                    res.end(url.endsWith('.xml') ? seo.sitemapXml(new Date().toISOString().slice(0, 10)) : seo.llmsTxt());
                    return;
                }
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
