/**
 * ProjectFlow OAuth 2.1 authorization server for MCP clients (brain/plans/ai-integrations-concept.md §4).
 *
 * HTTP function `oauth` (Hosting rewrites on app.getprojectflow.com):
 *   GET  /.well-known/oauth-authorization-server   RFC 8414 metadata
 *   GET  /oauth/authorize                          code + PKCE S256, parks the request, redirects to /oauth/consent
 *   POST /oauth/token                              authorization_code | refresh_token (rotation + reuse detection)
 *   POST /oauth/register                           RFC 7591 dynamic client registration
 *   POST /oauth/revoke                             RFC 7009
 * Clients: Client ID Metadata Documents (https client_id) or DCR. Identity = Firebase Auth via the web consent
 * page, which uses the callables below. Storage: oauth_clients, oauth_requests, oauth_codes, ai_grants, ai_tokens.
 */
import { lookup } from 'dns/promises';
import * as functions from 'firebase-functions/v1';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { checkWorkspaceAccess, effectiveScopes, normalizeRole, RateLimiter, type WorkspaceRole } from './ai-access';
import { loadAiPolicy } from './ai-store';
import { aiTokenRef, grantRef, issueOAuthTokens, revokeGrant } from './ai-tokens';
import { db } from './init';
import { acceptedResources, consentUrl, issuerFor, MCP_DOCS_URL } from './oauth-config';
import {
    AUTH_CODE_TTL_S,
    AUTH_REQUEST_TTL_S,
    type ClientMetadata,
    isCimdClientId,
    isPublicAddress,
    knownClientName,
    normalizeResource,
    OAUTH_SCOPES,
    parseClientMetadata,
    parseScopes,
    randomId,
    randomToken,
    redirectHost,
    redirectUriMatches,
    sha256Hex,
    verifyPkceS256
} from './oauth-core';

const REGION = 'europe-west3';
const CIMD_CACHE_MS = 24 * 60 * 60 * 1000;
const PAT_MAX_DAYS = 365;
const registrationLimiter = new RateLimiter();

type StoredClient = ClientMetadata & { docId: string; clientId: string; source: 'cimd' | 'dcr'; secretHash: string | null; verified: boolean };

const clientRef = (docId: string) => db.doc(`oauth_clients/${docId}`);

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const toStoredClient = (docId: string, data: any): StoredClient => ({
    docId,
    clientId: data.clientId,
    source: data.source,
    name: data.name,
    redirectUris: data.redirectUris || [],
    logoUri: data.logoUri || null,
    clientUri: data.clientUri || null,
    tokenEndpointAuthMethod: data.tokenEndpointAuthMethod || 'none',
    secretHash: data.secretHash || null,
    verified: Boolean(data.verified)
});

/** Fetches a Client ID Metadata Document with an SSRF guard (public IPs only, https, 5 s, 64 KB). */
const fetchCimd = async (clientId: string): Promise<ClientMetadata | string> => {
    const url = new URL(clientId);
    const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
    if (!addresses.length || !addresses.every((entry) => isPublicAddress(entry.address))) return 'client_id host is not reachable';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(clientId, { redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) return `client metadata document returned ${response.status}`;
        const text = await response.text();
        if (text.length > 64 * 1024) return 'client metadata document too large';
        return parseClientMetadata(JSON.parse(text), { cimdUrl: clientId });
    } catch {
        return 'client metadata document could not be loaded';
    } finally {
        clearTimeout(timer);
    }
};

