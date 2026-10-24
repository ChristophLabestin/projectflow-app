// Forms — pure server helpers (no Firestore, no Admin SDK): session tokens, IP hashing, spam heuristic
// and the defensive sanitizers for drafts, themes, settings. The shared rules live in forms-logic.ts
// (byte-identical to web/utils/formsLogic.ts); this file only adds what the web client does not need.
// Contract: brain/plans/forms-api-contract.md.
import * as crypto from 'crypto';

import {
    FORM_FIELD_TYPES,
    FORM_LIMITS,
    FORM_RETENTION_MONTHS,
    FormAnswer,
    FormCondition,
    FormField,
    FormFieldType,
    FormQuota,
    FormSchema,
    FormSection,
    isChoiceField
} from './forms-logic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FORM_FONTS = [
    'plus-jakarta-sans', 'inter', 'manrope', 'dm-sans', 'source-serif-4',
    'fraunces', 'space-grotesk', 'ibm-plex-sans', 'nunito', 'playfair-display'
] as const;
export const FORM_THEME_PRESETS = [
    'projectflow-light', 'projectflow-dark', 'paper', 'midnight', 'forest', 'sunset', 'ocean', 'mono'
] as const;
export const FORM_ASSET_KINDS = ['logo', 'cover', 'background'] as const;
export const FORM_ASSET_TYPES: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
};
export const FORM_ASSET_MAX_BYTES = 5 * 1024 * 1024;

export const SESSION_MIN_AGE_MS = 3000;
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_SUBMIT_BYTES = 256 * 1024;
export const SPAM_LINK_LIMIT = 3;
export const SPAM_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export const DEFAULT_THEME = {
    preset: 'projectflow-light',
    background: { type: 'color', color: '#f4f4f5' },
    surface: '#ffffff',
    text: '#18181b',
    accent: '#4f46e5',
    accentText: '#ffffff',
    font: 'plus-jakarta-sans',
    radius: 16,
    fieldStyle: 'sunken',
    density: 'comfortable'
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const isObj = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const isNum = (value: unknown): value is number => typeof value === 'number' && isFinite(value);

export const cleanText = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '');

/** Removes `undefined` recursively (Firestore rejects it); keeps null, Dates and Timestamps. */
export const compact = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map((entry) => compact(entry)).filter((entry) => entry !== undefined) as unknown as T;
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const out: Record<string, unknown> = {};
        Object.keys(value as Record<string, unknown>).forEach((key) => {
            const entry = (value as Record<string, unknown>)[key];
            if (entry !== undefined) out[key] = compact(entry);
        });
        return out as T;
    }
    return value;
};

export const randomId = (bytes = 6) => crypto.randomBytes(bytes).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');

export const sanitizeId = (value: unknown): string => (typeof value === 'string' ? value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) : '');

export const httpsUrl = (value: unknown, max = 500): string => {
    const text = cleanText(value, max);
    if (!/^https:\/\/[^\s]+$/i.test(text)) return '';
    try {
        return new URL(text).protocol === 'https:' ? text : '';
    } catch {
        return '';
    }
};

export const hexColor = (value: unknown, fallback: string): string =>
    typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toLowerCase() : fallback;

// ---------------------------------------------------------------------------
// Session tokens: base64url(json{tok,iat,n}).hmac
// ---------------------------------------------------------------------------

const b64 = (buffer: Buffer | string) => Buffer.from(buffer).toString('base64url');
const hmac = (secret: string, data: string) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export const signFormSession = (secret: string, token: string, now: number, nonce: string = crypto.randomBytes(8).toString('hex')): string => {
    const payload = b64(JSON.stringify({ tok: token, iat: now, n: nonce }));
    return `${payload}.${hmac(secret, payload)}`;
};

export type FormSessionCheck =
    | { ok: true; iat: number; nonce: string }
    | { ok: false; reason: 'malformed' | 'signature' | 'token' | 'expired' | 'too-fast' };

