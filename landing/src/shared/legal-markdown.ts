/**
 * Markdown subset of the legal documents (headings, paragraphs, lists, links, bold, italics).
 * Shared by the build-time render (src/templates/legal.ts) and the browser refresh (src/js/legal.ts).
 */
export interface LegalDoc {
    type: string;
    version: number | string;
    effectiveAt?: string;
    title: string;
    markdown: string;
}

export const escapeHtml = (value: string) =>
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

/** Line-based markdown subset of the legal documents: headings, paragraphs, bullet and numbered lists. */
export function renderMarkdown(markdown: string): { html: string; toc: { id: string; title: string }[] } {
    const toc: { id: string; title: string }[] = [];
    const out: string[] = [];
    let para: string[] = [];
    let list: { tag: 'ul' | 'ol'; items: string[]; start: number } | null = null;

    const flushPara = () => {
        if (para.length) out.push(`<p>${inline(para.join('\n'))}</p>`);
        para = [];
    };
    const flushList = () => {
        if (list) {
            const start = list.tag === 'ol' && list.start !== 1 ? ` start="${list.start}"` : '';
            out.push(`<${list.tag}${start}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
        }
        list = null;
    };

    for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
        const line = raw.trimEnd();
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (!line.trim()) {
            flushPara();
            flushList();
        } else if (heading) {
            flushPara();
            flushList();
            const level = Math.min(4, Math.max(2, heading[1].length)); // page h1 comes from the template
            const title = heading[2].trim();
            if (level === 2) {
                const id = slug(title) || `section-${toc.length + 1}`;
                toc.push({ id, title });
                out.push(`<h2 id="${id}">${inline(title)}</h2>`);
            } else {
                out.push(`<h${level}>${inline(title)}</h${level}>`);
            }
        } else if (bullet || numbered) {
            flushPara();
            const tag = bullet ? 'ul' : 'ol';
            if (!list || list.tag !== tag) {
                flushList();
                list = { tag, items: [], start: numbered ? Number(numbered[1]) : 1 };
            }
            list.items.push(bullet ? bullet[1] : numbered![2]);
        } else if (list && /^\s{2,}\S/.test(raw)) {
            list.items[list.items.length - 1] += ` ${line.trim()}`; // continuation line of a list item
        } else {
            flushList();
            para.push(raw.endsWith('  ') ? `${line}  ` : line);
        }
    }
    flushPara();
    flushList();
    return { html: out.join('\n'), toc };
}

/** Body of a legal document as HTML (drops a leading "# Title" – the page renders the title itself). */
export const legalHtml = (doc: LegalDoc) => renderMarkdown(doc.markdown.replace(/^#\s+.+\n+/, ''));

export const legalMetaLine = (doc: LegalDoc, lang: string) => {
    const updated = doc.effectiveAt
        ? new Date(doc.effectiveAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
    const versionLabel = lang === 'de' ? 'Fassung' : 'Version';
    const effectiveLabel = lang === 'de' ? 'gültig ab' : 'effective';
    return `${versionLabel} ${doc.version}${updated ? ` · ${effectiveLabel} ${updated}` : ''}`;
};

export const legalToc = (toc: { id: string; title: string }[], doc: LegalDoc, lang: string) =>
    (toc.length > 4 && doc.markdown.length > 6000
        ? `<details class="legal__toc"><summary>${lang === 'de' ? 'Inhalt' : 'Contents'}</summary><ol>${toc.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join('')}</ol></details>`
        : '');
