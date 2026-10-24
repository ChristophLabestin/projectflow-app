// Platform newsletter + waitlist: pure logic (no Firebase imports), unit tested in scripts/unit/platform-newsletter.test.js.
// Concept: brain/plans/newsletter-concept.md · contract: brain/plans/newsletter-contract.md
import { createHash, randomBytes } from 'crypto';
import { normalizeEmail, suppressionId } from '../email-logic';
import { EMAIL_IMPRINT } from '../email-template';

export const LISTS = ['waitlist', 'newsletter'] as const;
export type ListId = typeof LISTS[number];
export const LIST_STATUSES = ['pending', 'confirmed', 'unsubscribed', 'bounced'] as const;
export type ListStatus = typeof LIST_STATUSES[number];
export const SOURCES = ['landing', 'app', 'onboarding', 'admin', 'legacy'] as const;
export type Source = typeof SOURCES[number];
export type Lang = 'de' | 'en';

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

export const OPTIN_TTL_MS = 48 * 3_600_000;
export const PENDING_RETENTION_MS = 30 * 86_400_000;
export const MIN_FORM_MS = 2_000;
export const SITE_URL = 'https://getprojectflow.com';

export const isList = (value: unknown): value is ListId => LISTS.includes(value as ListId);
export const toLang = (value: unknown): Lang => (/^de\b/i.test(String(value || '')) ? 'de' : 'en');
export const isSource = (value: unknown): value is Source => SOURCES.includes(value as Source);

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/** Normalized address or null (max 254 chars, simple shape check). */
export const parseEmail = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const email = normalizeEmail(value);
    return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
};

/** Single-line text without control characters. */
export const cleanText = (value: unknown, max: number): string =>
    // eslint-disable-next-line no-control-regex
    typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Same id as the suppression list: sha256(normalized email), 40 hex chars. */
export const subscriberId = (email: string): string => suppressionId(email);

export const newToken = (): string => randomBytes(24).toString('base64url');
export const tokenId = (token: string): string => createHash('sha256').update(String(token)).digest('hex').slice(0, 40);
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Bot heuristics for the public forms: filled honeypot or submitted faster than a human can type. */
export const looksLikeBot = (body: Record<string, unknown>, nowMs = Date.now()): boolean => {
    if (typeof body.website === 'string' && body.website.trim()) return true;
    const startedAt = Number(body.startedAt);
    return Number.isFinite(startedAt) && startedAt > 0 && nowMs - startedAt < MIN_FORM_MS;
};

export const maskEmail = (email: string): string => {
    const [user, domain] = email.split('@');
    if (!domain) return '';
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
};

// ---------------------------------------------------------------------------
// Consent texts (versioned; the version + hash land in every consent_log entry).
// Keep in sync with landing/src/content/optin.ts and web/locales (newsletter toggle).
// ---------------------------------------------------------------------------

export const CONSENT_VERSION = '2026-10-24';
export const CONSENT_TEXTS: Record<ListId, Record<Lang, string>> = {
    waitlist: {
        de: 'Ich möchte auf die Warteliste von ProjectFlow und per E-Mail erfahren, sobald ich einen Zugang bekomme. Die Einwilligung kann ich jederzeit widerrufen, z. B. über den Abmeldelink in jeder E-Mail.',
        en: 'I want to join the ProjectFlow waitlist and be notified by email when I get access. I can withdraw my consent at any time, e.g. via the unsubscribe link in every email.',
    },
    newsletter: {
        de: 'Ich möchte den ProjectFlow-Newsletter mit Produktneuigkeiten und Tipps per E-Mail erhalten (etwa ein- bis zweimal im Monat). Die Einwilligung kann ich jederzeit widerrufen, z. B. über den Abmeldelink in jeder E-Mail.',
        en: 'I want to receive the ProjectFlow newsletter with product news and tips by email (about once or twice a month). I can withdraw my consent at any time, e.g. via the unsubscribe link in every email.',
    },
};
export const consentRecord = (list: ListId, lang: Lang) => ({
    consentVersion: `${list}-${CONSENT_VERSION}-${lang}`,
    consentHash: sha256(CONSENT_TEXTS[list][lang]).slice(0, 16),
});

