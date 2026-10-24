import * as functions from 'firebase-functions/v1';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../init';
import { normalizeResource, parseClientMetadata, randomId, redirectUriMatches, sha256Hex, verifyPkceS256 } from '../../oauth-core';
import { writeAudit } from '../audit';
import { ADMIN_MCP_SCOPES, baseUrlFor, decideAccess, isAllowedAdminRedirect, parseAdminScopes, REQUEST_TTL_MS } from './core';
import { adminFacts, col, emulatorBase, issueTokens, killSwitchOn, revokeGrantTokens } from './store';

/**
 * Admin MCP authorization server (Hosting rewrites on the console site → `adminOAuth`). Public clients only,
 * PKCE S256, redirect allowlist (Claude Code loopback, claude.ai/claude.com), DCR creates `pending` clients that the
 * admin approves in the console. Consent page: console `/oauth/consent`.
 */
const REGION = 'europe-west3';

const baseOf = (req: any) => baseUrlFor(String(req.headers['x-forwarded-host'] || req.headers.host || ''), emulatorBase(String(req.headers['x-forwarded-host'] || req.headers.host || '')));
const pathOf = (req: any) => String(req.path || req.url || '').split('?')[0];

const oauthError = (res: any, status: number, error: string, description?: string) => {
    res.set('Cache-Control', 'no-store');
    res.status(status).json({ error, ...(description ? { error_description: description } : {}) });
};

const errorPage = (res: any, message: string) => {
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(400).send(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Admin-MCP</title><body style="font-family:system-ui;padding:40px;max-width:560px"><h1>Admin-MCP: Anfrage abgelehnt</h1><p>${message.replace(/[<>&"]/g, '')}</p></body>`);
};

const redirectWith = (uri: string, params: Record<string, string | undefined>) => {
    const url = new URL(uri);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, v); });
    return url.toString();
};

// Best-effort per-instance limits (DCR is cheap to abuse otherwise; tokens are bound by grants anyway).
const hits = new Map<string, { start: number; count: number }>();
const limited = (key: string, max: number, windowMs: number) => {
    const now = Date.now();
    const e = hits.get(key);
    if (!e || now - e.start > windowMs) { hits.set(key, { start: now, count: 1 }); if (hits.size > 5000) hits.clear(); return false; }
    e.count += 1;
    return e.count > max;
};
const clientIp = (req: any) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

export const authorizationServerMetadata = (base: string) => ({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...ADMIN_MCP_SCOPES],
    service_documentation: 'https://admin.getprojectflow.com/mcp-access',
});

export const MAX_PENDING_CLIENTS = 5;
export const MAX_REGISTRATIONS_PER_HOUR = 10;
const PENDING_CLIENT_TTL_MS = 24 * 3_600_000;

/** Deletes unapproved clients older than 24 h (the Firestore TTL on `expireAt` does the same eventually). */
const cleanupStalePending = async () => {
    const stale = await col.clients().where('status', '==', 'pending').where('expireAt', '<', Timestamp.now()).limit(50).get();
    if (stale.empty) return;
    const batch = db.batch();
    stale.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
};

/** Returns an error text when registration must be refused, else reserves one slot (transaction). */
const takeRegistrationSlot = async (): Promise<string | null> => {
    const hour = new Date().toISOString().slice(0, 13);
    const counterRef = db.collection('admin_config').doc(`mcp_dcr_${hour}`);
    const pending = (await col.clients().where('status', '==', 'pending').count().get()).data().count;
    if (pending >= MAX_PENDING_CLIENTS) return `Too many unapproved clients (${pending}). Approve or revoke them in the admin console first.`;
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const count = Number(snap.get('count') || 0);
        if (count >= MAX_REGISTRATIONS_PER_HOUR) return 'Too many registrations this hour';
        tx.set(counterRef, { count: count + 1, expireAt: Timestamp.fromMillis(Date.now() + 2 * 3_600_000) }, { merge: true });
        return null;
    });
};

