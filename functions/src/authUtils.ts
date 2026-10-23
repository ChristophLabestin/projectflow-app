import * as admin from 'firebase-admin';
import { isTenantSuspended, SUSPENDED_MESSAGE } from './tenant-status';
import * as crypto from 'crypto';
import { db } from './init';
import { FieldValue } from 'firebase-admin/firestore';
import { shouldTouchLastUsed } from './ai-access';
import { isAiToken, resolveAiToken } from './ai-tokens';
import { checkMachineLegalConsent, type MachineConsentResult } from './legal-machine-access';

/**
 * Hash a token using SHA-256 (must match client-side implementation)
 */
export const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

export type ApiPermission =
    | 'newsletter:write'
    | 'recipients:read'
    | 'projects:read'
    | 'projects:write'
    | 'projects:delete'
    | 'initiatives:read'
    | 'initiatives:write'
    | 'initiatives:delete'
    | 'tasks:read'
    | 'tasks:write'
    | 'tasks:delete'
    | 'blog:read'
    | 'blog:write'
    | 'blog:categories:read'
    | 'blog:categories:write';

/**
 * Find a workspace API token by its hash. Uses one collection-group query
 * (index: api_tokens.tokenHash, collection-group scope).
 */
export const findApiToken = async (token: string): Promise<{
    tokenRef: admin.firestore.DocumentReference;
    tokenData: any;
    tenantId: string;
} | null> => {
    const tokenHash = hashToken(token);
    // No fallback scan over all tenants: any unauthenticated request could trigger it. A missing index is
    // an outage to fix (firestore.indexes.json → api_tokens.tokenHash), not a reason to read every tenant.
    const snapshot = await db.collectionGroup('api_tokens').where('tokenHash', '==', tokenHash).limit(1).get();
    const doc = snapshot.docs[0];
    const tenantId = doc?.ref.parent.parent?.id;
    return doc && tenantId ? { tokenRef: doc.ref, tokenData: doc.data(), tenantId } : null;
};

export type ApiTokenUsable = { ok: true; role: string } | { ok: false; error: string; status?: 403 };

/**
 * A workspace API token is only usable while it is unexpired and its creator is still a full
 * (non-guest) member of the token's workspace. Tokens act as their creator, so removing or
 * demoting the creator must stop the token.
 */
export const checkApiTokenUsable = async (
    tokenData: any,
    tenantId: string,
    deps: {
        getMemberRole: (tenantId: string, uid: string) => Promise<string | null>;
        now: () => Date;
        checkConsent?: (uid: string) => Promise<MachineConsentResult>;
        isSuspended?: (tenantId: string) => Promise<boolean>;
    } = {
        getMemberRole: (t, uid) => getWorkspaceMemberRole(t, uid),
        now: () => new Date(),
        checkConsent: (uid) => checkMachineLegalConsent(uid),
        isSuspended: (t) => isTenantSuspended(t)
    }
): Promise<ApiTokenUsable> => {
    const expiresAt = tokenData?.expiresAt?.toDate?.();
    if (expiresAt && deps.now() > expiresAt) return { ok: false, error: 'Token expired' };
    const creator = typeof tokenData?.createdBy === 'string' ? tokenData.createdBy : '';
    if (!creator) return { ok: false, error: 'Token has no owner. Create a new token.' };
    if (deps.isSuspended && await deps.isSuspended(tenantId)) return { ok: false, error: SUSPENDED_MESSAGE, status: 403 };
    const role = await deps.getMemberRole(tenantId, creator);
    if (!role || role === 'Guest') return { ok: false, error: 'Token creator is no longer a member of this workspace.' };
    const consent = deps.checkConsent ? await deps.checkConsent(creator) : { ok: true as const };
    if (!consent.ok) return { ok: false, error: consent.error, status: 403 };
    return { ok: true, role };
};

/**
 * Validate an API token and return the token data if valid
 */
export const validateAPIToken = async (
    token: string,
    requiredPermission: ApiPermission
): Promise<{ valid: boolean; tokenData?: any; tenantId?: string; tokenId?: string; memberRole?: string; error?: string; status?: 403 }> => {
    try {
        // 0. User-bound AI credentials (OAuth access tokens, personal access tokens).
        if (isAiToken(token)) {
            const resolved = await resolveAiToken(token);
            if (!resolved) return { valid: false, error: 'Invalid token' };
            if ('error' in resolved) return { valid: false, error: resolved.error, status: resolved.status };
            if (!resolved.tokenData.permissions.includes(requiredPermission)) {
                return { valid: false, error: 'Insufficient permissions' };
            }
            return {
                valid: true,
                tokenData: resolved.tokenData,
                tenantId: resolved.tenantId,
                tokenId: resolved.tokenId,
                memberRole: resolved.memberRole
            };
        }

        // 1. Firebase ID tokens (signed-in app users) are only accepted for
        //    workspace-scoped PM endpoints. The caller must still verify the
        //    user's membership in the requested tenant (see requireWorkspaceMember).
        let decodedToken: admin.auth.DecodedIdToken | null = null;
        try {
            decodedToken = await admin.auth().verifyIdToken(token, true);
        } catch (e) {
            decodedToken = null;
        }
        if (decodedToken) {
            if (!/^(projects|initiatives|tasks):/.test(requiredPermission)) {
                return { valid: false, error: 'Insufficient permissions' };
            }
            return {
                valid: true,
                tokenData: {
                    uid: decodedToken.uid,
                    authType: 'firebase',
                    permissions: [requiredPermission]
                }
            };
        }

        const found = await findApiToken(token);
        if (found) {
            const { tokenRef, tokenData, tenantId } = found;

            const usable = await checkApiTokenUsable(tokenData, tenantId);
            if (!usable.ok) {
                return { valid: false, error: usable.error, status: usable.status };
            }

            // Check permissions
            if (!tokenData.permissions.includes(requiredPermission)) {
                return { valid: false, error: 'Insufficient permissions' };
            }

            // lastUsedAt at most every 5 minutes (one write per call adds up for agents).
            if (shouldTouchLastUsed(tokenData.lastUsedAt, new Date())) {
                await tokenRef.update({
                    lastUsedAt: FieldValue.serverTimestamp()
                });
            }

            return {
                valid: true,
                tokenData,
                tenantId,
                tokenId: tokenRef.id,
                memberRole: usable.role
            };
        }

        return { valid: false, error: 'Invalid token' };
    } catch (error: any) {
        console.error('Token validation error:', error);
        return { valid: false, error: 'Token validation failed' };
    }
};

/**
 * Extract API token from request headers or body
 */
export const getAuthToken = (req: any): string => {
    // 1. Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // 2. Query param or body (fallback)
    return req.query?.token || req.body?.token || '';
};

// --- RBAC Helpers (Duplicate of types/permissions Logic for backend) ---


/**
 * Returns the member role of `uid` in `tenantId`, or null when not a member.
 */
export const getWorkspaceMemberRole = async (tenantId: string, uid: string): Promise<string | null> => {
    const snap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
    return snap.exists ? String(snap.data()?.role || 'Member') : null;
};
