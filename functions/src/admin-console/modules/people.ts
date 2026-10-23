import * as admin from 'firebase-admin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { buildUserExport } from '../../account-data';
import { revokeGrant } from '../../ai-tokens';
import type { HandlerMap } from '../types';
import { AdminInputError, int, str, toMs } from '../types';
import { plain } from './content';
import { invalidateDirectory, listDirectory, toDirectoryUser } from './directory';

const tenantOfRef = (ref: FirebaseFirestore.DocumentReference) => ref.parent.parent?.id || '';

const grantOut = (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
    id: doc.id,
    uid: doc.get('uid'),
    tenantId: doc.get('tenantId'),
    kind: doc.get('kind') || 'oauth',
    clientName: doc.get('clientName') || '',
    scopes: doc.get('scopes') || [],
    tokenPrefix: doc.get('tokenPrefix') || null,
    createdAt: toMs(doc.get('createdAt')),
    lastUsedAt: toMs(doc.get('lastUsedAt')),
    revokedAt: toMs(doc.get('revokedAt')),
    expiresAt: toMs(doc.get('tokenExpiresAt')),
});

const uidParam = (params: any) => {
    const uid = str(params?.uid, 128);
    if (!uid) throw new AdminInputError('uid fehlt');
    return uid;
};

export const peopleHandlers: HandlerMap = {
    'users.list': {
        audit: 'none',
        run: async ({ db }, params) => {
            const [users, memberships] = await Promise.all([
                listDirectory(params?.fresh === true),
                db.collectionGroup('members').select('uid', 'role').get(),
            ]);
            const counts = new Map<string, { workspaces: number; owner: number }>();
            memberships.forEach((doc) => {
                const uid = doc.get('uid') || doc.id;
                const entry = counts.get(uid) ?? { workspaces: 0, owner: 0 };
                entry.workspaces += 1;
                if (doc.get('role') === 'Owner') entry.owner += 1;
                counts.set(uid, entry);
            });
            return { users: users.map((u) => ({ ...u, ...(counts.get(u.uid) ?? { workspaces: 0, owner: 0 }) })) };
        },
    },

    'users.search': {
        audit: 'none',
        run: async (_ctx, params) => {
            const q = str(params?.query, 120).toLowerCase();
            const limit = int(params?.limit, 8, 1, 50);
            if (q.length < 2) return { users: [] };
            const users = await listDirectory();
            return { users: users.filter((u) => u.uid === q || u.email.includes(q) || u.displayName.toLowerCase().includes(q)).slice(0, limit) };
        },
    },

    /** Everything support needs about one account. Personal data → audited read. */
    'users.get': {
        audit: 'read',
        target: (p) => `users/${str(p?.uid, 128)}`,
        run: async ({ db }, params) => {
            const uid = uidParam(params);
            const record = await admin.auth().getUser(uid).catch(() => null);
            if (!record) throw new AdminInputError('Nutzer nicht gefunden');
            const month = new Date().toISOString().slice(0, 7);
            const today = new Date().toISOString().slice(0, 10);
            const [profile, memberships, devices, passkeys, consent, grants, usageMonth, usageToday, totalUsage, activity] = await Promise.all([
                db.collection('users').doc(uid).get(),
                db.collectionGroup('members').where('uid', '==', uid).get(),
                db.collection('users').doc(uid).collection('devices').get(),
                db.collection('users').doc(uid).collection('passkeys').select('createdAt', 'lastUsedAt', 'transports').get(),
                db.collection('legal_acceptances').doc(uid).get(),
                db.collection('ai_grants').where('uid', '==', uid).get(),
                db.collection('ai_usage_quotas').doc(`${uid}_${month}`).get(),
                db.collection('ai_usage_quotas').doc(`${uid}_${today}`).get(),
                db.collection('users').doc(uid).collection('private').doc('usage').get(),
                db.collectionGroup('activity').where('actorId', '==', uid).orderBy('createdAt', 'desc').limit(25).get().catch(() => null),
            ]);
            const tenantIds = memberships.docs.map((d) => tenantOfRef(d.ref));
            const tenants = tenantIds.length ? await db.getAll(...tenantIds.map((t) => db.collection('tenants').doc(t))) : [];
            const p = profile.data() || {};
            return {
                auth: { ...toDirectoryUser(record), customClaims: record.customClaims || {}, tokensValidAfter: record.tokensValidAfterTime ? Date.parse(record.tokensValidAfterTime) : null, mfaFactors: (record.multiFactor?.enrolledFactors || []).map((f) => ({ factorId: f.factorId, displayName: f.displayName || '', enrolledAt: f.enrollmentTime ? Date.parse(f.enrollmentTime) : null })) },
                profile: { displayName: p.displayName || '', language: p.language || null, lastTenantId: p.lastTenantId || null, timezone: p.notificationPrefs?.timezone || null, webPush: plain(p.webPush || null), fcmTokens: Array.isArray(p.fcmTokens) ? p.fcmTokens.length : 0 },
                memberships: memberships.docs.map((d, i) => ({ tenantId: tenantIds[i], tenantName: tenants[i]?.get('name') || '(gelöscht)', role: d.get('role'), joinedAt: toMs(d.get('joinedAt')), isOwner: tenants[i]?.get('ownerId') === uid })),
                devices: devices.docs.map((d) => ({ id: d.id, platform: d.get('platform'), appVersion: d.get('appVersion') || null, locale: d.get('locale') || null, timezone: d.get('timezone') || null, updatedAt: toMs(d.get('updatedAt')), push: Boolean(d.get('fcmToken')) })),
                passkeys: passkeys.docs.map((d) => ({ id: d.id.slice(0, 10), createdAt: toMs(d.get('createdAt')), lastUsedAt: toMs(d.get('lastUsedAt')) })),
                consent: consent.exists ? plain(consent.get('docs') || {}) : {},
                grants: grants.docs.map(grantOut).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)),
                ai: {
                    monthTokens: Number(usageMonth.get('tokens') || 0), monthImages: Number(usageMonth.get('images') || 0),
                    todayText: Number(usageToday.get('text') || 0), todayImages: Number(usageToday.get('image') || 0),
                    totalTokens: Number(totalUsage.get('aiUsage')?.tokensUsed || 0),
                },
                activity: activity ? activity.docs.map((d) => ({ id: d.id, tenantId: tenantOfRef(d.ref), type: d.get('type'), object: d.get('object')?.title || d.get('object')?.type || '', projectTitle: d.get('projectTitle') || null, createdAt: toMs(d.get('createdAt')) })) : null,
            };
        },
    },

    'users.revokeSessions': {
        audit: 'mutation',
        target: (p) => `auth/${str(p?.uid, 128)}`,
        summary: () => 'Refresh-Tokens widerrufen (alle Geräte abgemeldet)',
        run: async ({ uid: adminUid }, params) => {
            const uid = uidParam(params);
            if (uid === adminUid) throw new AdminInputError('Das eigene Konto bitte über „Abmelden“ beenden');
            await admin.auth().revokeRefreshTokens(uid);
            return { ok: true };
        },
    },

    'users.setDisabled': {
        audit: 'mutation',
        target: (p) => `auth/${str(p?.uid, 128)}`,
        summary: (p) => (p?.disabled ? 'Konto gesperrt' : 'Konto entsperrt'),
        run: async ({ uid: adminUid }, params) => {
            const uid = uidParam(params);
            if (uid === adminUid) throw new AdminInputError('Das eigene Konto kann nicht gesperrt werden');
            const disabled = params?.disabled === true;
            await admin.auth().updateUser(uid, { disabled });
            if (disabled) await admin.auth().revokeRefreshTokens(uid);
            invalidateDirectory();
            return { ok: true, disabled };
        },
    },

    'users.revokeGrant': {
        audit: 'mutation',
        target: (p) => `ai_grants/${str(p?.grantId, 128)}`,
        summary: () => 'KI-Verbindung getrennt (Tokens gelöscht)',
        run: async ({ db, uid }, params) => {
            const grantId = str(params?.grantId, 128);
            const snap = await db.collection('ai_grants').doc(grantId).get();
            if (!snap.exists) throw new AdminInputError('Verbindung nicht gefunden');
            await revokeGrant(grantId, `platform-admin:${uid}`);
            return { ok: true };
        },
    },

    /** Same JSON as the user's own "Export my data" (account-data.ts), returned to the admin for support/DSAR. */
    'users.export': {
        audit: 'mutation',
        target: (p) => `users/${str(p?.uid, 128)}`,
        summary: () => 'Datenexport erstellt (Art. 15/20 DSGVO)',
        run: async ({ db }, params) => {
            const uid = uidParam(params);
            const record = await admin.auth().getUser(uid);
            const data = await buildUserExport(db, uid, record.email);
            const json = JSON.stringify(data);
            if (json.length > 9_000_000) throw new AdminInputError('Export zu groß für den direkten Download');
            return { filename: `projectflow-export-${uid}-${new Date().toISOString().slice(0, 10)}.json`, json };
        },
    },

    'workspaces.list': {
        audit: 'none',
        run: async ({ db }) => {
            const [tenants, members, projects, grants, policies] = await Promise.all([
                db.collection('tenants').select('name', 'ownerId', 'createdAt', 'suspendedAt').get(),
                db.collectionGroup('members').select('role').get(),
                db.collectionGroup('projects').select('updatedAt').get(),
                db.collection('ai_grants').where('revokedAt', '==', null).select('tenantId').get(),
                db.collectionGroup('ai_config').select('enabled').get(),
            ]);
            const stats = new Map<string, { members: number; guests: number; projects: number; lastProjectUpdate: number | null; grants: number; aiEnabled: boolean }>();
            const entry = (t: string) => {
                let e = stats.get(t);
                if (!e) { e = { members: 0, guests: 0, projects: 0, lastProjectUpdate: null, grants: 0, aiEnabled: true }; stats.set(t, e); }
                return e;
            };
            members.forEach((d) => { const e = entry(tenantOfRef(d.ref)); if (d.get('role') === 'Guest') e.guests += 1; else e.members += 1; });
            projects.forEach((d) => {
                const t = tenantOfRef(d.ref);
                if (d.ref.parent.parent?.parent.id !== 'tenants') return;
                const e = entry(t);
                e.projects += 1;
                const u = toMs(d.get('updatedAt'));
                if (u && (!e.lastProjectUpdate || u > e.lastProjectUpdate)) e.lastProjectUpdate = u;
            });
            grants.forEach((d) => { const t = d.get('tenantId'); if (t) entry(t).grants += 1; });
            policies.forEach((d) => { if (d.id === 'policy' && d.get('enabled') === false) entry(tenantOfRef(d.ref)).aiEnabled = false; });
            const users = await listDirectory();
            const emailOf = new Map(users.map((u) => [u.uid, u.email]));
            return {
                workspaces: tenants.docs.map((d) => ({
                    id: d.id,
                    name: d.get('name') || '(ohne Namen)',
                    ownerId: d.get('ownerId') || null,
                    ownerEmail: emailOf.get(d.get('ownerId')) || null,
                    createdAt: toMs(d.get('createdAt')),
                    suspendedAt: toMs(d.get('suspendedAt')),
                    ...(stats.get(d.id) ?? { members: 0, guests: 0, projects: 0, lastProjectUpdate: null, grants: 0, aiEnabled: true }),
                })),
            };
        },
    },

    'workspaces.get': {
        audit: 'read',
        target: (p) => `tenants/${str(p?.id, 128)}`,
        run: async ({ db }, params) => {
            const id = str(params?.id, 128);
            const ref = db.collection('tenants').doc(id);
            const tenant = await ref.get();
            if (!tenant.exists) throw new AdminInputError('Workspace nicht gefunden');
            const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
            const [members, projects, policy, grants, usage, activity, apiTokens] = await Promise.all([
                ref.collection('members').get(),
                ref.collection('projects').select('title', 'status', 'updatedAt', 'createdAt').get(),
                ref.collection('ai_config').doc('policy').get(),
                db.collection('ai_grants').where('tenantId', '==', id).get(),
                ref.collection('ai_usage').where(FieldPath.documentId(), '>=', since).get(),
                ref.collection('activity').orderBy('createdAt', 'desc').limit(30).get(),
                ref.collection('api_tokens').select('name', 'createdAt', 'lastUsedAt', 'expiresAt', 'permissions').get(),
            ]);
            const users = await listDirectory();
            const byUid = new Map(users.map((u) => [u.uid, u]));
            return {
                id,
                name: tenant.get('name') || '',
                ownerId: tenant.get('ownerId') || null,
                createdAt: toMs(tenant.get('createdAt')),
                suspendedAt: toMs(tenant.get('suspendedAt')),
                suspendedReason: tenant.get('suspendedReason') || null,
                modules: tenant.get('AccessToModules') || null,
                members: members.docs.map((d) => {
                    const uid = d.get('uid') || d.id;
                    const u = byUid.get(uid);
                    return { uid, email: u?.email || d.get('email') || '', displayName: u?.displayName || d.get('displayName') || '', role: d.get('role'), joinedAt: toMs(d.get('joinedAt')), lastActiveAt: u?.lastActiveAt ?? null };
                }),
                projects: projects.docs.map((d) => ({ id: d.id, title: d.get('title') || '', status: d.get('status') || '', updatedAt: toMs(d.get('updatedAt')), createdAt: toMs(d.get('createdAt')) })),
                aiPolicy: { enabled: true, allowGuests: false, allowDeleteScopes: false, allowPersonalTokens: true, ...(policy.data() || {}) },
                grants: grants.docs.map(grantOut),
                machineWrites: usage.docs.map((d) => ({ day: d.id, writes: Number(d.get('writes') || 0) })),
                apiTokens: apiTokens.docs.map((d) => ({ id: d.id, name: d.get('name') || '', createdAt: toMs(d.get('createdAt')), lastUsedAt: toMs(d.get('lastUsedAt')), expiresAt: toMs(d.get('expiresAt')), permissions: d.get('permissions') || [] })),
                activity: activity.docs.map((d) => ({ id: d.id, type: d.get('type'), actor: d.get('actor')?.name || '', object: d.get('object')?.title || '', projectTitle: d.get('projectTitle') || null, createdAt: toMs(d.get('createdAt')) })),
            };
        },
    },

    'workspaces.setAiPolicy': {
        audit: 'mutation',
        target: (p) => `tenants/${str(p?.id, 128)}/ai_config/policy`,
        summary: (p) => JSON.stringify(p?.policy ?? {}),
        run: async ({ db, uid }, params) => {
            const id = str(params?.id, 128);
            const allowed = ['enabled', 'allowGuests', 'allowDeleteScopes', 'allowPersonalTokens'];
            const policy = Object.fromEntries(Object.entries(params?.policy || {}).filter(([k, v]) => allowed.includes(k) && typeof v === 'boolean'));
            if (!id || !Object.keys(policy).length) throw new AdminInputError('Ungültige Policy');
            await db.collection('tenants').doc(id).collection('ai_config').doc('policy').set({ ...policy, updatedAt: FieldValue.serverTimestamp(), updatedBy: `platform-admin:${uid}` }, { merge: true });
            return { ok: true };
        },
    },
};