/** Double-opt-in mail copy per list (du-form like the landing page). */
export const OPTIN_MAIL: Record<ListId, Record<Lang, { subject: string; title: string; body: string; button: string }>> = {
    waitlist: {
        de: {
            subject: 'Bitte bestätige deinen Platz auf der Warteliste',
            title: 'Fast geschafft',
            body: 'Danke für dein Interesse an ProjectFlow. Bitte bestätige deine E-Mail-Adresse, damit wir dich auf die Warteliste setzen können. Der Link ist 48 Stunden gültig. Wenn du dich nicht angemeldet hast, ignoriere diese E-Mail einfach.',
            button: 'Adresse bestätigen',
        },
        en: {
            subject: 'Please confirm your spot on the waitlist',
            title: 'Almost there',
            body: 'Thanks for your interest in ProjectFlow. Please confirm your email address so we can add you to the waitlist. The link is valid for 48 hours. If you did not sign up, simply ignore this email.',
            button: 'Confirm address',
        },
    },
    newsletter: {
        de: {
            subject: 'Bitte bestätige dein Newsletter-Abo',
            title: 'Newsletter bestätigen',
            body: 'Du hast dich für den ProjectFlow-Newsletter angemeldet. Bitte bestätige deine E-Mail-Adresse, erst dann schicken wir dir Neuigkeiten. Der Link ist 48 Stunden gültig. Wenn du dich nicht angemeldet hast, ignoriere diese E-Mail einfach.',
            button: 'Abo bestätigen',
        },
        en: {
            subject: 'Please confirm your newsletter subscription',
            title: 'Confirm the newsletter',
            body: 'You signed up for the ProjectFlow newsletter. Please confirm your email address; only then will we send you news. The link is valid for 48 hours. If you did not sign up, simply ignore this email.',
            button: 'Confirm subscription',
        },
    },
};

export const confirmUrl = (token: string, lang: Lang, base = SITE_URL): string =>
    `${base}${lang === 'de' ? '/bestaetigen' : '/en/confirm'}?t=${encodeURIComponent(token)}`;

// ---------------------------------------------------------------------------
// Subscriber state
// ---------------------------------------------------------------------------

export type ListMembership = {
    status: ListStatus;
    source?: Source;
    requestedAt?: unknown;
    confirmedAt?: unknown;
    unsubscribedAt?: unknown;
    bouncedAt?: unknown;
    consentVersion?: string;
};
export type SubscriberDoc = {
    email: string;
    name?: string;
    lang?: Lang;
    source?: Source;
    interest?: string;
    uid?: string | null;
    lists?: Partial<Record<ListId, ListMembership>>;
    status?: ListStatus;
};

/** Aggregate status for list views: confirmed > pending > bounced > unsubscribed. */
export const aggregateStatus = (lists: SubscriberDoc['lists'] = {}): ListStatus => {
    const states = Object.values(lists).map((m) => m?.status).filter(Boolean) as ListStatus[];
    for (const s of ['confirmed', 'pending', 'bounced', 'unsubscribed'] as ListStatus[]) if (states.includes(s)) return s;
    return 'pending';
};

// ---------------------------------------------------------------------------
// Campaign audience + input
// ---------------------------------------------------------------------------

export type Audience = { list: ListId; lang?: Lang | null; appUsersOnly?: boolean; source?: Source | null };

export const normalizeAudience = (raw: any): Audience => {
    const list = isList(raw?.list) ? raw.list : 'newsletter';
    return {
        list,
        lang: raw?.lang === 'de' || raw?.lang === 'en' ? raw.lang : null,
        appUsersOnly: raw?.appUsersOnly === true,
        source: isSource(raw?.source) ? raw.source : null,
    };
};

/** True if a subscriber (already confirmed on audience.list) matches the optional filters. */
export const matchesAudience = (sub: SubscriberDoc, audience: Audience): boolean => {
    if (sub.lists?.[audience.list]?.status !== 'confirmed') return false;
    if (audience.lang && (sub.lang || 'en') !== audience.lang) return false;
    if (audience.appUsersOnly && !sub.uid) return false;
    if (audience.source && (sub.lists?.[audience.list]?.source || sub.source) !== audience.source) return false;
    return true;
};

