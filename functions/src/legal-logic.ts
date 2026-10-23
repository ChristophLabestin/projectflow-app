/**
 * Pure logic for versioned legal documents (no Firestore access) so it can be unit tested.
 * The gate evaluation is mirrored in web/utils/legalConsent.ts and the iOS app
 * (contract: brain/plans/legal-consent-contract.md) — keep them in sync.
 */

export const LEGAL_TYPES = ['privacy', 'terms', 'imprint'] as const;
export type LegalType = typeof LEGAL_TYPES[number];
export type LegalChangeType = 'requiresAcceptance' | 'notifyOnly';
export type LegalLang = 'de' | 'en';
export type LegalPlatform = 'web' | 'desktop' | 'ios';
export const LEGAL_PLATFORMS: LegalPlatform[] = ['web', 'desktop', 'ios'];

/** Documents users must have accepted (initial consent + re-consent). The imprint is informational only. */
export const ACCEPTANCE_TYPES: LegalType[] = ['privacy', 'terms'];

export const isLegalType = (value: unknown): value is LegalType =>
    typeof value === 'string' && (LEGAL_TYPES as readonly string[]).includes(value);

export const requiresAcceptanceTracking = (type: LegalType) => ACCEPTANCE_TYPES.includes(type);

export type Localized = { de: string; en: string };

/** Compact version metadata kept on legal_documents/{type}.versions (ascending by version). */
export type VersionMeta = {
    version: number;
    changeType: LegalChangeType;
    effectiveAtMs: number;
    publishedAtMs: number;
    summary: Localized;
    /** Days after effectiveAt during which API/MCP tokens keep working without consent (default 14). */
    machineGraceDays?: number;
};

export const DEFAULT_MACHINE_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AcceptedDocs = Partial<Record<LegalType, { version: number }>>;

export type GateItem = {
    type: LegalType;
    /** The version the user is asked to accept / acknowledge (current effective version). */
    version: number;
    /** Last version the user accepted, null if never (initial consent). */
    acceptedVersion: number | null;
    /** Versions between the accepted one (exclusive) and the current one (inclusive), newest first. */
    changes: VersionMeta[];
};

export type GateResult = {
    /** Blocking: user must accept before using the app. */
    blocking: GateItem[];
    /** Non-blocking notices (notifyOnly changes the user has not acknowledged yet). */
    notices: GateItem[];
};

export const currentEffective = (versions: VersionMeta[], nowMs: number): VersionMeta | null => {
    let best: VersionMeta | null = null;
    for (const v of versions) {
        if (v.effectiveAtMs <= nowMs && (!best || v.version > best.version)) best = v;
    }
    return best;
};

/**
 * Gate rule per acceptance document:
 * - no effective version → nothing
 * - never accepted → blocking (initial consent, also covers new registrations)
 * - accepted < newest effective `requiresAcceptance` version → blocking
 * - accepted < current effective version (only notifyOnly changes in between) → notice
 */
export const evaluateGate = (
    docs: Array<{ type: LegalType; versions: VersionMeta[] }>,
    accepted: AcceptedDocs | null | undefined,
    nowMs: number,
): GateResult => {
    const result: GateResult = { blocking: [], notices: [] };
    for (const doc of docs) {
        if (!requiresAcceptanceTracking(doc.type)) continue;
        const current = currentEffective(doc.versions, nowMs);
        if (!current) continue;
        const acceptedVersion = accepted?.[doc.type]?.version ?? 0;
        if (acceptedVersion >= current.version) continue;
        const changes = doc.versions
            .filter((v) => v.version > acceptedVersion && v.version <= current.version)
            .sort((a, b) => b.version - a.version);
        const item: GateItem = {
            type: doc.type,
            version: current.version,
            acceptedVersion: acceptedVersion > 0 ? acceptedVersion : null,
            changes,
        };
        const needsAcceptance = acceptedVersion === 0 || changes.some((v) => v.changeType === 'requiresAcceptance');
        (needsAcceptance ? result.blocking : result.notices).push(item);
    }
    return result;
};

/**
 * Machine access (/mcp, /api tokens): a missing consent only blocks once the grace period of
 * the version that requires it has passed. Returns the earliest blocking item or null.
 */
export const machineAccessBlock = (
    docs: Array<{ type: LegalType; versions: VersionMeta[] }>,
    accepted: AcceptedDocs | null | undefined,
    nowMs: number,
): { type: LegalType; version: number; blockedSinceMs: number } | null => {
    const gate = evaluateGate(docs, accepted, nowMs);
    for (const item of gate.blocking) {
        // Initial consent: the oldest version counts; updates: the newest requiresAcceptance change.
        const trigger = item.acceptedVersion == null
            ? item.changes[item.changes.length - 1]
            : item.changes.find((change) => change.changeType === 'requiresAcceptance');
        if (!trigger) continue;
        const graceDays = trigger.machineGraceDays ?? DEFAULT_MACHINE_GRACE_DAYS;
        const blockedSinceMs = trigger.effectiveAtMs + graceDays * DAY_MS;
        if (nowMs >= blockedSinceMs) return { type: item.type, version: item.version, blockedSinceMs };
    }
    return null;
};

// ---------------------------------------------------------------------------
// Draft validation
// ---------------------------------------------------------------------------

export const MAX_CONTENT_LENGTH = 300_000;
export const MAX_SUMMARY_LENGTH = 2_000;
export const MAX_TITLE_LENGTH = 200;

export type DraftInput = {
    type: LegalType;
    title: Localized;
    content: Localized;
    summary: Localized;
    changeType: LegalChangeType;
    effectiveAtMs: number | null;
    notifyByEmail: boolean;
    machineGraceDays: number;
};

