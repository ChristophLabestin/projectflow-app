/**
 * In-app assistant endpoint (`aiAssist`, Gen2, Server-Sent Events). Concept: brain/plans/in-app-ai-concept.md.
 *
 * POST { tenantId, capability: 'write' | 'assist' | 'snap', language, input | messages + context }
 * Snap: input { image: data URL, note?, projectId? } → `snap` event (kind, summary) + one `proposal` per task draft.
 * Authorization: Bearer <Firebase ID token>
 *
 * Events: `context` (resolved chips), `step` (tool call), `delta` (text), `done` (credits), `error`.
 * Tools run through the REST API with the user's own ID token, so the assistant never exceeds the
 * user's rights. Write tools only create proposals (`proposal` event); the user applies them via
 * `aiApplyProposal` (ai-actions.ts).
 */
import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

import { db } from './init';
import { ALLOWED_ORIGINS } from './corsConfig';
import { normalizeRole } from './ai-access';
import { isTenantSuspended, SUSPENDED_MESSAGE } from './tenant-status';
import { aiPolicyRef, loadAiPolicy } from './ai-store';
import { consumeAiQuota, trackUsage } from './ai-service';
import { aiGateFor, resolveAiAccess } from './billing';
import { refundCredits, reserveCredits, recordModelUsage, resolveMonthlyLimit, type CreditCapability } from './ai-credits';
import { streamTurn, tierModel, ModelError, type ModelTier, type ModelUsage } from './ai-models';
import {
    AssistInputError, buildAssistInstructions, buildWriteRequest, normalizeContext, normalizeMessages,
    renderContextBlock, type AssistContext, type ResolvedContext
} from './ai-assist-prompts';
import { AI_TOOLS, findTool, parseToolArgs, serializeToolResult, toOpenAiTools, ToolError, type ToolContext } from './ai-tools/registry';
import { createProposal, MAX_PROPOSALS_PER_TURN } from './ai-actions';
import { callApi, compact, summarizeProject } from './ai-tools/api';
import { normalizeSnapInput, runSnap, SnapInputError } from './ai-snap';
import { normalizeLanguage } from './ai-capabilities';

const REGION = 'europe-west3';
/** Emulator: any local dev port may call (dev-e2e runs on custom ports). */
const CORS_ORIGINS: Array<string | RegExp> = process.env.FUNCTIONS_EMULATOR === 'true'
    ? [...ALLOWED_ORIGINS, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/]
    : ALLOWED_ORIGINS;
const MAX_TOOL_ROUNDS = 5;

/** Rollout default when a workspace has not set `inAppAi` (env `AI_IN_APP_DEFAULT=true` opens it for all). */
const ROLLOUT_DEFAULT = process.env.AI_IN_APP_DEFAULT === 'true';

class HttpError extends Error {
    constructor(readonly status: number, message: string, readonly code = 'error') {
        super(message);
    }
}

type Send = (event: string, data: unknown) => void;

