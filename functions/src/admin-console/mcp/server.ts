import { onRequest } from 'firebase-functions/v2/https';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
import { z } from 'zod';

import { db } from '../../init';
import { sha256Hex } from '../../oauth-core';
import { writeAudit } from '../audit';
import { featureHandlers } from '../registry';
import type { AdminContext } from '../types';
import { ACCESS_PREFIX, baseUrlFor, decideAccess, PENDING_TTL_MS } from './core';
import { adminFacts, col, emulatorBase, killSwitchOn, notifyAdmin } from './store';

/**
 * Admin MCP server (`https://admin.getprojectflow.com/mcp`, function `adminMcp`). Platform admin only:
 * every request re-checks kill switch, token, audience, grant, client, claim, allowlist and revocation (core.ts).
 * Read tools call the same adminApi handlers as the console; write tools need a confirmation code that is shown
 * only in the console (Admin-MCP → Ausstehend). Nothing here deletes data.
 */
const REGION = 'europe-west3';
const VERSION = '1.0.0';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

const INSTRUCTIONS = `ProjectFlow platform admin console (operator tools, not a workspace). Read tools are free to use.
Write tools never act on the first call: they return a pendingId and the admin reads a 6-digit confirmation code in the admin console
(Admin-MCP → Ausstehend). Ask the admin for that code, then call the same tool again with pendingId and confirmationCode.`;

type Caller = { ctx: AdminContext; grantId: string; scopes: Set<string>; clientName: string };

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });

const runAction = async (caller: Caller, action: string, params: unknown) => {
    const handler = featureHandlers()[action];
    if (!handler) throw new Error(`Unknown action ${action}`);
    try {
        const result = await handler.run(caller.ctx, params);
        await writeAudit(db, { uid: caller.ctx.uid, email: caller.ctx.email, action: `mcp:${action}`, target: handler.target ? safe(() => handler.target!(params)) : null, summary: `${caller.clientName}${handler.summary ? ` · ${safe(() => handler.summary!(params, result)) ?? ''}` : ''}`, ok: true, sessionId: caller.ctx.sessionId, ip: caller.ctx.ip, userAgent: caller.ctx.userAgent });
        return result;
    } catch (error) {
        await writeAudit(db, { uid: caller.ctx.uid, email: caller.ctx.email, action: `mcp:${action}`, ok: false, error: (error as Error).message, sessionId: caller.ctx.sessionId, ip: caller.ctx.ip, userAgent: caller.ctx.userAgent }).catch(() => undefined);
        throw error;
    }
};

const safe = <T>(fn: () => T): T | null => { try { return fn(); } catch { return null; } };

/** Two-step write: without a code → pending + code in the console; with pendingId + code → execute once. */
const confirmedWrite = async (caller: Caller, action: string, params: Record<string, unknown>, summary: string, confirmation: { pendingId?: string; confirmationCode?: string }) => {
    if (!caller.scopes.has('admin:write')) return fail('This connection is read-only (scope admin:write was not granted).');
    if (!confirmation.pendingId) {
        const ref = col.pending().doc();
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        await ref.set({ grantId: caller.grantId, clientName: caller.clientName, action, params, summary, code, status: 'pending', attempts: 0, createdAt: FieldValue.serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + PENDING_TTL_MS) });
        await writeAudit(db, { uid: caller.ctx.uid, email: caller.ctx.email, action: `mcp:pending:${action}`, target: `admin_mcp_pending/${ref.id}`, summary, ok: true, sessionId: caller.ctx.sessionId });
        return text({ status: 'confirmation_required', pendingId: ref.id, summary, expiresInMinutes: PENDING_TTL_MS / 60_000, next: 'Ask the admin for the 6-digit code shown in the admin console (Admin-MCP → Ausstehend), then call this tool again with pendingId and confirmationCode.' });
    }
    const ref = col.pending().doc(String(confirmation.pendingId).slice(0, 80));
    const outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.data();
        if (!d || d.grantId !== caller.grantId) return { error: 'Unknown pendingId for this connection.' };
        if (d.status !== 'pending') return { error: `This request is ${d.status}.` };
        if (d.expireAt.toMillis() < Date.now()) { tx.update(ref, { status: 'expired' }); return { error: 'The confirmation expired. Start again without pendingId.' }; }
        if (d.action !== action) return { error: 'pendingId belongs to another tool.' };
        if (String(confirmation.confirmationCode || '') !== d.code) {
            const attempts = Number(d.attempts || 0) + 1;
            tx.update(ref, { attempts, ...(attempts >= 3 ? { status: 'locked' } : {}) });
            return { error: attempts >= 3 ? 'Wrong code three times — request locked.' : 'Wrong confirmation code.' };
        }
        tx.update(ref, { status: 'done', doneAt: FieldValue.serverTimestamp() });
        return { params: d.params as Record<string, unknown>, summary: d.summary as string };
    });
    if ('error' in outcome) return fail(outcome.error as string);
    const result = await runAction(caller, action, outcome.params);
    void notifyAdmin(caller.ctx.email, 'Schreibaktion ausgeführt', `${caller.clientName}: ${outcome.summary}`);
    return text({ status: 'done', result });
};