export type Variant = { subject: string; preheader: string; markdown: string };
export type CampaignInput = { title: string; defaultLang: Lang; variants: Partial<Record<Lang, Variant>>; audience: Audience };

export class CampaignInputError extends Error {}

export const normalizeCampaignInput = (raw: any): CampaignInput => {
    const variants: Partial<Record<Lang, Variant>> = {};
    for (const lang of ['de', 'en'] as Lang[]) {
        const v = raw?.variants?.[lang];
        if (!v) continue;
        const variant = { subject: cleanText(v.subject, 200), preheader: cleanText(v.preheader, 200), markdown: typeof v.markdown === 'string' ? v.markdown.slice(0, 50_000) : '' };
        if (variant.subject || variant.markdown) variants[lang] = variant;
    }
    const defaultLang: Lang = raw?.defaultLang === 'de' ? 'de' : raw?.defaultLang === 'en' ? 'en' : (variants.de ? 'de' : 'en');
    if (!variants[defaultLang]) throw new CampaignInputError(`variant ${defaultLang} (defaultLang) is required`);
    const title = cleanText(raw?.title, 200) || variants[defaultLang]!.subject || 'Kampagne';
    return { title, defaultLang, variants, audience: normalizeAudience(raw?.audience) };
};

/** Errors that block scheduling (drafts may be incomplete). */
export const campaignReadyErrors = (c: CampaignInput): string[] => {
    const errors: string[] = [];
    for (const [lang, v] of Object.entries(c.variants) as [Lang, Variant][]) {
        if (!v.subject) errors.push(`${lang}: subject missing`);
        if (!v.markdown.trim()) errors.push(`${lang}: content missing`);
    }
    return errors;
};

export const variantFor = (c: Pick<CampaignInput, 'variants' | 'defaultLang'>, lang: Lang | undefined): { lang: Lang; variant: Variant } => {
    const pick = lang && c.variants[lang] ? lang : c.defaultLang;
    return { lang: pick, variant: c.variants[pick]! };
};

// ---------------------------------------------------------------------------
// Markdown → HTML (small, safe subset; everything is escaped first)
// ---------------------------------------------------------------------------

export const escapeHtml = (value: string): string =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const LINK_STYLE = 'color:#000000;text-decoration:underline;';
const URL_RE = '((?:https?:\\/\\/|mailto:)[^\\s)]+)';

