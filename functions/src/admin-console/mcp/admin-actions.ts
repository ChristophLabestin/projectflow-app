import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomToken, sha256Hex } from '../../oauth-core';
import type { HandlerMap } from '../types';
import { AdminInputError, str, toMs } from '../types';
import { CODE_TTL_MS, consentFresh, GRANT_MAX_MS, parseAdminScopes } from './core';
import { col, killSwitchOn, notifyAdmin, revokeGrantTokens } from './store';

/** Console side of the admin MCP: consent, kill switch, clients, grants, pending confirmations (all behind the adminApi gate). */

const redirectWith = (uri: string, params: Record<string, string | undefined>) => {
    const url = new URL(uri);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, v); });
    return url.toString();
};

const loadRequest = async (requestId: string) => {
    const snap = await col.requests().doc(requestId).get();
    const d = snap.data();
    if (!d) throw new AdminInputError('Anfrage nicht gefunden oder abgelaufen');
    if ((toMs(d.expireAt) ?? 0) < Date.now()) throw new AdminInputError('Anfrage abgelaufen — Verbindung im Client neu starten');
    return { ref: snap.ref, d };
};

export const mcpConsoleHandlers: HandlerMap = {
    'mcp.consent.get': {
        audit: 'none',
        run: async (_ctx, params) => {
            const { d } = await loadRequest(str(params?.requestId, 64));
            const client = (await col.clients().doc(d.clientId).get()).data() || {};
            return {
                clientId: d.clientId, clientName: client.name || d.clientId, clientStatus: client.status || 'pending',
                redirectUri: d.redirectUri, scopes: d.scopes, resource: d.resource, killSwitchOn: await killSwitchOn(),
                expiresAt: toMs(d.expireAt),
            };
        },
    },

    /** Grants access. Needs the console gate + a re-authentication with TOTP at most 5 minutes ago. */
    'mcp.consent.approve': {
        audit: 'mutation',
        target: (p) => `admin_mcp_requests/${str(p?.requestId, 64)}`,
        summary: (p) => `Scopes ${parseAdminScopes(p?.scopes).join(' ')}${p?.approveClient ? ' + Client freigegeben' : ''}`,
        run: async (ctx, params) => {
            if (!consentFresh(ctx.authTimeS, Date.now())) throw new AdminInputError('reauth-required');
            if (!(await killSwitchOn())) throw new AdminInputError('Admin-MCP ist ausgeschaltet (Admin-MCP → Einschalten)');
            const { ref, d } = await loadRequest(str(params?.requestId, 64));
            const clientRef = col.clients().doc(d.clientId);
            const client = (await clientRef.get()).data();
            if (!client || client.status === 'revoked') throw new AdminInputError('Client ist widerrufen');
            if (client.status !== 'approved') {
                if (params?.approveClient !== true) throw new AdminInputError('Client muss zuerst freigegeben werden');
                await clientRef.set({ status: 'approved', approvedAt: FieldValue.serverTimestamp(), approvedBy: ctx.uid }, { merge: true });
            }
            const requested = parseAdminScopes(d.scopes);
            const scopes = parseAdminScopes(params?.scopes).filter((s) => requested.includes(s));
            const grantRef = col.grants().doc();
            const now = Date.now();
            await grantRef.set({
                uid: ctx.uid, email: ctx.email, clientId: d.clientId, clientName: client.name || d.clientId, scopes: scopes.length ? scopes : ['admin:read'],
                resource: d.resource, createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + GRANT_MAX_MS), revokedAt: null, lastUsedAt: null,
            });
            const code = randomToken('pfac_');
            await col.codes().doc(sha256Hex(code)).set({
                grantId: grantRef.id, clientId: d.clientId, redirectUri: d.redirectUri, codeChallenge: d.codeChallenge, resource: d.resource,
                expireAt: Timestamp.fromMillis(now + CODE_TTL_MS), used: false,
            });
            await ref.delete();
            void notifyAdmin(ctx.email, 'Neue Verbindung', `Der Client „${client.name || d.clientId}“ wurde mit ${scopes.join(', ') || 'admin:read'} verbunden (gültig 7 Tage). Falls du das nicht warst: in der Konsole unter Admin-MCP sofort widerrufen.`);
            return { redirectUrl: redirectWith(d.redirectUri, { code, state: d.state ?? undefined, iss: d.issuer }) };
        },
    },

    'mcp.consent.deny': {
        audit: 'mutation',
        target: (p) => `admin_mcp_requests/${str(p?.requestId, 64)}`,
        run: async (_ctx, params) => {
            const { ref, d } = await loadRequest(str(params?.requestId, 64));
            await ref.delete();
            return { redirectUrl: redirectWith(d.redirectUri, { error: 'access_denied', state: d.state ?? undefined, iss: d.issuer }) };
        },
    },

    'mcp.status': {
        audit: 'none',
        run: async ({ db }) => {
            const [enabled, clients, grants, pending, audit] = await Promise.all([
                killSwitchOn(),
                col.clients().orderBy('createdAt', 'desc').limit(100).get(),
                col.grants().orderBy('createdAt', 'desc').limit(100).get(),
                col.pending().where('status', '==', 'pending').limit(50).get(),
                db.collection('admin_audit').orderBy('at', 'desc').limit(200).get(),
            ]);
            return {
                enabled,
                clients: clients.docs.map((c) => ({ id: c.id, name: c.get('name') || c.id, status: c.get('status') || 'pending', redirectUris: c.get('redirectUris') || [], createdAt: toMs(c.get('createdAt')), approvedAt: toMs(c.get('approvedAt')) })),
                grants: grants.docs.map((g) => ({ id: g.id, clientName: g.get('clientName') || g.get('clientId'), scopes: g.get('scopes') || [], createdAt: toMs(g.get('createdAt')), expiresAt: toMs(g.get('expiresAt')), revokedAt: toMs(g.get('revokedAt')), lastUsedAt: toMs(g.get('lastUsedAt')) })),
                pending: pending.docs.filter((p) => (toMs(p.get('expireAt')) ?? 0) > Date.now()).map((p) => ({ id: p.id, action: p.get('action'), summary: p.get('summary') || '', code: p.get('code'), clientName: p.get('clientName') || '', expiresAt: toMs(p.get('expireAt')), createdAt: toMs(p.get('createdAt')) })),
                audit: audit.docs.filter((a) => String(a.get('action') || '').startsWith('mcp:')).slice(0, 50).map((a) => ({ id: a.id, at: toMs(a.get('at')), action: a.get('action'), target: a.get('target') || null, summary: a.get('summary') || null, ok: a.get('ok') !== false, error: a.get('error') || null })),
            };
        },
    },

    'mcp.setEnabled': {
        audit: 'mutation',
        target: () => 'admin_config/mcp.enabled',
        summary: (p) => (p?.enabled ? 'eingeschaltet' : 'ausgeschaltet (Kill-Switch)'),
        run: async ({ db, uid }, params) => {
            await db.collection('admin_config').doc('mcp').set({ enabled: params?.enabled === true, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
            return { ok: true };
        },
    },

    'mcp.setClientStatus': {
        audit: 'mutation',
        target: (p) => `admin_mcp_clients/${str(p?.clientId, 80)}`,
        summary: (p) => `→ ${p?.status}`,
        run: async ({ uid }, params) => {
            const clientId = str(params?.clientId, 80);
            const status = params?.status;
            if (!clientId || !['approved', 'revoked'].includes(status)) throw new AdminInputError('clientId/status ungültig');
            const ref = col.clients().doc(clientId);
            if (!(await ref.get()).exists) throw new AdminInputError('Client nicht gefunden');
            await ref.set({ status, [`${status}At`]: FieldValue.serverTimestamp(), [`${status}By`]: uid }, { merge: true });
            if (status === 'revoked') {
                const grants = await col.grants().where('clientId', '==', clientId).get();
                for (const g of grants.docs) if (!g.get('revokedAt')) await revokeGrantTokens(g.id, 'client-revoked');
            }
            return { ok: true };
        },
    },

    'mcp.revokeGrant': {
        audit: 'mutation',
        target: (p) => `admin_mcp_grants/${str(p?.grantId, 80)}`,
        run: async (_ctx, params) => {
            const grantId = str(params?.grantId, 80);
            if (!grantId) throw new AdminInputError('grantId fehlt');
            await revokeGrantTokens(grantId, 'admin-revoked');
            return { ok: true };
        },
    },

    'mcp.cancelPending': {
        audit: 'mutation',
        target: (p) => `admin_mcp_pending/${str(p?.id, 80)}`,
        run: async (_ctx, params) => {
            await col.pending().doc(str(params?.id, 80)).set({ status: 'cancelled' }, { merge: true });
            return { ok: true };
        },
    },
};