export const verifyFormSession = (
    secret: string,
    session: unknown,
    token: string,
    now: number,
    options: { minAgeMs?: number; maxAgeMs?: number } = {}
): FormSessionCheck => {
    if (typeof session !== 'string' || session.length > 600) return { ok: false, reason: 'malformed' };
    const parts = session.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
    const expected = Buffer.from(hmac(secret, parts[0]));
    const given = Buffer.from(parts[1]);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { ok: false, reason: 'signature' };
    let payload: any;
    try {
        payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
        return { ok: false, reason: 'malformed' };
    }
    if (!isObj(payload) || typeof payload.tok !== 'string' || !isNum(payload.iat) || typeof payload.n !== 'string') return { ok: false, reason: 'malformed' };
    if (payload.tok !== token) return { ok: false, reason: 'token' };
    const age = now - payload.iat;
    if (age > (options.maxAgeMs === undefined ? SESSION_MAX_AGE_MS : options.maxAgeMs) || age < -60000) return { ok: false, reason: 'expired' };
    if (age < (options.minAgeMs === undefined ? 0 : options.minAgeMs)) return { ok: false, reason: 'too-fast' };
    return { ok: true, iat: payload.iat, nonce: payload.n };
};

/** Daily rotating salt derived from the server secret; the IP hash only ever lives in rate-limit keys. */
export const dailySalt = (secret: string, now: number) => hmac(secret, `ip-salt:${new Date(now).toISOString().slice(0, 10)}`);
export const hashIp = (salt: string, ip: string) => crypto.createHmac('sha256', salt).update(ip).digest('hex');
export const respondentKey = (secret: string, formId: string, uid: string) => crypto.createHmac('sha256', secret).update(`respondent|${formId}|${uid}`).digest('hex');

// ---------------------------------------------------------------------------
// Spam heuristic
// ---------------------------------------------------------------------------

export const countLinks = (text: string): number => (text.match(/(https?:\/\/|www\.)\S+/gi) || []).length;

/** Links in free text answers (short and long text fields) over all answers. */
export const freeTextLinkCount = (schema: FormSchema, answers: Record<string, FormAnswer>): number => {
    let total = 0;
    schema.fields.forEach((field) => {
        const value = answers[field.id];
        if (typeof value === 'string' && (field.type === 'shortText' || field.type === 'longText')) total += countLinks(value);
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as any).other === 'string') total += countLinks((value as any).other);
    });
    return total;
};

export const hasTooManyLinks = (schema: FormSchema, answers: Record<string, FormAnswer>) => freeTextLinkCount(schema, answers) > SPAM_LINK_LIMIT;