const handleRegister = async (req: any, res: any) => {
    if (!(await killSwitchOn())) return oauthError(res, 403, 'access_denied', 'Admin MCP is disabled');
    // Flood guard (security review 2026-10-24, M11): no per-IP trust (X-Forwarded-For is spoofable) — a global
    // Firestore counter per hour across all instances, a cap on unapproved clients, and pending clients expire after 24 h.
    await cleanupStalePending();
    const gate = await takeRegistrationSlot();
    if (gate) return oauthError(res, 429, 'slow_down', gate);
    const meta = parseClientMetadata(req.body);
    if (typeof meta === 'string') return oauthError(res, 400, meta === 'invalid_redirect_uri' ? 'invalid_redirect_uri' : 'invalid_client_metadata', meta);
    if (!meta.redirectUris.every(isAllowedAdminRedirect)) return oauthError(res, 400, 'invalid_redirect_uri', 'Only Claude Code (loopback) and claude.ai / claude.com callbacks are allowed');
    if (meta.tokenEndpointAuthMethod !== 'none') return oauthError(res, 400, 'invalid_client_metadata', 'Only public clients (token_endpoint_auth_method none)');
    const clientId = `pfac_client_${randomId()}`;
    await col.clients().doc(clientId).set({
        name: meta.name, redirectUris: meta.redirectUris, status: 'pending', createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + PENDING_CLIENT_TTL_MS), // TTL; cleared on approval
        registeredFromIpHash: sha256Hex(clientIp(req)).slice(0, 16),
    });
    await writeAudit(db, { uid: null, email: null, action: 'mcp:client.register', target: `admin_mcp_clients/${clientId}`, summary: `${meta.name} (pending)`, ok: true, ip: clientIp(req) }).catch(() => undefined);
    res.set('Cache-Control', 'no-store');
    res.status(201).json({
        client_id: clientId, client_name: meta.name, redirect_uris: meta.redirectUris, token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], client_id_issued_at: Math.floor(Date.now() / 1000),
    });
};

const handleAuthorize = async (req: any, res: any) => {
    const q = req.query || {};
    const base = baseOf(req);
    const clientId = String(q.client_id || '');
    const redirectUri = String(q.redirect_uri || '');
    if (!(await killSwitchOn())) return errorPage(res, 'Der Admin-MCP ist ausgeschaltet. Schalte ihn in der Konsole unter Admin-MCP ein.');
    const client = clientId ? (await col.clients().doc(clientId).get()).data() : null;
    if (!client || client.status === 'revoked') return errorPage(res, 'Unbekannter oder widerrufener Client.');
    if (!redirectUri || !isAllowedAdminRedirect(redirectUri) || !redirectUriMatches(client.redirectUris || [], redirectUri)) return errorPage(res, 'redirect_uri ist für diesen Client nicht erlaubt.');
    const state = typeof q.state === 'string' ? q.state.slice(0, 500) : undefined;
    const fail = (error: string, description: string) => res.redirect(302, redirectWith(redirectUri, { error, error_description: description, state, iss: base }));
    if (q.response_type !== 'code') return fail('unsupported_response_type', 'response_type must be code');
    if (q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(String(q.code_challenge || ''))) return fail('invalid_request', 'PKCE S256 is required');
    const resource = `${base}/mcp`;
    if (q.resource && normalizeResource(q.resource) !== resource) return fail('invalid_target', 'Unknown resource');
    const requestId = randomId();
    await col.requests().doc(requestId).set({
        clientId, redirectUri, codeChallenge: String(q.code_challenge), state: state ?? null, scopes: parseAdminScopes(q.scope),
        resource, issuer: base, expireAt: Timestamp.fromMillis(Date.now() + REQUEST_TTL_MS), createdAt: FieldValue.serverTimestamp(),
    });
    res.set('Cache-Control', 'no-store');
    res.redirect(302, `${base}/oauth/consent?request=${encodeURIComponent(requestId)}`);
};

const ensureStillAdmin = async (grant: FirebaseFirestore.DocumentData, clientStatus: string | undefined, resource: string) => {
    const facts = await adminFacts(grant.uid);
    return decideAccess({
        killSwitchOn: await killSwitchOn(),
        token: { type: 'access', expireAtMs: Date.now() + 1, resource, grantId: 'x', uid: grant.uid },
        requestResource: resource,
        grant: { uid: grant.uid, clientId: grant.clientId, revokedAtMs: grant.revokedAt ? 1 : null, createdAtMs: grant.createdAt?.toMillis?.() ?? 0, expiresAtMs: grant.expiresAt?.toMillis?.() ?? 0 },
        client: clientStatus ? { status: clientStatus } : null,
        user: facts.user,
        allowlist: facts.allowlist,
        nowMs: Date.now(),
    });
};

