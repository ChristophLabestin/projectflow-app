import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { HandlerMap } from '../types';
import { AdminInputError, int, str, toMs } from '../types';
import { plain } from './content';
import {
    CampaignInputError, LISTS, applyPlaceholders, LIST_STATUSES, campaignReadyErrors, isList, matchesAudience, newsletterEmailHtml, normalizeAudience,
    normalizeCampaignInput, parseEmail, renderMarkdown, subscriberId, toLang, variantFor,
} from '../../platform-newsletter/logic';
import type { ListId, SubscriberDoc } from '../../platform-newsletter/logic';

/**
 * Platform newsletter + waitlist (ProjectFlow's own audience, not the customers' marketing module).
 * Contract: brain/plans/newsletter-contract.md
 */
const store = () => import('../../platform-newsletter/store');
const dispatch = () => import('../../platform-newsletter/dispatch');

const listParam = (value: unknown): ListId => {
    if (!isList(value)) throw new AdminInputError(`list must be one of ${LISTS.join(', ')}`);
    return value;
};
const idParam = (params: any) => {
    const id = str(params?.id, 80);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new AdminInputError('id fehlt');
    return id;
};

const membershipOut = (m: any) => m ? {
    status: m.status,
    source: m.source || null,
    requestedAt: toMs(m.requestedAt),
    confirmedAt: toMs(m.confirmedAt),
    unsubscribedAt: toMs(m.unsubscribedAt),
    bouncedAt: toMs(m.bouncedAt),
    consentVersion: m.consentVersion || null,
} : null;

const subscriberOut = (id: string, d: FirebaseFirestore.DocumentData) => ({
    id,
    email: d.email || '',
    name: d.name || '',
    lang: d.lang || 'en',
    source: d.source || null,
    interest: d.interest || '',
    uid: d.uid || null,
    status: d.status || 'pending',
    lists: Object.fromEntries(LISTS.map((l) => [l, membershipOut(d.lists?.[l])])),
    createdAt: toMs(d.createdAt),
    updatedAt: toMs(d.updatedAt),
});

const campaignOut = (id: string, d: FirebaseFirestore.DocumentData) => ({
    id,
    title: d.title || '',
    status: d.status || 'draft',
    defaultLang: d.defaultLang || 'de',
    variants: d.variants || {},
    audience: normalizeAudience(d.audience),
    scheduledAt: toMs(d.scheduledAt),
    startedAt: toMs(d.startedAt),
    finishedAt: toMs(d.finishedAt),
    createdAt: toMs(d.createdAt),
    updatedAt: toMs(d.updatedAt),
    createdBy: d.createdBy || null,
    stats: {
        recipients: 0, sent: 0, failed: 0, skipped: 0, suppressed: 0, unsubscribed: 0, ...(d.stats || {}),
        ses: { delivery: 0, bounce: 0, complaint: 0, reject: 0, ...(d.stats?.ses || {}) },
    },
    lastTest: d.lastTest ? { at: toMs(d.lastTest.at), emails: d.lastTest.emails || [] } : null,
});

const countAudience = async (db: FirebaseFirestore.Firestore, raw: any) => {
    const audience = normalizeAudience(raw);
    const snap = await db.collection('platform_subscribers').where(`lists.${audience.list}.status`, '==', 'confirmed').select('lists', 'lang', 'uid', 'source').get();
    const matching = snap.docs.filter((d) => matchesAudience(d.data() as SubscriberDoc, audience));
    return { audience, total: matching.length, byLang: { de: matching.filter((d) => d.get('lang') === 'de').length, en: matching.filter((d) => d.get('lang') !== 'de').length } };
};

const getCampaign = async (db: FirebaseFirestore.Firestore, id: string) => {
    const snap = await db.collection('platform_campaigns').doc(id).get();
    if (!snap.exists) throw new AdminInputError('Kampagne nicht gefunden');
    return snap;
};

