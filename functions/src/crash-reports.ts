import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * ProjectFlow's own crash reporting (web + iOS), opt-in on every client (`pf.consent.crashReports`).
 *
 * POST /api/crash (hosting rewrite → crashIngest), no auth: clients send anonymous reports only — a random install
 * id, app release/build, OS, device model, locale and the crash itself (type, message, stack). The server scrubs
 * emails/tokens/long numbers again, stores no IP or user id, groups events into issues by fingerprint and keeps
 * events 90 days (`expireAt`, Firestore TTL policy on collection group `crashEvents`).
 *
 * Data: `crashIssues/{fingerprint}` (+ `crashEvents/{eventId}` below it). Read/triage only for platform admins
 * (custom claim `platformAdmin`, firestore.rules) in the admin platform (/admin/crashes).
 */

const REGION = 'europe-west3';
const MAX_BODY_BYTES = 128 * 1024;
const MAX_EVENTS = 10;
const MAX_FRAMES = 80;
const MAX_IMAGES = 40;
const EVENTS_PER_ISSUE_PER_DAY = 100;
const RETENTION_DAYS = 90;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;

export type CrashPlatform = 'web' | 'ios';
export type CrashEnvironment = 'production' | 'development';

export type CrashFrame = {
    function?: string;
    file?: string;
    line?: number;
    column?: number;
    image?: string;
    uuid?: string;
    offset?: number;
    address?: string;
    inApp?: boolean;
};

export type CrashImage = { name: string; uuid: string; loadAddress: string; arch?: string };

export type CrashEvent = {
    id: string;
    timestamp: number;
    mechanism: string;
    handled: boolean;
    type: string;
    message: string;
    frames: CrashFrame[];
    images: CrashImage[];
    route?: string;
};

export type CrashReport = {
    platform: CrashPlatform;
    environment: CrashEnvironment;
    release: string;
    build?: string;
    installId: string;
    device: { os: string; osVersion: string; model?: string; locale?: string; browser?: string };
    events: CrashEvent[];
};

const str = (value: unknown, max: number): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
};

const int = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;

