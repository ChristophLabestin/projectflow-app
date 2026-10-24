import type { HandlerMap } from '../types';
import { AdminInputError, int, str, toMs } from '../types';
import { normalizeEmail } from '../../email-logic';

const DAY = 86_400_000;

const suppressionOut = (id: string, d: FirebaseFirestore.DocumentData) => ({
    id,
    email: d.email || '',
    active: d.active === true,
    reason: d.reason || 'bounce',
    detail: d.detail || '',
    source: d.source || 'ses',
    mailType: d.mailType || null,
    events: Number(d.events || 0),
    softBounces: Array.isArray(d.softBounces) ? d.softBounces.length : 0,
    by: d.by || null,
    createdAt: toMs(d.createdAt),
    updatedAt: toMs(d.updatedAt),
});

const emailParam = (params: any) => {
    const email = normalizeEmail(str(params?.email, 320));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminInputError('valid email required');
    return email;
};

/** Mail delivery (SES): suppression list + daily event counters. Runbook: brain/operations/email-ses.md */
export const emailHandlers: HandlerMap = {
    /** Suppressions, newest first; `active: false` entries are removed ones or soft bounces below the limit. */
    'email.suppressions.list': {
        audit: 'none',
        run: async ({ db }, params) => {
            const limit = int(params?.limit, 200, 1, 1000);
            const query = str(params?.query, 320).toLowerCase();
            const snap = await db.collection('email_suppressions').orderBy('updatedAt', 'desc').limit(limit).get();
            const items = snap.docs.map((doc) => suppressionOut(doc.id, doc.data()));
            return { items: query ? items.filter((i) => i.email.includes(query)) : items };
        },
    },
    /** Lifts a suppression (Firestore + SES account list). Only after the recipient confirmed the address works. */
    'email.suppressions.remove': {
        audit: 'mutation',
        target: (params) => `email:${normalizeEmail(str(params?.email, 320))}`,
        run: async ({ email: adminEmail }, params) => {
            const email = emailParam(params);
            const { setSuppression } = await import('../../email-events');
            const { syncSesAccountSuppression } = await import('../../email');
            await setSuppression(email, { active: false, reason: 'manual', detail: str(params?.note, 300) || 'removed in admin console', source: 'admin', by: adminEmail || undefined });
            return { ok: true, ses: await syncSesAccountSuppression(email, false) };
        },
    },
    /** Blocks an address manually (e.g. a recipient asked to never be mailed). */
    'email.suppressions.add': {
        audit: 'mutation',
        target: (params) => `email:${normalizeEmail(str(params?.email, 320))}`,
        run: async ({ email: adminEmail }, params) => {
            const email = emailParam(params);
            const { setSuppression } = await import('../../email-events');
            const { syncSesAccountSuppression } = await import('../../email');
            await setSuppression(email, { active: true, reason: 'manual', detail: str(params?.note, 300) || 'added in admin console', source: 'admin', by: adminEmail || undefined });
            return { ok: true, ses: await syncSesAccountSuppression(email, true) };
        },
    },
    /** Sends a test mail, e.g. to the SES mailbox simulator (bounce@ / complaint@ / success@simulator.amazonses.com). */
    'email.test': {
        audit: 'mutation',
        target: (params) => `email:${normalizeEmail(str(params?.email, 320))}`,
        run: async (_ctx, params) => {
            const email = emailParam(params);
            const { sendEmail, getSystemEmailTemplate } = await import('../../email');
            const html = getSystemEmailTemplate('ProjectFlow test mail', 'Test of the ProjectFlow mail delivery (SES).', 'https://app.getprojectflow.com/', 'Open ProjectFlow', 'en');
            return sendEmail(email, 'ProjectFlow test mail', html, { type: 'system' });
        },
    },
    /** SES events per day (send, delivery, bounce, complaint, reject, …) with rates over the window. */
    'email.stats': {
        audit: 'none',
        run: async ({ db }, params) => {
            const days = int(params?.days, 14, 1, 90);
            const since = new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10);
            const snap = await db.collection('email_stats').where('day', '>=', since).orderBy('day', 'asc').get();
            const series = snap.docs.map((doc) => ({ day: doc.get('day'), counts: doc.get('counts') || {}, byType: doc.get('byType') || {} }));
            const sum = (key: string) => series.reduce((n, d) => n + Number(d.counts[key] || 0), 0);
            const sent = sum('send') || sum('delivery') + sum('bounce');
            return {
                days: series,
                totals: { send: sum('send'), delivery: sum('delivery'), bounce: sum('bounce'), complaint: sum('complaint'), reject: sum('reject') },
                // SES reviews accounts above 5 % bounces / 0.1 % complaints (pause at 10 % / 0.5 %).
                bounceRate: sent ? sum('bounce') / sent : 0,
                complaintRate: sent ? sum('complaint') / sent : 0,
            };
        },
    },
};