const handleToken = async (req: any, res: any) => {
    const body = req.body || {};
    const clientId = String(body.client_id || '');
    if (!clientId) return oauthError(res, 401, 'invalid_client', 'client_id is required');
    if (limited(`token:${clientId}`, 60, 60_000)) return oauthError(res, 429, 'slow_down');
    const client = (await col.clients().doc(clientId).get()).data();
    if (!client || client.status !== 'approved') return oauthError(res, 401, 'invalid_client', 'client is not approved');

    if (body.grant_type === 'authorization_code') {
        const codeRef = col.codes().doc(sha256Hex(String(body.code || '')));
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(codeRef);
            const d = snap.data();
            if (!d) return { error: 'unknown code' } as const;
            if (d.used) return { error: 'code already used', replay: d.grantId as string } as const;
            tx.update(codeRef, { used: true });
            return { d } as const;
        });
        if ('error' in result) {
            if ('replay' in result && result.replay) await revokeGrantTokens(result.replay, 'code-replay');
            return oauthError(res, 400, 'invalid_grant', result.error);
        }
        const d = result.d;
        if (d.expireAt.toMillis() < Date.now()) return oauthError(res, 400, 'invalid_grant', 'code expired');
        if (d.clientId !== clientId) return oauthError(res, 400, 'invalid_grant', 'code was issued to another client');
        if (String(body.redirect_uri || '') !== d.redirectUri) return oauthError(res, 400, 'invalid_grant', 'redirect_uri mismatch');
        if (!verifyPkceS256(String(body.code_verifier || ''), d.codeChallenge)) return oauthError(res, 400, 'invalid_grant', 'PKCE verification failed');
        if (body.resource && normalizeResource(body.resource) !== d.resource) return oauthError(res, 400, 'invalid_target', 'resource mismatch');
        const grantSnap = await col.grants().doc(d.grantId).get();
        const grant = grantSnap.data();
        if (!grant) return oauthError(res, 400, 'invalid_grant', 'grant missing');
        const decision = await ensureStillAdmin(grant, client.status, d.resource);
        if (!decision.ok) return oauthError(res, 400, 'invalid_grant', decision.reason);
        return res.set('Cache-Control', 'no-store').status(200).json(await issueTokens({ id: grantSnap.id, uid: grant.uid, clientId, scopes: grant.scopes, resource: d.resource, expiresAtMs: grant.expiresAt.toMillis() }));
    }

    if (body.grant_type === 'refresh_token') {
        const tokenRef = col.tokens().doc(sha256Hex(String(body.refresh_token || '')));
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(tokenRef);
            const d = snap.data();
            if (!d || d.type !== 'refresh') return { error: 'unknown refresh token' } as const;
            if (d.rotatedAt) return { error: 'refresh token already used', reuse: d.grantId as string } as const;
            tx.update(tokenRef, { rotatedAt: FieldValue.serverTimestamp() });
            return { d } as const;
        });
        if ('error' in result) {
            if ('reuse' in result && result.reuse) await revokeGrantTokens(result.reuse, 'refresh-reuse');
            return oauthError(res, 400, 'invalid_grant', result.error);
        }
        const d = result.d;
        if (d.expireAt.toMillis() < Date.now()) return oauthError(res, 400, 'invalid_grant', 'refresh token expired');
        if (d.clientId !== clientId) return oauthError(res, 400, 'invalid_grant', 'refresh token was issued to another client');
        const grantSnap = await col.grants().doc(d.grantId).get();
        const grant = grantSnap.data();
        if (!grant) return oauthError(res, 400, 'invalid_grant', 'grant missing');
        const decision = await ensureStillAdmin(grant, client.status, d.resource);
        if (!decision.ok) return oauthError(res, 400, 'invalid_grant', decision.reason);
        return res.set('Cache-Control', 'no-store').status(200).json(await issueTokens({ id: grantSnap.id, uid: grant.uid, clientId, scopes: grant.scopes, resource: d.resource, expiresAtMs: grant.expiresAt.toMillis() }));
    }
    return oauthError(res, 400, 'unsupported_grant_type');
};

const handleRevoke = async (req: any, res: any) => {
    const token = String(req.body?.token || '');
    if (token) {
        const snap = await col.tokens().doc(sha256Hex(token)).get();
        const grantId = snap.get('grantId');
        if (grantId) await revokeGrantTokens(grantId, 'client-revoke');
    }
    res.status(200).send('');
};

export const handleAdminOAuth = async (req: any, res: any) => {
    res.set('X-Robots-Tag', 'noindex');
    const path = pathOf(req);
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        return res.status(204).send('');
    }
    res.set('Access-Control-Allow-Origin', '*');
    try {
        if (req.method === 'GET' && /\/\.well-known\/oauth-authorization-server(\/.*)?$/.test(path)) {
            res.set('Cache-Control', 'public, max-age=300');
            return res.status(200).json(authorizationServerMetadata(baseOf(req)));
        }
        if (req.method === 'GET' && path.endsWith('/oauth/authorize')) return await handleAuthorize(req, res);
        if (req.method === 'POST' && path.endsWith('/oauth/token')) return await handleToken(req, res);
        if (req.method === 'POST' && path.endsWith('/oauth/register')) return await handleRegister(req, res);
        if (req.method === 'POST' && path.endsWith('/oauth/revoke')) return await handleRevoke(req, res);
        return oauthError(res, 404, 'not_found');
    } catch (error) {
        console.error('adminOAuth failed', error);
        return oauthError(res, 500, 'server_error');
    }
};

export const adminOAuth = functions.region(REGION).runWith({ memory: '256MB', timeoutSeconds: 30 }).https.onRequest(handleAdminOAuth);
