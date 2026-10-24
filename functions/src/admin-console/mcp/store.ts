import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../init';
import { getSystemEmailTemplate, sendEmail } from '../../email';
import { randomToken, sha256Hex } from '../../oauth-core';
import { ACCESS_PREFIX, ACCESS_TTL_MS, REFRESH_PREFIX } from './core';

/** Admin MCP storage — server-only collections (rules deny all), separate from the user MCP (`ai_*`, `oauth_*`). */
export const col = {
    clients: () => db.collection('admin_mcp_clients'),
    requests: () => db.collection('admin_mcp_requests'),
    codes: () => db.collection('admin_mcp_codes'),
    grants: () => db.collection('admin_mcp_grants'),
    tokens: () => db.collection('admin_mcp_tokens'),
    pending: () => db.collection('admin_mcp_pending'),
};

export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
/** Emulator only (no Hosting in front): the issuer/resource base is the calling host. */
export const emulatorBase = (host?: string) => (isEmulator ? process.env.ADMIN_MCP_BASE || `http://${String(host || 'localhost').split(',')[0].trim()}` : undefined);

export const killSwitchOn = async () => (await db.collection('admin_config').doc('mcp').get()).get('enabled') === true;

/** Issues an access token (15 min) and a rotating refresh token that never outlives the grant (max 7 days). */
export const issueTokens = async (grant: { id: string; uid: string; clientId: string; scopes: string[]; resource: string; expiresAtMs: number }) => {
    const access = randomToken(ACCESS_PREFIX);
    const refresh = randomToken(REFRESH_PREFIX);
    const now = Date.now();
    const accessExpire = Math.min(now + ACCESS_TTL_MS, grant.expiresAtMs);
    const batch = db.batch();
    const base = { grantId: grant.id, uid: grant.uid, clientId: grant.clientId, scopes: grant.scopes, resource: grant.resource, createdAt: FieldValue.serverTimestamp() };
    batch.set(col.tokens().doc(sha256Hex(access)), { ...base, type: 'access', expireAt: Timestamp.fromMillis(accessExpire) });
    batch.set(col.tokens().doc(sha256Hex(refresh)), { ...base, type: 'refresh', expireAt: Timestamp.fromMillis(grant.expiresAtMs), rotatedAt: null });
    await batch.commit();
    return { access_token: access, token_type: 'Bearer', expires_in: Math.round((accessExpire - now) / 1000), refresh_token: refresh, scope: grant.scopes.join(' ') };
};

export const revokeGrantTokens = async (grantId: string, reason: string) => {
    await col.grants().doc(grantId).set({ revokedAt: FieldValue.serverTimestamp(), revokedReason: reason }, { merge: true });
    const tokens = await col.tokens().where('grantId', '==', grantId).get();
    for (let i = 0; i < tokens.docs.length; i += 400) {
        const batch = db.batch();
        tokens.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
};

/** Live admin facts for a uid: claim, disabled, revocation time, allowlist. */
export const adminFacts = async (uid: string) => {
    const [user, allow] = await Promise.all([admin.auth().getUser(uid).catch(() => null), db.collection('platform_admins').doc(uid).get()]);
    return {
        user: user ? {
            exists: true,
            platformAdmin: user.customClaims?.platformAdmin === true,
            email: (user.email || '').toLowerCase(),
            disabled: user.disabled,
            tokensValidAfterMs: user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : null,
        } : null,
        allowlist: allow.exists ? (allow.data() as { active?: boolean; email?: string }) : null,
    };
};

/** Best-effort mail to the admin (new connection, executed write actions). Never blocks the request. */
export const notifyAdmin = async (email: string, subject: string, body: string) => {
    if (!email || isEmulator) return;
    try {
        await sendEmail(email, `[ProjectFlow Admin-MCP] ${subject}`, getSystemEmailTemplate(subject, body, 'https://admin.getprojectflow.com/mcp-access', 'Admin-MCP öffnen', 'de'), { type: 'admin' });
    } catch (error) {
        console.warn('admin MCP notify failed', (error as Error).message);
    }
};
