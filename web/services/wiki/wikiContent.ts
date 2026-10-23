// Pure helpers for wiki content: chunking, text/ref extraction, tree and ordering.
// No Firestore or editor imports so they stay unit-testable.
import type { WikiDocMeta, WikiJsonNode } from '../../types/wiki';

/** Body chunk size in UTF-16 units. Firestore docs max out at 1 MiB; one unit is at most
 *  3 UTF-8 bytes, so 300k units stay below ~900 KB for any text. */
export const WIKI_CHUNK_CHARS = 300_000;
export const WIKI_EXCERPT_CHARS = 200;
export const WIKI_SEARCH_CHARS = 6000;
export const WIKI_MENTION_NODE = 'wikiMention';

export const splitIntoChunks = (value: string, size = WIKI_CHUNK_CHARS): string[] => {
    if (!value) return [''];
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
    return chunks;
};

export const joinChunks = (chunks: { i: number; data: string }[]): string =>
    [...chunks].sort((a, b) => a.i - b.i).map((chunk) => chunk.data || '').join('');

export const emptyDocJson = (): WikiJsonNode => ({ type: 'doc', content: [{ type: 'paragraph' }] });

export const parseDocJson = (value: string | null | undefined): WikiJsonNode => {
    if (!value) return emptyDocJson();
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && parsed.type === 'doc' ? parsed : emptyDocJson();
    } catch {
        return emptyDocJson();
    }
};

const BLOCK_TYPES = new Set([
    'paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'tableCell', 'tableHeader',
    'detailsSummary', 'wikiCallout', 'horizontalRule',
]);

/** Plain text of a document: blocks become lines, mentions become their label. */
export const extractPlainText = (node: WikiJsonNode | null | undefined): string => {
    if (!node) return '';
    const out: string[] = [];
    const walk = (current: WikiJsonNode) => {
        if (current.type === 'text') {
            out.push(current.text || '');
            return;
        }
        if (current.type === WIKI_MENTION_NODE) {
            out.push(`@${current.attrs?.label || ''}`);
            return;
        }
        if (current.type === 'wikiFile') {
            out.push(current.attrs?.name || '');
        }
        if (current.type === 'hardBreak') {
            out.push('\n');
            return;
        }
        (current.content || []).forEach(walk);
        if (current.type && BLOCK_TYPES.has(current.type)) out.push('\n');
    };
    walk(node);
    return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

export const buildExcerpt = (plain: string, max = WIKI_EXCERPT_CHARS): string => {
    const flat = plain.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

export const buildSearchText = (title: string, plain: string, max = WIKI_SEARCH_CHARS): string =>
    `${title}\n${plain}`.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, max);

export interface WikiContentRefs {
    outLinks: string[];
    mentionTaskRefs: string[];
    mentionedUserIds: string[];
}

/** Collects mentioned pages, tasks ("projectId/taskId") and people. */
export const extractRefs = (node: WikiJsonNode | null | undefined): WikiContentRefs => {
    const outLinks = new Set<string>();
    const tasks = new Set<string>();
    const users = new Set<string>();
    const walk = (current: WikiJsonNode) => {
        if (current.type === WIKI_MENTION_NODE && current.attrs?.id) {
            const { kind, id, projectId } = current.attrs;
            if (kind === 'doc') outLinks.add(id);
            if (kind === 'user') users.add(id);
            if (kind === 'task' && projectId) tasks.add(`${projectId}/${id}`);
        }
        (current.content || []).forEach(walk);
    };
    if (node) walk(node);
    return { outLinks: [...outLinks], mentionTaskRefs: [...tasks], mentionedUserIds: [...users] };
};

export const unionRefs = (...lists: (string[] | undefined)[]): string[] =>
    [...new Set(lists.flatMap((list) => list || []))];

/** Headings for the table of contents. */
export const extractHeadings = (node: WikiJsonNode | null | undefined): { level: number; text: string; index: number }[] => {
    const headings: { level: number; text: string; index: number }[] = [];
    (node?.content || []).forEach((child, index) => {
        if (child.type === 'heading') {
            headings.push({ level: Number(child.attrs?.level) || 1, text: extractPlainText(child), index });
        }
    });
    return headings;
};

// ---- Tree ------------------------------------------------------------------

export interface WikiTreeNode {
    doc: WikiDocMeta;
    children: WikiTreeNode[];
    depth: number;
}

export const sortByOrder = (a: WikiDocMeta, b: WikiDocMeta) =>
    (a.order - b.order) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);

