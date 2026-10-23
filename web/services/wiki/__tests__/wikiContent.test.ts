import { describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase', () => ({ auth: {}, db: {}, functions: {}, storage: {}, rtdb: {} }));
import type { WikiDocMeta } from '../../../types/wiki';
import {
    WIKI_CHUNK_CHARS,
    buildTree,
    computeDrop,
    descendantIds,
    extractPlainText,
    extractRefs,
    flattenTree,
    joinChunks,
    orderBetween,
    searchDocs,
    splitIntoChunks,
} from '../wikiContent';
import { markdownToWikiJson, parseInline } from '../wikiMarkdown';
import { parseAiTasks } from '../wikiAi';
import { filterEmbeddedTasks } from '../../../screens/wiki/editor/nodeViews';

const meta = (id: string, extra: Partial<WikiDocMeta> = {}): WikiDocMeta => ({
    id, tenantId: 't', spaceType: 'workspace', projectId: null, parentId: null, order: 0, title: id, icon: null,
    excerpt: '', searchText: id, bodyChunks: 1, bodyRev: 1, bodySize: 0, linkedTaskRefs: [], mentionTaskRefs: [],
    taskRefs: [], outLinks: [], mentionedUserIds: [], createdBy: 'u', updatedBy: 'u', updatedByName: null,
    createdAt: 0, updatedAt: 0, archivedAt: null, archivedBy: null, ...extra,
});

describe('chunking', () => {
    it('round-trips long bodies through chunks below the Firestore limit', () => {
        const raw = 'x'.repeat(WIKI_CHUNK_CHARS * 2 + 5);
        const chunks = splitIntoChunks(raw);
        expect(chunks).toHaveLength(3);
        expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(WIKI_CHUNK_CHARS);
        const shuffled = chunks.map((data, i) => ({ i, data })).reverse();
        expect(joinChunks(shuffled)).toBe(raw);
    });
});

describe('text and refs', () => {
    const doc = {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Plan' }] },
            { type: 'paragraph', content: [
                { type: 'text', text: 'Ask ' },
                { type: 'wikiMention', attrs: { kind: 'user', id: 'u1', label: 'Ana' } },
                { type: 'text', text: ' about ' },
                { type: 'wikiMention', attrs: { kind: 'task', id: 'k1', projectId: 'p1', label: 'Login' } },
                { type: 'wikiMention', attrs: { kind: 'doc', id: 'd2', label: 'Spec' } },
            ] },
        ],
    };
    it('extracts readable text with mention labels', () => {
        expect(extractPlainText(doc)).toBe('Plan\nAsk @Ana about @Login@Spec');
    });
    it('collects page, task and person references', () => {
        expect(extractRefs(doc)).toEqual({ outLinks: ['d2'], mentionTaskRefs: ['p1/k1'], mentionedUserIds: ['u1'] });
    });
});

describe('tree', () => {
    const docs = [
        meta('a', { order: 2 }),
        meta('b', { order: 1 }),
        meta('a1', { parentId: 'a', order: 1 }),
        meta('a1x', { parentId: 'a1', order: 1 }),
        meta('gone', { parentId: 'a', archivedAt: 5 }),
        meta('orphan', { parentId: 'missing' }),
    ];
    it('nests, sorts and hides archived pages; orphans surface at the root', () => {
        const flat = flattenTree(buildTree(docs)).map((node) => `${node.doc.id}:${node.depth}`);
        expect(flat).toEqual(['orphan:0', 'b:0', 'a:0', 'a1:1', 'a1x:2']);
        expect(flattenTree(buildTree(docs), new Set(['a'])).map((node) => node.doc.id)).toEqual(['orphan', 'b', 'a']);
    });
    it('rejects dropping a page into its own subtree and orders between neighbours', () => {
        expect(descendantIds(docs, 'a').sort()).toEqual(['a1', 'a1x', 'gone']);
        expect(computeDrop(docs, 'a', 'a1x', 'inside')).toBeNull();
        expect(computeDrop(docs, 'b', 'a', 'after')).toEqual({ parentId: null, order: 1002 });
        expect(computeDrop(docs, 'a1x', 'b', 'inside')).toEqual({ parentId: 'b', order: 1000 });
        expect(orderBetween(1, 2)).toBe(1.5);
        expect(orderBetween(null, 5)).toBe(-995);
    });
});

describe('search', () => {
    it('ranks title hits first and needs every word', () => {
        const docs = [
            meta('x', { title: 'Release notes', searchText: 'release notes\nshipping plan' }),
            meta('y', { title: 'Plan', searchText: 'plan\nrelease checklist' }),
            meta('z', { title: 'Other', searchText: 'other' }),
        ];
        expect(searchDocs(docs, 'plan').map((d) => d.id)).toEqual(['y', 'x']);
        expect(searchDocs(docs, 'release plan').map((d) => d.id).sort()).toEqual(['x', 'y']);
        expect(searchDocs(docs, 'nothing')).toEqual([]);
    });
});

describe('markdown import', () => {
    it('converts headings, lists, checklists, quotes and code', () => {
        const json = markdownToWikiJson('# Weekly\n\nSome **bold** text\nmore\n\n- one\n- two\n\n- [ ] todo\n- [x] done\n\n1. first\n\n> quote\n\n```ts\nconst a = 1;\n```\n\n---');
        expect(json.content?.map((node) => node.type)).toEqual([
            'heading', 'paragraph', 'bulletList', 'taskList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule',
        ]);
        expect(json.content?.[3].content?.[1].attrs?.checked).toBe(true);
        expect(json.content?.[6].content?.[0].text).toBe('const a = 1;');
    });
    it('parses inline marks and links', () => {
        expect(parseInline('a **b** [c](https://x.y) `d`')).toEqual([
            { type: 'text', text: 'a ' },
            { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'c', marks: [{ type: 'link', attrs: { href: 'https://x.y' } }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'd', marks: [{ type: 'code' }] },
        ]);
    });
});

describe('ai + embedded tasks', () => {
    it('parses AI task JSON defensively', () => {
        expect(parseAiTasks('{"tasks":[{"title":" Ship it ","priority":"High"},{"title":""},{"foo":1}]}'))
            .toEqual([{ title: 'Ship it', description: undefined, priority: 'High' }]);
        expect(parseAiTasks('not json')).toEqual([]);
    });
    it('filters embedded task lists', () => {
        const tasks = [
            { id: '1', projectId: 'p', title: 'A', isCompleted: false, assigneeIds: ['me'], dueDate: '2000-01-01' },
            { id: '2', projectId: 'p', title: 'B', isCompleted: true },
            { id: '3', projectId: 'q', title: 'C', isCompleted: false },
        ] as any[];
        const base = { projectId: null, status: 'open', assignee: 'any', due: 'any', limit: 8 };
        expect(filterEmbeddedTasks(tasks, base, 'me').items.map((t) => t.id)).toEqual(['1', '3']);
        expect(filterEmbeddedTasks(tasks, { ...base, projectId: 'p', status: 'done' }, 'me').items.map((t) => t.id)).toEqual(['2']);
        expect(filterEmbeddedTasks(tasks, { ...base, assignee: 'me', due: 'overdue' }, 'me').items.map((t) => t.id)).toEqual(['1']);
        expect(filterEmbeddedTasks(tasks, { ...base, limit: 1 }, 'me')).toMatchObject({ total: 2 });
    });
});