const buildServer = (caller: Caller) => {
    const server = new McpServer({ name: 'projectflow-admin', title: 'ProjectFlow Admin', version: VERSION }, { instructions: INSTRUCTIONS });
    const read = (name: string, title: string, description: string, inputSchema: Record<string, z.ZodTypeAny>, action: string, map: (args: any) => unknown = (a) => a) => {
        server.registerTool(name, { title, description, annotations: READ, inputSchema }, async (args: any) => {
            try { return text(await runAction(caller, action, map(args))); } catch (error) { return fail((error as Error).message); }
        });
    };
    const confirm = { pendingId: z.string().optional().describe('From the first call (confirmation_required).'), confirmationCode: z.string().optional().describe('6-digit code the admin reads in the console.') };
    const write = (name: string, title: string, description: string, inputSchema: Record<string, z.ZodTypeAny>, action: string, toParams: (args: any) => Record<string, unknown>, summarize: (args: any) => string) => {
        server.registerTool(name, { title, description: `${description} Needs a confirmation code from the admin console.`, annotations: WRITE, inputSchema: { ...inputSchema, ...confirm } }, async (args: any) => {
            try { return await confirmedWrite(caller, action, toParams(args), summarize(args), args); } catch (error) { return fail((error as Error).message); }
        });
    };

    read('overview', 'Platform overview', 'KPIs: users (DAU/WAU/MAU, signups), workspaces, projects/tasks, crashes, AI usage and cost estimate, MCP connections, MRR, plans, terms acceptance, client versions.', { days: z.number().int().min(7).max(90).optional() }, 'overview.get', (a) => ({ days: a.days ?? 30 }));
    read('search_users', 'Search users', 'Find accounts by email, name or uid (max 50).', { query: z.string().min(2), limit: z.number().int().min(1).max(50).optional() }, 'users.search');
    read('get_user', 'User details', 'Account, memberships, devices, consent, AI usage and connections, recent activity of one user (audited).', { uid: z.string().min(1) }, 'users.get');
    read('list_workspaces', 'List workspaces', 'All workspaces with members, projects, plan, status, MRR, type, suspension and orphaned flag.', {}, 'workspaces.list');
    read('get_workspace', 'Workspace details', 'Members, projects, billing, flows, AI policy and credits, API tokens, suspension log, activity (audited).', { id: z.string().min(1) }, 'workspaces.get');
    read('list_crashes', 'Crash issues', 'Crash groups with trend, installs, status and releases.', { days: z.number().int().min(1).max(90).optional() }, 'crashes.list', (a) => ({ days: a.days ?? 14 }));
    read('get_crash', 'Crash details', 'One crash issue with stack, events, releases and devices.', { id: z.string().min(1) }, 'crashes.get');
    read('ai_usage', 'AI usage and cost', 'In-app AI usage per user/workspace with cost estimate and limits.', { days: z.number().int().min(7).max(90).optional() }, 'ai.overview', (a) => ({ days: a.days ?? 30 }));
    read('ai_credits', 'In-app AI credits', 'Rollout flag, workspace switch, credits and cost per workspace for a month.', { month: z.string().regex(/^\d{4}-\d{2}$/).optional() }, 'ai.credits');
    read('mcp_connections', 'User MCP connections', 'OAuth/PAT connections of all users (user MCP, not this admin server).', {}, 'ai.grants');
    read('system_status', 'System status', 'Scheduled jobs, functions, hosting releases, AI limits.', {}, 'system.status');
    read('audit_log', 'Admin audit log', 'Latest admin actions (console and admin MCP).', { limit: z.number().int().min(1).max(500).optional(), action: z.string().optional() }, 'audit.list', (a) => ({ limit: a.limit ?? 100, action: a.action }));

    write('set_workspace_suspended', 'Suspend / release workspace', 'Suspends or releases a workspace (rules, tokens, flows, scheduled jobs stop).', { id: z.string(), suspended: z.boolean(), reason: z.string().min(10) }, 'workspaces.setSuspended', (a) => ({ id: a.id, suspended: a.suspended, reason: a.reason }), (a) => `${a.suspended ? 'Sperren' : 'Freigeben'}: Workspace ${a.id} — ${a.reason}`);
    write('set_announcement', 'Announcement banner', 'Publishes or turns off the banner for all users.', { active: z.boolean(), type: z.enum(['info', 'maintenance', 'warning']), textDe: z.string().max(400), textEn: z.string().max(400), endsAt: z.string().optional().describe('ISO date') }, 'system.setAnnouncement', (a) => ({ active: a.active, type: a.type, text: { de: a.textDe, en: a.textEn }, endsAt: a.endsAt ?? null, dismissible: true }), (a) => `Banner ${a.active ? `(${a.type}): ${a.textDe}` : 'aus'}`);
    write('set_in_app_ai_rollout', 'In-app AI rollout', 'Sets the inAppAi rollout flag for workspaces.', { tenantIds: z.array(z.string()).min(1).max(50), inAppAi: z.boolean() }, 'ai.setRollout', (a) => ({ tenantIds: a.tenantIds, inAppAi: a.inAppAi }), (a) => `In-App-KI ${a.inAppAi ? 'an' : 'aus'} für ${a.tenantIds.join(', ')}`);
    write('set_workspace_ai_policy', 'Workspace AI policy', 'Changes AI policy flags or the monthly credit limit (null = default).', { id: z.string(), inAppEnabled: z.boolean().optional(), enabled: z.boolean().optional(), monthlyCredits: z.number().int().positive().nullable().optional() }, 'workspaces.setAiPolicy', (a) => ({ id: a.id, policy: Object.fromEntries(Object.entries({ inAppEnabled: a.inAppEnabled, enabled: a.enabled, monthlyCredits: a.monthlyCredits }).filter(([, v]) => v !== undefined)) }), (a) => `KI-Policy ${a.id}: ${JSON.stringify({ inAppEnabled: a.inAppEnabled, enabled: a.enabled, monthlyCredits: a.monthlyCredits })}`);
    write('set_billing_exempt', 'Billing exempt (intern)', 'Marks a workspace as internal (Team incl. AI, no payment) or removes it.', { id: z.string(), exempt: z.boolean(), reason: z.string().min(10) }, 'billing.setExempt', (a) => ({ id: a.id, exempt: a.exempt, reason: a.reason }), (a) => `${a.exempt ? 'Intern' : 'Intern entfernen'}: ${a.id} — ${a.reason}`);
    write('set_storage_override', 'Storage override', 'Sets a storage quota override in GB (null removes it).', { id: z.string(), gigabytes: z.number().int().min(1).max(10240).nullable(), reason: z.string().min(10) }, 'billing.setStorageOverride', (a) => ({ id: a.id, bytes: a.gigabytes == null ? null : a.gigabytes * 1024 ** 3, reason: a.reason }), (a) => `Speicher ${a.id}: ${a.gigabytes == null ? 'Override entfernen' : `${a.gigabytes} GB`} — ${a.reason}`);
    write('set_crash_status', 'Crash status', 'Marks a crash issue open, resolved or ignored.', { id: z.string(), status: z.enum(['open', 'resolved', 'ignored']) }, 'crashes.setStatus', (a) => ({ id: a.id, status: a.status }), (a) => `Crash ${a.id} → ${a.status}`);
    return server;
};

