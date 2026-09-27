"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkspace = exports.transferWorkspaceOwnership = void 0;
const functions = require("firebase-functions/v1");
const firestore_1 = require("firebase-admin/firestore");
const init_1 = require("./init");
const REGION = 'europe-west3';
const requireAuth = (context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    return context.auth.uid;
};
const requireString = (value, field) => {
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
exports.transferWorkspaceOwnership = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireString(data === null || data === void 0 ? void 0 : data.tenantId, 'tenantId');
    const newOwnerId = requireString(data === null || data === void 0 ? void 0 : data.newOwnerId, 'newOwnerId');
    if (newOwnerId === uid)
        throw new functions.https.HttpsError('invalid-argument', 'You already own this workspace.');
    const tenantRef = init_1.db.doc(`tenants/${tenantId}`);
    const currentRef = init_1.db.doc(`tenants/${tenantId}/members/${uid}`);
    const nextRef = init_1.db.doc(`tenants/${tenantId}/members/${newOwnerId}`);
    await init_1.db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const [tenant, current, next] = await Promise.all([tx.get(tenantRef), tx.get(currentRef), tx.get(nextRef)]);
        if (!tenant.exists)
            throw new functions.https.HttpsError('not-found', 'Workspace not found.');
        if (((_a = tenant.data()) === null || _a === void 0 ? void 0 : _a.ownerId) !== uid || ((_b = current.data()) === null || _b === void 0 ? void 0 : _b.role) !== 'Owner') {
            throw new functions.https.HttpsError('permission-denied', 'Only the owner can transfer the workspace.');
        }
        if (!next.exists)
            throw new functions.https.HttpsError('not-found', 'That person is not a member of this workspace.');
        if (((_c = next.data()) === null || _c === void 0 ? void 0 : _c.role) === 'Guest') {
            throw new functions.https.HttpsError('failed-precondition', 'Guests cannot own a workspace. Make them a member first.');
        }
        const now = firestore_1.FieldValue.serverTimestamp();
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
exports.deleteWorkspace = functions.region(REGION).runWith({ timeoutSeconds: 540, memory: '512MB' }).https.onCall(async (data, context) => {
    var _a, _b, _c;
    const uid = requireAuth(context);
    const tenantId = requireString(data === null || data === void 0 ? void 0 : data.tenantId, 'tenantId');
    const confirmName = requireString(data === null || data === void 0 ? void 0 : data.confirmName, 'confirmName');
    const tenantRef = init_1.db.doc(`tenants/${tenantId}`);
    const [tenant, member] = await Promise.all([tenantRef.get(), init_1.db.doc(`tenants/${tenantId}/members/${uid}`).get()]);
    if (!tenant.exists)
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    if (((_a = tenant.data()) === null || _a === void 0 ? void 0 : _a.ownerId) !== uid || ((_b = member.data()) === null || _b === void 0 ? void 0 : _b.role) !== 'Owner') {
        throw new functions.https.HttpsError('permission-denied', 'Only the owner can delete the workspace.');
    }
    if (String(((_c = tenant.data()) === null || _c === void 0 ? void 0 : _c.name) || '').trim() !== confirmName) {
        throw new functions.https.HttpsError('failed-precondition', 'workspace-name-mismatch');
    }
    await init_1.db.recursiveDelete(tenantRef);
    return { success: true };
});
//# sourceMappingURL=workspace-lifecycle.js.map