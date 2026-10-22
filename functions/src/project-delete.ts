import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

import { db } from './init';

const REGION = 'europe-west3';

const requireString = (value: unknown, field: string) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new functions.https.HttpsError('invalid-argument', `${field} is required.`);
    }
    return value.trim();
};

/**
 * Permanently delete a project and everything below it (tasks, subcollections, ...).
 * Allowed for workspace Owners/Admins and for the project's owner.
 */
export const deleteProject = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const uid = context.auth.uid;
    const tenantId = requireString(data?.tenantId, 'tenantId');
    const projectId = requireString(data?.projectId, 'projectId');

    const projectRef = db.doc(`tenants/${tenantId}/projects/${projectId}`);
    const [project, member] = await Promise.all([
        projectRef.get(),
        db.doc(`tenants/${tenantId}/members/${uid}`).get(),
    ]);
    if (!project.exists) throw new functions.https.HttpsError('not-found', 'Project not found.');
    if (!member.exists) throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');

    const role = member.data()?.role;
    const isAdmin = role === 'Owner' || role === 'Admin';
    const isProjectOwner = project.data()?.ownerId === uid;
    if (!isAdmin && !isProjectOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins or the project owner can delete a project.');
    }

    await db.recursiveDelete(projectRef);

    // Best-effort cleanup of project-scoped Storage files, if any exist.
    try {
        await admin.storage().bucket().deleteFiles({ prefix: `tenants/${tenantId}/projects/${projectId}/`, force: true });
    } catch (error) {
        console.warn('deleteProject: storage cleanup skipped', error);
    }

    return { ok: true };
});
