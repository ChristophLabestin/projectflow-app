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
