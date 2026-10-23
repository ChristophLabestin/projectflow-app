/**
 * User-bound AI credentials: OAuth grants (`pfo_` access / `pfr_` refresh) and personal access tokens (`pfp_`).
 *
 *   ai_grants/{grantId}  { uid, tenantId, kind: 'oauth'|'personal-token', clientDocId, clientName, clientLogo,
 *                          scopes, resource, createdAt, lastUsedAt, revokedAt, expireAt }
 *   ai_tokens/{sha256}   { type: 'access'|'refresh'|'pat', grantId, uid, tenantId, clientDocId, scopes, resource,
 *                          expireAt, rotatedAt }
 *
 * Only hashes are stored and the hash is the document id (one direct read, no scans). Admin SDK only.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { type PrincipalKind, shouldTouchLastUsed } from './ai-access';
import { db } from './init';
import { ACCESS_TOKEN_TTL_S, randomToken, REFRESH_TOKEN_TTL_S, sha256Hex } from './oauth-core';

export const AI_TOKEN_PREFIXES = ['pfo_', 'pfp_'] as const;
export const isAiToken = (token: string) => AI_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));

export const grantRef = (grantId: string) => db.doc(`ai_grants/${grantId}`);
export const aiTokenRef = (hash: string) => db.doc(`ai_tokens/${hash}`);

const GRANT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export type ResolvedAiToken = {
    tenantId: string;
    tokenId: string;
    memberRole: string;
    tokenData: {
        kind: PrincipalKind;
        uid: string;
        createdBy: string;
        permissions: string[];
        name: string;
        clientName: string;
        grantId: string;
        resource: string | null;
        projectScope: null;
    };
};

/** Resolves a `pfo_` / `pfp_` bearer token; null when unknown, expired, revoked or the user left the workspace. */
export const resolveAiToken = async (token: string): Promise<ResolvedAiToken | { error: string } | null> => {
    const tokenSnap = await aiTokenRef(sha256Hex(token)).get();
    if (!tokenSnap.exists) return null;
    const data = tokenSnap.data() || {};
    if (data.type !== 'access' && data.type !== 'pat') return null;
    const expiresAt: Date | undefined = data.expireAt?.toDate?.();
    if (expiresAt && expiresAt.getTime() <= Date.now()) return { error: 'Token expired' };

    const grantSnap = await grantRef(String(data.grantId)).get();
    const grant = grantSnap.data();
    if (!grant || grant.revokedAt) return { error: 'Connection was revoked' };

    const member = await db.doc(`tenants/${grant.tenantId}/members/${grant.uid}`).get();
    if (!member.exists) return { error: 'You are no longer a member of this workspace.' };

    if (shouldTouchLastUsed(grant.lastUsedAt, new Date())) {
        await grantSnap.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    }

    return {
        tenantId: grant.tenantId,
        tokenId: grantSnap.id,
        memberRole: String(member.data()?.role || 'Member'),
        tokenData: {
            kind: grant.kind === 'personal-token' ? 'personal-token' : 'oauth',
            uid: grant.uid,
            createdBy: grant.uid,
            permissions: Array.isArray(grant.scopes) ? grant.scopes : [],
            name: grant.clientName || 'AI client',
            clientName: grant.clientName || 'AI client',
            grantId: grantSnap.id,
            resource: data.resource || null,
            projectScope: null
        }
    };
};

/** Issues a fresh access + refresh token pair for a grant (authorization_code and refresh_token grants). */
export const issueOAuthTokens = async (input: {
    grantId: string;
    uid: string;
    tenantId: string;
    clientDocId: string;
    scopes: string[];
    resource: string | null;
}) => {
    const accessToken = randomToken('pfo_');
    const refreshToken = randomToken('pfr_');
    const now = Date.now();
    const base = {
        grantId: input.grantId,
        uid: input.uid,
        tenantId: input.tenantId,
        clientDocId: input.clientDocId,
        scopes: input.scopes,
        resource: input.resource,
        createdAt: FieldValue.serverTimestamp()
    };
    const batch = db.batch();
    batch.set(aiTokenRef(sha256Hex(accessToken)), { ...base, type: 'access', expireAt: Timestamp.fromMillis(now + ACCESS_TOKEN_TTL_S * 1000) });
    batch.set(aiTokenRef(sha256Hex(refreshToken)), { ...base, type: 'refresh', expireAt: Timestamp.fromMillis(now + REFRESH_TOKEN_TTL_S * 1000), rotatedAt: null });
    await batch.commit();
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_S,
        refresh_token: refreshToken,
        scope: input.scopes.join(' ')
    };
};

/** Revokes a grant and deletes all its tokens. Revoked grants stay listed for 180 days for the audit trail. */
export const revokeGrant = async (grantId: string, revokedBy: string) => {
    await grantRef(grantId).set({
        revokedAt: FieldValue.serverTimestamp(),
        revokedBy,
        expireAt: Timestamp.fromMillis(Date.now() + GRANT_RETENTION_MS)
    }, { merge: true });
    const tokens = await db.collection('ai_tokens').where('grantId', '==', grantId).get();
    for (let index = 0; index < tokens.docs.length; index += 400) {
        const batch = db.batch();
        tokens.docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
};
