import { FieldValue } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import type { HandlerMap } from '../types';
import { AdminInputError, int, str, toMs } from '../types';
import { dayKeys } from './crashes';
import { listDirectory } from './directory';

const PROJECT = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'projectflow-labestin';
const REGION = 'europe-west3';
const HOSTING_SITES = ['projectflow-labestin', 'projectflow-admin', 'getprojectflow'];
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/** Same env-driven limits as functions/src/ai-service.ts (read-only display). */
export const AI_LIMITS = {
    dailyText: Number(process.env.AI_DAILY_TEXT_LIMIT) || 200,
    dailyImage: Number(process.env.AI_DAILY_IMAGE_LIMIT) || 30,
    monthlyTokens: Number(process.env.AI_MONTHLY_TOKEN_LIMIT) || 1_000_000,
    monthlyImages: Number(process.env.AI_MONTHLY_IMAGE_LIMIT) || 50,
};

/** Console-only settings (`admin_config/console`, no client access): cost estimate inputs. */
export const DEFAULT_PRICING = { usdPerMTokens: 0.9, usdPerImage: 0.011 };
export const loadPricing = async (db: FirebaseFirestore.Firestore) => {
    const snap = await db.collection('admin_config').doc('console').get();
    const p = snap.get('pricing') || {};
    return {
        usdPerMTokens: Number.isFinite(p.usdPerMTokens) ? p.usdPerMTokens : DEFAULT_PRICING.usdPerMTokens,
        usdPerImage: Number.isFinite(p.usdPerImage) ? p.usdPerImage : DEFAULT_PRICING.usdPerImage,
    };
};

let googleAuth: GoogleAuth | null = null;
const gcp = async <T>(url: string): Promise<T | null> => {
    if (isEmulator) return null;
    try {
        googleAuth ??= new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await googleAuth.getClient();
        const res = await client.request<T>({ url });
        return res.data;
    } catch (error) {
        console.warn('adminApi gcp request failed', url, (error as Error).message);
        return null;
    }
};