const loadClient = async (clientId: string): Promise<StoredClient | string> => {
    if (isCimdClientId(clientId)) {
        const docId = `cimd_${sha256Hex(clientId).slice(0, 40)}`;
        const snapshot = await clientRef(docId).get();
        const fetchedAt = snapshot.data()?.fetchedAt?.toMillis?.() || 0;
        if (snapshot.exists && Date.now() - fetchedAt < CIMD_CACHE_MS) return toStoredClient(docId, snapshot.data());
        const metadata = await fetchCimd(clientId);
        if (typeof metadata === 'string') return metadata;
        const host = new URL(clientId).host;
        const data = {
            ...metadata,
            clientId,
            source: 'cimd',
            secretHash: null,
            // A metadata document proves control of its host; its own redirect hosts count as verified.
            verified: metadata.redirectUris.every((uri) => redirectHost(uri) === host) || Boolean(knownClientName(metadata.redirectUris)),
            fetchedAt: FieldValue.serverTimestamp()
        };
        await clientRef(docId).set(data, { merge: true });
        return toStoredClient(docId, data);
    }
    if (!/^pfc_[A-Za-z0-9_-]{20,64}$/.test(clientId)) return 'unknown client_id';
    const snapshot = await clientRef(clientId).get();
    return snapshot.exists ? toStoredClient(clientId, snapshot.data()) : 'unknown client_id';
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const json = (res: any, status: number, body: Record<string, unknown>) => {
    res.set('Cache-Control', 'no-store');
    res.status(status).json(body);
};

const oauthError = (res: any, status: number, error: string, description?: string) =>
    json(res, status, description ? { error, error_description: description } : { error });

const errorPage = (res: any, message: string) => {
    res.set('Cache-Control', 'no-store');
    res.status(400).type('text/plain; charset=utf-8').send(`ProjectFlow sign-in failed: ${message}\nStart the connection again from your AI client.`);
};

const redirectWith = (redirectUri: string, params: Record<string, string | undefined>) => {
    const url = new URL(redirectUri);
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
    });
    return url.toString();
};

const clientIp = (req: any) => String(req.headers?.['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

const authorizationServerMetadata = (req: any) => {
    const issuer = issuerFor(req);
    return {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        registration_endpoint: `${issuer}/oauth/register`,
        revocation_endpoint: `${issuer}/oauth/revoke`,
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        scopes_supported: [...OAUTH_SCOPES, 'offline_access'],
        client_id_metadata_document_supported: true,
        authorization_response_iss_parameter_supported: true,
        service_documentation: MCP_DOCS_URL
    };
};

/** client_id + secret from the body or HTTP Basic; verifies the secret when the client has one. */
const authenticateClient = async (req: any): Promise<StoredClient | string> => {
    let clientId = typeof req.body?.client_id === 'string' ? req.body.client_id : '';
    let secret = typeof req.body?.client_secret === 'string' ? req.body.client_secret : '';
    const header = String(req.headers?.authorization || '');
    if (header.startsWith('Basic ')) {
        const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
        const index = decoded.indexOf(':');
        if (index > 0) {
            clientId = decodeURIComponent(decoded.slice(0, index));
            secret = decodeURIComponent(decoded.slice(index + 1));
        }
    }
    if (!clientId) return 'client_id is required';
    const client = await loadClient(clientId);
    if (typeof client === 'string') return client;
    if (client.secretHash && sha256Hex(secret) !== client.secretHash) return 'invalid client credentials';
    return client;
};

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const handleAuthorize = async (req: any, res: any) => {
    const query = req.query || {};
    const clientId = String(query.client_id || '');
    const redirectUri = String(query.redirect_uri || '');
    const client = clientId ? await loadClient(clientId) : 'client_id is required';
    if (typeof client === 'string') return errorPage(res, client);
    if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) return errorPage(res, 'redirect_uri is not registered for this client');

    const issuer = issuerFor(req);
    const state = typeof query.state === 'string' ? query.state : undefined;
    const fail = (error: string, description: string) =>
        res.redirect(302, redirectWith(redirectUri, { error, error_description: description, state, iss: issuer }));

    if (query.response_type !== 'code') return fail('unsupported_response_type', 'response_type must be code');
    if (query.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(String(query.code_challenge || ''))) {
        return fail('invalid_request', 'PKCE with code_challenge_method S256 is required');
    }
    let resource: string | null = null;
    if (query.resource) {
        resource = normalizeResource(query.resource);
        if (!resource || !acceptedResources(req).map(normalizeResource).includes(resource)) {
            return fail('invalid_target', 'unknown resource');
        }
    }

    const requestId = randomId();
    await db.doc(`oauth_requests/${requestId}`).set({
        clientDocId: client.docId,
        clientId: client.clientId,
        redirectUri,
        state: state || null,
        codeChallenge: String(query.code_challenge),
        scopes: parseScopes(query.scope),
        resource,
        issuer,
        consumed: false,
        createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + AUTH_REQUEST_TTL_S * 1000)
    });
    res.set('Cache-Control', 'no-store');
    res.redirect(302, consentUrl(requestId));
};

