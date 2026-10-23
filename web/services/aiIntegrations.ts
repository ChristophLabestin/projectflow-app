import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** One workspace the signed-in user can connect an AI client to (OAuth consent). */
export type OAuthConsentWorkspace = {
    tenantId: string;
    name: string;
    role: string;
    allowed: boolean;
    reason: 'disabled' | 'guest' | null;
    allowDeleteScopes: boolean;
};

export type OAuthConsentRequest = {
    client: { name: string; logoUri: string | null; clientUri: string | null; redirectHost: string; verified: boolean };
    requestedScopes: string[];
    workspaces: OAuthConsentWorkspace[];
};

export const getOAuthConsentRequest = async (requestId: string) => {
    const call = httpsCallable<{ requestId: string }, OAuthConsentRequest>(functions, 'getOAuthConsentRequest');
    return (await call({ requestId })).data;
};

export const approveOAuthConsent = async (requestId: string, tenantId: string, scopes: string[]) => {
    const call = httpsCallable<{ requestId: string; tenantId: string; scopes: string[] }, { redirectUrl: string }>(functions, 'approveOAuthConsent');
    return (await call({ requestId, tenantId, scopes })).data.redirectUrl;
};

export const denyOAuthConsent = async (requestId: string) => {
    const call = httpsCallable<{ requestId: string }, { redirectUrl: string }>(functions, 'denyOAuthConsent');
    return (await call({ requestId })).data.redirectUrl;
};

export const isValidConsentRequestId = (value: string | null): value is string => Boolean(value && /^[A-Za-z0-9_-]{20,64}$/.test(value));

// ---------------------------------------------------------------------------
// Settings → AI & integrations
// ---------------------------------------------------------------------------

export type AiConnection = {
    id: string;
    kind: 'oauth' | 'personal-token';
    uid: string;
    isMine: boolean;
    clientName: string;
    clientLogo: string | null;
    scopes: string[];
    tokenPrefix: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
};

export type AiPolicy = {
    enabled: boolean;
    allowGuests: boolean;
    allowDeleteScopes: boolean;
    allowPersonalTokens: boolean;
    /** In-app assistant (✦, ⌘J) for this workspace. */
    inAppEnabled: boolean;
    /** Rollout flag for the in-app assistant. */
    inAppAi: boolean;
};

export type AiAuditEntry = {
    id: string;
    kind: string;
    actorId: string;
    credentialLabel: string | null;
    clientName: string | null;
    permission: string;
    method: string;
    path: string;
    status: number;
    createdAt: string | null;
};

export const listAiConnections = async (tenantId: string, all = false) => {
    const call = httpsCallable<{ tenantId: string; all: boolean }, { connections: AiConnection[]; canManageAll: boolean }>(functions, 'listAiConnections');
    return (await call({ tenantId, all })).data;
};

export const revokeAiConnection = async (grantId: string) => {
    const call = httpsCallable<{ grantId: string }, { success: boolean }>(functions, 'revokeAiConnection');
    await call({ grantId });
};

export const createPersonalAccessToken = async (tenantId: string, name: string, scopes: string[], expiresInDays: number) => {
    const call = httpsCallable<
        { tenantId: string; name: string; scopes: string[]; expiresInDays: number },
        { id: string; token: string; scopes: string[]; expiresAt: string }
    >(functions, 'createPersonalAccessToken');
    return (await call({ tenantId, name, scopes, expiresInDays })).data;
};

export const getWorkspaceAiPolicy = async (tenantId: string) => {
    const call = httpsCallable<{ tenantId: string }, { policy: AiPolicy; canEdit: boolean }>(functions, 'getWorkspaceAiPolicy');
    return (await call({ tenantId })).data;
};

export const updateWorkspaceAiPolicy = async (tenantId: string, policy: Partial<AiPolicy>) => {
    const call = httpsCallable<{ tenantId: string; policy: Partial<AiPolicy> }, { policy: AiPolicy }>(functions, 'updateWorkspaceAiPolicy');
    return (await call({ tenantId, policy })).data.policy;
};

export const listWorkspaceAiAudit = async (tenantId: string, limit = 20) => {
    const call = httpsCallable<{ tenantId: string; limit: number }, { entries: AiAuditEntry[] }>(functions, 'listWorkspaceAiAudit');
    return (await call({ tenantId, limit })).data.entries;
};
