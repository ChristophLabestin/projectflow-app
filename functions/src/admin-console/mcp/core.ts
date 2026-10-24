/**
 * Admin MCP — pure rules (brain/plans/admin-console-concept.md → "Admin-MCP"). No Firebase here, so the unit tests
 * (functions/scripts/unit/admin-mcp.test.js) cover every decision.
 */
import { isLoopbackRedirect } from '../../oauth-core';

export const ADMIN_MCP_SCOPES = ['admin:read', 'admin:write'] as const;
export type AdminMcpScope = typeof ADMIN_MCP_SCOPES[number];

export const ACCESS_TTL_MS = 15 * 60_000;
export const GRANT_MAX_MS = 7 * 24 * 60 * 60_000;
export const CODE_TTL_MS = 60_000;
export const REQUEST_TTL_MS = 10 * 60_000;
export const PENDING_TTL_MS = 10 * 60_000;
export const CONSENT_FRESH_MS = 5 * 60_000;

export const ACCESS_PREFIX = 'pfa_';
export const REFRESH_PREFIX = 'pfar_';

/** Canonical console hosts. Anything else (cloudfunctions.net, unknown proxies) falls back to the first. */
export const ADMIN_HOSTS = ['admin.getprojectflow.com', 'projectflow-admin.web.app'];

export const baseUrlFor = (host: string | undefined, emulatorBase?: string) => {
    if (emulatorBase) return emulatorBase.replace(/\/$/, '');
    const clean = String(host || '').split(',')[0].trim().toLowerCase();
    return `https://${ADMIN_HOSTS.includes(clean) ? clean : ADMIN_HOSTS[0]}`;
};

/** Only Claude Code (loopback, any port) and claude.ai / claude.com web callbacks may receive admin codes. */
export const isAllowedAdminRedirect = (value: unknown): value is string => {
    if (typeof value !== 'string' || value.length > 500) return false;
    if (isLoopbackRedirect(value)) {
        try { return !new URL(value).hash; } catch { return false; }
    }
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(url.hostname) && url.pathname === '/api/mcp/auth_callback' && !url.search && !url.hash;
    } catch {
        return false;
    }
};

export const parseAdminScopes = (raw: unknown): AdminMcpScope[] => {
    const list = typeof raw === 'string' ? raw.split(/\s+/) : Array.isArray(raw) ? raw : [];
    const scopes = Array.from(new Set(list.filter((s): s is AdminMcpScope => (ADMIN_MCP_SCOPES as readonly string[]).includes(String(s)))));
    return scopes.length ? scopes : ['admin:read'];
};

export type AccessFacts = {
    killSwitchOn: boolean;
    token: { type: string; expireAtMs: number; resource: string; grantId: string; uid: string } | null;
    requestResource: string;
    grant: { uid: string; clientId: string; revokedAtMs: number | null; createdAtMs: number; expiresAtMs: number } | null;
    client: { status: string } | null;
    user: { exists: boolean; platformAdmin: boolean; email: string; disabled: boolean; tokensValidAfterMs: number | null } | null;
    allowlist: { active?: boolean; email?: string } | null;
    nowMs: number;
};

export type AccessDecision = { ok: true } | { ok: false; status: 401 | 403 | 503; reason: string };

/** Every MCP request: all barriers at once (kill switch, token, audience, grant, client, claim, allowlist, revocation). */
export const decideAccess = (f: AccessFacts): AccessDecision => {
    if (!f.killSwitchOn) return { ok: false, status: 503, reason: 'admin-mcp-disabled' };
    if (!f.token || f.token.type !== 'access') return { ok: false, status: 401, reason: 'invalid-token' };
    if (f.token.expireAtMs <= f.nowMs) return { ok: false, status: 401, reason: 'token-expired' };
    if (f.token.resource !== f.requestResource) return { ok: false, status: 401, reason: 'wrong-audience' };
    const g = f.grant;
    if (!g || g.revokedAtMs || g.uid !== f.token.uid) return { ok: false, status: 401, reason: 'grant-revoked' };
    if (g.expiresAtMs <= f.nowMs) return { ok: false, status: 401, reason: 'grant-expired' };
    if (!f.client || f.client.status !== 'approved') return { ok: false, status: 403, reason: 'client-not-approved' };
    const u = f.user;
    if (!u || !u.exists || u.disabled || !u.platformAdmin) return { ok: false, status: 403, reason: 'not-admin' };
    if (!f.allowlist || f.allowlist.active === false || !u.email || (f.allowlist.email || '').toLowerCase() !== u.email.toLowerCase()) {
        return { ok: false, status: 403, reason: 'not-allowlisted' };
    }
    if (u.tokensValidAfterMs && u.tokensValidAfterMs > g.createdAtMs) return { ok: false, status: 401, reason: 'sessions-revoked' };
    return { ok: true };
};

/** Consent approval needs the console gate (checked by adminApi) plus a re-authentication with TOTP ≤ 5 min ago. */
export const consentFresh = (authTimeS: number | undefined, nowMs: number) => Boolean(authTimeS) && nowMs - (authTimeS as number) * 1000 <= CONSENT_FRESH_MS;