const inline = (escaped: string): string => escaped
    .replace(new RegExp(`\\[([^\\]]+)\\]\\(${URL_RE}\\)`, 'g'), (_m, text, href) => `<a href="${href}" style="${LINK_STYLE}">${text}</a>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>');

const BLOCK = {
    p: 'font-size:16px;line-height:1.6;margin:0 0 16px;',
    h1: 'font-size:24px;line-height:1.3;margin:24px 0 12px;',
    h2: 'font-size:20px;line-height:1.3;margin:24px 0 12px;',
    h3: 'font-size:17px;line-height:1.3;margin:20px 0 8px;',
    list: 'font-size:16px;line-height:1.6;margin:0 0 16px;padding-left:24px;',
    hr: 'border:0;border-top:1px solid #e5e7eb;margin:24px 0;',
    button: 'display:inline-block;background:#000000;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;',
};

export const renderMarkdown = (markdown: string): string => {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const out: string[] = [];
    let para: string[] = [];
    let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
    const flushPara = () => { if (para.length) out.push(`<p style="${BLOCK.p}">${para.map(inline).join('<br>')}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<${list.tag} style="${BLOCK.list}">${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };
    for (const raw of lines) {
        const line = escapeHtml(raw.trimEnd());
        const trimmed = line.trim();
        let m: RegExpMatchArray | null;
        if (!trimmed) { flushPara(); flushList(); continue; }
        if ((m = trimmed.match(/^(#{1,3})\s+(.+)$/))) {
            flushPara(); flushList();
            const tag = `h${m[1].length}` as 'h1' | 'h2' | 'h3';
            out.push(`<${tag} style="${BLOCK[tag]}">${inline(m[2])}</${tag}>`);
        } else if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
            flushPara(); flushList();
            out.push(`<hr style="${BLOCK.hr}">`);
        } else if ((m = trimmed.match(new RegExp(`^\\[\\[([^\\]]+)\\]\\]\\(${URL_RE}\\)$`)))) {
            flushPara(); flushList();
            out.push(`<p style="margin:8px 0 24px;"><a href="${m[2]}" style="${BLOCK.button}">${m[1]}</a></p>`);
        } else if ((m = trimmed.match(/^[-*]\s+(.+)$/)) || (m = trimmed.match(/^\d+\.\s+(.+)$/))) {
            flushPara();
            const tag = /^\d/.test(trimmed) ? 'ol' : 'ul';
            if (list && list.tag !== tag) flushList();
            if (!list) list = { tag, items: [] };
            list.items.push(m[1]);
        } else {
            flushList();
            para.push(trimmed);
        }
    }
    flushPara(); flushList();
    return out.join('\n');
};

/** Replaces {{name}} / {{name|Fallback}} with the escaped recipient name. */
export const applyPlaceholders = (text: string, vars: { name?: string }, escape = true): string =>
    text.replace(/\{\{\s*name\s*(?:\|([^}]*))?\}\}/g, (_m, fallback) => (escape ? escapeHtml(vars.name || '') : (vars.name || '')) || (fallback ?? '').trim());

const FOOTER: Record<Lang, { reason: Record<ListId, string>; unsubscribe: string; web: string }> = {
    de: {
        reason: {
            newsletter: 'Du bekommst diese E-Mail, weil du den ProjectFlow-Newsletter abonniert und deine Adresse bestätigt hast.',
            waitlist: 'Du bekommst diese E-Mail, weil du dich auf der ProjectFlow-Warteliste eingetragen und deine Adresse bestätigt hast.',
        },
        unsubscribe: 'Abmelden',
        web: 'getprojectflow.com',
    },
    en: {
        reason: {
            newsletter: 'You receive this email because you subscribed to the ProjectFlow newsletter and confirmed your address.',
            waitlist: 'You receive this email because you joined the ProjectFlow waitlist and confirmed your address.',
        },
        unsubscribe: 'Unsubscribe',
        web: 'getprojectflow.com',
    },
};

/** Campaign mail layout: preheader, rendered body, footer with reason, unsubscribe link and imprint. */
export const newsletterEmailHtml = (o: { subject: string; preheader: string; bodyHtml: string; lang: Lang; list: ListId; unsubscribeUrl: string }): string => {
    const f = FOOTER[o.lang];
    return `<!DOCTYPE html>
<html lang="${o.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>${escapeHtml(o.subject)}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#000000;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</div>
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="padding:32px 40px 8px;font-size:16px;font-weight:600;">ProjectFlow</div>
    <div style="padding:8px 40px 24px;">
${o.bodyHtml}
    </div>
    <div style="border-top:1px solid #f3f4f6;padding:24px 40px;font-size:12px;line-height:1.5;color:#6b7280;background:#fafafa;">
      <p style="margin:0 0 8px;">${escapeHtml(f.reason[o.list])}<br><a href="${escapeHtml(o.unsubscribeUrl)}" style="color:#6b7280;">${f.unsubscribe}</a> · <a href="${SITE_URL}${o.lang === 'de' ? '' : '/en'}" style="color:#6b7280;">${f.web}</a></p>
      <p style="margin:0;">&copy; ${new Date().getFullYear()} ${escapeHtml(EMAIL_IMPRINT)}</p>
    </div>
  </div>
</body>
</html>`;
};

/** UTC day key for the daily send cap. */
export const dayKey = (ms = Date.now()): string => new Date(ms).toISOString().slice(0, 10);

/** How many mails a dispatcher run may still send today. */
export const remainingDailyQuota = (state: { day?: string; count?: number } | undefined, cap: number, nowMs = Date.now()): number =>
    Math.max(0, cap - (state?.day === dayKey(nowMs) ? Number(state?.count || 0) : 0));