const localized = (value: any, max: number, field: string, allowEmpty = false): Localized => {
    const out = { de: '', en: '' };
    for (const lang of ['de', 'en'] as const) {
        const text = typeof value?.[lang] === 'string' ? value[lang].trim() : '';
        if (!allowEmpty && !text) throw new Error(`${field}.${lang} is required`);
        if (text.length > max) throw new Error(`${field}.${lang} is too long`);
        out[lang] = text;
    }
    return out;
};

/** Validates and normalizes a draft payload. Throws Error(message) on invalid input. */
export const normalizeDraft = (data: any): DraftInput => {
    if (!isLegalType(data?.type)) throw new Error('type is invalid');
    const type = data.type as LegalType;
    const changeType: LegalChangeType = data.changeType === 'requiresAcceptance' ? 'requiresAcceptance' : 'notifyOnly';
    if (data.changeType !== 'requiresAcceptance' && data.changeType !== 'notifyOnly') throw new Error('changeType is invalid');
    let effectiveAtMs: number | null = null;
    if (data.effectiveAt != null && data.effectiveAt !== '') {
        const parsed = Date.parse(String(data.effectiveAt));
        if (!Number.isFinite(parsed)) throw new Error('effectiveAt is invalid');
        effectiveAtMs = parsed;
    }
    const imprint = type === 'imprint';
    const grace = data.machineGraceDays == null || data.machineGraceDays === '' ? DEFAULT_MACHINE_GRACE_DAYS : Number(data.machineGraceDays);
    if (!Number.isInteger(grace) || grace < 0 || grace > 365) throw new Error('machineGraceDays is invalid');
    return {
        machineGraceDays: grace,
        type,
        title: localized(data.title, MAX_TITLE_LENGTH, 'title'),
        content: localized(data.content, MAX_CONTENT_LENGTH, 'content'),
        summary: localized(data.summary, MAX_SUMMARY_LENGTH, 'summary', true),
        // The imprint is informational: always notifyOnly, never mailed.
        changeType: imprint ? 'notifyOnly' : changeType,
        effectiveAtMs,
        notifyByEmail: imprint ? false : changeType === 'requiresAcceptance' ? true : data.notifyByEmail === true,
    };
};

// ---------------------------------------------------------------------------
// Mail
// ---------------------------------------------------------------------------

export const APP_URL = 'https://app.getprojectflow.com';

export const resolveLang = (value: unknown): LegalLang =>
    typeof value === 'string' && value.toLowerCase().startsWith('de') ? 'de' : 'en';

const DOC_NAMES: Record<LegalType, Localized> = {
    privacy: { de: 'Datenschutzerklärung', en: 'Privacy Policy' },
    terms: { de: 'Nutzungsbedingungen', en: 'Terms of Service' },
    imprint: { de: 'Impressum', en: 'Imprint' },
};

export const legalDocName = (type: LegalType, lang: LegalLang) => DOC_NAMES[type][lang];

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatDate = (ms: number, lang: LegalLang) =>
    new Date(ms).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Berlin' });

export type LegalMail = { subject: string; title: string; bodyHtml: string; actionLink: string; actionText: string };

/** Subject + body for the "document changed" mail. Body is HTML-escaped except for our own markup. */
export const buildLegalMail = (
    input: { type: LegalType; version: number; changeType: LegalChangeType; summary: Localized; effectiveAtMs: number },
    lang: LegalLang,
): LegalMail => {
    const name = legalDocName(input.type, lang);
    const docLink = `${APP_URL}/legal/${input.type}?v=${input.version}`;
    const date = formatDate(input.effectiveAtMs, lang);
    const summary = input.summary[lang] || input.summary[lang === 'de' ? 'en' : 'de'];
    const needsAcceptance = input.changeType === 'requiresAcceptance';
    const t = lang === 'de'
        ? {
            subject: `Aktualisierung: ${name}`,
            title: `Wir haben unsere ${name} aktualisiert`,
            intro: `Die neue Fassung (Version ${input.version}) gilt ab ${date}.`,
            summaryLabel: 'Was sich ändert:',
            action: needsAcceptance
                ? 'Beim nächsten Öffnen von ProjectFlow bitten wir Sie, der neuen Fassung zuzustimmen.'
                : 'Sie müssen nichts weiter tun.',
            readFull: 'Vollständige Fassung lesen',
            open: 'ProjectFlow öffnen',
        }
        : {
            subject: `Update: ${name}`,
            title: `We have updated our ${name}`,
            intro: `The new version (version ${input.version}) applies from ${date}.`,
            summaryLabel: 'What changes:',
            action: needsAcceptance
                ? 'The next time you open ProjectFlow, we will ask you to accept the new version.'
                : 'No action is required.',
            readFull: 'Read the full version',
            open: 'Open ProjectFlow',
        };
    const summaryHtml = summary
        ? `<br><br><strong>${t.summaryLabel}</strong><br>${escapeHtml(summary).replace(/\n/g, '<br>')}`
        : '';
    const bodyHtml = `${escapeHtml(t.intro)}${summaryHtml}<br><br>${escapeHtml(t.action)}<br><br><a href="${docLink}">${t.readFull}</a>`;
    return { subject: t.subject, title: t.title, bodyHtml, actionLink: APP_URL, actionText: t.open };
};

/** Users that should receive the mail: has an address and has not already accepted this version. */
export const shouldMailUser = (user: { email?: unknown; disabled?: unknown; deleted?: unknown }, acceptedVersion: number, version: number) =>
    typeof user.email === 'string' && user.email.includes('@') && user.disabled !== true && user.deleted !== true && acceptedVersion < version;
