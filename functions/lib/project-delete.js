"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const init_1 = require("./init");
const REGION = 'europe-west3';
const requireString = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new functions.https.HttpsError('invalid-argument', `${field} is required.`);
    }
    return value.trim();
};
/**
 * Permanently delete a project and everything below it (tasks, subcollections, ...).
 * Allowed for workspace Owners/Admins and for the project's owner.
 */
exports.deleteProject = functions.region(REGION).https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const uid = context.auth.uid;
    const tenantId = requireString(data === null || data === void 0 ? void 0 : data.tenantId, 'tenantId');
    const projectId = requireString(data === null || data === void 0 ? void 0 : data.projectId, 'projectId');
    const projectRef = init_1.db.doc(`tenants/${tenantId}/projects/${projectId}`);
    const [project, member] = await Promise.all([
        projectRef.get(),
        init_1.db.doc(`tenants/${tenantId}/members/${uid}`).get(),
    ]);
    if (!project.exists)
        throw new functions.https.HttpsError('not-found', 'Project not found.');
    if (!member.exists)
        throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');
    const role = (_a = member.data()) === null || _a === void 0 ? void 0 : _a.role;
    const isAdmin = role === 'Owner' || role === 'Admin';
    const isProjectOwner = ((_b = project.data()) === null || _b === void 0 ? void 0 : _b.ownerId) === uid;
    if (!isAdmin && !isProjectOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins or the project owner can delete a project.');
    }
    await init_1.db.recursiveDelete(projectRef);
    // Best-effort cleanup of project-scoped Storage files, if any exist.
    try {
        await admin.storage().bucket().deleteFiles({ prefix: `tenants/${tenantId}/projects/${projectId}/`, force: true });
    }
    catch (error) {
        console.warn('deleteProject: storage cleanup skipped', error);
    }
    return { ok: true };
});
//# sourceMappingURL=project-delete.js.map