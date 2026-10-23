/**
 * Legal pages render the version published in the app (GET /api/legal/<type>?lang=…).
 * Only used when LEGAL_SOURCE = 'api' in src/templates/pages.ts; on any error the shell keeps
 * its link to the app route.
 */
interface LegalResponse {
    type: string;
    version: number | string;
    effectiveAt?: string;
    title: string;
    markdown: string;
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slug = (value: string) =>
    value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Inline markdown: links (http/https/mailto only), bold, italics, hard breaks. Input is escaped first. */
const inline = (text: string) =>
    escapeHtml(text)
        .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
        .replace(/ {2}\n/g, '<br>');

/** Block markdown subset used by the legal documents: headings, paragraphs, bullet lists. */
export function renderMarkdown(markdown: string): { html: string; toc: { id: string; title: string }[] } {
    const toc: { id: string; title: string }[] = [];
    const blocks = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/);
    const html = blocks.map((block) => {
        const heading = block.match(/^(#{1,4})\s+(.+)$/);
        if (heading && !block.includes('\n')) {
            const level = Math.min(4, Math.max(2, heading[1].length)); // page h1 comes from the template
            const title = heading[2].trim();
            if (level === 2) {
                const id = slug(title) || `section-${toc.length + 1}`;
                toc.push({ id, title });
                return `<h2 id="${id}">${inline(title)}</h2>`;
            }
            return `<h${level}>${inline(title)}</h${level}>`;
        }
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
            return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
        }
        return `<p>${inline(block)}</p>`;
    }).join('\n');
    return { html, toc };
}

async function load(root: HTMLElement) {
    const content = root.querySelector<HTMLElement>('.legal__content');
    const status = root.querySelector<HTMLElement>('[data-legal-status]');
    const lang = document.documentElement.lang;
    try {
        const res = await fetch(root.dataset.src!, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        const doc = (await res.json()) as LegalResponse;
        // Drop a leading "# Title" – the page renders the title itself.
        const body = doc.markdown.replace(/^#\s+.+\n+/, '');
        const { html, toc } = renderMarkdown(body);
        const updated = doc.effectiveAt
            ? new Date(doc.effectiveAt).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
            : '';
        const tocTitle = lang === 'de' ? 'Inhalt' : 'Contents';
        const versionLabel = lang === 'de' ? 'Fassung' : 'Version';
        const effectiveLabel = lang === 'de' ? 'gültig ab' : 'effective';
        if (toc.length > 4) {
            root.insertAdjacentHTML('afterbegin', `<nav class="legal__toc" aria-labelledby="toc-title"><h2 id="toc-title">${tocTitle}</h2><ol>${toc.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join('')}</ol></nav>`);
        }
        if (content) {
            content.innerHTML = `<h1>${escapeHtml(doc.title)}</h1><p class="legal__updated">${versionLabel} ${escapeHtml(String(doc.version))}${updated ? ` · ${effectiveLabel} ${updated}` : ''}</p>${html}`;
        }
        document.title = `${doc.title} · ProjectFlow`;
        if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch {
        if (status) status.textContent = status.dataset.error ?? '';
    }
}

const root = document.querySelector<HTMLElement>('[data-legal]');
if (root) void load(root);
