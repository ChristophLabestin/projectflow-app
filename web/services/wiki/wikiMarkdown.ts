// Minimal Markdown → wiki (Tiptap) JSON. Covers what generated reports use: headings,
// paragraphs, bullet/numbered/check lists, quotes, code fences, rules, **bold**, *italic*,
// `code` and [links](url). Pure so it stays unit-testable.
import type { WikiJsonNode } from '../../types/wiki';

type Mark = { type: string; attrs?: Record<string, any> };

const INLINE = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/;

export const parseInline = (value: string, marks: Mark[] = []): WikiJsonNode[] => {
    const out: WikiJsonNode[] = [];
    let rest = value;
    while (rest) {
        const match = INLINE.exec(rest);
        if (!match) {
            out.push({ type: 'text', text: rest, ...(marks.length ? { marks } : {}) });
            break;
        }
        if (match.index > 0) out.push({ type: 'text', text: rest.slice(0, match.index), ...(marks.length ? { marks } : {}) });
        const [, , bold1, bold2, em1, em2, code, linkText, href] = match;
        if (bold1 || bold2) out.push(...parseInline(bold1 || bold2, [...marks, { type: 'bold' }]));
        else if (em1 || em2) out.push(...parseInline(em1 || em2, [...marks, { type: 'italic' }]));
        else if (code) out.push({ type: 'text', text: code, marks: [...marks, { type: 'code' }] });
        else if (linkText) out.push(...parseInline(linkText, [...marks, { type: 'link', attrs: { href } }]));
        rest = rest.slice(match.index + match[0].length);
    }
    return out.filter((node) => node.text);
};

const paragraph = (value: string): WikiJsonNode => ({ type: 'paragraph', content: parseInline(value.trim()) });

export const markdownToWikiJson = (markdown: string): WikiJsonNode => {
    const lines = (markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const content: WikiJsonNode[] = [];
    let para: string[] = [];
    const flush = () => {
        if (para.length) content.push(paragraph(para.join(' ')));
        para = [];
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) { flush(); continue; }

        if (trimmed.startsWith('```')) {
            flush();
            const language = trimmed.slice(3).trim() || null;
            const code: string[] = [];
            i += 1;
            while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i += 1; }
            content.push({ type: 'codeBlock', attrs: { language }, content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] });
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
        if (heading) {
            flush();
            content.push({ type: 'heading', attrs: { level: Math.min(3, heading[1].length) }, content: parseInline(heading[2].trim()) });
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); content.push({ type: 'horizontalRule' }); continue; }
        if (trimmed.startsWith('>')) {
            flush();
            const quote: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) { quote.push(lines[i].trim().replace(/^>\s?/, '')); i += 1; }
            i -= 1;
            content.push({ type: 'blockquote', content: [paragraph(quote.join(' '))] });
            continue;
        }
        const listMatch = /^([-*+]|\d+[.)])\s+(.*)$/.exec(trimmed);
        if (listMatch) {
            flush();
            const ordered = /\d/.test(listMatch[1]);
            const items: { text: string; checked: boolean | null }[] = [];
            while (i < lines.length) {
                const current = /^([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i].trim());
                if (!current || /\d/.test(current[1]) !== ordered) break;
                const task = /^\[( |x|X)\]\s*(.*)$/.exec(current[2]);
                items.push(task ? { text: task[2], checked: task[1].toLowerCase() === 'x' } : { text: current[2], checked: null });
                i += 1;
            }
            i -= 1;
            if (!ordered && items.every((item) => item.checked !== null)) {
                content.push({
                    type: 'taskList',
                    content: items.map((item) => ({ type: 'taskItem', attrs: { checked: Boolean(item.checked) }, content: [paragraph(item.text)] })),
                });
            } else {
                content.push({
                    type: ordered ? 'orderedList' : 'bulletList',
                    content: items.map((item) => ({ type: 'listItem', content: [paragraph(item.checked === null ? item.text : `${item.checked ? '✓' : '☐'} ${item.text}`)] })),
                });
            }
            continue;
        }
        para.push(trimmed);
    }
    flush();
    return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
};
