// Email delivery logic (SES, suppression, SNS events, unsubscribe tokens).
// Pure module: no Firebase imports, safe to unit test. Runbook: brain/operations/email-ses.md
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { BlockList, isIP } from 'net';

/** Bind these on every function that can reach sendEmail(): `runWith({ secrets: EMAIL_SECRETS })`. */
export const EMAIL_SECRETS = ['AWS_SES_ACCESS_KEY_ID', 'AWS_SES_SECRET_ACCESS_KEY'];

/**
 * v2 functions default to the compute service account, which has no Firestore role in this project
 * (PERMISSION_DENIED); mail functions run as the App Engine default account like the v1 functions.
 */
export const FUNCTIONS_SERVICE_ACCOUNT = 'projectflow-labestin@appspot.gserviceaccount.com';

/** Mail types become the SES tag `type`; they decide transactional vs. list mail. */
export const EMAIL_TYPES = [
    'invitation',
    'notification',
    'legal',
    'waitlist',
    'newsletter',
    'newsletter-optin',
    'contact',
    'admin',
    'system',
] as const;
export type EmailType = typeof EMAIL_TYPES[number];

/** Non-transactional mails (tag category=list); they carry List-Unsubscribe (RFC 8058 one-click). */
export const NON_TRANSACTIONAL: ReadonlySet<EmailType> = new Set<EmailType>(['notification', 'newsletter']);

export const normalizeEmail = (email: string): string => String(email || '').trim().toLowerCase();

/** Doc id in `email_suppressions` (emails can contain `/`, so hash them). */
export const suppressionId = (email: string): string =>
    createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 40);

export type SuppressionReason = 'bounce' | 'complaint' | 'manual';

/** Soft bounces only suppress after this many within SOFT_BOUNCE_WINDOW_MS. */
export const SOFT_BOUNCE_LIMIT = 3;
export const SOFT_BOUNCE_WINDOW_MS = 7 * 86_400_000;

export interface SuppressionState {
    active?: boolean;
    softBounces?: number[]; // epoch ms
}

/** A suppression blocks sending while active (removal in the admin console sets active=false). */
export const isActiveSuppression = (state: SuppressionState | null | undefined): boolean => state?.active === true;

// ---------------------------------------------------------------------------
// SES event publishing payloads (SNS message body)
// ---------------------------------------------------------------------------

export type SesEventAction =
    | { kind: 'suppress'; email: string; reason: SuppressionReason; detail: string }
    | { kind: 'soft-bounce'; email: string; detail: string }
    | { kind: 'count'; email: string; event: 'delivery' | 'reject' | 'send' | 'other' };

export interface ParsedSesEvent {
    eventType: string;
    messageId: string;
    mailType: string;
    actions: SesEventAction[];
}

const asRecord = (value: unknown): Record<string, any> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const tagValue = (mail: Record<string, any>, name: string): string => {
    const values = asRecord(mail.tags)[name];
    return Array.isArray(values) && typeof values[0] === 'string' ? values[0] : '';
};

/**
 * Maps one SES event (configuration-set event publishing format, `eventType`; also accepts the
 * identity-notification format `notificationType`) to suppression actions.
 */