const handleToken = async (req: any, res: any) => {
    const body = req.body || {};
    const client = await authenticateClient(req);
    if (typeof client === 'string') return oauthError(res, 401, 'invalid_client', client);

    if (body.grant_type === 'authorization_code') {
        const code = String(body.code || '');
        const codeRef = db.doc(`oauth_codes/${sha256Hex(code)}`);
        const result = await db.runTransaction(async (tx) => {
            const snapshot = await tx.get(codeRef);
            const data = snapshot.data();
            if (!data) return { error: 'unknown code' } as const;
            if (data.used) return { error: 'code already used', replayGrantId: data.grantId as string } as const;
            tx.update(codeRef, { used: true });
            return { data } as const;
        });
        if ('error' in result) {
            // A replayed code means it leaked: revoke everything issued from it (OAuth 2.1 §4.1.3).
            if ('replayGrantId' in result && result.replayGrantId) await revokeGrant(result.replayGrantId, 'code-replay');
            return oauthError(res, 400, 'invalid_grant', result.error);
        }
        const data = result.data;
        if (data.expireAt.toMillis() < Date.now()) return oauthError(res, 400, 'invalid_grant', 'code expired');
        if (data.clientDocId !== client.docId) return oauthError(res, 400, 'invalid_grant', 'code was issued to another client');
        if (String(body.redirect_uri || '') !== data.redirectUri) return oauthError(res, 400, 'invalid_grant', 'redirect_uri mismatch');
        if (!verifyPkceS256(String(body.code_verifier || ''), data.codeChallenge)) return oauthError(res, 400, 'invalid_grant', 'PKCE verification failed');
        if (body.resource && normalizeResource(body.resource) !== data.resource) return oauthError(res, 400, 'invalid_target', 'resource mismatch');
        return json(res, 200, await issueOAuthTokens({
            grantId: data.grantId,
            uid: data.uid,
            tenantId: data.tenantId,
            clientDocId: client.docId,
            scopes: data.scopes,
            resource: data.resource || null
        }));
    }

    if (body.grant_type === 'refresh_token') {
        const tokenRef = aiTokenRef(sha256Hex(String(body.refresh_token || '')));
        const result = await db.runTransaction(async (tx) => {
            const snapshot = await tx.get(tokenRef);
            const data = snapshot.data();
            if (!data || data.type !== 'refresh') return { error: 'unknown refresh token' } as const;
            if (data.rotatedAt) return { error: 'refresh token already used', reuseGrantId: data.grantId as string } as const;
            tx.update(tokenRef, { rotatedAt: FieldValue.serverTimestamp() });
            return { data } as const;
        });
        if ('error' in result) {
            if ('reuseGrantId' in result && result.reuseGrantId) await revokeGrant(result.reuseGrantId, 'refresh-reuse');
            return oauthError(res, 400, 'invalid_grant', result.error);
        }
        const data = result.data;
        if (data.expireAt.toMillis() < Date.now()) return oauthError(res, 400, 'invalid_grant', 'refresh token expired');
        if (data.clientDocId !== client.docId) return oauthError(res, 400, 'invalid_grant', 'refresh token was issued to another client');
        const grant = (await grantRef(data.grantId).get()).data();
        if (!grant || grant.revokedAt) return oauthError(res, 400, 'invalid_grant', 'connection was revoked');
        return json(res, 200, await issueOAuthTokens({
            grantId: data.grantId,
            uid: data.uid,
            tenantId: data.tenantId,
            clientDocId: client.docId,
            scopes: grant.scopes || data.scopes,
            resource: data.resource || null
        }));
    }

    return oauthError(res, 400, 'unsupported_grant_type');
};