const authenticate = async (req: any) => {
    const header = String(req.headers?.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new HttpError(401, 'Missing ID token.', 'unauthenticated');
    try {
        const decoded = await getAuth().verifyIdToken(token);
        return { idToken: token, uid: decoded.uid };
    } catch {
        throw new HttpError(401, 'Invalid ID token.', 'unauthenticated');
    }
};

const authorizeWorkspace = async (tenantId: string, uid: string) => {
    const [member, policy, rawPolicy] = await Promise.all([
        db.doc(`tenants/${tenantId}/members/${uid}`).get(),
        loadAiPolicy(tenantId),
        aiPolicyRef(tenantId).get()
    ]);
    if (await isTenantSuspended(tenantId)) throw new HttpError(403, SUSPENDED_MESSAGE, 'suspended');
    const role = normalizeRole(member.data()?.role);
    if (!member.exists || !role) throw new HttpError(403, 'Not a member of this workspace.', 'forbidden');
    const flag = rawPolicy.data()?.inAppAi;
    const rolledOut = typeof flag === 'boolean' ? flag : ROLLOUT_DEFAULT;
    if (!rolledOut || !policy.inAppEnabled) throw new HttpError(403, 'The AI assistant is not enabled for this workspace.', 'disabled');
    return { role, monthlyLimit: resolveMonthlyLimit(rawPolicy.data()) };
};

const resolveContext = async (ctx: ToolContext, context: AssistContext): Promise<ResolvedContext> => {
    const resolved: ResolvedContext = {};
    const projectId = context.entity?.projectId || context.projectId || (context.entity?.kind === 'project' ? context.entity.id : undefined);
    const jobs: Promise<void>[] = [];
    if (projectId) {
        jobs.push(callApi(ctx.idToken, 'GET', `/projects/${projectId}`, { tenantId: ctx.tenantId }).then((result) => {
            if (result.status < 400 && result.payload?.project) resolved.project = summarizeProject(result.payload.project);
        }));
    }
    if (context.entity?.kind === 'task' && projectId) {
        jobs.push(callApi(ctx.idToken, 'GET', `/projects/${projectId}/tasks/${context.entity.id}`, { tenantId: ctx.tenantId }).then((result) => {
            const task = result.status < 400 ? result.payload?.task : null;
            if (task) {
                resolved.task = compact({
                    id: task.id, projectId, title: task.title, status: task.status, priority: task.priority,
                    dueDate: task.dueDate || undefined, assigneeIds: task.assigneeIds?.length ? task.assigneeIds : undefined,
                    description: typeof task.description === 'string' && task.description ? task.description.slice(0, 1500) : undefined
                });
            }
        }));
    }
    await Promise.all(jobs.map((job) => job.catch(() => undefined)));
    return resolved;
};

const addUsage = (total: ModelUsage, usage: ModelUsage) => {
    total.inputTokens += usage.inputTokens;
    total.outputTokens += usage.outputTokens;
    total.cachedTokens += usage.cachedTokens;
};

const runWrite = async (body: any, send: Send, signal: AbortSignal, ownKey?: string): Promise<ModelUsage> => {
    const request = buildWriteRequest(body.input, body.language);
    const turn = await streamTurn({ tier: 'fast', ...request, signal, ownKey }, (delta) => send('delta', { text: delta }));
    return turn.usage;
};

const runAssist = async (body: any, ctx: ToolContext, send: Send, signal: AbortSignal, ownKey?: string): Promise<ModelUsage> => {
    const messages = normalizeMessages(body.messages);
    const context = normalizeContext(body.context, body.language);
    const resolved = await resolveContext(ctx, context);
    send('context', compact({
        surface: context.surface,
        project: resolved.project ? { id: resolved.project.id, title: resolved.project.title } : undefined,
        task: resolved.task ? { id: resolved.task.id, title: resolved.task.title } : undefined,
        selected: context.selectionIds.length || undefined
    }));

    const tools = AI_TOOLS;
    let proposals = 0;
    const instructions = buildAssistInstructions(context.language, renderContextBlock(context, resolved));
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
    let turn = await streamTurn({ tier: 'agent', instructions, input: messages, tools: toOpenAiTools(tools), signal, ownKey }, (delta) => send('delta', { text: delta }));
    addUsage(usage, turn.usage);

    for (let round = 0; round < MAX_TOOL_ROUNDS && turn.functionCalls.length; round++) {
        const outputs = await Promise.all(turn.functionCalls.map(async (call) => {
            const entry = findTool(call.name);
            send('step', { tool: call.name });
            let output: string;
            try {
                if (!entry) throw new ToolError(`Unknown tool ${call.name}.`);
                if (entry.kind === 'write') {
                    // Never executed here: the user confirms the card (P3).
                    if (++proposals > MAX_PROPOSALS_PER_TURN) throw new ToolError('Too many changes in one answer; ask the user to narrow it down.');
                    const preview = await createProposal(ctx, call.name, call.arguments);
                    send('proposal', preview);
                    output = JSON.stringify({ status: 'proposed', proposalId: preview.id, note: 'Shown to the user as a card to confirm. Not applied yet.' });
                } else {
                    output = serializeToolResult(await entry.run(ctx, parseToolArgs(entry, call.arguments)));
                }
            } catch (error: any) {
                output = JSON.stringify({ error: error instanceof ToolError || error instanceof Error ? error.message : 'Tool failed.' });
            }
            return { type: 'function_call_output' as const, call_id: call.callId, output };
        }));
        turn = await streamTurn({
            tier: 'agent', instructions, input: outputs, previousResponseId: turn.responseId, tools: toOpenAiTools(tools), signal, ownKey
        }, (delta) => send('delta', { text: delta }));
        addUsage(usage, turn.usage);
    }
    return usage;
};

const runSnapCapability = async (body: any, ctx: ToolContext, send: Send, ownKey?: string): Promise<ModelUsage> => {
    const input = normalizeSnapInput(body.input);
    const language = normalizeLanguage(body.language);
    const context = normalizeContext(body.context, body.language);
    const currentProjectId = input.projectId || context.entity?.projectId || context.projectId || (context.entity?.kind === 'project' ? context.entity.id : undefined);
    const listed = await callApi(ctx.idToken, 'GET', '/projects', { tenantId: ctx.tenantId });
    const projects = (listed.status < 400 ? listed.payload?.projects || [] : [])
        .filter((project: any) => !['Completed', 'Canceled'].includes(project.status))
        .map((project: any) => ({ id: String(project.id), title: String(project.title || '') }));
    if (currentProjectId && !projects.some((project: { id: string }) => project.id === currentProjectId)) {
        const current = await callApi(ctx.idToken, 'GET', `/projects/${currentProjectId}`, { tenantId: ctx.tenantId });
        if (current.status < 400 && current.payload?.project) projects.unshift({ id: currentProjectId, title: String(current.payload.project.title || '') });
    }
    if (!projects.length) throw new HttpError(400, 'Create a project first.', 'invalid-argument');
    const validCurrent = currentProjectId && projects.some((project: { id: string }) => project.id === currentProjectId) ? currentProjectId : undefined;

    const result = await runSnap({ input, language, projects, currentProjectId: validCurrent, ownKey, onStep: (step) => send('step', { tool: step }) });
    send('snap', compact({ kind: result.kind, confidence: Math.round(result.confidence * 100) / 100, summary: result.summary || undefined }));
    if (!result.projectId || !result.drafts.length) return result.usage;
    for (const draft of result.drafts) {
        try {
            const preview = await createProposal(ctx, 'create_task', JSON.stringify({ projectId: result.projectId, ...draft }));
            send('proposal', preview);
        } catch (error: any) {
            console.warn('snap proposal skipped', { tenantId: ctx.tenantId, message: error?.message });
        }
    }
    return result.usage;
};

const CAPABILITIES: Record<string, { credit: CreditCapability; tier: ModelTier }> = {
    write: { credit: 'write', tier: 'fast' },
    assist: { credit: 'assist', tier: 'agent' },
    snap: { credit: 'snap', tier: 'agent' }
};

export const aiAssist = onRequest({
    region: REGION,
    cors: CORS_ORIGINS,
    secrets: ['OPENAI_API_KEY', 'AI_KEY_ENCRYPTION_KEY'],
    memory: '512MiB',
    timeoutSeconds: 120,
    concurrency: 40
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed.' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const capability = CAPABILITIES[String(body.capability)];
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    let uid = '';
    let started = false;
    const abort = new AbortController();
    // Client went away before we finished: stop the model stream (req 'close' fires after the body is read).
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });

    const send: Send = (event, data) => {
        if (!started) {
            res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
            started = true;
        }
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        if (!capability) throw new HttpError(400, 'Unknown capability.', 'invalid-argument');
        if (!tenantId) throw new HttpError(400, 'tenantId is required.', 'invalid-argument');
        const auth = await authenticate(req);
        uid = auth.uid;
        const { role, monthlyLimit } = await authorizeWorkspace(tenantId, uid);
        if (body.capability !== 'write' && role === 'Guest') throw new HttpError(403, 'The assistant is not available for guests yet.', 'forbidden');
        // Free workspaces have no included AI (brain/plans/billing-implementation.md).
        // AI per user: trial/beta for all members, otherwise the AI add-on (brain/plans/billing-entitlements-contract.md).
        // Without server AI the user may run on their own OpenAI key (BYOK, billing-entitlements-contract.md):
        // no quota, no workspace credits, costs on their key.
        let ownKey: string | undefined;
        const aiGate = await aiGateFor(tenantId, uid);
        if (aiGate) {
            const access = await resolveAiAccess(uid);
            if (access.mode !== 'own-key') throw new HttpError(402, 'AI is not enabled for you in this workspace.', aiGate);
            ownKey = access.apiKey;
        }

        // Validate before spending anything.
        if (body.capability === 'write') buildWriteRequest(body.input, body.language);
        else if (body.capability === 'snap') normalizeSnapInput(body.input);
        else normalizeMessages(body.messages);

        let credits: { ok: boolean; used: number; limit: number } | null = null;
        if (!ownKey) {
            await consumeAiQuota(uid, 'text').catch(() => {
                throw new HttpError(429, 'Daily AI limit reached.', 'resource-exhausted');
            });
            credits = await reserveCredits(tenantId, uid, capability.credit, monthlyLimit);
            if (!credits.ok) throw new HttpError(429, 'The workspace has used its AI credits for this month.', 'credits-exhausted');
        }

        const ctx: ToolContext = { idToken: auth.idToken, tenantId, uid };
        let usage: ModelUsage;
        try {
            usage = body.capability === 'write'
                ? await runWrite(body, send, abort.signal, ownKey)
                : body.capability === 'snap'
                    ? await runSnapCapability(body, ctx, send, ownKey)
                    : await runAssist(body, ctx, send, abort.signal, ownKey);
        } catch (error) {
            // Nothing useful reached the user: give the credits back.
            if (credits) await refundCredits(tenantId, uid, capability.credit).catch(() => undefined);
            throw error;
        }

        if (!credits) {
            send('done', { ownKey: true });
            res.end();
            return;
        }
        const { model, serviceTier } = tierModel(capability.tier);
        await Promise.all([
            recordModelUsage(tenantId, uid, model, usage, serviceTier),
            trackUsage(uid, usage.inputTokens + usage.outputTokens)
        ]).catch((error) => console.error('aiAssist usage write failed', { tenantId, message: error?.message }));
        send('done', { credits: credits.used, limit: credits.limit });
    } catch (error: any) {
        const known = error instanceof HttpError
            ? error
            : error instanceof AssistInputError || error instanceof SnapInputError
                ? new HttpError(400, error.message, 'invalid-argument')
                : error instanceof ModelError
                    ? new HttpError(error.kind === 'quota' ? 503 : 502, error.message, error.kind === 'quota' ? 'provider-quota' : 'provider-unavailable')
                    : new HttpError(500, 'AI request failed.', 'internal');
        if (!(error instanceof HttpError || error instanceof AssistInputError || error instanceof SnapInputError)) {
            console.error('aiAssist failed', { tenantId, uid, message: error?.message });
        }
        if (started) {
            send('error', { code: known.code, message: known.message });
        } else {
            res.status(known.status).json({ error: known.message, code: known.code });
            return;
        }
    }
    res.end();
});
