import { legalHtml, legalMetaLine, legalToc, type LegalDoc } from '../shared/legal-markdown';

/**
 * Legal pages are rendered at build time with the version published in the app. In the browser we only check
 * quietly whether a newer version was published since the last deploy and swap it in; errors change nothing.
 */
async function refresh(root: HTMLElement) {
    const lang = document.documentElement.lang;
    try {
        const res = await fetch(root.dataset.src!, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const doc = (await res.json()) as LegalDoc;
        if (String(doc.version) === root.dataset.version) return;
        const { html, toc } = legalHtml(doc);
        root.innerHTML = `${legalToc(toc, doc, lang)}<div class="legal__content">${html}</div>`;
        if (matchMedia('(min-width: 961px)').matches) root.querySelector('details.legal__toc')?.setAttribute('open', '');
        root.dataset.version = String(doc.version);
        const heading = document.querySelector<HTMLElement>('[data-legal-title]');
        const meta = document.querySelector<HTMLElement>('[data-legal-meta]');
        if (heading) heading.textContent = doc.title;
        if (meta) meta.textContent = legalMetaLine(doc, lang);
    } catch {
        /* keep the prerendered version */
    }
}

const root = document.querySelector<HTMLElement>('[data-legal]');
// Wide screens: the table of contents sits in its own column, so opening it shifts nothing (closed on phones).
if (root && matchMedia('(min-width: 961px)').matches) root.querySelector('details.legal__toc')?.setAttribute('open', '');
if (root) void refresh(root);
