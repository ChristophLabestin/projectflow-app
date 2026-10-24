// Campaign dispatcher: scheduled every 5 minutes, also run inline by adminApi `newsletter.campaigns.send`.
//   scheduled (due) → materialize platform_campaigns/{id}/sends/{subscriberId} (queued) → sending → sent
// A lease on admin_config/newsletter keeps runs exclusive; pacing comes from sendEmail() (SES max send rate),
// plus a per-run and a daily cap (NEWSLETTER_MAX_PER_RUN / NEWSLETTER_DAILY_CAP, SES sandbox: 200 mails/24 h).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { db } from '../init';
import { EMAIL_SECRETS, FUNCTIONS_SERVICE_ACCOUNT } from '../email-logic';
import {
    PENDING_RETENTION_MS, applyPlaceholders, dayKey, matchesAudience, newsletterEmailHtml, normalizeAudience, remainingDailyQuota,
    renderMarkdown, subscriberId, variantFor,
} from './logic';
import type { Audience, Lang, ListId, SubscriberDoc, Variant } from './logic';
import { campaigns, cleanupPending, subscribers } from './store';

const CONFIG = () => db.collection('admin_config').doc('newsletter');
const envInt = (name: string, fallback: number) => {
    const n = parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};
export const dailyCap = () => envInt('NEWSLETTER_DAILY_CAP', 150);
const maxPerRun = () => envInt('NEWSLETTER_MAX_PER_RUN', 150);

type CampaignDoc = {
    title: string;
    status: string;
    defaultLang: Lang;
    variants: Partial<Record<Lang, Variant>>;
    audience: Audience;
    scheduledAt?: Timestamp | null;
    materialized?: boolean;
};

const acquireLease = async (ms: number): Promise<string | null> => {
    const id = randomBytes(8).toString('hex');
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(CONFIG());
        if (Number(snap.get('leaseUntil') || 0) > Date.now()) return null;
        tx.set(CONFIG(), { leaseUntil: Date.now() + ms, leaseId: id }, { merge: true });
        return id;
    });
};
const releaseLease = (id: string) => db.runTransaction(async (tx) => {
    const snap = await tx.get(CONFIG());
    if (snap.get('leaseId') === id) tx.set(CONFIG(), { leaseUntil: 0 }, { merge: true });
});

type Rendered = { subject: string; preheader: string; bodyHtml: string };
const renderCache = new Map<string, Rendered>();
export const renderVariant = (campaignId: string, c: Pick<CampaignDoc, 'variants' | 'defaultLang'>, lang: Lang | undefined) => {
    const picked = variantFor(c, lang);
    const key = `${campaignId}:${picked.lang}:${picked.variant.subject}:${picked.variant.markdown.length}`;
    let r = renderCache.get(key);
    if (!r) {
        r = { subject: picked.variant.subject, preheader: picked.variant.preheader, bodyHtml: renderMarkdown(picked.variant.markdown) };
        renderCache.set(key, r);
    }
    return { lang: picked.lang, ...r };
};

/** Builds and sends one campaign mail. `test` prefixes the subject and skips list checks. */
export const sendCampaignMail = async (o: {
    campaignId: string; campaign: Pick<CampaignDoc, 'variants' | 'defaultLang'>; list: ListId; email: string; name?: string; lang?: Lang; test?: boolean;
}) => {
    const { sendEmail } = await import('../email');
    const { newsletterUnsubscribeUrl } = await import('../email-events');
    const r = renderVariant(o.campaignId, o.campaign, o.lang);
    const unsubscribeUrl = await newsletterUnsubscribeUrl(subscriberId(o.email), o.list, o.test ? undefined : o.campaignId);
    const subject = applyPlaceholders(r.subject, { name: o.name }, false);
    const html = newsletterEmailHtml({
        subject,
        preheader: r.preheader,
        bodyHtml: applyPlaceholders(r.bodyHtml, { name: o.name }),
        lang: r.lang,
        list: o.list,
        unsubscribeUrl,
    });
    return sendEmail(o.email, o.test ? `[Test] ${subject}` : subject, html, {
        type: 'newsletter',
        unsubscribeUrl,
        tags: { campaign: o.test ? 'test' : o.campaignId },
    });
};

/** Writes the recipient snapshot (queued sends) for a campaign that just started. */
const materialize = async (ref: FirebaseFirestore.DocumentReference, c: CampaignDoc) => {
    const audience = normalizeAudience(c.audience);
    let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let recipients = 0;
    for (;;) {
        let q = subscribers().where(`lists.${audience.list}.status`, '==', 'confirmed').orderBy('__name__').limit(500);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        const batch = db.batch();
        for (const doc of snap.docs) {
            const sub = doc.data() as SubscriberDoc;
            if (!matchesAudience(sub, audience)) continue;
            batch.set(ref.collection('sends').doc(doc.id), { status: 'queued', lang: sub.lang || 'en', createdAt: FieldValue.serverTimestamp() }, { merge: true });
            recipients += 1;
        }
        await batch.commit();
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 500) break;
    }
    await ref.set({ materialized: true, stats: { recipients } }, { merge: true });
    return recipients;
};

