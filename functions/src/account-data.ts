import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

import { db as defaultDb } from './init';

/**
 * GDPR self-service: Art. 20 data export (`exportMyData`) and Art. 17 erasure
 * (`deleteMyAccount`). The core logic takes the Firestore instance and uid so it
 * can be exercised against the emulator (see scripts/account-data-test.js).
 */

const REGION = 'europe-west3';
const DELETED_USER_LABEL = 'Deleted user';
const RECENT_LOGIN_SECONDS = 10 * 60;
const INLINE_EXPORT_MAX_BYTES = 6 * 1024 * 1024;
const PER_COLLECTION_CAP = 500;
const MAX_TENANTS = 100;
const MAX_PROJECTS_PER_TENANT = 300;
const BATCH_SIZE = 400;
const SECRET_KEY_PATTERN = /token|secret|password|credential|publickey|apikey|private_?key|counter/i;
const PASSKEY_DROP_KEYS = new Set(['credentialID', 'credentialPublicKey', 'counter']);

type BatchOp = (b: FirebaseFirestore.WriteBatch) => void;

const requireAuth = (context: functions.https.CallableContext) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    return context.auth.uid;
};

/** Recursively drop secret-looking keys and make Firestore values JSON-safe. */
export const sanitizeValue = (value: any, dropKeys?: Set<string>): any => {
    if (value === null || value === undefined) return value ?? null;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return undefined;
    if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, dropKeys)).filter((v) => v !== undefined);
    if (typeof value === 'object') {
        if (typeof value.path === 'string' && typeof value.firestore === 'object') return value.path;
        const out: Record<string, any> = {};
        for (const [key, inner] of Object.entries(value)) {
            if (SECRET_KEY_PATTERN.test(key) || dropKeys?.has(key)) continue;
            const clean = sanitizeValue(inner, dropKeys);
            if (clean !== undefined) out[key] = clean;
        }
        return out;
    }
    return value;
};

const docToJson = (doc: FirebaseFirestore.DocumentSnapshot, dropKeys?: Set<string>) => ({
    id: doc.id,
    path: doc.ref.path,
    ...sanitizeValue(doc.data() || {}, dropKeys),
});

const listMemberships = async (db: Firestore, uid: string) => {
    const snap = await db.collectionGroup('members').where('uid', '==', uid).limit(MAX_TENANTS).get();
    return snap.docs
        .filter((d) => d.ref.path.startsWith('tenants/'))
        .map((d) => ({ tenantId: d.ref.parent.parent?.id || '', doc: d }));
};

export const buildUserExport = async (db: Firestore, uid: string, email?: string | null) => {
    const truncated: string[] = [];
    const capped = async (query: FirebaseFirestore.Query, label: string, dropKeys?: Set<string>) => {
        const snap = await query.limit(PER_COLLECTION_CAP + 1).get();
        if (snap.size > PER_COLLECTION_CAP) truncated.push(label);
        return snap.docs.slice(0, PER_COLLECTION_CAP).map((d) => docToJson(d, dropKeys));
    };

    const userRef = db.doc(`users/${uid}`);
    const [userSnap, privateDocs, passkeys] = await Promise.all([
        userRef.get(),
        capped(userRef.collection('private'), 'users.private'),
        capped(userRef.collection('passkeys'), 'users.passkeys', PASSKEY_DROP_KEYS),
    ]);

    const memberships = await listMemberships(db, uid);
    const workspaces: any[] = [];
    for (const { tenantId, doc } of memberships) {
        const tenantRef = db.doc(`tenants/${tenantId}`);
        const tenantSnap = await tenantRef.get();
        const entry: any = {
            tenantId,
            tenantName: tenantSnap.data()?.name ?? null,
            isOwner: tenantSnap.data()?.ownerId === uid,
            membership: docToJson(doc),
            personalData: {} as Record<string, any[]>,
            notifications: await capped(tenantRef.collection('notifications').where('userId', '==', uid), `${tenantId}.notifications`),
            projects: [] as any[],
        };

        // tenants/{t}/users/{uid}/** (personal tasks etc.)
        for (const sub of await tenantRef.collection('users').doc(uid).listCollections()) {
            entry.personalData[sub.id] = await capped(sub, `${tenantId}.users.${sub.id}`);
        }

        const projects = await tenantRef.collection('projects').limit(MAX_PROJECTS_PER_TENANT + 1).get();
        if (projects.size > MAX_PROJECTS_PER_TENANT) truncated.push(`${tenantId}.projects`);
        for (const project of projects.docs.slice(0, MAX_PROJECTS_PER_TENANT)) {
            const pdata = project.data();
            const involved = pdata.ownerId === uid || (pdata.memberIds || []).includes(uid);
            const tasksRef = project.ref.collection('tasks');
            const [assigned, assignedMulti, ownedTasks, createdTasks, comments, activities] = await Promise.all([
                tasksRef.where('assigneeId', '==', uid).limit(PER_COLLECTION_CAP).get(),
                tasksRef.where('assigneeIds', 'array-contains', uid).limit(PER_COLLECTION_CAP).get(),
                tasksRef.where('ownerId', '==', uid).limit(PER_COLLECTION_CAP).get(),
                tasksRef.where('createdBy', '==', uid).limit(PER_COLLECTION_CAP).get(),
                project.ref.collection('comments').where('userId', '==', uid).limit(PER_COLLECTION_CAP).get(),
                project.ref.collection('activities').where('ownerId', '==', uid).limit(PER_COLLECTION_CAP).get(),
            ]);
            const taskMap = new Map<string, any>();
            [assigned, assignedMulti, ownedTasks, createdTasks].forEach((s) => s.docs.forEach((d) => taskMap.set(d.id, docToJson(d))));
            if (!involved && taskMap.size === 0 && comments.empty && activities.empty) continue;
            entry.projects.push({
                projectId: project.id,
                title: pdata.title ?? pdata.name ?? null,
                isOwner: pdata.ownerId === uid,
                tasks: [...taskMap.values()],
                comments: comments.docs.map((d) => docToJson(d)),
                activities: activities.docs.map((d) => docToJson(d)),
            });
        }
        workspaces.push(entry);
    }

    return {
        format: 'projectflow-personal-data-export/v1',
        exportedAt: new Date().toISOString(),
        uid,
        authEmail: email ?? null,
        profile: userSnap.exists ? docToJson(userSnap) : null,
        privateData: privateDocs,
        passkeys,
        workspaces,
        truncatedCollections: truncated,
        notes: 'Secrets, tokens and passkey credentials are intentionally omitted.',
    };
};