export const newsletterHandlers: HandlerMap = {
    /** Counts per list and status, daily cap, latest campaigns. */
    'newsletter.overview': {
        audit: 'none',
        run: async ({ db }) => {
            const col = db.collection('platform_subscribers');
            const counts: Record<string, Record<string, number>> = {};
            await Promise.all(LISTS.flatMap((list) => LIST_STATUSES.map(async (status) => {
                const n = (await col.where(`lists.${list}.status`, '==', status).count().get()).data().count;
                (counts[list] ??= {})[status] = n;
            })));
            const confirmed = await col.where('lists.newsletter.status', '==', 'confirmed').select('uid').get();
            const appUsers = confirmed.docs.filter((d) => !!d.get('uid')).length;
            const recent = await db.collection('platform_campaigns').orderBy('updatedAt', 'desc').limit(5).get();
            const config = (await db.collection('admin_config').doc('newsletter').get()).data() || {};
            const { dailyCap } = await dispatch();
            return {
                counts,
                appUsers,
                total: (await col.count().get()).data().count,
                daily: { cap: dailyCap(), day: config.daily?.day || null, sent: config.daily?.count || 0 },
                recentCampaigns: recent.docs.map((d) => campaignOut(d.id, d.data())),
            };
        },
    },

    /** Subscribers, newest first (in memory; fine up to a few thousand). Personal data → audited read. */
    'newsletter.subscribers.list': {
        audit: 'read',
        target: (p) => `platform_subscribers?list=${str(p?.list, 20) || '*'}&status=${str(p?.status, 20) || '*'}`,
        run: async ({ db }, params) => {
            const limit = int(params?.limit, 500, 1, 5000);
            const query = str(params?.query, 320).toLowerCase();
            let q: FirebaseFirestore.Query = db.collection('platform_subscribers');
            const list = params?.list ? listParam(params.list) : null;
            const status = str(params?.status, 20);
            if (status && !LIST_STATUSES.includes(status as any)) throw new AdminInputError('invalid status');
            if (list && status) q = q.where(`lists.${list}.status`, '==', status);
            else if (list) q = q.where(`lists.${list}.status`, 'in', [...LIST_STATUSES]);
            else if (status) q = q.where('status', '==', status);
            const snap = await q.limit(5000).get();
            let items = snap.docs.map((d) => subscriberOut(d.id, d.data()));
            if (query) items = items.filter((i) => i.email.includes(query) || i.name.toLowerCase().includes(query));
            items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return { items: items.slice(0, limit), total: items.length };
        },
    },
    'newsletter.subscribers.get': {
        audit: 'read',
        target: (p) => `platform_subscribers/${str(p?.id, 80)}`,
        run: async ({ db }, params) => {
            const id = idParam(params);
            const ref = db.collection('platform_subscribers').doc(id);
            const snap = await ref.get();
            if (!snap.exists) throw new AdminInputError('Abonnent nicht gefunden');
            const log = await ref.collection('consent_log').orderBy('at', 'desc').limit(100).get();
            return {
                subscriber: subscriberOut(id, snap.data()!),
                consentLog: log.docs.map((d) => ({ id: d.id, ...plain(d.data()), at: toMs(d.get('at')) })),
            };
        },
    },
    /** Adds an address as pending and sends the double-opt-in mail (admins never confirm on someone's behalf). */
    'newsletter.subscribers.add': {
        audit: 'mutation',
        target: (p) => `platform_subscribers/${parseEmail(p?.email) ? subscriberId(parseEmail(p?.email)!) : '?'}`,
        summary: (p) => `${str(p?.list, 20)} (DOI-Mail)`,
        run: async ({ email: adminEmail, ip }, params) => {
            const email = parseEmail(params?.email);
            if (!email) throw new AdminInputError('valid email required');
            const list = listParam(params?.list);
            const lang = toLang(params?.lang);
            const { requestOptin, sendOptinMail } = await store();
            const out = await requestOptin({ email, list, lang, source: 'admin', name: str(params?.name, 120), evidence: { ip, by: adminEmail } });
            if (out.token) await sendOptinMail(email, list, lang, out.token, process.env.NEWSLETTER_SITE_URL || undefined);
            return { id: out.id, status: out.already ? 'confirmed' : 'pending', mailSent: !!out.token };
        },
    },
    /** Re-sends the opt-in mail for a pending (or unsubscribed/expired) membership. */
    'newsletter.subscribers.resendOptin': {
        audit: 'mutation',
        target: (p) => `platform_subscribers/${str(p?.id, 80)}`,
        run: async ({ db, email: adminEmail, ip }, params) => {
            const id = idParam(params);
            const list = listParam(params?.list);
            const snap = await db.collection('platform_subscribers').doc(id).get();
            const d = snap.data() as SubscriberDoc | undefined;
            if (!d) throw new AdminInputError('Abonnent nicht gefunden');
            const { requestOptin, sendOptinMail } = await store();
            const lang = toLang(d.lang);
            const out = await requestOptin({ email: d.email, list, lang, source: 'admin', evidence: { ip, by: adminEmail } });
            if (out.token) await sendOptinMail(d.email, list, lang, out.token, process.env.NEWSLETTER_SITE_URL || undefined);
            return { status: out.already ? 'confirmed' : 'pending', mailSent: !!out.token };
        },
    },
    'newsletter.subscribers.unsubscribe': {
        audit: 'mutation',
        target: (p) => `platform_subscribers/${str(p?.id, 80)}`,
        summary: (p) => `${str(p?.list, 20)} abgemeldet${str(p?.note, 100) ? `: ${str(p?.note, 100)}` : ''}`,
        run: async ({ email: adminEmail, ip }, params) => {
            const id = idParam(params);
            const list = listParam(params?.list);
            const { unsubscribe } = await store();
            if (!(await unsubscribe(id, list, { via: 'admin', ip, by: adminEmail }))) throw new AdminInputError('Abonnent/Liste nicht gefunden');
            return { ok: true };
        },
    },
    /** GDPR erasure: subscriber + consent log + tokens. Optional `suppress` keeps the address blocked for all mail. */
    'newsletter.subscribers.delete': {
        audit: 'mutation',
        target: (p) => `platform_subscribers/${str(p?.id, 80)}`,
        summary: (p) => (p?.suppress ? 'gelöscht + gesperrt' : 'gelöscht (DSGVO)'),
        run: async ({ db, email: adminEmail }, params) => {
            const id = idParam(params);
            const snap = await db.collection('platform_subscribers').doc(id).get();
            if (!snap.exists) throw new AdminInputError('Abonnent nicht gefunden');
            const email = String(snap.get('email') || '');
            const { deleteSubscriber } = await store();
            await deleteSubscriber(id);
            if (params?.suppress === true && email) {
                const { setSuppression } = await import('../../email-events');
                await setSuppression(email, { active: true, reason: 'manual', detail: 'newsletter erasure + block', source: 'admin', by: adminEmail || undefined });
            }
            return { ok: true };
        },
    },
    /** Rows for CSV export (confirmed members of one list by default). */
    'newsletter.subscribers.export': {
        audit: 'read',
        target: (p) => `platform_subscribers?export=${str(p?.list, 20)}`,
        run: async ({ db }, params) => {
            const list = listParam(params?.list);
            const status = str(params?.status, 20) || 'confirmed';
            const snap = await db.collection('platform_subscribers').where(`lists.${list}.status`, '==', status).limit(20000).get();
            return {
                rows: snap.docs.map((d) => {
                    const s = subscriberOut(d.id, d.data());
                    const m = s.lists[list];
                    return { email: s.email, name: s.name, lang: s.lang, source: m?.source || s.source, status: m?.status, confirmedAt: m?.confirmedAt || null, appUser: !!s.uid };
                }),
            };
        },
    },

    /** Matching recipients for an audience (preview before scheduling). */
    'newsletter.audience.count': {
        audit: 'none',
        run: async ({ db }, params) => countAudience(db, params?.audience),
    },

    'newsletter.campaigns.list': {
        audit: 'none',
        run: async ({ db }, params) => {
            const limit = int(params?.limit, 100, 1, 500);
            const snap = await db.collection('platform_campaigns').orderBy('updatedAt', 'desc').limit(limit).get();
            return { items: snap.docs.map((d) => campaignOut(d.id, d.data())) };
        },
    },
    'newsletter.campaigns.get': {
        audit: 'none',
        run: async ({ db }, params) => {
            const snap = await getCampaign(db, idParam(params));
            const sends = await snap.ref.collection('sends').where('status', 'in', ['failed', 'suppressed']).limit(200).get();
            return { campaign: campaignOut(snap.id, snap.data()!), problems: sends.docs.map((d) => ({ subscriberId: d.id, status: d.get('status'), error: d.get('error') || null })) };
        },
    },
    /** Creates (no id) or updates a draft. */
    'newsletter.campaigns.save': {
        audit: 'mutation',
        target: (p) => `platform_campaigns/${str(p?.id, 80) || 'neu'}`,
        summary: (p) => str(p?.title, 80),
        run: async ({ db, email: adminEmail }, params) => {
            let input;
            try { input = normalizeCampaignInput(params); } catch (error: any) {
                if (error instanceof CampaignInputError) throw new AdminInputError(error.message);
                throw error;
            }
            const id = params?.id ? idParam(params) : null;
            const data = { ...input, updatedAt: FieldValue.serverTimestamp() };
            if (id) {
                const ref = db.collection('platform_campaigns').doc(id);
                await db.runTransaction(async (tx) => {
                    const snap = await tx.get(ref);
                    if (!snap.exists) throw new AdminInputError('Kampagne nicht gefunden');
                    if (snap.get('status') !== 'draft') throw new AdminInputError('Nur Entwürfe können bearbeitet werden');
                    // update() replaces the variants/audience maps as a whole.
                    tx.update(ref, data);
                });
                return { id };
            }
            const ref = await db.collection('platform_campaigns').add({ ...data, status: 'draft', createdAt: FieldValue.serverTimestamp(), createdBy: adminEmail || null, stats: {} });
            return { id: ref.id };
        },
    },
    'newsletter.campaigns.delete': {
        audit: 'mutation',
        target: (p) => `platform_campaigns/${str(p?.id, 80)}`,
        run: async ({ db }, params) => {
            const snap = await getCampaign(db, idParam(params));
            if (!['draft', 'canceled'].includes(snap.get('status'))) throw new AdminInputError('Nur Entwürfe oder abgebrochene Kampagnen löschen');
            const sends = await snap.ref.collection('sends').limit(5000).get();
            for (let i = 0; i < sends.docs.length; i += 400) {
                const batch = db.batch();
                sends.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
            await snap.ref.delete();
            return { ok: true };
        },
    },
    /** Rendered HTML of one language variant (preview pane). */
    'newsletter.campaigns.preview': {
        audit: 'none',
        run: async ({ db }, params) => {
            const raw = params?.id ? (await getCampaign(db, idParam(params))).data() : params?.campaign;
            let c;
            try { c = normalizeCampaignInput(raw); } catch (error: any) { throw new AdminInputError(error.message); }
            const { lang, variant } = variantFor(c, toLang(params?.lang));
            // Placeholders like in the real send: `sampleName`, else the {{name|Fallback}} fallback.
            const vars = { name: str(params?.sampleName, 120) };
            const subject = applyPlaceholders(variant.subject, vars, false);
            return {
                lang,
                subject,
                html: newsletterEmailHtml({ subject, preheader: variant.preheader, bodyHtml: applyPlaceholders(renderMarkdown(variant.markdown), vars), lang, list: c.audience.list, unsubscribeUrl: '#' }),
            };
        },
    },
    /** Test mail ("[Test] …") to up to 5 addresses; list membership is not required. */
    'newsletter.campaigns.test': {
        audit: 'mutation',
        target: (p) => `platform_campaigns/${str(p?.id, 80)}`,
        summary: (p) => (Array.isArray(p?.emails) ? p.emails.slice(0, 5).join(', ') : ''),
        run: async ({ db }, params) => {
            const snap = await getCampaign(db, idParam(params));
            const emails = (Array.isArray(params?.emails) ? params.emails : [params?.email]).map(parseEmail).filter(Boolean) as string[];
            if (!emails.length || emails.length > 5) throw new AdminInputError('1–5 gültige Adressen');
            let c;
            try { c = normalizeCampaignInput(snap.data()); } catch (error: any) { throw new AdminInputError(error.message); }
            const { sendCampaignMail } = await dispatch();
            const langs = params?.lang ? [toLang(params.lang)] : (Object.keys(c.variants) as ('de' | 'en')[]);
            const results = [];
            for (const email of emails) {
                for (const lang of langs) {
                    const r = await sendCampaignMail({ campaignId: snap.id, campaign: c, list: c.audience.list, email, lang, test: true });
                    results.push({ email, lang, transport: r.transport, messageId: r.messageId || null });
                }
            }
            await snap.ref.set({ lastTest: { at: FieldValue.serverTimestamp(), emails } }, { merge: true });
            return { results };
        },
    },
    /** Schedules a draft: `at` (ms) in the future, or now. "Now" sends the first batch inline (≤ 90 s). */
    'newsletter.campaigns.schedule': {
        audit: 'mutation',
        target: (p) => `platform_campaigns/${str(p?.id, 80)}`,
        summary: (p) => (p?.at ? `geplant ${new Date(Number(p.at)).toISOString()}` : 'jetzt senden'),
        run: async ({ db, email: adminEmail }, params) => {
            const snap = await getCampaign(db, idParam(params));
            if (snap.get('status') !== 'draft') throw new AdminInputError('Nur Entwürfe können geplant werden');
            let c;
            try { c = normalizeCampaignInput(snap.data()); } catch (error: any) { throw new AdminInputError(error.message); }
            const errors = campaignReadyErrors(c);
            if (errors.length) throw new AdminInputError(`Nicht versandbereit: ${errors.join('; ')}`);
            const at = params?.at ? Number(params.at) : Date.now();
            if (!Number.isFinite(at) || at < Date.now() - 60_000 || at > Date.now() + 365 * 86_400_000) throw new AdminInputError('Zeitpunkt ungültig');
            const { total } = await countAudience(db, c.audience);
            if (!total) throw new AdminInputError('Zielgruppe ist leer');
            await snap.ref.set({ status: 'scheduled', scheduledAt: Timestamp.fromMillis(at), scheduledBy: adminEmail || null, materialized: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            if (at > Date.now() + 5_000 || params?.inline === false) return { status: 'scheduled', recipients: total };
            const { runDispatch } = await dispatch();
            const run = await runDispatch(90_000, snap.id);
            const status = (await snap.ref.get()).get('status');
            return { status, recipients: total, run };
        },
    },
    /** Back to draft (only before sending started). */
    'newsletter.campaigns.unschedule': {
        audit: 'mutation',
        target: (p) => `platform_campaigns/${str(p?.id, 80)}`,
        run: async ({ db }, params) => {
            const ref = db.collection('platform_campaigns').doc(idParam(params));
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (snap.get('status') !== 'scheduled') throw new AdminInputError('Nur geplante Kampagnen');
                tx.set(ref, { status: 'draft', scheduledAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            });
            return { ok: true };
        },
    },
    /** Stops a scheduled or running campaign; queued mails are not sent. */
    'newsletter.campaigns.cancel': {
        audit: 'mutation',
        target: (p) => `platform_campaigns/${str(p?.id, 80)}`,
        run: async ({ db }, params) => {
            const ref = db.collection('platform_campaigns').doc(idParam(params));
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (!['scheduled', 'sending'].includes(snap.get('status'))) throw new AdminInputError('Nur geplante oder laufende Kampagnen');
                tx.set(ref, { status: 'canceled', finishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            });
            return { ok: true };
        },
    },
    /** Runs the dispatcher now (otherwise every 5 minutes). */
    'newsletter.dispatch.run': {
        audit: 'mutation',
        target: () => 'platform_campaigns',
        run: async () => (await dispatch()).runDispatch(90_000),
    },

    /**
     * One-time import of the old landing collections (confirmed entries only) as `source: 'legacy'`.
     * There is no IP proof for those consents; the log entry says so. `dryRun: true` only counts.
     */
    'newsletter.migrateLegacy': {
        audit: 'mutation',
        target: () => 'platform_subscribers (legacy import)',
        summary: (p) => (p?.dryRun ? 'Probelauf' : 'Import'),
        run: async ({ db, email: adminEmail }, params) => {
            const dryRun = params?.dryRun !== false;
            const sources: { col: string; list: ListId; confirmed: (d: any) => boolean; at: (d: any) => unknown }[] = [
                { col: 'newsletter_subscribers', list: 'newsletter', confirmed: (d) => d.status === 'active' || d.status === 'confirmed', at: (d) => d.subscribedAt },
                { col: 'waitlist', list: 'waitlist', confirmed: (d) => d.email_confirmed === true, at: (d) => d.confirmed_at || d.updated_at },
            ];
            const result: Record<string, { found: number; imported: number; skipped: number }> = {};
            for (const s of sources) {
                const snap = await db.collection(s.col).limit(5000).get();
                const r = (result[s.col] = { found: snap.size, imported: 0, skipped: 0 });
                for (const doc of snap.docs) {
                    const d = doc.data();
                    const email = parseEmail(d.email || doc.id);
                    if (!email || !s.confirmed(d)) { r.skipped += 1; continue; }
                    const ref = db.collection('platform_subscribers').doc(subscriberId(email));
                    const existing = (await ref.get()).data() as SubscriberDoc | undefined;
                    if (existing?.lists?.[s.list]) { r.skipped += 1; continue; }
                    r.imported += 1;
                    if (dryRun) continue;
                    const lists = { ...(existing?.lists || {}), [s.list]: { status: 'confirmed', source: 'legacy', confirmedAt: s.at(d) ?? FieldValue.serverTimestamp(), consentVersion: 'legacy' } };
                    await ref.set({
                        email, lang: existing?.lang || 'de', ...(d.name ? { name: String(d.name).slice(0, 120) } : {}),
                        ...(existing ? {} : { createdAt: FieldValue.serverTimestamp(), source: 'legacy' }),
                        lists, status: 'confirmed', updatedAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
                    await ref.collection('consent_log').add({ list: s.list, action: 'imported', at: FieldValue.serverTimestamp(), by: adminEmail || null, from: `${s.col}/${doc.id}`, note: 'Double-Opt-in der alten Landingpage, ohne IP-Nachweis' });
                }
            }
            return { dryRun, result };
        },
    },
};