const mcpHandler = toNodeHandler(createMcpHandler((ctx: any) => buildServer(ctx?.authInfo?.extra?.caller as Caller), { responseMode: 'json', onerror: (e: unknown) => console.error('admin MCP error', e) }));

const jsonRpcError = (res: any, status: number, message: string, headers: Record<string, string> = {}) => {
    Object.entries(headers).forEach(([k, v]) => res.set(k, v));
    res.status(status).json({ jsonrpc: '2.0', error: { code: status === 401 ? -32001 : -32000, message }, id: null });
};

const hits = new Map<string, { start: number; count: number }>();
const rateLimited = (key: string) => {
    const now = Date.now();
    const e = hits.get(key);
    if (!e || now - e.start > 60_000) { hits.set(key, { start: now, count: 1 }); return false; }
    e.count += 1;
    return e.count > 60;
};

export const handleAdminMcp = async (req: any, res: any) => {
    const base = baseUrlFor(String(req.headers['x-forwarded-host'] || req.headers.host || ''), emulatorBase(String(req.headers['x-forwarded-host'] || req.headers.host || '')));
    const resource = `${base}/mcp`;
    const prmUrl = `${base}/.well-known/oauth-protected-resource/mcp`;
    res.set('X-Robots-Tag', 'noindex');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
    res.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); return res.status(204).send(''); }
    const path = String(req.path || req.url || '');
    if (req.method === 'GET' && /\/\.well-known\/oauth-protected-resource(\/mcp)?\/?$/.test(path)) {
        res.set('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ resource, authorization_servers: [base], scopes_supported: ['admin:read', 'admin:write'], bearer_methods_supported: ['header'], resource_name: 'ProjectFlow Admin' });
    }
    if (req.method !== 'POST') { res.set('Allow', 'POST, OPTIONS'); return jsonRpcError(res, 405, 'Send MCP JSON-RPC requests with POST.'); }

    const challenge = `Bearer realm="ProjectFlow Admin", resource_metadata="${prmUrl}", scope="admin:read"`;
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return jsonRpcError(res, 401, 'Sign in with the ProjectFlow admin console (OAuth).', { 'WWW-Authenticate': challenge });
    // Only admin tokens: user MCP tokens (pfo_/pfp_/pfat_) live elsewhere and are never looked up here.
    const tokenSnap = token.startsWith(ACCESS_PREFIX) ? await col.tokens().doc(sha256Hex(token)).get() : null;
    const t = tokenSnap?.data();
    const grantSnap = t?.grantId ? await col.grants().doc(String(t.grantId)).get() : null;
    const g = grantSnap?.data();
    const [enabled, client, facts] = await Promise.all([
        killSwitchOn(),
        g?.clientId ? col.clients().doc(String(g.clientId)).get().then((c) => c.data() || null) : Promise.resolve(null),
        g?.uid ? adminFacts(String(g.uid)) : Promise.resolve({ user: null, allowlist: null }),
    ]);
    const decision = decideAccess({
        killSwitchOn: enabled,
        token: t ? { type: t.type, expireAtMs: t.expireAt?.toMillis?.() ?? 0, resource: t.resource, grantId: t.grantId, uid: t.uid } : null,
        requestResource: resource,
        grant: g ? { uid: g.uid, clientId: g.clientId, revokedAtMs: g.revokedAt ? (g.revokedAt.toMillis?.() ?? 1) : null, createdAtMs: g.createdAt?.toMillis?.() ?? 0, expiresAtMs: g.expiresAt?.toMillis?.() ?? 0 } : null,
        client: client ? { status: client.status } : null,
        user: facts.user,
        allowlist: facts.allowlist,
        nowMs: Date.now(),
    });
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 64);
    if (!decision.ok) {
        if (g?.uid) await writeAudit(db, { uid: String(g.uid), email: facts.user?.email ?? null, action: 'mcp:refused', ok: false, error: decision.reason, ip }).catch(() => undefined);
        const headers: Record<string, string> = decision.status === 401 ? { 'WWW-Authenticate': `${challenge}, error="invalid_token"` } : {};
        return jsonRpcError(res, decision.status, decision.reason, headers);
    }
    if (rateLimited(String(grantSnap!.id))) { res.set('Retry-After', '60'); return jsonRpcError(res, 429, 'Rate limit exceeded (60/min).'); }
    void grantSnap!.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => undefined);

    const caller: Caller = {
        grantId: grantSnap!.id,
        scopes: new Set<string>(Array.isArray(g!.scopes) ? g!.scopes : ['admin:read']),
        clientName: String(g!.clientName || g!.clientId),
        ctx: { uid: String(g!.uid), email: facts.user!.email, sessionId: `mcp:${grantSnap!.id}`, db, ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 200), channel: 'mcp' },
    };
    (req as any).auth = { token, clientId: g!.clientId, scopes: [...caller.scopes], extra: { caller } };
    try {
        await mcpHandler(req as any, res as any, req.body);
    } catch (error) {
        console.error('admin MCP request failed', error);
        if (!res.headersSent) jsonRpcError(res, 500, 'Internal server error.');
    }
};

export const adminMcp = onRequest({ region: REGION, memory: '512MiB', timeoutSeconds: 120, concurrency: 40, secrets: ['STRIPE_SECRET_KEY'] }, handleAdminMcp);