export type DeletionBlocker = { tenantId: string; name: string; memberCount: number };

/** Splits the user's workspaces into blockers (owner with other members), sole-owned (deleted) and others (detached). */
export const planAccountDeletion = async (db: Firestore, uid: string) => {
    const memberships = await listMemberships(db, uid);
    const blockers: DeletionBlocker[] = [];
    const soleTenants: string[] = [];
    const otherTenants: string[] = [];
    for (const { tenantId } of memberships) {
        const tenant = await db.doc(`tenants/${tenantId}`).get();
        if (!tenant.exists) continue;
        if (tenant.data()?.ownerId === uid) {
            const members = await db.collection(`tenants/${tenantId}/members`).limit(50).get();
            const others = members.docs.filter((m) => m.id !== uid).length;
            if (others > 0) blockers.push({ tenantId, name: String(tenant.data()?.name || tenantId), memberCount: members.size });
            else soleTenants.push(tenantId);
        } else {
            otherTenants.push(tenantId);
        }
    }
    return { blockers, soleTenants, otherTenants };
};

const commitInBatches = async (db: Firestore, ops: BatchOp[]) => {
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        const batch = db.batch();
        ops.slice(i, i + BATCH_SIZE).forEach((op) => op(batch));
        await batch.commit();
    }
};

