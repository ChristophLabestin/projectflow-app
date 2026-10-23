/**
 * Versioned legal documents: gate evaluation, Markdown rendering and block diff.
 * The gate logic mirrors functions/src/legal-logic.ts (server is the source of truth when
 * accepting) and the iOS contract in brain/plans/legal-consent-contract.md — keep them in sync.
 */

export const LEGAL_TYPES = ['privacy', 'terms', 'imprint'] as const;
export type LegalType = typeof LEGAL_TYPES[number];
export type LegalChangeType = 'requiresAcceptance' | 'notifyOnly';
export type LegalPlatform = 'web' | 'desktop' | 'ios';
export type Localized = { de: string; en: string };

/** Documents users must have accepted. The imprint is informational only. */
export const ACCEPTANCE_TYPES: LegalType[] = ['privacy', 'terms'];

export const isLegalType = (value: unknown): value is LegalType =>
    typeof value === 'string' && (LEGAL_TYPES as readonly string[]).includes(value);

/** Old URL slug kept working: /legal/impressum → imprint. */
export const legalTypeFromSlug = (slug: string | undefined): LegalType | null => {
    if (slug === 'impressum' || slug === 'legal-notice') return 'imprint';
    if (slug === 'datenschutz' || slug === 'app-privacy' || slug === 'appPrivacy') return 'privacy';
    if (slug === 'agb' || slug === 'tos') return 'terms';
    return isLegalType(slug) ? slug : null;
};

export type VersionMeta = {
    version: number;
    changeType: LegalChangeType;
    effectiveAtMs: number;
    publishedAtMs: number;
    summary: Localized;
};

export type AcceptedDocs = Partial<Record<LegalType, { version: number }>>;

export type GateItem = {
    type: LegalType;
    version: number;
    acceptedVersion: number | null;
    changes: VersionMeta[];
};

export type GateResult = { blocking: GateItem[]; notices: GateItem[] };

export const currentEffective = (versions: VersionMeta[], nowMs: number): VersionMeta | null => {
    let best: VersionMeta | null = null;
    for (const v of versions) {
        if (v.effectiveAtMs <= nowMs && (!best || v.version > best.version)) best = v;
    }
    return best;
};

export const evaluateGate = (
    docs: Array<{ type: LegalType; versions: VersionMeta[] }>,
    accepted: AcceptedDocs | null | undefined,
    nowMs: number,
): GateResult => {
    const result: GateResult = { blocking: [], notices: [] };
    for (const doc of docs) {
        if (!ACCEPTANCE_TYPES.includes(doc.type)) continue;
        const current = currentEffective(doc.versions, nowMs);
        if (!current) continue;
        const acceptedVersion = accepted?.[doc.type]?.version ?? 0;
        if (acceptedVersion >= current.version) continue;
        const changes = doc.versions
            .filter((v) => v.version > acceptedVersion && v.version <= current.version)
            .sort((a, b) => b.version - a.version);
        const item: GateItem = { type: doc.type, version: current.version, acceptedVersion: acceptedVersion > 0 ? acceptedVersion : null, changes };
        const needsAcceptance = acceptedVersion === 0 || changes.some((v) => v.changeType === 'requiresAcceptance');
        (needsAcceptance ? result.blocking : result.notices).push(item);
    }
    return result;
};

/** Next time a future-dated version becomes effective (to re-evaluate the gate without reload). */
export const nextEffectiveAt = (docs: Array<{ versions: VersionMeta[] }>, nowMs: number): number | null => {
    let next: number | null = null;
    for (const doc of docs) {
        for (const v of doc.versions) {
            if (v.effectiveAtMs > nowMs && (next == null || v.effectiveAtMs < next)) next = v.effectiveAtMs;
        }
    }
    return next;
};

const toMs = (value: any): number => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const versionMetaFromRaw = (raw: any): VersionMeta => ({
    version: Number(raw?.version) || 0,
    changeType: raw?.changeType === 'requiresAcceptance' ? 'requiresAcceptance' : 'notifyOnly',
    effectiveAtMs: toMs(raw?.effectiveAt),
    publishedAtMs: toMs(raw?.publishedAt),
    summary: { de: raw?.summary?.de || '', en: raw?.summary?.en || '' },
});

