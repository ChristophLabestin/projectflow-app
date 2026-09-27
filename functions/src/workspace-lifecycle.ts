import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from './init';

const REGION = 'europe-west3';

const requireAuth = (context: functions.https.CallableContext) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    return context.auth.uid;
};

const requireString = (value: unknown, field: string) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new functions.https.HttpsError('invalid-argument', `${field} is required.`);
    }
    return value.trim();
};

/**
 * Hand the workspace to another member. The new owner becomes Owner (and the
 * tenant's `ownerId`), the previous owner stays on as Admin. Only the current
 * owner can do this, and only to an existing, non-guest member.
 */
export const transferWorkspaceOwnership = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireString(data?.tenantId, 'tenantId');
    const newOwnerId = requireString(data?.newOwnerId, 'newOwnerId');
    if (newOwnerId === uid) throw new functions.https.HttpsError('invalid-argument', 'You already own this workspace.');

    const tenantRef = db.doc(`tenants/${tenantId}`);
    const currentRef = db.doc(`tenants/${tenantId}/members/${uid}`);
    const nextRef = db.doc(`tenants/${tenantId}/members/${newOwnerId}`);

    await db.runTransaction(async (tx) => {
        const [tenant, current, next] = await Promise.all([tx.get(tenantRef), tx.get(currentRef), tx.get(nextRef)]);
        if (!tenant.exists) throw new functions.https.HttpsError('not-found', 'Workspace not found.');
        if (tenant.data()?.ownerId !== uid || current.data()?.role !== 'Owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only the owner can transfer the workspace.');
        }
        if (!next.exists) throw new functions.https.HttpsError('not-found', 'That person is not a member of this workspace.');
        if (next.data()?.role === 'Guest') {
            throw new functions.https.HttpsError('failed-precondition', 'Guests cannot own a workspace. Make them a member first.');
        }
        const now = FieldValue.serverTimestamp();
        tx.update(tenantRef, { ownerId: newOwnerId, updatedAt: now });
        tx.update(nextRef, { role: 'Owner', updatedAt: now });
        tx.update(currentRef, { role: 'Admin', updatedAt: now });
    });

    return { success: true };
});

/**
 * Permanently delete a workspace with everything in it (projects, tasks,
 * members, invitations, settings). Owner only; the caller must repeat the
 * workspace name as confirmation. Uploaded files in Storage are not removed.
 */
export const deleteWorkspace = functions.region(REGION).runWith({ timeoutSeconds: 540, memory: '512MB' }).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireString(data?.tenantId, 'tenantId');
    const confirmName = requireString(data?.confirmName, 'confirmName');

    const tenantRef = db.doc(`tenants/${tenantId}`);
    const [tenant, member] = await Promise.all([tenantRef.get(), db.doc(`tenants/${tenantId}/members/${uid}`).get()]);
    if (!tenant.exists) throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    if (tenant.data()?.ownerId !== uid || member.data()?.role !== 'Owner') {
        throw new functions.https.HttpsError('permission-denied', 'Only the owner can delete the workspace.');
    }
    if (String(tenant.data()?.name || '').trim() !== confirmName) {
        throw new functions.https.HttpsError('failed-precondition', 'workspace-name-mismatch');
    }

    await db.recursiveDelete(tenantRef);
    return { success: true };
});
