import { describe, expect, it } from 'vitest';

import {
    clientInfo,
    diffMarkdown,
    evaluateGate,
    legalTypeFromSlug,
    markdownHeadings,
    nextEffectiveAt,
    renderMarkdown,
    versionMetaFromRaw,
    type VersionMeta,
} from '../legalConsent';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-23T12:00:00Z');
const v = (version: number, changeType: VersionMeta['changeType'], offsetDays = -10): VersionMeta => ({
    version, changeType, effectiveAtMs: NOW + offsetDays * DAY, publishedAtMs: NOW - 20 * DAY, summary: { de: `DE ${version}`, en: `EN ${version}` },
});
const docs = (terms: VersionMeta[], privacy: VersionMeta[] = [v(1, 'requiresAcceptance')]) => [
    { type: 'privacy' as const, versions: privacy },
    { type: 'terms' as const, versions: terms },
    { type: 'imprint' as const, versions: [v(1, 'notifyOnly'), v(2, 'notifyOnly')] },
];

describe('evaluateGate (mirror of functions/src/legal-logic.ts)', () => {
    it('blocks new users (initial consent) but never for the imprint', () => {
        const gate = evaluateGate(docs([v(1, 'requiresAcceptance')]), {}, NOW);
        expect(gate.blocking.map((item) => item.type)).toEqual(['privacy', 'terms']);
        expect(gate.blocking[0].acceptedVersion).toBeNull();
    });

    it('blocks on a requiresAcceptance change, notices on notifyOnly', () => {
        const accepted = { privacy: { version: 1 }, terms: { version: 1 } };
        expect(evaluateGate(docs([v(1, 'requiresAcceptance'), v(2, 'requiresAcceptance')]), accepted, NOW).blocking[0]).toMatchObject({ type: 'terms', version: 2, acceptedVersion: 1 });
        const notice = evaluateGate(docs([v(1, 'requiresAcceptance'), v(2, 'notifyOnly')]), accepted, NOW);
        expect(notice.blocking).toHaveLength(0);
        expect(notice.notices[0]).toMatchObject({ type: 'terms', version: 2 });
    });

    it('ignores future versions until effective and reports the next switch time', () => {
        const versions = [v(1, 'requiresAcceptance'), v(2, 'requiresAcceptance', 3)];
        const accepted = { privacy: { version: 1 }, terms: { version: 1 } };
        expect(evaluateGate(docs(versions), accepted, NOW).blocking).toHaveLength(0);
        expect(nextEffectiveAt(docs(versions), NOW)).toBe(NOW + 3 * DAY);
        expect(evaluateGate(docs(versions), accepted, NOW + 4 * DAY).blocking[0].version).toBe(2);
    });

    it('nothing to do without published versions', () => {
        expect(evaluateGate(docs([], []), null, NOW)).toEqual({ blocking: [], notices: [] });
    });
});

describe('markdown + diff', () => {
    it('renders the supported subset and escapes HTML', () => {
        const html = renderMarkdown('# Title\n\nText with **bold**, *em* and [link](https://x.de).  \nNext line <script>\n\n- a\n- b\n\n1. one\n2. two\n\n[bad](javascript:alert(1))');
        expect(html).toContain('<h1 id="title">Title</h1>');
        expect(html).toContain('<strong>bold</strong>');
        expect(html).toContain('<em>em</em>');
        expect(html).toContain('<a href="https://x.de" target="_blank" rel="noopener noreferrer">link</a>');
        expect(html).toContain('<br>Next line &lt;script&gt;');
        expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
        expect(html).toContain('<ol><li>one</li><li>two</li></ol>');
        expect(html).toContain('<a href="#">bad</a>');
    });

    it('extracts headings with stable ids', () => {
        expect(markdownHeadings('## 1. Einleitung\ntext\n### Sub')).toEqual([
            { level: 2, text: '1. Einleitung', id: '1-einleitung' },
            { level: 3, text: 'Sub', id: 'sub' },
        ]);
    });

    it('diffs by paragraph', () => {
        expect(diffMarkdown('# A\n\nold\n\nsame', '# A\n\nnew\n\nsame')).toEqual([
            { kind: 'same', text: '# A' },
            { kind: 'removed', text: 'old' },
            { kind: 'added', text: 'new' },
            { kind: 'same', text: 'same' },
        ]);
    });
});

describe('helpers', () => {
    it('maps the old impressum slug', () => {
        expect(legalTypeFromSlug('impressum')).toBe('imprint');
        expect(legalTypeFromSlug('terms')).toBe('terms');
        expect(legalTypeFromSlug('cookies')).toBeNull();
    });

    it('parses Firestore timestamps and ISO strings', () => {
        expect(versionMetaFromRaw({ version: 2, changeType: 'requiresAcceptance', effectiveAt: { seconds: 10 }, publishedAt: '2026-01-01T00:00:00Z' }))
            .toMatchObject({ version: 2, effectiveAtMs: 10_000, publishedAtMs: Date.parse('2026-01-01T00:00:00Z') });
    });

    it('identifies web vs desktop clients', () => {
        expect(clientInfo(false).platform).toBe('web');
        expect(clientInfo(true).platform).toBe('desktop');
    });
});