export const timestampToMs = toMs;

// ---------------------------------------------------------------------------
// Markdown (subset: headings, paragraphs, - / 1. lists, **bold**, *italic*, [links](url),
// hard line breaks via two trailing spaces, ---). Output must still go through DOMPurify.
// ---------------------------------------------------------------------------

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeHref = (href: string) => (/^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : '#');

const renderInline = (text: string) =>
    escapeHtml(text)
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
            const url = safeHref(href.replace(/&amp;/g, '&'));
            const external = /^https?:/i.test(url);
            return `<a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
        .replace(/ {2}\n/g, '<br>')
        .replace(/\n/g, ' ');

export const slugifyHeading = (text: string) =>
    text.toLowerCase().replace(/[*_[\]()]/g, '').trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '').replace(/-+/g, '-');

export type MarkdownHeading = { level: number; text: string; id: string };

export const markdownHeadings = (markdown: string): MarkdownHeading[] =>
    markdown.split('\n').flatMap((line) => {
        const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
        if (!match) return [];
        const text = match[2].replace(/\*\*/g, '').trim();
        return [{ level: match[1].length, text, id: slugifyHeading(text) }];
    });

export const renderMarkdown = (markdown: string): string => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushParagraph = () => {
        if (paragraph.length) out.push(`<p>${renderInline(paragraph.join('\n'))}</p>`);
        paragraph = [];
    };
    const flushList = () => {
        if (list) {
            const tag = list.ordered ? 'ol' : 'ul';
            out.push(`<${tag}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
        }
        list = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/, (trail) => (trail.length >= 2 ? '  ' : ''));
        const trimmed = line.trim();
        if (!trimmed) { flushParagraph(); flushList(); continue; }
        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph(); flushList();
            const level = heading[1].length;
            const text = heading[2].trim();
            out.push(`<h${level} id="${slugifyHeading(text.replace(/\*\*/g, ''))}">${renderInline(text)}</h${level}>`);
            continue;
        }
        if (/^(-{3,}|\*{3,})$/.test(trimmed)) { flushParagraph(); flushList(); out.push('<hr>'); continue; }
        const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
        const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
        if (bullet || ordered) {
            flushParagraph();
            const isOrdered = Boolean(ordered);
            if (list && list.ordered !== isOrdered) flushList();
            if (!list) list = { ordered: isOrdered, items: [] };
            list.items.push((bullet || ordered)![1]);
            continue;
        }
        if (list) {
            // continuation line of the last list item
            list.items[list.items.length - 1] += `\n${trimmed}`;
            continue;
        }
        paragraph.push(line.endsWith('  ') ? `${trimmed}  ` : trimmed);
    }
    flushParagraph();
    flushList();
    return out.join('\n');
};

// ---------------------------------------------------------------------------
// Block diff (paragraph granularity, LCS)
// ---------------------------------------------------------------------------

export type DiffBlock = { kind: 'same' | 'added' | 'removed'; text: string };

const splitBlocks = (markdown: string) =>
    markdown.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

export const diffMarkdown = (before: string, after: string): DiffBlock[] => {
    const a = splitBlocks(before);
    const b = splitBlocks(after);
    const n = a.length;
    const m = b.length;
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const result: DiffBlock[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) { result.push({ kind: 'same', text: a[i] }); i += 1; j += 1; }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) { result.push({ kind: 'removed', text: a[i] }); i += 1; }
        else { result.push({ kind: 'added', text: b[j] }); j += 1; }
    }
    while (i < n) { result.push({ kind: 'removed', text: a[i] }); i += 1; }
    while (j < m) { result.push({ kind: 'added', text: b[j] }); j += 1; }
    return result;
};

// ---------------------------------------------------------------------------
// Client identification for consent records
// ---------------------------------------------------------------------------

export const clientInfo = (desktop: boolean): { platform: LegalPlatform; appVersion: string } => {
    if (desktop) {
        const match = /ProjectFlow\/([\w.-]+)/.exec(typeof navigator !== 'undefined' ? navigator.userAgent : '');
        return { platform: 'desktop', appVersion: match ? match[1] : `web-${__PF_BUILD__}` };
    }
    return { platform: 'web', appVersion: `web-${__PF_BUILD__}` };
};
