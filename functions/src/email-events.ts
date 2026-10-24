// SES feedback loop + one-click unsubscribe. Runbook: brain/operations/email-ses.md
//   SES configuration set → SNS topic → sesEvents (signature checked) → email_suppressions / email_stats
//   List-Unsubscribe → emailUnsubscribe (HMAC token) → users/{uid}.notificationPrefs.email.<category> = false
import * as functions from 'firebase-functions/v1';
import { onRequest } from 'firebase-functions/v2/https';
import { createVerify, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './init';
import {
    FUNCTIONS_SERVICE_ACCOUNT, SesEventAction, applySoftBounce, isAllowedTopic, isSnsCertUrl, isSnsHostUrl, normalizeEmail, parseSesEvent,
    parseSnsMessage, safeJson, signUnsubscribeToken, snsStringToSign, suppressionId, verifyUnsubscribeToken
} from './email-logic';
import type { SuppressionReason } from './email-logic';
import type { PrefCategory } from './notification-prefs';

const REGION = 'europe-west3';
const PREF_CATEGORIES: PrefCategory[] = ['assignments', 'mentions', 'comments', 'due', 'reminders'];

// ---------------------------------------------------------------------------
// Suppression list
// ---------------------------------------------------------------------------

export const suppressionRef = (email: string) => db.collection('email_suppressions').doc(suppressionId(email));

export const setSuppression = async (
    email: string,
    entry: { active: boolean; reason: SuppressionReason; detail: string; source: 'ses' | 'admin'; mailType?: string; messageId?: string; by?: string }
) => {
    const ref = suppressionRef(email);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        tx.set(ref, {
            email: normalizeEmail(email),
            ...entry,
            mailType: entry.mailType || null,
            messageId: entry.messageId || null,
            by: entry.by || null,
            events: FieldValue.increment(entry.source === 'ses' ? 1 : 0),
            updatedAt: FieldValue.serverTimestamp(),
            ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }, { merge: true });
    });
    // Platform newsletter: a blocked address is no longer a deliverable subscriber.
    if (entry.active) {
        const { markBounced } = await import('./platform-newsletter/store');
        await markBounced(email, `${entry.reason}: ${entry.detail}`.slice(0, 300)).catch((error) => console.warn('markBounced failed', error?.message));
    }
};

const applyAction = async (action: SesEventAction, meta: { mailType: string; messageId: string }) => {
    if (action.kind === 'suppress') {
        await setSuppression(action.email, { active: true, reason: action.reason, detail: action.detail, source: 'ses', ...meta });
        return;
    }
    if (action.kind === 'soft-bounce') {
        const ref = suppressionRef(action.email);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const { softBounces, suppress } = applySoftBounce(snap.get('softBounces'), Date.now());
            tx.set(ref, {
                email: action.email,
                softBounces,
                lastSoftBounce: action.detail,
                updatedAt: FieldValue.serverTimestamp(),
                ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), active: false, reason: 'bounce', source: 'ses' }),
                ...(suppress && snap.get('active') !== true
                    ? { active: true, reason: 'bounce', detail: `soft bounce x${softBounces.length} · ${action.detail}`.slice(0, 300), source: 'ses', ...meta }
                    : {}),
            }, { merge: true });
        });
    }
};