const handleRegister = async (req: any, res: any) => {
    if (registrationLimiter.take(`dcr:${clientIp(req)}`, { capacity: 20, refillPerSecond: 20 / 3600 }) > 0) {
        return oauthError(res, 429, 'too_many_requests', 'Too many client registrations from this address.');
    }
    const metadata = parseClientMetadata(req.body);
    if (typeof metadata === 'string') {
        return oauthError(res, 400, metadata === 'invalid_redirect_uri' ? 'invalid_redirect_uri' : 'invalid_client_metadata', metadata);
    }
    const clientId = `pfc_${randomId()}`;
    const secret = metadata.tokenEndpointAuthMethod === 'none' ? null : randomToken('pfcs_');
    const knownName = knownClientName(metadata.redirectUris);
    await clientRef(clientId).set({
        ...metadata,
        clientId,
        source: 'dcr',
        secretHash: secret ? sha256Hex(secret) : null,
        verified: Boolean(knownName),
        registeredFromIp: sha256Hex(clientIp(req)).slice(0, 16),
        createdAt: FieldValue.serverTimestamp()
    });
    return json(res, 201, {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_name: metadata.name,
        redirect_uris: metadata.redirectUris,
        token_endpoint_auth_method: metadata.tokenEndpointAuthMethod,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code']
    });
};

const handleRevoke = async (req: any, res: any) => {
    const client = await authenticateClient(req);
    if (typeof client === 'string') return oauthError(res, 401, 'invalid_client', client);
    const snapshot = await aiTokenRef(sha256Hex(String(req.body?.token || ''))).get();
    const data = snapshot.data();
    if (data && data.clientDocId === client.docId) await revokeGrant(data.grantId, 'client');
    res.set('Cache-Control', 'no-store');
    res.status(200).send('');
};

export const oauth = functions.region(REGION).runWith({ memory: '256MB', timeoutSeconds: 30 }).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.status(204).send('');
        return;
    }
    const path = String(req.path || '').replace(/\/+$/, '');
    try {
        if (req.method === 'GET' && /\/\.well-known\/(oauth-authorization-server|openid-configuration)(\/.*)?$/.test(path)) {
            res.set('Cache-Control', 'public, max-age=300');
            res.status(200).json(authorizationServerMetadata(req));
            return;
        }
        if (req.method === 'GET' && path.endsWith('/oauth/authorize')) return void (await handleAuthorize(req, res));
        if (req.method === 'POST' && path.endsWith('/oauth/token')) return void (await handleToken(req, res));
        if (req.method === 'POST' && path.endsWith('/oauth/register')) return void (await handleRegister(req, res));
        if (req.method === 'POST' && path.endsWith('/oauth/revoke')) return void (await handleRevoke(req, res));
        oauthError(res, 404, 'not_found');
    } catch (error: any) {
        console.error('OAuth request failed', { path, message: error?.message });
        if (!res.headersSent) oauthError(res, 500, 'server_error');
    }
});

// ---------------------------------------------------------------------------
// Consent + connection management (callables used by the web app)
// ---------------------------------------------------------------------------

const requireUid = (context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    return uid;
};

const loadOpenRequest = async (requestId: unknown) => {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(requestId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid request.');
    }
    const ref = db.doc(`oauth_requests/${requestId}`);
    const snapshot = await ref.get();
    const data = snapshot.data();
    if (!data || data.consumed || data.expireAt.toMillis() < Date.now()) {
        throw new functions.https.HttpsError('not-found', 'This connection request expired.');
    }
    return { ref, data };
};

const memberRole = async (tenantId: string, uid: string): Promise<WorkspaceRole | null> => {
    const snapshot = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
    return snapshot.exists ? normalizeRole(String(snapshot.data()?.role || 'Member')) : null;
};