const finishIfDone = async (ref: FirebaseFirestore.DocumentReference) => {
    const queued = await ref.collection('sends').where('status', '==', 'queued').limit(1).get();
    if (!queued.empty) return false;
    // Interrupted sends (crash between claim and result) are not retried: no duplicate mails.
    const stale = await ref.collection('sends').where('status', '==', 'sending').get();
    if (!stale.empty) {
        const batch = db.batch();
        stale.docs.forEach((d) => batch.set(d.ref, { status: 'failed', error: 'interrupted' }, { merge: true }));
        await batch.commit();
        await ref.set({ stats: { failed: FieldValue.increment(stale.size) } }, { merge: true });
    }
    await ref.set({ status: 'sent', finishedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
};

export type DispatchResult = { started: number; sent: number; failed: number; skipped: number; suppressed: number; finished: number; quotaLeft: number; busy?: boolean };

/** One dispatcher run: start due campaigns, send queued mails within time budget and caps. */
export const runDispatch = async (budgetMs: number, onlyCampaignId?: string): Promise<DispatchResult> => {
    const out: DispatchResult = { started: 0, sent: 0, failed: 0, skipped: 0, suppressed: 0, finished: 0, quotaLeft: 0 };
    const lease = await acquireLease(budgetMs + 60_000);
    if (!lease) return { ...out, busy: true };
    const deadline = Date.now() + budgetMs;
    try {
        const config = (await CONFIG().get()).data() || {};
        let quota = Math.min(remainingDailyQuota(config.daily, dailyCap()), maxPerRun());
        const countSent = async (n: number) => {
            if (!n) return;
            const today = dayKey();
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(CONFIG());
                const daily = snap.get('daily') || {};
                tx.set(CONFIG(), { daily: { day: today, count: (daily.day === today ? Number(daily.count || 0) : 0) + n } }, { merge: true });
            });
        };

        // 1. Start due campaigns.
        const scheduled = await campaigns().where('status', '==', 'scheduled').get();
        for (const doc of scheduled.docs) {
            const c = doc.data() as CampaignDoc;
            if ((c.scheduledAt?.toMillis?.() ?? 0) > Date.now()) continue;
            if (onlyCampaignId && doc.id !== onlyCampaignId) continue;
            await doc.ref.set({ status: 'sending', startedAt: FieldValue.serverTimestamp() }, { merge: true });
            out.started += 1;
        }

        // 2. Send.
        const sending = await campaigns().where('status', '==', 'sending').get();
        for (const doc of sending.docs) {
            if (onlyCampaignId && doc.id !== onlyCampaignId) continue;
            const c = doc.data() as CampaignDoc;
            if (!c.materialized) await materialize(doc.ref, c);
            const audience = normalizeAudience(c.audience);
            while (quota > 0 && Date.now() < deadline) {
                const fresh = (await doc.ref.get()).get('status');
                if (fresh !== 'sending') break; // canceled meanwhile
                const batch = await doc.ref.collection('sends').where('status', '==', 'queued').limit(Math.min(quota, 25)).get();
                if (batch.empty) break;
                const stats = { sent: 0, failed: 0, skipped: 0, suppressed: 0 };
                for (const send of batch.docs) {
                    if (quota <= 0 || Date.now() >= deadline) break;
                    const sub = (await subscribers().doc(send.id).get()).data() as SubscriberDoc | undefined;
                    if (!sub || !matchesAudience(sub, { ...audience, lang: null, source: null, appUsersOnly: false })) {
                        await send.ref.set({ status: 'skipped', reason: 'not-subscribed' }, { merge: true });
                        stats.skipped += 1;
                        continue;
                    }
                    await send.ref.set({ status: 'sending', claimedAt: FieldValue.serverTimestamp() }, { merge: true });
                    try {
                        const result = await sendCampaignMail({ campaignId: doc.id, campaign: c, list: audience.list, email: sub.email, name: sub.name, lang: sub.lang });
                        const suppressed = result.transport === 'suppressed';
                        await send.ref.set({ status: suppressed ? 'suppressed' : 'sent', transport: result.transport, messageId: result.messageId || null, sentAt: FieldValue.serverTimestamp() }, { merge: true });
                        if (suppressed) stats.suppressed += 1;
                        else { stats.sent += 1; quota -= 1; }
                    } catch (error: any) {
                        await send.ref.set({ status: 'failed', error: String(error?.name || error?.message || 'error').slice(0, 200) }, { merge: true });
                        stats.failed += 1;
                        quota -= 1;
                    }
                }
                await doc.ref.set({ stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, FieldValue.increment(v)])) }, { merge: true });
                await countSent(stats.sent + stats.failed);
                out.sent += stats.sent; out.failed += stats.failed; out.skipped += stats.skipped; out.suppressed += stats.suppressed;
            }
            if (await finishIfDone(doc.ref)) out.finished += 1;
        }

        // 3. Daily housekeeping: unconfirmed subscribers after 30 days, expired tokens.
        if (!onlyCampaignId && Number(config.lastCleanupAt || 0) < Date.now() - 86_400_000) {
            const cleaned = await cleanupPending(PENDING_RETENTION_MS);
            await CONFIG().set({ lastCleanupAt: Date.now(), lastCleanup: cleaned }, { merge: true });
        }
        out.quotaLeft = quota;
        return out;
    } finally {
        await releaseLease(lease);
    }
};

export const platformNewsletterDispatch = onSchedule(
    { schedule: 'every 5 minutes', region: 'europe-west3', timeoutSeconds: 540, memory: '512MiB', maxInstances: 1, secrets: EMAIL_SECRETS, serviceAccount: FUNCTIONS_SERVICE_ACCOUNT },
    async () => {
        const result = await runDispatch(480_000);
        if (result.started || result.sent || result.failed || result.finished) console.log('platformNewsletterDispatch', JSON.stringify(result));
    },
);
