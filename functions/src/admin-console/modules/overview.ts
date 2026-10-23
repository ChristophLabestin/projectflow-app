import { Timestamp } from 'firebase-admin/firestore';
import type { HandlerMap } from '../types';
import { int, toMs } from '../types';
import { dayKeys } from './crashes';
import { listDirectory } from './directory';
import { loadPricing } from './ops';

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

            const pricing = await loadPricing(db);
            const [users, tenantsCount, newTenants, projectsCount, tasksCount, activity, crashEvents, aiDaily, aiMonthly, grants, devices, acceptances, termsIndex] = await Promise.all([
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

            // Users: signups + "last active" (Auth refresh time) windows.
            const signups = keys.map(() => 0);
            users.forEach((u) => add(signups, u.createdAt));
            const activeWithin = (d: number) => users.filter((u) => u.lastActiveAt && now - u.lastActiveAt <= d * DAY).length;

            // Daily active = distinct actors in the activity stream that day (human actions only).
            const actorsPerDay = keys.map(() => new Set<string>());
            const indexOf = new Map(keys.map((k, i) => [k, i]));
            const events = keys.map(() => 0);
            activity.forEach((doc) => {
                const at = toMs(doc.get('createdAt'));
                if (!at) return;
                const i = indexOf.get(new Date(at).toISOString().slice(0, 10));
                if (i === undefined) return;
                events[i] += 1;
                const actor = doc.get('actorId');
                if (typeof actor === 'string' && actor) actorsPerDay[i].add(actor);
            });

            const workspacesNew = keys.map(() => 0);
            newTenants.forEach((doc) => add(workspacesNew, toMs(doc.get('createdAt'))));

            const crashes = { web: keys.map(() => 0), ios: keys.map(() => 0) };
            crashEvents.forEach((doc) => add(doc.get('platform') === 'ios' ? crashes.ios : crashes.web, toMs(doc.get('receivedAt'))));

            const aiText = keys.map(() => 0);
            const aiImages = keys.map(() => 0);
            const aiUsers = new Set<string>();
            aiDaily.forEach((doc) => {
                const i = indexOf.get(doc.get('day'));
                if (i === undefined) return;
                aiText[i] += Number(doc.get('text') || 0);
                aiImages[i] += Number(doc.get('image') || 0);
                aiUsers.add(doc.get('uid'));
            });
            const monthTokens = aiMonthly.docs.reduce((sum, doc) => sum + Number(doc.get('tokens') || 0), 0);
            const monthImages = aiMonthly.docs.reduce((sum, doc) => sum + Number(doc.get('images') || 0), 0);

            const grantKinds: Record<string, number> = {};
            const grantClients: Record<string, number> = {};
            grants.forEach((doc) => {
                grantKinds[doc.get('kind') || 'oauth'] = (grantKinds[doc.get('kind') || 'oauth'] || 0) + 1;
                const client = doc.get('clientName') || (doc.get('kind') === 'personal-token' ? 'Persönlicher Token' : '?');
                grantClients[client] = (grantClients[client] || 0) + 1;
            });

            // Client versions: iOS from devices, web/desktop from the last consent record.
            const versions: Record<string, Record<string, number>> = { ios: {}, desktop: {}, web: {} };
            devices.forEach((doc) => {
                const updated = toMs(doc.get('updatedAt'));
                if (updated && now - updated > 60 * DAY) return;
                const v = doc.get('appVersion') || '?';
                versions.ios[v] = (versions.ios[v] || 0) + 1;
            });
            const termsVersion = Number(termsIndex.get('currentVersion') || 0);
            let termsAccepted = 0;
            acceptances.forEach((doc) => {
                const docs = doc.get('docs') || {};
                if (termsVersion && Number(docs.terms?.version || 0) >= termsVersion) termsAccepted += 1;
                const latest = Object.values(docs as Record<string, any>).sort((a, b) => (toMs(b?.acceptedAt) ?? 0) - (toMs(a?.acceptedAt) ?? 0))[0];
                const platform = latest?.platform;
                if ((platform === 'desktop' || platform === 'web') && latest?.appVersion) versions[platform][latest.appVersion] = (versions[platform][latest.appVersion] || 0) + 1;
            });

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
                workspaces: { total: tenantsCount.data().count, created: workspacesNew },
                content: { projects: projectsCount.data().count, tasks: tasksCount.data().count, activityEvents: events },
                crashes: { ...crashes, total: crashTotal, perActiveUser: dauAvg ? crashTotal / days / dauAvg : null },
                ai: {
                    text: aiText, images: aiImages, users: aiUsers.size,
                    monthTokens, monthImages, monthCostUsd: (monthTokens / 1_000_000) * pricing.usdPerMTokens + monthImages * pricing.usdPerImage, usdPerMTokens: pricing.usdPerMTokens,
                },
                mcp: { active: grants.size, kinds: grantKinds, clients: grantClients },
                legal: { termsVersion, termsAccepted, acceptanceRate: users.length && termsVersion ? termsAccepted / users.length : null },
                versions,
            };
            cache = { key: cacheKey, at: now, value };
            return value;
        },
    },
};
