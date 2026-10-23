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

async function load(root: HTMLElement) {
    const content = root.querySelector<HTMLElement>('.legal__content');
    const status = document.querySelector<HTMLElement>('[data-legal-meta]');
    const heading = document.querySelector<HTMLElement>('[data-legal-title]');
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
        if (toc.length > 4 && doc.markdown.length > 6000) {
            const open = matchMedia('(min-width: 961px)').matches ? ' open' : '';
            root.insertAdjacentHTML('afterbegin', `<details class="legal__toc"${open}><summary>${tocTitle}</summary><ol>${toc.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join('')}</ol></details>`);
        }
        if (heading) heading.textContent = doc.title;
        if (status) status.textContent = `${versionLabel} ${doc.version}${updated ? ` · ${effectiveLabel} ${updated}` : ''}`;
        if (content) content.innerHTML = html;
        document.title = `${doc.title} · ProjectFlow`;
        if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch {
        if (status) status.textContent = status.dataset.error ?? '';
    }
}

const root = document.querySelector<HTMLElement>('[data-legal]');
if (root) void load(root);
