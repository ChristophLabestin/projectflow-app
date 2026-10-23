/**
 * Pure OAuth 2.1 helpers for the ProjectFlow authorization server (oauth-server.ts):
 * PKCE, redirect URI rules, scope parsing, Client ID Metadata Documents, SSRF guard.
 * No Firestore here so everything is unit-testable.
 */
import * as crypto from 'crypto';
import { isIP } from 'net';

import { PM_SCOPES } from './ai-access';

export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;
export const AUTH_CODE_TTL_S = 60;
export const AUTH_REQUEST_TTL_S = 10 * 60;

/** Scopes a client may request. `offline_access` is accepted and ignored (refresh tokens are always issued). */
export const OAUTH_SCOPES: readonly string[] = PM_SCOPES;
/** Granted when a client requests no scope: read everything, work on tasks. */
export const DEFAULT_OAUTH_SCOPES = ['projects:read', 'tasks:read', 'tasks:write', 'initiatives:read'];

export const randomToken = (prefix: string) => `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
export const randomId = () => crypto.randomBytes(18).toString('base64url');
export const sha256Hex = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const verifyPkceS256 = (verifier: string, challenge: string) => {
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
    const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
    return computed.length === challenge.length && crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
};

export const parseScopes = (raw: unknown): string[] => {
    const requested = typeof raw === 'string' ? raw.split(/\s+/).filter(Boolean) : [];
    const known = requested.filter((scope) => OAUTH_SCOPES.includes(scope));
    return known.length ? [...new Set(known)] : [...DEFAULT_OAUTH_SCOPES];
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:', 'ftp:']);

const parseUrl = (value: unknown): URL | null => {
    if (typeof value !== 'string' || value.length > 2000) return null;
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

export const isLoopbackRedirect = (value: string) => {
    const url = parseUrl(value);
    return Boolean(url && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
};

/** Registration rule: https anywhere, http only on loopback, native app schemes, never script/data/file. */
export const isAllowedRedirectUri = (value: unknown): value is string => {
    const url = parseUrl(value);
    if (!url || url.hash) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:') return LOOPBACK_HOSTS.has(url.hostname);
    return !BLOCKED_SCHEMES.has(url.protocol);
};

/** Exact match, except loopback redirects may use any port (RFC 8252 §7.3). */
export const redirectUriMatches = (registered: readonly string[], requested: string) => {
    if (registered.includes(requested)) return true;
    const url = parseUrl(requested);
    if (!url || !isLoopbackRedirect(requested)) return false;
    return registered.some((entry) => {
        const candidate = parseUrl(entry);
        return Boolean(candidate && isLoopbackRedirect(entry) && candidate.hostname === url.hostname &&
            candidate.pathname === url.pathname && candidate.search === url.search);
    });
};

export const redirectHost = (value: string) => {
    const url = parseUrl(value);
    if (!url) return value;
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : `${url.protocol}//`;
};

/** Redirect hosts of well-known MCP clients; consent shows them as verified with their real name. */
const KNOWN_CLIENTS: { name: string; match: (url: URL) => boolean }[] = [
    { name: 'Claude', match: (url) => url.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(url.hostname) },
    { name: 'ChatGPT', match: (url) => url.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(url.hostname) },
    { name: 'Cursor', match: (url) => url.protocol === 'cursor:' || (url.protocol === 'https:' && ['cursor.com', 'www.cursor.com'].includes(url.hostname)) },
    { name: 'Visual Studio Code', match: (url) => url.protocol === 'vscode:' || (url.protocol === 'https:' && url.hostname === 'vscode.dev') }
];

export const knownClientName = (redirectUris: readonly string[]): string | null => {
    for (const uri of redirectUris) {
        const url = parseUrl(uri);
        const known = url && KNOWN_CLIENTS.find((client) => client.match(url));
        if (known) return known.name;
    }
    return null;
};

/** CIMD: the client_id is an https URL with a path that serves the client's metadata document. */
export const isCimdClientId = (value: unknown): value is string => {
    const url = parseUrl(value);
    return Boolean(url && url.protocol === 'https:' && url.pathname.length > 1 && !url.hash && !url.username && !url.password);
};

export type ClientMetadata = {
    name: string;
    redirectUris: string[];
    logoUri: string | null;
    clientUri: string | null;
    tokenEndpointAuthMethod: 'none' | 'client_secret_post' | 'client_secret_basic';
};

const cleanText = (value: unknown, max: number) =>
    typeof value === 'string' ? [...value].filter((char) => char.charCodeAt(0) >= 32).join('').trim().slice(0, max) : '';
const httpsUrlOrNull = (value: unknown) => {
    const url = parseUrl(value);
    return url && url.protocol === 'https:' ? url.toString() : null;
};

/** Validates RFC 7591 registration or CIMD metadata. Returns an error string on failure. */
export const parseClientMetadata = (raw: unknown, options: { cimdUrl?: string } = {}): ClientMetadata | string => {
    if (!raw || typeof raw !== 'object') return 'invalid_client_metadata';
    const data = raw as Record<string, unknown>;
    if (options.cimdUrl && data.client_id !== options.cimdUrl) return 'client_id does not match the metadata document URL';
    const redirectUris = Array.isArray(data.redirect_uris) ? data.redirect_uris : [];
    if (!redirectUris.length || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirectUri)) return 'invalid_redirect_uri';
    const method = cleanText(data.token_endpoint_auth_method, 40) || 'none';
    if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) return 'unsupported token_endpoint_auth_method';
    if (options.cimdUrl && method !== 'none') return 'metadata documents must use token_endpoint_auth_method none';
    const grantTypes = Array.isArray(data.grant_types) ? data.grant_types : ['authorization_code'];
    if (!grantTypes.includes('authorization_code')) return 'grant_types must include authorization_code';
    return {
        name: cleanText(data.client_name, 80) || redirectHost(String(redirectUris[0])),
        redirectUris: redirectUris as string[],
        logoUri: httpsUrlOrNull(data.logo_uri),
        clientUri: httpsUrlOrNull(data.client_uri),
        tokenEndpointAuthMethod: method as ClientMetadata['tokenEndpointAuthMethod']
    };
};

/** SSRF guard for CIMD fetches: only public unicast addresses. */
export const isPublicAddress = (address: string): boolean => {
    const version = isIP(address);
    if (version === 4) {
        const [a, b] = address.split('.').map(Number);
        if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
        if (a === 169 && b === 254) return false;
        if (a === 172 && b >= 16 && b <= 31) return false;
        if (a === 192 && b === 168) return false;
        if (a === 100 && b >= 64 && b <= 127) return false;
        return true;
    }
    if (version === 6) {
        const lower = address.toLowerCase();
        if (lower === '::1' || lower === '::') return false;
        if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return false;
        if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice(7));
        return true;
    }
    return false;
};

/** Canonical MCP resource URLs this server accepts as token audience. */
export const MCP_RESOURCES = [
    'https://mcp.getprojectflow.com/mcp',
    'https://app.getprojectflow.com/mcp',
    'https://projectflow-labestin.web.app/mcp'
];

export const normalizeResource = (value: unknown): string | null => {
    const url = parseUrl(value);
    if (!url) return null;
    url.hash = '';
    url.search = '';
    const normalized = url.toString().replace(/\/$/, '');
    return normalized;
};

/** Audience check: tokens bound to a resource only work there; unbound (legacy clients without `resource`) work on any ProjectFlow MCP URL. */
export const audienceMatches = (tokenResource: string | null | undefined, requestResource: string) =>
    !tokenResource || normalizeResource(tokenResource) === normalizeResource(requestResource);