/** Daily counters for the admin console (bounce/complaint rate vs. SES thresholds 5 % / 0.1 %). */
const countEvent = async (eventType: string, mailType: string, recipients: number, campaignId = '') => {
    const day = new Date().toISOString().slice(0, 10);
    const key = eventType.replace(/[^A-Za-z]/g, '').toLowerCase() || 'other';
    const inc = FieldValue.increment(Math.max(recipients, 1));
    if (campaignId && campaignId !== 'test' && /^[A-Za-z0-9_-]{1,64}$/.test(campaignId)) {
        // Platform newsletter campaign stats (delivery, bounce, complaint, …); missing campaigns are ignored.
        await db.collection('platform_campaigns').doc(campaignId).update({ [`stats.ses.${key}`]: inc }).catch(() => undefined);
    }
    await db.collection('email_stats').doc(day).set({
        day,
        counts: { [key]: inc },
        byType: { [mailType || 'untagged']: { [key]: inc } },
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
};

// ---------------------------------------------------------------------------
// SNS webhook
// ---------------------------------------------------------------------------

const certCache = new Map<string, string>();

const fetchCert = async (url: string) => {
    const cached = certCache.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cert fetch ${res.status}`);
    const pem = await res.text();
    if (!pem.includes('BEGIN CERTIFICATE')) throw new Error('not a certificate');
    certCache.set(url, pem);
    return pem;
};

/**
 * SNS HTTPS subscription endpoint. Accepts only signed messages from the topics in
 * SES_SNS_TOPIC_ARNS (exact ARNs, comma separated) and confirms their subscription.
 */
export const sesEvents = onRequest({ region: REGION, serviceAccount: FUNCTIONS_SERVICE_ACCOUNT, memory: '256MiB', timeoutSeconds: 60, concurrency: 20 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    const msg = parseSnsMessage(req.rawBody ? req.rawBody.toString('utf8') : req.body);
    if (!msg || !isSnsCertUrl(msg.SigningCertURL)) {
        res.status(400).send('Bad request');
        return;
    }
    if (!isAllowedTopic(msg.TopicArn, process.env.SES_SNS_TOPIC_ARNS)) {
        console.warn('sesEvents: topic not allowed', msg.TopicArn);
        res.status(403).send('Forbidden');
        return;
    }
    try {
        const cert = await fetchCert(msg.SigningCertURL);
        const verifier = createVerify(msg.SignatureVersion === '1' ? 'RSA-SHA1' : 'RSA-SHA256');
        verifier.update(snsStringToSign(msg));
        if (!verifier.verify(cert, msg.Signature, 'base64')) {
            console.warn('sesEvents: invalid signature', msg.MessageId);
            res.status(403).send('Forbidden');
            return;
        }
    } catch (error) {
        console.error('sesEvents: signature check failed', error);
        res.status(500).send('Error');
        return;
    }

    if (msg.Type === 'SubscriptionConfirmation') {
        if (!msg.SubscribeURL || !isSnsHostUrl(msg.SubscribeURL)) {
            res.status(400).send('Bad request');
            return;
        }
        const confirm = await fetch(msg.SubscribeURL);
        console.log(`sesEvents: subscription to ${msg.TopicArn} confirmed (${confirm.status})`);
        res.status(confirm.ok ? 200 : 502).send(confirm.ok ? 'Confirmed' : 'Confirm failed');
        return;
    }
    if (msg.Type !== 'Notification') {
        res.status(200).send('Ignored');
        return;
    }

    const event = parseSesEvent(safeJson(msg.Message));
    if (!event) {
        res.status(200).send('Ignored');
        return;
    }
    try {
        // SNS retries on non-2xx, so a failed write gets another chance; suppression writes are idempotent.
        const meta = { mailType: event.mailType, messageId: event.messageId };
        for (const action of event.actions) await applyAction(action, meta);
        await countEvent(event.eventType, event.mailType, event.actions.length, event.campaignId);
        if (event.eventType === 'Bounce' || event.eventType === 'Complaint') {
            console.log(`sesEvents: ${event.eventType} type=${event.mailType} recipients=${event.actions.length}`);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('sesEvents: processing failed', error);
        res.status(500).send('Error');
    }
});

// ---------------------------------------------------------------------------
// One-click unsubscribe (List-Unsubscribe / List-Unsubscribe-Post)
// ---------------------------------------------------------------------------

let unsubscribeKey: string | null = null;

const getUnsubscribeKey = async () => {
    if (unsubscribeKey) return unsubscribeKey;
    const ref = db.collection('admin_config').doc('email');
    unsubscribeKey = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.get('unsubscribeKey');
        if (typeof existing === 'string' && existing.length >= 32) return existing;
        const key = randomBytes(32).toString('base64url');
        tx.set(ref, { unsubscribeKey: key, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return key;
    });
    return unsubscribeKey;
};

const unsubscribeBase = () =>
    process.env.EMAIL_UNSUBSCRIBE_URL || `https://${REGION}-${process.env.GCLOUD_PROJECT || 'projectflow-labestin'}.cloudfunctions.net/emailUnsubscribe`;

/** One-click URL that turns off one email notification category for the user; null for categories without a toggle. */
export const notificationUnsubscribeUrl = async (uid: string, category: string): Promise<string | null> => {
    if (!PREF_CATEGORIES.includes(category as PrefCategory)) return null;
    const token = signUnsubscribeToken(await getUnsubscribeKey(), uid, `notif:${category}`);
    return `${unsubscribeBase()}?t=${encodeURIComponent(token)}`;
};

/** Unsubscribe link for platform newsletter/waitlist mails (subject = platform_subscribers id). */
export const newsletterUnsubscribeUrl = async (subscriberId: string, list: string, campaignId?: string): Promise<string> => {
    const token = signUnsubscribeToken(await getUnsubscribeKey(), subscriberId, `newsletter:${list}${campaignId ? `:${campaignId}` : ''}`);
    return `${unsubscribeBase()}?t=${encodeURIComponent(token)}`;
};

const NEWSLETTER_TEXT = {
    de: {
        title: 'Vom ProjectFlow-Newsletter abmelden',
        titleWaitlist: 'Von der ProjectFlow-Warteliste abmelden',
        confirm: 'Möchtest du dich abmelden? Du bekommst danach keine E-Mails dieser Liste mehr.',
        done: 'Erledigt. Du bist abgemeldet und bekommst keine E-Mails dieser Liste mehr.',
    },
    en: {
        title: 'Unsubscribe from the ProjectFlow newsletter',
        titleWaitlist: 'Leave the ProjectFlow waitlist',
        confirm: 'Do you want to unsubscribe? You will no longer receive emails from this list.',
        done: 'Done. You are unsubscribed and will no longer receive emails from this list.',
    },
};

const PAGE_TEXT = {
    de: {
        title: 'E-Mail-Benachrichtigungen abbestellen',
        confirm: 'Diese Art von E-Mail-Benachrichtigung abbestellen?',
        button: 'Abbestellen',
        done: 'Erledigt. Du bekommst diese E-Mail-Benachrichtigungen nicht mehr. Unter Einstellungen → Benachrichtigungen kannst du das jederzeit ändern.',
        invalid: 'Dieser Abmeldelink ist ungültig.',
    },
    en: {
        title: 'Unsubscribe from email notifications',
        confirm: 'Unsubscribe from this kind of email notification?',
        button: 'Unsubscribe',
        done: 'Done. You will no longer receive these email notifications. You can change this any time under Settings → Notifications.',
        invalid: 'This unsubscribe link is invalid.',
    },
};

const page = (lang: 'de' | 'en', body: string, title = PAGE_TEXT[lang].title) => `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;color:#000;margin:0;padding:48px 16px}main{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center}button{background:#000;color:#fff;border:0;border-radius:8px;padding:14px 28px;font-size:16px;font-weight:600;cursor:pointer}</style></head>
<body><main><h1 style="font-size:22px">${title}</h1>${body}<p style="margin-top:32px"><a href="https://app.getprojectflow.com/?openSettings=notifications" style="color:#6b7280">ProjectFlow</a></p></main></body></html>`;

const applyUnsubscribe = async (subject: string, scope: string, ip?: string) => {
    const [kind, category, campaignId] = scope.split(':');
    if (kind === 'newsletter') {
        if (category !== 'newsletter' && category !== 'waitlist') return false;
        const { unsubscribe } = await import('./platform-newsletter/store');
        return unsubscribe(subject, category, { via: 'link', campaignId, ip });
    }
    if (kind !== 'notif' || !PREF_CATEGORIES.includes(category as PrefCategory)) return false;
    await db.collection('users').doc(subject).set({ notificationPrefs: { email: { [category]: false } } }, { merge: true });
    console.log(`emailUnsubscribe: ${category} off for ${subject.slice(0, 6)}…`);
    return true;
};

export const emailUnsubscribe = functions.region(REGION).https.onRequest(async (req, res) => {
    const lang = /^de\b/i.test(String(req.headers['accept-language'] || '')) ? 'de' : 'en';
    const token = String(req.query.t || '');
    res.set('Cache-Control', 'no-store');
    const parsed = verifyUnsubscribeToken(await getUnsubscribeKey(), token);
    const n = NEWSLETTER_TEXT[lang];
    const t = parsed?.scope.startsWith('newsletter:')
        ? { ...PAGE_TEXT[lang], title: parsed.scope.startsWith('newsletter:waitlist') ? n.titleWaitlist : n.title, confirm: n.confirm, done: n.done }
        : PAGE_TEXT[lang];
    if (!parsed) {
        res.status(400).send(page(lang, `<p>${t.invalid}</p>`, t.title));
        return;
    }
    if (req.method === 'POST') {
        // RFC 8058 one-click (mail client) or the confirm button below.
        const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
        const ok = await applyUnsubscribe(parsed.subject, parsed.scope, ip);
        res.status(ok ? 200 : 400).send(page(lang, `<p>${ok ? t.done : t.invalid}</p>`, t.title));
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).send('Method not allowed');
        return;
    }
    // GET only shows a confirm button: link scanners must not unsubscribe anyone.
    res.status(200).send(page(lang, `<p>${t.confirm}</p><form method="post" action="?t=${encodeURIComponent(token)}"><button type="submit">${t.button}</button></form>`, t.title));
});
