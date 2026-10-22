import * as functions from 'firebase-functions/v1';
import { randomBytes } from 'crypto';
import { db } from './init';
import { getWorkspaceMemberRole } from './authUtils';

// Server-side OAuth state for the social connect flows (Facebook, TikTok,
// YouTube). The `state` sent to the provider is an opaque random id; the
// tenant/project/user it belongs to only lives in Firestore, so a callback
// cannot be forged or replayed into another workspace.
const OAUTH_STATES = 'oauth_states';
const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthProvider = 'facebook' | 'tiktok' | 'youtube';

export type OAuthStateData = {
    provider: OAuthProvider;
    tenantId: string;
    projectId: string;
    userId: string;
};

export const createOAuthState = async (
    provider: OAuthProvider,
    data: any,
    context: functions.https.CallableContext
): Promise<string> => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const tenantId = typeof data?.tenantId === 'string' ? data.tenantId : '';
    const projectId = typeof data?.projectId === 'string' ? data.projectId : '';
    if (!tenantId || !projectId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing projectId or tenantId');
    }

    const role = await getWorkspaceMemberRole(tenantId, context.auth.uid);
    if (!role || role === 'Guest') {
        throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');
    }

    const project = await db.doc(`tenants/${tenantId}/projects/${projectId}`).get();
    if (!project.exists) {
        throw new functions.https.HttpsError('not-found', 'Project not found.');
    }

    const state = randomBytes(32).toString('hex');
    await db.collection(OAUTH_STATES).doc(state).set({
        provider,
        tenantId,
        projectId,
        userId: context.auth.uid,
        createdAt: Date.now(),
    });
    return state;
};

/**
 * Returns the stored state once (it is deleted on read) or null when it is
 * unknown, expired or belongs to another provider.
 */
export const consumeOAuthState = async (provider: OAuthProvider, state: unknown): Promise<OAuthStateData | null> => {
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) {
        return null;
    }

    const ref = db.collection(OAUTH_STATES).doc(state);
    const stored = await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return null;
        tx.delete(ref);
        return snapshot.data() as OAuthStateData & { createdAt: number };
    });

    if (!stored || stored.provider !== provider || Date.now() - stored.createdAt > STATE_TTL_MS) {
        return null;
    }
    return { provider, tenantId: stored.tenantId, projectId: stored.projectId, userId: stored.userId };
};