export const parseSesEvent = (raw: unknown): ParsedSesEvent | null => {
    const event = asRecord(raw);
    const eventType = String(event.eventType || event.notificationType || '');
    if (!eventType) return null;
    const mail = asRecord(event.mail);
    const base = { eventType, messageId: String(mail.messageId || ''), mailType: tagValue(mail, 'type') };
    const destinations: string[] = Array.isArray(mail.destination) ? mail.destination.map(String) : [];

    if (eventType === 'Bounce') {
        const bounce = asRecord(event.bounce);
        const permanent = bounce.bounceType === 'Permanent';
        const recipients: any[] = Array.isArray(bounce.bouncedRecipients) ? bounce.bouncedRecipients : [];
        return {
            ...base,
            actions: recipients.map((r) => {
                const email = normalizeEmail(asRecord(r).emailAddress);
                const detail = [bounce.bounceType, bounce.bounceSubType, asRecord(r).diagnosticCode].filter(Boolean).join(' · ').slice(0, 300);
                return permanent ? { kind: 'suppress', email, reason: 'bounce', detail } : { kind: 'soft-bounce', email, detail };
            }).filter((a) => a.email) as SesEventAction[],
        };
    }
    if (eventType === 'Complaint') {
        const complaint = asRecord(event.complaint);
        const recipients: any[] = Array.isArray(complaint.complainedRecipients) ? complaint.complainedRecipients : [];
        const detail = String(complaint.complaintFeedbackType || complaint.complaintSubType || 'complaint').slice(0, 300);
        return {
            ...base,
            actions: recipients
                .map((r) => ({ kind: 'suppress', email: normalizeEmail(asRecord(r).emailAddress), reason: 'complaint', detail }))
                .filter((a) => a.email) as SesEventAction[],
        };
    }
    const counted = eventType === 'Delivery' ? 'delivery' : eventType === 'Reject' ? 'reject' : eventType === 'Send' ? 'send' : 'other';
    return { ...base, actions: destinations.map((email) => ({ kind: 'count', email: normalizeEmail(email), event: counted })) };
};

/** Applies one soft bounce to the stored timestamps; returns the new list and whether to suppress. */
export const applySoftBounce = (previous: number[] | undefined, nowMs: number) => {
    const recent = (previous || []).filter((t) => nowMs - t < SOFT_BOUNCE_WINDOW_MS);
    recent.push(nowMs);
    return { softBounces: recent.slice(-10), suppress: recent.length >= SOFT_BOUNCE_LIMIT };
};

// ---------------------------------------------------------------------------
// SNS message signature (https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html)
// ---------------------------------------------------------------------------

export interface SnsMessage {
    Type: string;
    MessageId: string;
    TopicArn: string;
    Message: string;
    Timestamp: string;
    SignatureVersion: string;
    Signature: string;
    SigningCertURL: string;
    Subject?: string;
    Token?: string;
    SubscribeURL?: string;
}

const NOTIFICATION_KEYS = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
const SUBSCRIPTION_KEYS = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];

export const snsStringToSign = (msg: SnsMessage): string => {
    const keys = msg.Type === 'Notification' ? NOTIFICATION_KEYS : SUBSCRIPTION_KEYS;
    return keys
        .filter((key) => (msg as any)[key] !== undefined && (msg as any)[key] !== null)
        .map((key) => `${key}\n${(msg as any)[key]}\n`)
        .join('');
};

/** Only certificates and subscribe links served by SNS itself are trusted. */
export const isSnsHostUrl = (url: string, path?: RegExp): boolean => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname) && (!path || path.test(parsed.pathname));
    } catch {
        return false;
    }
};

export const isSnsCertUrl = (url: string): boolean => isSnsHostUrl(url, /\.pem$/);

export const parseSnsMessage = (raw: unknown): SnsMessage | null => {
    const body = asRecord(typeof raw === 'string' ? safeJson(raw) : raw);
    const required = ['Type', 'MessageId', 'TopicArn', 'Timestamp', 'SignatureVersion', 'Signature', 'SigningCertURL'];
    if (required.some((key) => typeof body[key] !== 'string' || !body[key])) return null;
    if (!['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation'].includes(body.Type)) return null;
    if (body.SignatureVersion !== '1' && body.SignatureVersion !== '2') return null;
    return body as SnsMessage;
};

export const safeJson = (value: string): unknown => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

/** ARN allowlist: comma-separated env value, exact match. Empty = nothing allowed. */
export const isAllowedTopic = (topicArn: string, allowed: string | undefined): boolean =>
    String(allowed || '').split(',').map((s) => s.trim()).filter(Boolean).includes(topicArn);

// ---------------------------------------------------------------------------
// Unsubscribe tokens + List-Unsubscribe headers
// ---------------------------------------------------------------------------

/** Scope: `notif:<category>` (a notification email category) or `newsletter`. */
export const signUnsubscribeToken = (key: string, uidOrEmail: string, scope: string): string => {
    const payload = Buffer.from(JSON.stringify({ s: uidOrEmail, c: scope })).toString('base64url');
    const sig = createHmac('sha256', key).update(payload).digest('base64url').slice(0, 32);
    return `${payload}.${sig}`;
};

