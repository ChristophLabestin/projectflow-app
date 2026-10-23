import * as admin from 'firebase-admin';
import { findApiToken, type ApiPermission } from './authUtils';

/**
 * The public blog (`blog_posts`, `blog_categories`) is global, not tenant data, so only platform admins
 * (custom claim `platformAdmin === true`, see functions/scripts/grant-platform-admin.mjs) may write it:
 * either signed in (Firebase ID token with the claim) or through a workspace API token that carries the
 * permission *and* was created by a platform admin. Any workspace owner can mint tokens, so the permission
 * alone is not enough.
 */
export const PLATFORM_ADMIN_PERMISSIONS: ApiPermission[] = ['blog:read', 'blog:write', 'blog:categories:read', 'blog:categories:write'];

export type PlatformAdminDeps = {
    verifyIdToken: (token: string) => Promise<{ uid: string; platformAdmin?: unknown } | null>;
    findApiToken: (token: string) => Promise<{ tokenData: any; markUsed: () => Promise<unknown> } | null>;
    isPlatformAdminUid: (uid: string) => Promise<boolean>;
    now: () => Date;
};

export type PlatformAdminAuth =
    | { ok: true; uid: string; via: 'firebase' | 'token' }
    | { ok: false; status: 401 | 403; error: string };

export const authorizePlatformAdmin = async (
    token: string,
    permission: ApiPermission,
    deps: PlatformAdminDeps = defaultDeps
): Promise<PlatformAdminAuth> => {
    if (!token) return { ok: false, status: 401, error: 'Missing API token' };

    const decoded = await deps.verifyIdToken(token);
    if (decoded) {
        return decoded.platformAdmin === true
            ? { ok: true, uid: decoded.uid, via: 'firebase' }
            : { ok: false, status: 403, error: 'Platform admin only' };
    }

    const found = await deps.findApiToken(token);
    if (!found) return { ok: false, status: 401, error: 'Invalid token' };
    const { tokenData } = found;
    const expiresAt = tokenData.expiresAt?.toDate?.();
    if (expiresAt && deps.now() > expiresAt) return { ok: false, status: 401, error: 'Token expired' };
    if (!Array.isArray(tokenData.permissions) || !tokenData.permissions.includes(permission)) {
        return { ok: false, status: 403, error: 'Insufficient permissions' };
    }
    const creator = typeof tokenData.createdBy === 'string' ? tokenData.createdBy : '';
    if (!creator || !(await deps.isPlatformAdminUid(creator))) {
        return { ok: false, status: 403, error: 'Platform admin only' };
    }
    await found.markUsed();
    return { ok: true, uid: creator, via: 'token' };
};

const defaultDeps: PlatformAdminDeps = {
    verifyIdToken: async (token) => {
        try {
            return await admin.auth().verifyIdToken(token, true);
        } catch {
            return null;
        }
    },
    findApiToken: async (token) => {
        const found = await findApiToken(token);
        return found
            ? { tokenData: found.tokenData, markUsed: () => found.tokenRef.update({ lastUsedAt: admin.firestore.FieldValue.serverTimestamp() }) }
            : null;
    },
    isPlatformAdminUid: async (uid) => {
        try {
            const user = await admin.auth().getUser(uid);
            return user.customClaims?.platformAdmin === true;
        } catch {
            return false;
        }
    },
    now: () => new Date()
};
