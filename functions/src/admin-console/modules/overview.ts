import { Timestamp } from 'firebase-admin/firestore';
import type { HandlerMap } from '../types';
import { int, toMs } from '../types';
import { dayKeys } from './crashes';
import { listDirectory, reviewTenantIds } from './directory';
import { loadPricing } from './ops';
import { loadBilling } from './billing';

const DAY = 86_400_000;

const bucket = (keys: string[]) => {
    const index = new Map(keys.map((k, i) => [k, i]));
    return (values: number[], at: number | null, by = 1) => {
        if (!at) return;
        const i = index.get(new Date(at).toISOString().slice(0, 10));
        if (i !== undefined) values[i] += by;
    };
};

let cache: { key: string; at: number; value: unknown } | null = null;

export const overviewHandlers: HandlerMap = {
    'overview.get': {
        audit: 'none',
        run: async ({ db }, params) => {
            const days = int(params?.days, 30, 7, 90);
            const cacheKey = String(days);
            if (!params?.fresh && cache && cache.key === cacheKey && Date.now() - cache.at < 120_000) return cache.value;

            const now = Date.now();
            const keys = dayKeys(days, now);
            const add = bucket(keys);
            const since = Timestamp.fromMillis(now - days * DAY);
            const month = new Date(now).toISOString().slice(0, 7);

            const [pricing, reviewTenants] = await Promise.all([loadPricing(db), reviewTenantIds(db)]);
            const [allUsers, tenantsCount, newTenants, projectsCount, tasksCount, activity, crashEvents, aiDaily, aiMonthly, grants, devices, acceptances, termsIndex] = await Promise.all([
                listDirectory(),
                db.collection('tenants').count().get(),
                db.collection('tenants').where('createdAt', '>=', since).select('createdAt').get(),
                db.collectionGroup('projects').count().get(),
                db.collectionGroup('tasks').count().get(),
                db.collectionGroup('activity').where('createdAt', '>=', since).select('createdAt', 'actorId').get(),
                db.collectionGroup('crashEvents').where('receivedAt', '>=', since).select('receivedAt', 'platform').get(),
                db.collection('ai_usage_quotas').where('day', '>=', keys[0]).select('day', 'text', 'image', 'uid').get(),
                db.collection('ai_usage_quotas').where('month', '==', month).select('tokens', 'images', 'uid').get(),
                db.collection('ai_grants').where('revokedAt', '==', null).select('kind', 'clientName', 'tenantId', 'lastUsedAt').get(),
                db.collectionGroup('devices').select('platform', 'appVersion', 'updatedAt').get(),
                db.collection('legal_acceptances').select('docs').get(),
                db.collection('legal_documents').doc('terms').get(),
            ]);

            // The App Review demo account (and its workspace) never counts.
            const reviewUids = new Set(allUsers.filter((u) => u.reviewAccount).map((u) => u.uid));
            const users = allUsers.filter((u) => !u.reviewAccount);
            const tenantOf = (ref: FirebaseFirestore.DocumentReference) => ref.path.split('/')[1];
            const reviewList = Array.from(reviewTenants);
            const [reviewProjects, reviewTasks] = reviewList.length ? await Promise.all([
                Promise.all(reviewList.map((t) => db.collection('tenants').doc(t).collection('projects').count().get().then((c) => c.data().count))),
                db.collectionGroup('tasks').where('tenantId', 'in', reviewList.slice(0, 30)).count().get().then((c) => c.data().count).catch(() => 0),
            ]) : [[0], 0];

            // Users: signups + "last active" (Auth refresh time) windows.
            const signups = keys.map(() => 0);
            users.forEach((u) => add(signups, u.createdAt));
            const activeWithin = (d: number) => users.filter((u) => u.lastActiveAt && now - u.lastActiveAt <= d * DAY).length;

            // Daily active = distinct actors in the activity stream that day (human actions only).
            const actorsPerDay = keys.map(() => new Set<string>());
            const indexOf = new Map(keys.map((k, i) => [k, i]));
            const events = keys.map(() => 0);
            activity.forEach((doc) => {
                if (reviewTenants.has(tenantOf(doc.ref))) return;
                const at = toMs(doc.get('createdAt'));
                if (!at) return;
                const i = indexOf.get(new Date(at).toISOString().slice(0, 10));
                if (i === undefined) return;
                events[i] += 1;
                const actor = doc.get('actorId');
                if (typeof actor === 'string' && actor) actorsPerDay[i].add(actor);
            });

            const workspacesNew = keys.map(() => 0);
            newTenants.forEach((doc) => { if (!reviewTenants.has(doc.id)) add(workspacesNew, toMs(doc.get('createdAt'))); });

            const crashes = { web: keys.map(() => 0), ios: keys.map(() => 0) };
            crashEvents.forEach((doc) => add(doc.get('platform') === 'ios' ? crashes.ios : crashes.web, toMs(doc.get('receivedAt'))));

            const aiText = keys.map(() => 0);
            const aiImages = keys.map(() => 0);
            const aiUsers = new Set<string>();
            aiDaily.forEach((doc) => {
                if (reviewUids.has(doc.get('uid'))) return;
                const i = indexOf.get(doc.get('day'));
                if (i === undefined) return;
                aiText[i] += Number(doc.get('text') || 0);
                aiImages[i] += Number(doc.get('image') || 0);
                aiUsers.add(doc.get('uid'));
            });
            const monthDocs = aiMonthly.docs.filter((doc) => !reviewUids.has(doc.get('uid')));
            const monthTokens = monthDocs.reduce((sum, doc) => sum + Number(doc.get('tokens') || 0), 0);
            const monthImages = monthDocs.reduce((sum, doc) => sum + Number(doc.get('images') || 0), 0);

            const grantKinds: Record<string, number> = {};
            const grantClients: Record<string, number> = {};
            const liveGrants = grants.docs.filter((doc) => !reviewTenants.has(doc.get('tenantId')) && !reviewUids.has(doc.get('uid')));
            liveGrants.forEach((doc) => {
                grantKinds[doc.get('kind') || 'oauth'] = (grantKinds[doc.get('kind') || 'oauth'] || 0) + 1;
                const client = doc.get('clientName') || (doc.get('kind') === 'personal-token' ? 'Persönlicher Token' : '?');
                grantClients[client] = (grantClients[client] || 0) + 1;
            });

            // Client versions: iOS from devices, web/desktop from the last consent record.
            const versions: Record<string, Record<string, number>> = { ios: {}, desktop: {}, web: {} };
            devices.forEach((doc) => {
                if (reviewUids.has(tenantOf(doc.ref))) return;
                const updated = toMs(doc.get('updatedAt'));
                if (updated && now - updated > 60 * DAY) return;
                const v = doc.get('appVersion') || '?';
                versions.ios[v] = (versions.ios[v] || 0) + 1;
            });
            const termsVersion = Number(termsIndex.get('currentVersion') || 0);
            let termsAccepted = 0;
            acceptances.forEach((doc) => {
                if (reviewUids.has(doc.id)) return;
                const docs = doc.get('docs') || {};
                if (termsVersion && Number(docs.terms?.version || 0) >= termsVersion) termsAccepted += 1;
                const latest = Object.values(docs as Record<string, any>).sort((a, b) => (toMs(b?.acceptedAt) ?? 0) - (toMs(a?.acceptedAt) ?? 0))[0];
                const platform = latest?.platform;
                if ((platform === 'desktop' || platform === 'web') && latest?.appVersion) versions[platform][latest.appVersion] = (versions[platform][latest.appVersion] || 0) + 1;
            });

            const tenantIds = (await db.collection('tenants').select().get()).docs.map((d) => d.id).filter((t) => !reviewTenants.has(t));
            const billing = Array.from((await loadBilling(db, tenantIds)).values());
            const plans: Record<string, number> = {};
            const statuses: Record<string, number> = {};
            billing.forEach((b) => { plans[b.plan] = (plans[b.plan] || 0) + 1; statuses[b.status] = (statuses[b.status] || 0) + 1; });

            const crashTotal = crashes.web.reduce((a, b) => a + b, 0) + crashes.ios.reduce((a, b) => a + b, 0);
            const dauAvg = actorsPerDay.reduce((a, s) => a + s.size, 0) / Math.max(1, days);

            const value = {
                days: keys,
                generatedAt: now,
                users: {
                    total: users.length,
                    dau: activeWithin(1), wau: activeWithin(7), mau: activeWithin(30),
                    disabled: users.filter((u) => u.disabled).length,
                    mfa: users.filter((u) => u.mfa.length).length,
                    providers: users.reduce((acc: Record<string, number>, u) => { u.providers.forEach((p) => { acc[p] = (acc[p] || 0) + 1; }); return acc; }, {}),
                    signups,
                    activeDaily: actorsPerDay.map((s) => s.size),
                },
                workspaces: { total: tenantsCount.data().count - reviewTenants.size, created: workspacesNew },
                content: { projects: projectsCount.data().count - (reviewProjects as number[]).reduce((a, b) => a + b, 0), tasks: tasksCount.data().count - (reviewTasks as number), activityEvents: events },
                crashes: { ...crashes, total: crashTotal, perActiveUser: dauAvg ? crashTotal / days / dauAvg : null },
                ai: {
                    text: aiText, images: aiImages, users: aiUsers.size,
                    monthTokens, monthImages, monthCostUsd: (monthTokens / 1_000_000) * pricing.usdPerMTokens + monthImages * pricing.usdPerImage, usdPerMTokens: pricing.usdPerMTokens,
                },
                mcp: { active: liveGrants.length, kinds: grantKinds, clients: grantClients },
                legal: { termsVersion, termsAccepted, acceptanceRate: users.length && termsVersion ? termsAccepted / users.length : null },
                versions,
                billing: {
                    mrr: billing.reduce((a, b) => a + b.mrr, 0), paying: billing.filter((b) => b.mrr > 0).length, seats: billing.reduce((a, b) => a + (b.mrr > 0 ? b.seats : 0), 0),
                    aiAddonSeats: billing.reduce((a, b) => a + (b.mrr > 0 ? b.aiAddonSeats : 0), 0), plans, statuses,
                    trialsEndingSoon: billing.filter((b) => b.status === 'trialing' && b.trialEndsAt && b.trialEndsAt - now < 7 * DAY).length,
                },
            };
            cache = { key: cacheKey, at: now, value };
            return value;
        },
    },
};
