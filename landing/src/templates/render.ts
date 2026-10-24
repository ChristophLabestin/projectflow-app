import { site } from '../content/site';
import { homeBody } from './home';
import { esc, layout, links } from './layout';
import { icon } from './icons';
import { urlFor, type PageDef } from './pages';
import { legalBody } from './legal';
import { docsMcpBody } from './docs';
import { buyBody } from './buy';
import { buyCopy } from '../content/buy';
import { docsMcp } from '../content/docs-mcp';

const notFoundBody = (): string => {
    const de = site.de.notFound;
    const en = site.en.notFound;
    return `
<section class="not-found container">
    <p class="not-found__code" aria-hidden="true">404</p>
    <h1>${esc(de.title)}</h1>
    <p>${esc(de.text)}</p>
    <div class="not-found__actions">
        <a class="btn btn--primary" href="/">${esc(de.home)}</a>
        <a class="btn btn--ghost" href="${links.app}">${esc(de.app)}</a>
    </div>
    <p class="not-found__alt" lang="en">${esc(en.title)}. <a href="${urlFor('home', 'en')}">${esc(en.home)}</a> ${icon('arrowRight')}</p>
</section>`;
};

export function renderPage(page: PageDef): string {
    const t = site[page.lang];
    switch (page.kind) {
        case 'home':
            return layout({
                page,
                title: t.meta.title,
                description: t.meta.description,
                body: homeBody(t, page.lang),
                scripts: ['/src/js/main.ts', '/src/js/home.ts'],
                bodyClass: 'page-home',
            });
        case 'docsMcp':
            return layout({
                page,
                title: docsMcp[page.lang].meta.title,
                description: docsMcp[page.lang].meta.description,
                body: docsMcpBody(page.lang),
                scripts: ['/src/js/main.ts', '/src/js/docs.ts'],
                bodyClass: 'page-docs',
            });
        case 'buy':
            return layout({
                page,
                title: `${buyCopy[page.lang].meta.title} · ProjectFlow`,
                description: buyCopy[page.lang].meta.description,
                body: buyBody(page.lang),
                scripts: ['/src/js/main.ts', '/src/js/buy.ts'],
                bodyClass: 'page-buy',
                noindex: true,
            });
        case 'notFound':
            return layout({
                page,
                title: `${site.de.notFound.title} · ProjectFlow`,
                description: site.de.notFound.text,
                body: notFoundBody(),
                scripts: ['/src/js/main.ts'],
                bodyClass: 'page-404',
                noindex: true,
            });
        default: {
            const meta = t.legalMeta[page.kind];
            return layout({
                page,
                title: `${meta.title} · ProjectFlow`,
                description: meta.description,
                body: legalBody(page.kind, page.lang),
                scripts: ['/src/js/main.ts', '/src/js/legal.ts'],
                bodyClass: 'page-legal',
            });
        }
    }
}