/** Removes things that may identify a person or a secret: emails, bearer/API tokens, long digit runs, URL queries. */
export const scrub = (text: string): string =>
    text
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>')
        .replace(/\b(Bearer|token|key|secret|password)([=: ]+)\S+/gi, '$1$2<redacted>')
        .replace(/\b(?=[A-Za-z_-]*\d)(?=[0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g, '<redacted>')   // token-like: letters + digits
        .replace(/\d{6,}/g, '<number>')
        .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1');

/** Web file URLs are reduced to their path (no origin, query or hash). */
const cleanFile = (value: unknown): string | undefined => {
    const file = str(value, 300);
    if (!file) return undefined;
    try {
        if (/^https?:\/\//.test(file)) return new URL(file).pathname;
    } catch {
        /* keep as-is */
    }
    return file.replace(/[?#].*$/, '');
};

const parseFrame = (raw: any): CrashFrame | null => {
    if (!raw || typeof raw !== 'object') return null;
    const frame: CrashFrame = {};
    const fn = str(raw.function, 300);
    if (fn) frame.function = scrub(fn);
    const file = cleanFile(raw.file);
    if (file) frame.file = file;
    const line = int(raw.line); if (line !== undefined) frame.line = line;
    const column = int(raw.column); if (column !== undefined) frame.column = column;
    const image = str(raw.image, 120); if (image) frame.image = image;
    const uuid = str(raw.uuid, 40); if (uuid && /^[0-9A-Fa-f-]{32,36}$/.test(uuid)) frame.uuid = uuid.toUpperCase();
    const offset = int(raw.offset); if (offset !== undefined) frame.offset = offset;
    const address = str(raw.address, 24); if (address && /^0x[0-9a-f]+$/i.test(address)) frame.address = address.toLowerCase();
    if (typeof raw.inApp === 'boolean') frame.inApp = raw.inApp;
    return Object.keys(frame).length ? frame : null;
};

const parseImage = (raw: any): CrashImage | null => {
    const name = str(raw?.name, 120);
    const uuid = str(raw?.uuid, 40);
    const loadAddress = str(raw?.loadAddress, 24);
    if (!name || !uuid || !loadAddress || !/^0x[0-9a-f]+$/i.test(loadAddress)) return null;
    const arch = str(raw?.arch, 16);
    return { name, uuid: uuid.toUpperCase(), loadAddress: loadAddress.toLowerCase(), ...(arch ? { arch } : {}) };
};

/** Validates and normalizes a client report; returns null when it is not a usable report. */
export const parseCrashReport = (body: any): CrashReport | null => {
    if (!body || typeof body !== 'object') return null;
    const platform = body.platform === 'web' || body.platform === 'ios' ? body.platform : null;
    const release = str(body.release, 64);
    const installId = str(body.installId, 64);
    if (!platform || !release || !installId || !/^[A-Za-z0-9-]{8,64}$/.test(installId)) return null;
    const device = body.device ?? {};
    const events = (Array.isArray(body.events) ? body.events : []).slice(0, MAX_EVENTS).flatMap((raw: any): CrashEvent[] => {
        const type = str(raw?.type, 200);
        if (!type) return [];
        const frames = (Array.isArray(raw.frames) ? raw.frames : []).slice(0, MAX_FRAMES).map(parseFrame).filter(Boolean) as CrashFrame[];
        const images = (Array.isArray(raw.images) ? raw.images : []).slice(0, MAX_IMAGES).map(parseImage).filter(Boolean) as CrashImage[];
        const timestamp = int(raw.timestamp);
        const route = str(raw.route, 200)?.replace(/[?#].*$/, '');
        return [{
            id: str(raw.id, 64)?.replace(/[^A-Za-z0-9-]/g, '') || randomUUID(),
            timestamp: timestamp && timestamp > 1_600_000_000_000 && timestamp < Date.now() + 86_400_000 ? timestamp : Date.now(),
            mechanism: str(raw.mechanism, 40) ?? 'unknown',
            handled: raw.handled === true,
            type: scrub(type),
            message: scrub(str(raw.message, 2000) ?? ''),
            frames,
            images,
            ...(route ? { route: scrub(route) } : {}),
        }];
    });
    if (!events.length) return null;
    return {
        platform,
        environment: body.environment === 'development' ? 'development' : 'production',
        release,
        build: str(body.build, 32),
        installId,
        device: {
            os: str(device.os, 40) ?? (platform === 'ios' ? 'iOS' : 'unknown'),
            osVersion: str(device.osVersion, 40) ?? '',
            ...(str(device.model, 60) ? { model: str(device.model, 60) } : {}),
            ...(str(device.locale, 20) ? { locale: str(device.locale, 20) } : {}),
            ...(str(device.browser, 60) ? { browser: str(device.browser, 60) } : {}),
        },
        events,
    };
};

/** Message with variable parts (numbers, quoted strings, hex) removed, for grouping. */
export const normalizeMessage = (message: string): string =>
    message
        .replace(/0x[0-9a-f]+/gi, '<hex>')
        .replace(/(["'`]).*?\1/g, '<str>')
        .replace(/\d+/g, '<n>')
        .slice(0, 300);

/** First in-app frame that identifies where it failed; web: function + file name without the content hash. */
export const culpritOf = (platform: CrashPlatform, frames: CrashFrame[]): string => {
    const frame = frames.find((f) => f.inApp !== false && (f.function || f.file || f.image)) ?? frames[0];
    if (!frame) return '';
    if (platform === 'web') {
        const file = (frame.file ?? '').split('/').pop()?.replace(/-[A-Za-z0-9_]{8,}(?=\.js$)/, '') ?? '';
        return [frame.function, file].filter(Boolean).join(' · ');
    }
    if (frame.function) return `${frame.function} · ${frame.image ?? ''}`.trim();
    return `${frame.image ?? '?'} + ${frame.offset ?? frame.address ?? '?'}`;
};

export const fingerprintOf = (platform: CrashPlatform, event: CrashEvent): string => {
    // iOS frames are offsets that change with every build, so iOS groups by type + message + mechanism only.
    const culprit = platform === 'web' ? culpritOf(platform, event.frames) : '';
    const key = [platform, event.type, normalizeMessage(event.message), culprit].join('|');
    return createHash('sha1').update(key).digest('hex').slice(0, 24);
};

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Writes one report: per event, the issue (count, last seen, releases) and, within the daily cap, the event. */
export const storeCrashReport = async (db: admin.firestore.Firestore, report: CrashReport, now = Date.now()) => {
    const stored: string[] = [];
    for (const event of report.events) {
        const fingerprint = fingerprintOf(report.platform, event);
        const issueRef = db.collection('crashIssues').doc(fingerprint);
        const eventRef = issueRef.collection('crashEvents').doc(event.id);
        await db.runTransaction(async (tx) => {
            const issue = await tx.get(issueRef);
            const existing = await tx.get(eventRef);
            if (existing.exists) return; // client retry of an already stored event
            const data = issue.data() ?? {};
            const today = dayKey(now);
            const storedToday = data.dayKey === today ? Number(data.dayStored ?? 0) : 0;
            const keep = storedToday < EVENTS_PER_ISSUE_PER_DAY;
            const reopen = data.status === 'resolved' && data.resolvedRelease !== report.release;
            tx.set(issueRef, {
                platform: report.platform,
                type: event.type,
                message: event.message,
                culprit: culpritOf(report.platform, event.frames),
                mechanism: event.mechanism,
                count: FieldValue.increment(1),
                lastSeen: Timestamp.fromMillis(now),
                lastRelease: report.release,
                releases: FieldValue.arrayUnion(report.release),
                environments: FieldValue.arrayUnion(report.environment),
                lastEnvironment: report.environment,
                dayKey: today,
                dayStored: storedToday + (keep ? 1 : 0),
                ...(issue.exists ? {} : { firstSeen: Timestamp.fromMillis(now), status: 'open' }),
                ...(reopen ? { status: 'open', reopenedAt: Timestamp.fromMillis(now) } : {}),
                ...(keep ? { lastEventId: event.id } : {}),
            }, { merge: true });
            if (!keep) return;
            tx.set(eventRef, {
                ...event,
                platform: report.platform,
                environment: report.environment,
                release: report.release,
                build: report.build ?? null,
                installId: report.installId,
                device: report.device,
                receivedAt: Timestamp.fromMillis(now),
                expireAt: Timestamp.fromMillis(now + RETENTION_DAYS * 86_400_000),
                symbolicated: false,
            });
        });
        stored.push(event.id);
    }
    return stored;
};

// Best-effort per-instance limit; the payload limits and the per-issue daily cap bound the rest.
const hits = new Map<string, { start: number; count: number }>();
const rateLimited = (key: string, now = Date.now()) => {
    const entry = hits.get(key);
    if (!entry || now - entry.start > RATE_WINDOW_MS) {
        hits.set(key, { start: now, count: 1 });
        if (hits.size > 5000) hits.clear();
        return false;
    }
    entry.count += 1;
    return entry.count > RATE_MAX_REQUESTS;
};

export const crashIngest = functions.region(REGION).runWith({ memory: '256MB', maxInstances: 10 }).https.onRequest(async (req, res) => {
    // Reports carry no credentials, so any origin may send them (browsers, the iOS app, desktop).
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
    if ((req.rawBody?.length ?? 0) > MAX_BODY_BYTES) { res.status(413).json({ error: 'too_large' }); return; }

    let body = req.body;
    // sendBeacon posts text/plain to avoid a CORS preflight.
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString()); } catch { body = null; }
    }
    const report = parseCrashReport(body);
    if (!report) { res.status(400).json({ error: 'invalid_report' }); return; }
    if (rateLimited(report.installId) || rateLimited(String(req.ip ?? ''))) { res.set('Retry-After', '60'); res.status(429).json({ error: 'rate_limited' }); return; }

    try {
        const stored = await storeCrashReport(admin.firestore(), report);
        res.status(200).json({ ok: true, stored });
    } catch (error) {
        console.error('crashIngest failed', error);
        res.status(500).json({ error: 'internal' });
    }
});