export const opsHandlers: HandlerMap = {
    'ai.overview': {
        audit: 'none',
        run: async ({ db }, params) => {
            const days = int(params?.days, 30, 7, 90);
            const keys = dayKeys(days);
            const index = new Map(keys.map((k, i) => [k, i]));
            const month = new Date().toISOString().slice(0, 7);
            const [daily, monthly, users, pricing, profiles] = await Promise.all([
                db.collection('ai_usage_quotas').where('day', '>=', keys[0]).get(),
                db.collection('ai_usage_quotas').where('month', '==', month).get(),
                listDirectory(),
                loadPricing(db),
                db.collection('users').select('lastTenantId').get(),
            ]);
            const lastTenant = new Map(profiles.docs.map((d) => [d.id, d.get('lastTenantId') || null]));
            const byUser = new Map<string, { text: number; image: number; monthTokens: number; monthImages: number; series: number[]; peakDay: number }>();
            const entry = (uid: string) => {
                let e = byUser.get(uid);
                if (!e) { e = { text: 0, image: 0, monthTokens: 0, monthImages: 0, series: keys.map(() => 0), peakDay: 0 }; byUser.set(uid, e); }
                return e;
            };
            const text = keys.map(() => 0);
            const images = keys.map(() => 0);
            daily.forEach((d) => {
                const i = index.get(d.get('day'));
                if (i === undefined) return;
                const e = entry(d.get('uid'));
                const t = Number(d.get('text') || 0);
                const im = Number(d.get('image') || 0);
                e.text += t; e.image += im; e.series[i] += t; e.peakDay = Math.max(e.peakDay, t);
                text[i] += t; images[i] += im;
            });
            monthly.forEach((d) => { const e = entry(d.get('uid')); e.monthTokens += Number(d.get('tokens') || 0); e.monthImages += Number(d.get('images') || 0); });
            const emailOf = new Map(users.map((u) => [u.uid, u.email]));
            const tenantIds = Array.from(new Set(Array.from(byUser.keys()).map((uid) => lastTenant.get(uid)).filter(Boolean) as string[]));
            const tenants = tenantIds.length ? await db.getAll(...tenantIds.map((t) => db.collection('tenants').doc(t))) : [];
            const tenantName = new Map(tenants.map((t) => [t.id, t.get('name') || t.id]));
            const rows = Array.from(byUser.entries()).map(([uid, e]) => {
                const tenantId = lastTenant.get(uid) || null;
                return {
                    uid, email: emailOf.get(uid) || uid, tenantId, tenantName: tenantId ? tenantName.get(tenantId) || tenantId : null, ...e,
                    costUsd: (e.monthTokens / 1_000_000) * pricing.usdPerMTokens + e.monthImages * pricing.usdPerImage,
                    tokenShare: e.monthTokens / AI_LIMITS.monthlyTokens,
                };
            });
            const byWorkspace = new Map<string, { tenantId: string; name: string; users: number; monthTokens: number; monthImages: number; costUsd: number; text: number }>();
            rows.forEach((r) => {
                const key = r.tenantId || '–';
                const w = byWorkspace.get(key) ?? { tenantId: key, name: r.tenantName || '(kein Workspace)', users: 0, monthTokens: 0, monthImages: 0, costUsd: 0, text: 0 };
                w.users += 1; w.monthTokens += r.monthTokens; w.monthImages += r.monthImages; w.costUsd += r.costUsd; w.text += r.text;
                byWorkspace.set(key, w);
            });
            const monthTokens = rows.reduce((a, r) => a + r.monthTokens, 0);
            const monthImages = rows.reduce((a, r) => a + r.monthImages, 0);
            return {
                days: keys, text, images, users: rows, workspaces: Array.from(byWorkspace.values()), limits: AI_LIMITS, pricing,
                month: { tokens: monthTokens, images: monthImages, costUsd: (monthTokens / 1_000_000) * pricing.usdPerMTokens + monthImages * pricing.usdPerImage },
            };
        },
    },

    'ai.grants': {
        audit: 'none',
        run: async ({ db }) => {
            const [grants, users] = await Promise.all([db.collection('ai_grants').orderBy('createdAt', 'desc').limit(1000).get(), listDirectory()]);
            const emailOf = new Map(users.map((u) => [u.uid, u.email]));
            const tenantIds = Array.from(new Set(grants.docs.map((d) => d.get('tenantId')).filter(Boolean)));
            const tenants = tenantIds.length ? await db.getAll(...tenantIds.map((t) => db.collection('tenants').doc(t))) : [];
            const tenantName = new Map(tenants.map((t) => [t.id, t.get('name') || t.id]));
            return {
                grants: grants.docs.map((d) => ({
                    id: d.id, uid: d.get('uid'), email: emailOf.get(d.get('uid')) || d.get('uid'), tenantId: d.get('tenantId'), tenantName: tenantName.get(d.get('tenantId')) || d.get('tenantId'),
                    kind: d.get('kind') || 'oauth', clientName: d.get('clientName') || '', clientDocId: d.get('clientDocId') || null, scopes: d.get('scopes') || [], tokenPrefix: d.get('tokenPrefix') || null,
                    createdAt: toMs(d.get('createdAt')), lastUsedAt: toMs(d.get('lastUsedAt')), revokedAt: toMs(d.get('revokedAt')), expiresAt: toMs(d.get('tokenExpiresAt')),
                })),
            };
        },
    },

    'ai.clients': {
        audit: 'none',
        run: async ({ db }) => {
            const [clients, grants] = await Promise.all([db.collection('oauth_clients').limit(500).get(), db.collection('ai_grants').where('revokedAt', '==', null).select('clientDocId').get()]);
            const active = new Map<string, number>();
            grants.forEach((g) => { const c = g.get('clientDocId'); if (c) active.set(c, (active.get(c) || 0) + 1); });
            return {
                clients: clients.docs.map((d) => ({
                    id: d.id, name: d.get('name') || d.get('clientName') || d.get('clientId') || d.id, clientId: d.get('clientId') || d.id, source: d.get('source') || (d.id.startsWith('cimd_') ? 'cimd' : 'dcr'),
                    verified: d.get('verified') === true, redirectUris: d.get('redirectUris') || [], clientUri: d.get('clientUri') || null, logoUri: d.get('logoUri') || null,
                    createdAt: toMs(d.get('createdAt')) ?? toMs(d.get('fetchedAt')), activeGrants: active.get(d.id) || 0,
                })),
            };
        },
    },

    // API/MCP request log across workspaces (tenants/{id}/ai_audit, 180-day TTL).
    'ai.audit': {
        audit: 'none',
        run: async ({ db }, params) => {
            const tenantId = str(params?.tenantId, 128);
            const limit = int(params?.limit, 200, 1, 1000);
            const query = tenantId
                ? db.collection('tenants').doc(tenantId).collection('ai_audit').orderBy('createdAt', 'desc').limit(limit)
                : db.collectionGroup('ai_audit').orderBy('createdAt', 'desc').limit(limit);
            const snap = await query.get();
            return {
                entries: snap.docs.map((d) => ({
                    id: d.id, tenantId: d.ref.parent.parent?.id || '', kind: d.get('kind') || '', actorId: d.get('actorId') || '', credentialLabel: d.get('credentialLabel') || '',
                    clientName: d.get('clientName') || '', permission: d.get('permission') || '', method: d.get('method') || '', path: d.get('path') || '', status: d.get('status') ?? null, createdAt: toMs(d.get('createdAt')),
                })),
            };
        },
    },

    'system.status': {
        audit: 'none',
        run: async ({ db }) => {
            const [jobs, functionsList, releases, pricing, insights, mailJobs] = await Promise.all([
                gcp<{ jobs?: any[] }>(`https://cloudscheduler.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/jobs`),
                gcp<{ functions?: any[] }>(`https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/-/functions?pageSize=500`),
                Promise.all(HOSTING_SITES.map(async (site) => ({ site, data: await gcp<{ releases?: any[] }>(`https://firebasehosting.googleapis.com/v1beta1/sites/${site}/channels/live/releases?pageSize=5`) }))),
                loadPricing(db),
                db.collectionGroup('insights_daily').orderBy('computedAt', 'desc').limit(1).get().catch(() => null),
                db.collection('legal_mail_jobs').where('open', '==', true).get(),
            ]);
            return {
                available: !isEmulator,
                scheduler: (jobs?.jobs || []).map((j) => ({
                    name: String(j.name).split('/').pop(), schedule: j.schedule, timeZone: j.timeZone, state: j.state,
                    lastAttemptTime: j.lastAttemptTime ? Date.parse(j.lastAttemptTime) : null, statusCode: j.status?.code ?? 0, statusMessage: j.status?.message || null,
                    nextRun: j.scheduleTime ? Date.parse(j.scheduleTime) : null,
                })),
                functions: (functionsList?.functions || []).map((f) => ({
                    name: String(f.name).split('/').pop(), region: String(f.name).split('/')[3], state: f.state, environment: f.environment, runtime: f.buildConfig?.runtime || null,
                    updateTime: f.updateTime ? Date.parse(f.updateTime) : null, trigger: f.eventTrigger ? (f.eventTrigger.eventType || 'event') : 'https',
                })),
                hosting: releases.map(({ site, data }) => ({
                    site,
                    releases: (data?.releases || []).map((r) => ({ time: Date.parse(r.releaseTime), type: r.type, user: r.releaseUser?.email || null, message: r.message || null, files: Number(r.version?.fileCount || 0) })),
                })),
                pricing,
                limits: AI_LIMITS,
                signals: {
                    insightsComputedAt: insights?.docs[0] ? toMs(insights.docs[0].get('computedAt')) : null,
                    openLegalMailJobs: mailJobs.docs.map((d) => ({ id: d.id, status: d.get('status'), counts: d.get('counts') || null, sendAfter: toMs(d.get('sendAfter')) })),
                },
            };
        },
    },

    'system.setPricing': {
        audit: 'mutation',
        target: () => 'admin_config/console.pricing',
        summary: (p) => `${p?.usdPerMTokens} USD/1M Tokens, ${p?.usdPerImage} USD/Bild`,
        run: async ({ db, uid }, params) => {
            const usdPerMTokens = Number(params?.usdPerMTokens);
            const usdPerImage = Number(params?.usdPerImage);
            if (!(usdPerMTokens >= 0 && usdPerMTokens < 1000) || !(usdPerImage >= 0 && usdPerImage < 10)) throw new AdminInputError('Preise ungültig');
            await db.collection('admin_config').doc('console').set({ pricing: { usdPerMTokens, usdPerImage }, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
            return { ok: true };
        },
    },
};