const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (isObj(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
};

/** Hash of the answer content (file ids excluded): identical re-submissions within minutes are spam. */
export const contentHash = (answers: Record<string, FormAnswer>): string => {
    const reduced: Record<string, unknown> = {};
    Object.keys(answers).forEach((key) => {
        const value = answers[key];
        reduced[key] = Array.isArray(value) ? value.map((file) => ({ n: (file as any).name, s: (file as any).size })) : value;
    });
    return crypto.createHash('sha256').update(stable(reduced)).digest('hex').slice(0, 40);
};

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

const scalar = (value: unknown): string | number | boolean | null => {
    if (typeof value === 'string') return value.slice(0, FORM_LIMITS.shortTextMax);
    if (isNum(value)) return value;
    if (typeof value === 'boolean') return value;
    return null;
};

export const sanitizeCondition = (raw: unknown): FormCondition | null => {
    if (!isObj(raw)) return null;
    const rules = (Array.isArray(raw.rules) ? raw.rules : [])
        .filter(isObj)
        .slice(0, FORM_LIMITS.maxRules + 1)
        .map((rule) => ({
            fieldId: sanitizeId(rule.fieldId),
            op: (typeof rule.op === 'string' ? rule.op.slice(0, 20) : '') as FormCondition['rules'][number]['op'],
            ...(rule.value !== undefined ? { value: scalar(rule.value) } : {})
        }));
    if (!rules.length) return null;
    return { mode: raw.mode === 'any' ? 'any' : 'all', rules };
};

const sanitizeOptions = (raw: unknown) =>
    (Array.isArray(raw) ? raw : [])
        .filter(isObj)
        .slice(0, FORM_LIMITS.maxOptions + 1)
        .map((option) => ({ id: sanitizeId(option.id) || randomId(), label: cleanText(option.label, FORM_LIMITS.optionMax) }));

const numberOr = (value: unknown): number | undefined => (isNum(value) ? value : undefined);
const dateOnly = (value: unknown): string | undefined => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

export const sanitizeField = (raw: unknown): FormField | null => {
    if (!isObj(raw)) return null;
    const type = raw.type as FormFieldType;
    if (FORM_FIELD_TYPES.indexOf(type) < 0) return null;
    const field: FormField = {
        id: sanitizeId(raw.id) || randomId(),
        sectionId: sanitizeId(raw.sectionId),
        type,
        label: cleanText(raw.label, FORM_LIMITS.labelMax)
    };
    const help = cleanText(raw.help, FORM_LIMITS.helpMax);
    if (help) field.help = help;
    if (raw.required === true && type !== 'statement') field.required = true;
    const placeholder = cleanText(raw.placeholder, FORM_LIMITS.labelMax);
    if (placeholder) field.placeholder = placeholder;
    const showIf = sanitizeCondition(raw.showIf);
    if (showIf) field.showIf = showIf;

    if (isChoiceField(field)) {
        field.options = sanitizeOptions(raw.options);
        if (type !== 'dropdown' && raw.allowOther === true) field.allowOther = true;
        if (raw.shuffle === true) field.shuffle = true;
        if (type === 'multipleChoice') {
            if (isNum(raw.minSelect)) field.minSelect = Math.floor(raw.minSelect);
            if (isNum(raw.maxSelect)) field.maxSelect = Math.floor(raw.maxSelect);
        }
    }
    if (type === 'shortText' || type === 'longText') {
        if (isNum(raw.maxLength) && raw.maxLength > 0) field.maxLength = Math.min(Math.floor(raw.maxLength), type === 'shortText' ? FORM_LIMITS.shortTextMax : FORM_LIMITS.longTextMax);
    }
    if (type === 'number') {
        const min = numberOr(raw.min);
        const max = numberOr(raw.max);
        if (min !== undefined) field.min = min;
        if (max !== undefined) field.max = max;
        if (isNum(raw.decimals)) field.decimals = Math.max(0, Math.min(6, Math.floor(raw.decimals)));
        const unit = cleanText(raw.unit, 20);
        if (unit) field.unit = unit;
    }
    if (type === 'date') {
        const min = dateOnly(raw.min);
        const max = dateOnly(raw.max);
        if (min) field.min = min;
        if (max) field.max = max;
        if (raw.withTime === true) field.withTime = true;
    }
    if (type === 'rating' && isNum(raw.ratingMax)) field.ratingMax = raw.ratingMax;
    if (type === 'scale') {
        if (isNum(raw.scaleMin)) field.scaleMin = raw.scaleMin;
        if (isNum(raw.scaleMax)) field.scaleMax = raw.scaleMax;
        const minLabel = cleanText(raw.minLabel, 60);
        const maxLabel = cleanText(raw.maxLabel, 60);
        if (minLabel) field.minLabel = minLabel;
        if (maxLabel) field.maxLabel = maxLabel;
    }
    if (type === 'fileUpload') {
        if (isNum(raw.maxFiles)) field.maxFiles = raw.maxFiles;
        if (isNum(raw.maxFileBytes) && raw.maxFileBytes > 0) field.maxFileBytes = Math.floor(raw.maxFileBytes);
        if (Array.isArray(raw.fileKinds)) field.fileKinds = raw.fileKinds.filter((kind: unknown) => typeof kind === 'string').slice(0, 8) as FormField['fileKinds'];
    }
    if (type === 'consent') {
        const url = httpsUrl(raw.consentUrl);
        if (url) field.consentUrl = url;
    }
    if (type === 'email' && raw.isRespondentEmail === true) field.isRespondentEmail = true;
    return field;
};

export const sanitizeSection = (raw: unknown): FormSection | null => {
    if (!isObj(raw)) return null;
    const section: FormSection = { id: sanitizeId(raw.id) || randomId() };
    const title = cleanText(raw.title, FORM_LIMITS.titleMax);
    const description = cleanText(raw.description, FORM_LIMITS.helpMax);
    if (title) section.title = title;
    if (description) section.description = description;
    const showIf = sanitizeCondition(raw.showIf);
    if (showIf) section.showIf = showIf;
    return section;
};

/**
 * Normalizes a builder draft: known keys only, trimmed and capped strings. Counts are cut one above the
 * limit, so validateFormSchema still reports `tooManyFields` etc. instead of silently losing content.
 * Fields of unknown types are dropped. Only one field may be the respondent email.
 */
export const sanitizeSchema = (raw: unknown): FormSchema => {
    const source = isObj(raw) ? raw : {};
    const sections = (Array.isArray(source.sections) ? source.sections : [])
        .slice(0, FORM_LIMITS.maxSections + 1)
        .map(sanitizeSection)
        .filter((section): section is FormSection => !!section);
    const fields = (Array.isArray(source.fields) ? source.fields : [])
        .slice(0, FORM_LIMITS.maxFields + 1)
        .map(sanitizeField)
        .filter((field): field is FormField => !!field);
    let respondentEmail = false;
    fields.forEach((field) => {
        if (field.isRespondentEmail) {
            if (respondentEmail) delete field.isRespondentEmail;
            respondentEmail = true;
        }
    });
    return { sections, fields };
};

export const defaultSchema = (language: 'de' | 'en'): FormSchema => {
    const sectionId = randomId();
    return {
        sections: [{ id: sectionId }],
        fields: [{ id: randomId(), sectionId, type: 'shortText', label: language === 'de' ? 'Ihre Frage' : 'Your question' }]
    };
};

export const defaultTheme = () => JSON.parse(JSON.stringify(DEFAULT_THEME));

const oneOf = <T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.indexOf(value as T) >= 0 ? (value as T) : fallback;

export const assetPrefix = (tenantId: string, formId: string) => `public/forms/${tenantId}/${formId}/assets/`;

const assetPath = (value: unknown, tenantId: string, formId: string): string => {
    const text = typeof value === 'string' ? value.trim() : '';
    const prefix = assetPrefix(tenantId, formId);
    return text.startsWith(prefix) && text.length <= 300 && /^[A-Za-z0-9._\-/]+$/.test(text) && text.indexOf('..') < 0 ? text : '';
};

/**
 * Theme from the client. Without the plan's full-theme feature only the preset survives; otherwise every
 * key is validated (colors as #rrggbb, font whitelist, asset paths inside the form's own asset folder).
 * `themeId` references a saved workspace theme and is kept as the only key.
 */
export const sanitizeTheme = (
    raw: unknown,
    quota: Pick<FormQuota, 'fullTheme'>,
    scope: { tenantId: string; formId: string },
    current?: Record<string, any> | null
): Record<string, any> => {
    const input = isObj(raw) ? raw : {};
    const preset = oneOf(input.preset, FORM_THEME_PRESETS, oneOf(current && current.preset, FORM_THEME_PRESETS, 'projectflow-light'));
    if (!quota.fullTheme) return { preset };
    const themeId = sanitizeId(input.themeId);
    if (themeId) return { themeId };
    const base = DEFAULT_THEME;
    const bgIn = isObj(input.background) ? input.background : {};
    const type = oneOf(bgIn.type, ['color', 'gradient', 'image'] as const, 'color');
    const background: Record<string, any> = { type };
    if (type === 'color') background.color = hexColor(bgIn.color, base.background.color);
    if (type === 'gradient') {
        const gradient = isObj(bgIn.gradient) ? bgIn.gradient : {};
        background.gradient = {
            from: hexColor(gradient.from, '#f4f4f5'),
            to: hexColor(gradient.to, '#e4e4e7'),
            angle: isNum(gradient.angle) ? Math.max(0, Math.min(360, Math.round(gradient.angle))) : 135
        };
    }
    if (type === 'image') {
        const imagePath = assetPath(bgIn.imagePath, scope.tenantId, scope.formId);
        if (imagePath) background.imagePath = imagePath;
        else background.type = 'color', background.color = hexColor(bgIn.color, base.background.color);
    }
    const theme: Record<string, any> = {
        preset,
        background,
        surface: hexColor(input.surface, base.surface),
        text: hexColor(input.text, base.text),
        accent: hexColor(input.accent, base.accent),
        accentText: hexColor(input.accentText, base.accentText),
        font: oneOf(input.font, FORM_FONTS, 'plus-jakarta-sans'),
        radius: oneOf(input.radius, [0, 8, 16, 24] as const, 16),
        fieldStyle: oneOf(input.fieldStyle, ['sunken', 'filled', 'underline'] as const, 'sunken'),
        density: oneOf(input.density, ['comfortable', 'compact'] as const, 'comfortable')
    };
    const logoPath = assetPath(input.logoPath, scope.tenantId, scope.formId);
    const coverPath = assetPath(input.coverPath, scope.tenantId, scope.formId);
    if (logoPath) theme.logoPath = logoPath;
    if (coverPath) theme.coverPath = coverPath;
    return theme;
};

/** Origins like `https://example.com` or `http://localhost:3000`; paths and wildcards are dropped. */
export const sanitizeOrigins = (raw: unknown): string[] => {
    const out: string[] = [];
    (Array.isArray(raw) ? raw : []).slice(0, 40).forEach((entry) => {
        if (typeof entry !== 'string' || entry.length > 200) return;
        try {
            const url = new URL(entry.trim());
            if ((url.protocol !== 'https:' && url.protocol !== 'http:') || out.length >= 20) return;
            if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return;
            if (out.indexOf(url.origin) < 0) out.push(url.origin);
        } catch {
            // ignore malformed origin
        }
    });
    return out;
};

const stringList = (raw: unknown, maxItems: number, maxLength: number) =>
    (Array.isArray(raw) ? raw : []).filter((entry): entry is string => typeof entry === 'string' && !!entry.trim()).slice(0, maxItems).map((entry) => entry.trim().slice(0, maxLength));

export const defaultSettings = (ownerId: string) => ({
    retentionMonths: 12,
    confirmation: {},
    notifyMemberIds: [ownerId],
    respondentCopy: { enabled: false },
    aiTriage: { enabled: false, categories: [] as string[] }
});

/**
 * Merges a settings patch into the current settings. Unknown keys are ignored. `hideBranding` needs the
 * plan's removeBranding feature (silently false otherwise).
 */
export const sanitizeSettings = (
    raw: unknown,
    current: Record<string, any> | null | undefined,
    quota: Pick<FormQuota, 'removeBranding'>
): Record<string, any> => {
    const input = isObj(raw) ? raw : {};
    const base = isObj(current) ? current : {};
    const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
    const out: Record<string, any> = {};

    const closesAt = has('closesAt') ? input.closesAt : base.closesAt;
    out.closesAt = isNum(closesAt) && closesAt > 0 ? Math.floor(closesAt) : null;
    const maxResponses = has('maxResponses') ? input.maxResponses : base.maxResponses;
    out.maxResponses = isNum(maxResponses) && maxResponses >= 1 ? Math.min(Math.floor(maxResponses), 1000000) : null;
    out.onePerMember = (has('onePerMember') ? input.onePerMember : base.onePerMember) === true;
    out.allowGuests = (has('allowGuests') ? input.allowGuests : base.allowGuests) === true;

    const conf = has('confirmation') && isObj(input.confirmation) ? input.confirmation : isObj(base.confirmation) ? base.confirmation : {};
    const confirmation: Record<string, string> = {};
    const text = cleanText(conf.text, 1000);
    const redirectUrl = httpsUrl(conf.redirectUrl);
    if (text) confirmation.text = text;
    if (redirectUrl) confirmation.redirectUrl = redirectUrl;
    out.confirmation = confirmation;

    const retention = has('retentionMonths') ? input.retentionMonths : base.retentionMonths === undefined ? 12 : base.retentionMonths;
    out.retentionMonths = retention === null ? null : FORM_RETENTION_MONTHS.indexOf(retention as any) >= 0 ? retention : 12;

    const consentRaw = has('consent') ? input.consent : base.consent;
    const consentText = isObj(consentRaw) ? cleanText(consentRaw.text, 500) : '';
    if (consentText) {
        const consentUrl = httpsUrl((consentRaw as any).url);
        out.consent = consentUrl ? { text: consentText, url: consentUrl } : { text: consentText };
    } else {
        out.consent = null;
    }

    out.notifyMemberIds = stringList(has('notifyMemberIds') ? input.notifyMemberIds : base.notifyMemberIds, 50, 128);

    const copy = has('respondentCopy') && isObj(input.respondentCopy) ? input.respondentCopy : isObj(base.respondentCopy) ? base.respondentCopy : {};
    const emailFieldId = sanitizeId(copy.emailFieldId);
    out.respondentCopy = emailFieldId ? { enabled: copy.enabled === true, emailFieldId } : { enabled: copy.enabled === true };

    const triage = has('aiTriage') && isObj(input.aiTriage) ? input.aiTriage : isObj(base.aiTriage) ? base.aiTriage : {};
    out.aiTriage = { enabled: triage.enabled === true, categories: stringList(triage.categories, 20, 60) };

    out.hideBranding = quota.removeBranding && (has('hideBranding') ? input.hideBranding : base.hideBranding) === true;
    return out;
};

export const sanitizeActions = (raw: unknown): Record<string, any> => {
    const input = isObj(raw) ? raw : {};
    const task = isObj(input.createTask) ? input.createTask : null;
    if (!task) return {};
    const projectId = sanitizeId(task.projectId);
    if (!projectId) return {};
    const mapping = isObj(task.mapping) ? task.mapping : {};
    const defaults = isObj(task.defaults) ? task.defaults : {};
    const opt = (value: unknown, max = 200) => {
        const text = cleanText(value, max);
        return text ? text : null;
    };
    return {
        createTask: compact({
            projectId,
            initiativeId: sanitizeId(task.initiativeId) || null,
            mapping: {
                title: cleanText(mapping.title, 300),
                description: stringList(mapping.description, 30, 100),
                priority: opt(mapping.priority, 100),
                dueDate: opt(mapping.dueDate, 100),
                assigneeIds: opt(mapping.assigneeIds, 100),
                labels: opt(mapping.labels, 100)
            },
            defaults: {
                priority: opt(defaults.priority, 40) || undefined,
                status: opt(defaults.status, 60) || undefined,
                assigneeIds: stringList(defaults.assigneeIds, 20, 128)
            }
        })
    };
};

/** `YYYY-MM` (UTC) key of `forms_usage`. */
export const usageMonthId = (now: number) => new Date(now).toISOString().slice(0, 7);

export const safeObjectName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'file';
