import { site } from '../content/site';
import { legalHtml, legalMetaLine, legalToc, type LegalDoc } from '../shared/legal-markdown';
import { icon } from './icons';
import { esc } from './layout';
import { legalApiUrl, legalAppUrl, legalUrl, urlFor, type Lang, type LegalKind } from './pages';

/**
 * Legal page with the text rendered at build time (version published in the app, fetched by vite.config.ts;
 * falls back to legal/<kind>.<lang>.md). src/js/legal.ts only swaps in a newer version if one appears later.
 */
export const legalBody = (kind: LegalKind, lang: Lang, doc?: LegalDoc): string => {
    const t = site[lang];
    const kinds: LegalKind[] = ['imprint', 'privacy', 'terms'];
    const rendered = doc ? legalHtml(doc) : null;
    return `
<article class="legal container">
    <header class="legal__head">
        <a class="legal__back" href="${urlFor('home', lang)}">${icon('arrowRight', 'icon--flip')}${esc(t.legalPage.back)}</a>
        <nav class="legal__switch" aria-label="${esc(t.footer.legal)}">
            ${kinds.map((k) => `<a href="${legalUrl(k, lang)}"${k === kind ? ' aria-current="page"' : ''}>${esc(t.legalMeta[k].title)}</a>`).join('')}
        </nav>
        <h1 data-legal-title>${esc(doc?.title ?? t.legalMeta[kind].title)}</h1>
        <p class="legal__updated" data-legal-meta>${doc ? esc(legalMetaLine(doc, lang)) : ''}</p>
    </header>
    <div class="legal__layout" data-legal data-src="${legalApiUrl(kind, lang)}" data-version="${esc(String(doc?.version ?? ''))}">
        ${rendered && doc ? legalToc(rendered.toc, doc, lang) : ''}
        <div class="legal__content">
            ${rendered ? rendered.html : `<p><a href="${legalAppUrl(kind)}">${esc(t.legalPage.fallback)}</a></p>`}
        </div>
    </div>
</article>`;
};