export const getOAuthConsentRequest = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireUid(context);
    const { data: request } = await loadOpenRequest(data?.requestId);
    const clientSnapshot = await clientRef(request.clientDocId).get();
    const client = toStoredClient(clientSnapshot.id, clientSnapshot.data() || {});
    const memberships = await db.collectionGroup('members').where('uid', '==', uid).limit(50).get();
    const workspaces = await Promise.all(memberships.docs.map(async (doc) => {
        const tenantId = doc.ref.parent.parent?.id || '';
        const role = normalizeRole(String(doc.data()?.role || 'Member'));
        const [tenant, policy] = await Promise.all([db.doc(`tenants/${tenantId}`).get(), loadAiPolicy(tenantId)]);
        const access = role ? checkWorkspaceAccess({ role, policy, kind: 'oauth' }) : { ok: false as const, error: '' };
        return {
            tenantId,
            name: String(tenant.data()?.name || tenantId),
            role: role || 'Member',
            allowed: access.ok,
            reason: access.ok ? null : !policy.enabled ? 'disabled' : 'guest',
            allowDeleteScopes: Boolean(role && policy.allowDeleteScopes && role !== 'Guest')
        };
    }));
    return {
        client: {
            name: knownClientName(client.redirectUris) || client.name,
            logoUri: client.logoUri,
            clientUri: client.clientUri,
            redirectHost: redirectHost(request.redirectUri),
            verified: client.verified
        },
        requestedScopes: request.scopes,
        workspaces: workspaces.filter((workspace) => workspace.tenantId).sort((a, b) => Number(b.allowed) - Number(a.allowed))
    };
});

export const approveOAuthConsent = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireUid(context);
    const { ref, data: request } = await loadOpenRequest(data?.requestId);
    const tenantId = typeof data?.tenantId === 'string' ? data.tenantId : '';
    const role = tenantId ? await memberRole(tenantId, uid) : null;
    if (!role) throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');
    const policy = await loadAiPolicy(tenantId);
    const access = checkWorkspaceAccess({ role, policy, kind: 'oauth' });
    if (!access.ok) throw new functions.https.HttpsError('permission-denied', access.error);

    const chosen = Array.isArray(data?.scopes) ? data.scopes.filter((scope: unknown) => typeof scope === 'string' && request.scopes.includes(scope)) : [];
    const scopes = effectiveScopes({ tokenScopes: chosen, role, policy, kind: 'oauth' });
    if (!scopes.length) throw new functions.https.HttpsError('invalid-argument', 'Choose at least one permission.');

    const clientSnapshot = await clientRef(request.clientDocId).get();
    const client = toStoredClient(clientSnapshot.id, clientSnapshot.data() || {});
    const clientName = knownClientName(client.redirectUris) || client.name;

    // One grant per user, workspace and client: reconnecting updates it instead of piling up entries.
    const existing = await db.collection('ai_grants')
        .where('uid', '==', uid)
        .where('tenantId', '==', tenantId)
        .where('clientDocId', '==', client.docId)
        .where('revokedAt', '==', null)
        .limit(1)
        .get();
    const grantDoc = existing.docs[0]?.ref || db.collection('ai_grants').doc();
    await grantDoc.set({
        uid,
        tenantId,
        kind: 'oauth',
        clientDocId: client.docId,
        clientName,
        clientLogo: client.logoUri,
        scopes,
        resource: request.resource || null,
        revokedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.empty ? { createdAt: FieldValue.serverTimestamp(), lastUsedAt: null } : {})
    }, { merge: true });

    const code = randomToken('pfac_');
    await db.doc(`oauth_codes/${sha256Hex(code)}`).set({
        grantId: grantDoc.id,
        uid,
        tenantId,
        clientDocId: client.docId,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        scopes,
        resource: request.resource || null,
        used: false,
        expireAt: Timestamp.fromMillis(Date.now() + AUTH_CODE_TTL_S * 1000)
    });
    await ref.update({ consumed: true });
    return { redirectUrl: redirectWith(request.redirectUri, { code, state: request.state || undefined, iss: request.issuer }) };
});

export const denyOAuthConsent = functions.region(REGION).https.onCall(async (data, context) => {
    requireUid(context);
    const { ref, data: request } = await loadOpenRequest(data?.requestId);
    await ref.update({ consumed: true });
    return {
        redirectUrl: redirectWith(request.redirectUri, {
            error: 'access_denied',
            error_description: 'The user denied access.',
            state: request.state || undefined,
            iss: request.issuer
        })
    };
});