export const verifyUnsubscribeToken = (key: string, token: string): { subject: string; scope: string } | null => {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', key).update(payload).digest('base64url').slice(0, 32);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = asRecord(safeJson(Buffer.from(payload, 'base64url').toString('utf8')));
    if (typeof data.s !== 'string' || typeof data.c !== 'string' || !data.s || !data.c) return null;
    return { subject: data.s, scope: data.c };
};

export const listUnsubscribeHeaders = (url: string, mailto?: string) => [
    { Name: 'List-Unsubscribe', Value: [`<${url}>`, mailto ? `<mailto:${mailto}?subject=unsubscribe>` : ''].filter(Boolean).join(', ') },
    { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
];

// ---------------------------------------------------------------------------
// Sending: rate limit + retry classification
// ---------------------------------------------------------------------------

/** Per-instance pacing to the account's SES max send rate (mails per second). */
export class SendRateLimiter {
    private next = 0;
    constructor(private ratePerSecond: number, private now: () => number = Date.now) {}

    setRate(ratePerSecond: number) {
        if (Number.isFinite(ratePerSecond) && ratePerSecond > 0) this.ratePerSecond = ratePerSecond;
    }

    /** Milliseconds the caller has to wait before sending; reserves the slot. */
    reserve(): number {
        const now = this.now();
        const interval = 1000 / Math.max(this.ratePerSecond, 0.1);
        const slot = Math.max(now, this.next);
        this.next = slot + interval;
        return slot - now;
    }
}

const RETRYABLE = new Set(['Throttling', 'ThrottlingException', 'TooManyRequestsException', 'LimitExceededException', 'ServiceUnavailable', 'InternalFailure', 'RequestTimeout', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);

export const isRetryableSendError = (error: any): boolean => {
    const name = String(error?.name || error?.code || '');
    const status = Number(error?.$metadata?.httpStatusCode || error?.responseCode || 0);
    if (name === 'MessageRejected' || name === 'AccountSuspendedException' || name === 'MailFromDomainNotVerifiedException' || name === 'SendingPausedException') return false;
    if (/maximum sending rate/i.test(String(error?.message || ''))) return true;
    return RETRYABLE.has(name) || status === 429 || status >= 500;
};

export const backoffMs = (attempt: number, random: () => number = Math.random): number =>
    Math.min(8000, 500 * 2 ** attempt) + Math.floor(random() * 250);

/** SES tag values allow [A-Za-z0-9_-] only. */
export const sesTagValue = (value: string): string => String(value || 'none').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) || 'none';

export const stripHtml = (html: string): string =>
    String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&copy;/g, '©')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();

// ---------------------------------------------------------------------------
// Workspace SMTP: only public hosts on mail ports (SSRF guard, audit M9)
// ---------------------------------------------------------------------------

export const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];

const BLOCKED = new BlockList();
[
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
    ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 3],
].forEach(([net, prefix]) => BLOCKED.addSubnet(net as string, prefix as number, 'ipv4'));
[
    ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['64:ff9b:1::', 48],
    ['2001:db8::', 32], ['2002::', 16], ['100::', 64], ['::', 96],
].forEach(([net, prefix]) => BLOCKED.addSubnet(net as string, prefix as number, 'ipv6'));

/**
 * True for anything that is not a routable public address. IPv4-mapped IPv6 in any notation
 * (`::ffff:127.0.0.1`, `::ffff:7f00:1`, `0:0:0:0:0:ffff:7f00:1`) is checked against the IPv4 rules.
 */
export const isPrivateIp = (ip: string): boolean => {
    const version = isIP(ip);
    if (version === 4) return BLOCKED.check(ip, 'ipv4');
    if (version === 6) return BLOCKED.check(ip, 'ipv6');
    return true;
};

export const isAllowedSmtpPort = (port: unknown): boolean => ALLOWED_SMTP_PORTS.includes(Number(port));
