import { legal, type LegalKind } from '../content/legal';
import { site } from '../content/site';
import { icon } from './icons';
import { esc } from './layout';
import { urlFor, type Lang } from './pages';

export const legalBody = (kind: LegalKind, lang: Lang): string => {
    const doc = legal[lang][kind];
    const t = site[lang];
    const kinds: LegalKind[] = ['imprint', 'privacy', 'terms'];
    return `
<article class="legal container">
    <header class="legal__head">
        <a class="legal__back" href="${urlFor('home', lang)}">${icon('arrowRight', 'icon--flip')}${esc(t.legalPage.back)}</a>
        <nav class="legal__switch" aria-label="${esc(t.footer.legal)}">
            ${kinds.map((k) => `<a href="${urlFor(k, lang)}"${k === kind ? ' aria-current="page"' : ''}>${esc(legal[lang][k].title)}</a>`).join('')}
        </nav>
        <h1>${esc(doc.title)}</h1>
        <p class="legal__updated">${esc(doc.updated)}</p>
        ${doc.intro ? `<p class="legal__intro">${esc(doc.intro)}</p>` : ''}
    </header>
    <div class="legal__layout">
        ${doc.sections.length > 4 ? `
        <nav class="legal__toc" aria-labelledby="toc-title">
            <h2 id="toc-title">${esc(t.legalPage.toc)}</h2>
            <ol>${doc.sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ol>
        </nav>` : ''}
        <div class="legal__content">
            ${doc.sections.map((s) => `<section id="${s.id}" aria-labelledby="${s.id}-h"><h2 id="${s.id}-h">${esc(s.title)}</h2>${s.html}</section>`).join('\n            ')}
        </div>
    </div>
</article>`;
};