/** Remove the user from a tenant they do not solely own and anonymize their content. */
const detachFromTenant = async (db: Firestore, tenantId: string, uid: string) => {
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const tenant = await tenantRef.get();
    if (!tenant.exists) return;
    const tenantOwnerId = tenant.data()?.ownerId as string | undefined;
    const ops: BatchOp[] = [];

    const projects = await tenantRef.collection('projects').get();
    for (const project of projects.docs) {
        const p = project.data();
        const patch: Record<string, any> = {};
        if (Array.isArray(p.memberIds) && p.memberIds.includes(uid)) patch.memberIds = FieldValue.arrayRemove(uid);
        if (Array.isArray(p.members) && p.members.some((m: any) => m?.userId === uid)) {
            patch.members = p.members.filter((m: any) => m?.userId !== uid);
        }
        if (p.roles && Object.prototype.hasOwnProperty.call(p.roles, uid)) patch[`roles.${uid}`] = FieldValue.delete();
        if (p.ownerId === uid && tenantOwnerId && tenantOwnerId !== uid) patch.ownerId = tenantOwnerId;
        if (Object.keys(patch).length) ops.push((b) => b.update(project.ref, patch));

        const tasksRef = project.ref.collection('tasks');
        const [soloAssigned, multiAssigned, comments, activities] = await Promise.all([
            tasksRef.where('assigneeId', '==', uid).get(),
            tasksRef.where('assigneeIds', 'array-contains', uid).get(),
            project.ref.collection('comments').where('userId', '==', uid).get(),
            project.ref.collection('activities').where('ownerId', '==', uid).get(),
        ]);
        const taskDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        [...soloAssigned.docs, ...multiAssigned.docs].forEach((d) => taskDocs.set(d.id, d));
        for (const t of taskDocs.values()) {
            const td = t.data();
            const tp: Record<string, any> = {};
            if (td.assigneeId === uid) tp.assigneeId = FieldValue.delete();
            if (Array.isArray(td.assigneeIds) && td.assigneeIds.includes(uid)) tp.assigneeIds = FieldValue.arrayRemove(uid);
            ops.push((b) => b.update(t.ref, tp));
        }
        comments.docs.forEach((c) => ops.push((b) => b.update(c.ref, {
            userDisplayName: DELETED_USER_LABEL,
            userPhotoURL: FieldValue.delete(),
        })));
        activities.docs.forEach((a) => ops.push((b) => b.update(a.ref, {
            user: DELETED_USER_LABEL,
            userAvatar: FieldValue.delete(),
        })));
    }

    const [tokens, notifications, groups] = await Promise.all([
        tenantRef.collection('api_tokens').where('createdBy', '==', uid).get(),
        tenantRef.collection('notifications').where('userId', '==', uid).get(),
        tenantRef.collection('groups').where('memberIds', 'array-contains', uid).get(),
    ]);
    tokens.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
    notifications.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
    groups.docs.forEach((d) => ops.push((b) => b.update(d.ref, { memberIds: FieldValue.arrayRemove(uid) })));
    const tenantRoles = tenant.data()?.roles;
    if (tenantRoles && Object.prototype.hasOwnProperty.call(tenantRoles, uid)) {
        ops.push((b) => b.update(tenantRef, { [`roles.${uid}`]: FieldValue.delete() }));
    }

    await commitInBatches(db, ops);
    await db.recursiveDelete(tenantRef.collection('users').doc(uid));
    await tenantRef.collection('members').doc(uid).delete();
};

export const eraseUserData = async (
    db: Firestore,
    uid: string,
    plan: { soleTenants: string[]; otherTenants: string[] },
    storageDelete?: (prefix: string) => Promise<void>,
) => {
    for (const tenantId of plan.soleTenants) {
        await db.recursiveDelete(db.doc(`tenants/${tenantId}`));
        if (storageDelete) await storageDelete(`tenants/${tenantId}/`);
    }
    for (const tenantId of plan.otherTenants) await detachFromTenant(db, tenantId, uid);
    await db.recursiveDelete(db.doc(`users/${uid}`)); // includes private/ and passkeys/
    if (storageDelete) await storageDelete(`users/${uid}/`);
};

const deleteStoragePrefix = async (prefix: string) => {
    try {
        await admin.storage().bucket().deleteFiles({ prefix, force: true });
    } catch (error) {
        console.warn('account-data: storage cleanup skipped', prefix, (error as Error)?.message);
    }
};

export const exportMyData = functions.region(REGION).runWith({ timeoutSeconds: 300, memory: '512MB' }).https.onCall(async (_data, context) => {
    const uid = requireAuth(context);
    const data = await buildUserExport(defaultDb, uid, context.auth?.token?.email);
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) <= INLINE_EXPORT_MAX_BYTES) return { format: 'inline', data };

    try {
        const file = admin.storage().bucket().file(`users/${uid}/exports/export-${Date.now()}.json`);
        await file.save(json, { contentType: 'application/json' });
        const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
        return { format: 'url', url };
    } catch (error) {
        console.error('account-data: large export failed', error);
        throw new functions.https.HttpsError('resource-exhausted', 'Export is too large to deliver. Contact support.');
    }
});

export const deleteMyAccount = functions.region(REGION).runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (_data, context) => {
    const uid = requireAuth(context);
    const authTime = Number(context.auth?.token?.auth_time || 0);
    if (!authTime || Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
        throw new functions.https.HttpsError('failed-precondition', 'recent-login-required');
    }

    const plan = await planAccountDeletion(defaultDb, uid);
    if (plan.blockers.length) {
        throw new functions.https.HttpsError('failed-precondition', 'owner-of-shared-workspaces', { workspaces: plan.blockers });
    }

    await eraseUserData(defaultDb, uid, plan, deleteStoragePrefix);
    try {
        await admin.auth().deleteUser(uid);
    } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') throw error;
    }
    return { success: true };
});