/** Builds the page tree. Pages whose parent is missing/archived surface at the root. */
export const buildTree = (docs: WikiDocMeta[]): WikiTreeNode[] => {
    const live = docs.filter((doc) => !doc.archivedAt);
    const ids = new Set(live.map((doc) => doc.id));
    const byParent = new Map<string | null, WikiDocMeta[]>();
    live.forEach((doc) => {
        const parent = doc.parentId && ids.has(doc.parentId) && doc.parentId !== doc.id ? doc.parentId : null;
        const list = byParent.get(parent) || [];
        list.push(doc);
        byParent.set(parent, list);
    });
    const seen = new Set<string>();
    const build = (parentId: string | null, depth: number): WikiTreeNode[] =>
        (byParent.get(parentId) || []).sort(sortByOrder).filter((doc) => {
            if (seen.has(doc.id)) return false;
            seen.add(doc.id);
            return true;
        }).map((doc) => ({ doc, depth, children: build(doc.id, depth + 1) }));
    return build(null, 0);
};

export const flattenTree = (nodes: WikiTreeNode[], collapsed?: Set<string>): WikiTreeNode[] =>
    nodes.flatMap((node) => [
        node,
        ...(collapsed?.has(node.doc.id) ? [] : flattenTree(node.children, collapsed)),
    ]);

export const ancestorsOf = (docs: WikiDocMeta[], id: string): WikiDocMeta[] => {
    const byId = new Map(docs.map((doc) => [doc.id, doc]));
    const chain: WikiDocMeta[] = [];
    const guard = new Set<string>();
    let current = byId.get(id)?.parentId || null;
    while (current && byId.has(current) && !guard.has(current)) {
        guard.add(current);
        const doc = byId.get(current)!;
        chain.unshift(doc);
        current = doc.parentId;
    }
    return chain;
};

export const descendantIds = (docs: WikiDocMeta[], id: string): string[] => {
    const children = new Map<string, string[]>();
    docs.forEach((doc) => {
        if (!doc.parentId) return;
        children.set(doc.parentId, [...(children.get(doc.parentId) || []), doc.id]);
    });
    const out: string[] = [];
    const stack = [...(children.get(id) || [])];
    while (stack.length) {
        const next = stack.pop()!;
        if (out.includes(next) || next === id) continue;
        out.push(next);
        stack.push(...(children.get(next) || []));
    }
    return out;
};

/** Fractional order between two neighbours (either may be missing). */
export const orderBetween = (before?: number | null, after?: number | null): number => {
    if (before == null && after == null) return 1000;
    if (before == null) return (after as number) - 1000;
    if (after == null) return before + 1000;
    return (before + after) / 2;
};

export type WikiDropPosition = 'before' | 'after' | 'inside';

/** Where a dragged page lands relative to a target row. Returns null for invalid drops. */
export const computeDrop = (
    docs: WikiDocMeta[],
    draggedId: string,
    targetId: string,
    position: WikiDropPosition,
): { parentId: string | null; order: number } | null => {
    if (draggedId === targetId) return null;
    if (descendantIds(docs, draggedId).includes(targetId)) return null;
    const target = docs.find((doc) => doc.id === targetId);
    if (!target) return null;
    const live = docs.filter((doc) => !doc.archivedAt && doc.id !== draggedId);
    if (position === 'inside') {
        const siblings = live.filter((doc) => doc.parentId === target.id).sort(sortByOrder);
        return { parentId: target.id, order: orderBetween(siblings[siblings.length - 1]?.order, null) };
    }
    const parentId = target.parentId || null;
    const siblings = live.filter((doc) => (doc.parentId || null) === parentId).sort(sortByOrder);
    const index = siblings.findIndex((doc) => doc.id === target.id);
    if (position === 'before') return { parentId, order: orderBetween(siblings[index - 1]?.order, target.order) };
    return { parentId, order: orderBetween(target.order, siblings[index + 1]?.order) };
};

// ---- Search ----------------------------------------------------------------

/** Title hits first, then body hits; every query word must match somewhere. */
export const searchDocs = (docs: WikiDocMeta[], query: string, limit = 30): WikiDocMeta[] => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return docs
        .filter((doc) => !doc.archivedAt)
        .map((doc) => {
            const title = (doc.title || '').toLowerCase();
            const text = doc.searchText || title;
            if (!words.every((word) => title.includes(word) || text.includes(word))) return null;
            const titleHits = words.filter((word) => title.includes(word)).length;
            const score = titleHits * 10 + (title.startsWith(words[0]) ? 5 : 0) + (doc.updatedAt || 0) / 1e13;
            return { doc, score };
        })
        .filter((entry): entry is { doc: WikiDocMeta; score: number } => Boolean(entry))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.doc);
};

/** A short context snippet around the first query word in the search text. */
export const searchSnippet = (doc: WikiDocMeta, query: string, radius = 60): string => {
    const word = query.toLowerCase().split(/\s+/).filter(Boolean)[0];
    const text = doc.searchText || '';
    const titleLength = (doc.title || '').length + 1;
    const body = text.slice(titleLength);
    if (!word) return doc.excerpt;
    const at = body.indexOf(word);
    if (at < 0) return doc.excerpt;
    const start = Math.max(0, at - radius);
    return `${start > 0 ? '…' : ''}${body.slice(start, at + word.length + radius).trim()}…`;
};
