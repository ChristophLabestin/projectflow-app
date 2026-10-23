import { site } from '../content/site';
import { icon } from './icons';
import { esc } from './layout';
import { legalApiUrl, legalAppUrl, legalUrl, urlFor, type Lang, type LegalKind } from './pages';

/** Shell for a legal page; src/js/legal.ts fills it from the app's published version. */
export const legalBody = (kind: LegalKind, lang: Lang): string => {
    const t = site[lang];
    const kinds: LegalKind[] = ['imprint', 'privacy', 'terms'];
    return `
<article class="legal container">
    <header class="legal__head">
        <a class="legal__back" href="${urlFor('home', lang)}">${icon('arrowRight', 'icon--flip')}${esc(t.legalPage.back)}</a>
        <nav class="legal__switch" aria-label="${esc(t.footer.legal)}">
            ${kinds.map((k) => `<a href="${legalUrl(k, lang)}"${k === kind ? ' aria-current="page"' : ''}>${esc(t.legalMeta[k].title)}</a>`).join('')}
        </nav>
        <h1 data-legal-title>${esc(t.legalMeta[kind].title)}</h1>
        <p class="legal__updated" data-legal-meta data-error="${esc(t.legalPage.error)}">${esc(t.legalPage.loading)}</p>
    </header>
    <div class="legal__layout" data-legal data-src="${legalApiUrl(kind, lang)}" aria-live="polite">
        <div class="legal__content">
            <p><a href="${legalAppUrl(kind)}" data-legal-fallback>${esc(t.legalPage.fallback)}</a></p>
        </div>
    </div>
</article>`;
};