export const createPersonalAccessToken = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireUid(context);
    const tenantId = typeof data?.tenantId === 'string' ? data.tenantId : '';
    const role = tenantId ? await memberRole(tenantId, uid) : null;
    if (!role) throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');
    const policy = await loadAiPolicy(tenantId);
    const access = checkWorkspaceAccess({ role, policy, kind: 'personal-token' });
    if (!access.ok) throw new functions.https.HttpsError('permission-denied', access.error);

    const name = typeof data?.name === 'string' ? data.name.trim().slice(0, 80) : '';
    if (!name) throw new functions.https.HttpsError('invalid-argument', 'Token name is required.');
    const days = Math.round(Number(data?.expiresInDays));
    if (!Number.isFinite(days) || days < 1 || days > PAT_MAX_DAYS) {
        throw new functions.https.HttpsError('invalid-argument', `expiresInDays must be between 1 and ${PAT_MAX_DAYS}.`);
    }
    const requested = Array.isArray(data?.scopes) ? data.scopes.filter((scope: unknown) => typeof scope === 'string' && OAUTH_SCOPES.includes(scope)) : [];
    const scopes = effectiveScopes({ tokenScopes: requested, role, policy, kind: 'personal-token' });
    if (!scopes.length) throw new functions.https.HttpsError('invalid-argument', 'Choose at least one permission.');

    const token = randomToken('pfp_');
    const expireAt = Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
    const grantDoc = db.collection('ai_grants').doc();
    const batch = db.batch();
    batch.set(grantDoc, {
        uid,
        tenantId,
        kind: 'personal-token',
        clientDocId: null,
        clientName: name,
        clientLogo: null,
        scopes,
        resource: null,
        tokenPrefix: token.slice(0, 12),
        tokenExpiresAt: expireAt,
        revokedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null
    });
    batch.set(aiTokenRef(sha256Hex(token)), {
        type: 'pat',
        grantId: grantDoc.id,
        uid,
        tenantId,
        clientDocId: null,
        scopes,
        resource: null,
        expireAt,
        createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
    return { id: grantDoc.id, token, scopes, expiresAt: expireAt.toDate().toISOString() };
});

const serializeGrant = (id: string, grant: any, currentUid: string) => ({
    id,
    kind: grant.kind,
    uid: grant.uid,
    isMine: grant.uid === currentUid,
    clientName: grant.clientName,
    clientLogo: grant.clientLogo || null,
    scopes: grant.scopes || [],
    tokenPrefix: grant.tokenPrefix || null,
    createdAt: grant.createdAt?.toDate?.().toISOString() || null,
    lastUsedAt: grant.lastUsedAt?.toDate?.().toISOString() || null,
    expiresAt: grant.tokenExpiresAt?.toDate?.().toISOString() || null
});

/** Own connections; Owner/Admin may pass `all: true` for every connection in the workspace. */
export const listAiConnections = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireUid(context);
    const tenantId = typeof data?.tenantId === 'string' ? data.tenantId : '';
    const role = tenantId ? await memberRole(tenantId, uid) : null;
    if (!role) throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');
    const all = data?.all === true && (role === 'Owner' || role === 'Admin');
    let query = db.collection('ai_grants').where('tenantId', '==', tenantId).where('revokedAt', '==', null);
    if (!all) query = query.where('uid', '==', uid);
    const snapshot = await query.limit(200).get();
    return { connections: snapshot.docs.map((doc) => serializeGrant(doc.id, doc.data(), uid)), canManageAll: role === 'Owner' || role === 'Admin' };
});

export const revokeAiConnection = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireUid(context);
    const grantId = typeof data?.grantId === 'string' ? data.grantId : '';
    const snapshot = grantId ? await grantRef(grantId).get() : null;
    const grant = snapshot?.data();
    if (!grant || grant.revokedAt) throw new functions.https.HttpsError('not-found', 'Connection not found.');
    const role = await memberRole(grant.tenantId, uid);
    if (grant.uid !== uid && role !== 'Owner' && role !== 'Admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only the owner of the connection or a workspace admin can revoke it.');
    }
    await revokeGrant(grantId, uid);
    return { success: true };
});
