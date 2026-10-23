/**
 * Callables for "Settings → AI & integrations" (brain/plans/ai-integrations-concept.md):
 * workspace AI policy and the AI audit log. Policy is readable by every full member and editable
 * by Owner/Admin; the audit log is Owner/Admin only.
 */
import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';

import { type AiPolicy, normalizeAiPolicy } from './ai-access';
import { aiPolicyRef, forgetAiPolicy, loadAiPolicy } from './ai-store';
import { db } from './init';

const REGION = 'europe-west3';
const POLICY_KEYS: (keyof AiPolicy)[] = ['enabled', 'allowGuests', 'allowDeleteScopes', 'allowPersonalTokens', 'inAppEnabled', 'inAppAi'];

const requireRole = async (tenantId: unknown, context: functions.https.CallableContext, roles: string[]) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    const member = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
    const role = member.exists ? String(member.data()?.role || 'Member') : '';
    if (!roles.includes(role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient workspace role.');
    return { uid, tenantId: tenantId.trim(), role };
};

export const getWorkspaceAiPolicy = functions.region(REGION).https.onCall(async (data, context) => {
    const { tenantId, role } = await requireRole(data?.tenantId, context, ['Owner', 'Admin', 'Member']);
    return { policy: await loadAiPolicy(tenantId), canEdit: role === 'Owner' || role === 'Admin' };
});

export const updateWorkspaceAiPolicy = functions.region(REGION).https.onCall(async (data, context) => {
    const { tenantId, uid } = await requireRole(data?.tenantId, context, ['Owner', 'Admin']);
    const patch = (data?.policy && typeof data.policy === 'object' ? data.policy : {}) as Record<string, unknown>;
    const update: Partial<AiPolicy> = {};
    for (const key of POLICY_KEYS) {
        if (key in patch) {
            if (typeof patch[key] !== 'boolean') {
                throw new functions.https.HttpsError('invalid-argument', `${key} must be a boolean.`);
            }
            update[key] = patch[key] as boolean;
        }
    }
    await aiPolicyRef(tenantId).set({ ...update, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
    forgetAiPolicy(tenantId);
    const snapshot = await aiPolicyRef(tenantId).get();
    return { policy: normalizeAiPolicy(snapshot.data()) };
});

export const listWorkspaceAiAudit = functions.region(REGION).https.onCall(async (data, context) => {
    const { tenantId } = await requireRole(data?.tenantId, context, ['Owner', 'Admin']);
    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 200);
    const snapshot = await db
        .collection(`tenants/${tenantId}/ai_audit`)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    return {
        entries: snapshot.docs.map((doc) => {
            const entry = doc.data();
            return {
                id: doc.id,
                kind: entry.kind,
                actorId: entry.actorId,
                credentialId: entry.credentialId || null,
                credentialLabel: entry.credentialLabel || null,
                clientName: entry.clientName || null,
                permission: entry.permission,
                method: entry.method,
                path: entry.path,
                projectId: entry.projectId || null,
                status: entry.status,
                createdAt: entry.createdAt?.toDate?.().toISOString() || null
            };
        })
    };
});
