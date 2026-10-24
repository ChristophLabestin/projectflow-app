/**
 * Action cards for the in-app assistant (brain/plans/in-app-ai-concept.md §5 D, package P3).
 *
 * The model may call write tools, but `aiAssist` only stores a proposal (`users/{uid}/ai_proposals/{id}`,
 * Admin SDK only) and streams a preview card. The user applies it with `aiApplyProposal`, which runs the
 * tool through the REST API with the user's own ID token, writes the AI audit log and keeps an undo
 * step; `aiUndoProposal` reverts it (created items are deleted, changed fields restored).
 */
import * as functions from 'firebase-functions/v1';
import { FAST_START } from './runtime-options';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from './init';
import { writeAiAudit } from './ai-store';
import { callApi, compact } from './ai-tools/api';
import { findTool, parseToolArgs, type ToolContext } from './ai-tools/registry';

const REGION = 'europe-west3';
const PROPOSAL_TTL_MS = 2 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_PROPOSALS_PER_TURN = 10;

export interface ProposalChange { field: string; from?: unknown; to: unknown }

export interface ProposalPreview {
    id: string;
    tool: string;
    target: { projectId: string; projectTitle?: string; taskId?: string; taskTitle?: string };
    changes: ProposalChange[];
}

interface UndoStep { method: 'DELETE' | 'PATCH'; path: string; body?: Record<string, unknown> }

const proposalRef = (uid: string, id: string) => db.doc(`users/${uid}/ai_proposals/${id}`);

const clipValue = (value: unknown) => (typeof value === 'string' && value.length > 400 ? `${value.slice(0, 400)}…` : value);

const get = async (ctx: ToolContext, path: string) => {
    const result = await callApi(ctx.idToken, 'GET', path, { tenantId: ctx.tenantId });
    return result.status < 400 ? result.payload : null;
};

const UPDATE_FIELDS = ['title', 'description', 'status', 'priority', 'dueDate', 'assigneeIds'] as const;

/** Pure: which fields change and from what (for update previews and the undo body). */
export const diffTaskUpdate = (current: Record<string, unknown>, args: Record<string, unknown>) => {
    const changes: ProposalChange[] = [];
    const before: Record<string, unknown> = {};
    for (const field of UPDATE_FIELDS) {
        if (!(field in args) || args[field] === undefined) continue;
        const from = current[field] ?? (field === 'assigneeIds' ? [] : '');
        if (JSON.stringify(from) === JSON.stringify(args[field])) continue;
        changes.push({ field, from: clipValue(from), to: clipValue(args[field]) });
        before[field] = from;
    }
    if ('status' in before) before.isCompleted = before.status === 'Done';
    return { changes, before };
};

/** Validate a write tool call, build its preview and store it as a pending proposal. */
export const createProposal = async (ctx: ToolContext, toolName: string, rawArgs: string): Promise<ProposalPreview> => {
    const entry = findTool(toolName);
    if (!entry || entry.kind !== 'write') throw new Error(`Unknown write tool ${toolName}.`);
    const args = parseToolArgs(entry, rawArgs) as Record<string, any>;
    const projectId = String(args.projectId);
    const taskId: string | undefined = args.taskId;

    const [projectPayload, taskPayload] = await Promise.all([
        get(ctx, `/projects/${projectId}`),
        taskId ? get(ctx, `/projects/${projectId}/tasks/${taskId}`) : Promise.resolve(null)
    ]);
    if (!projectPayload?.project) throw new Error('Project not found or not accessible.');
    if (taskId && !taskPayload?.task) throw new Error('Task not found or not accessible.');

    let changes: ProposalChange[] = [];
    let before: Record<string, unknown> | null = null;
    if (toolName === 'create_task') {
        changes = Object.entries(compact({ title: args.title, description: args.description, status: args.status, priority: args.priority, dueDate: args.dueDate, assigneeIds: args.assigneeIds }))
            .map(([field, to]) => ({ field, to: clipValue(to) }));
    } else if (toolName === 'update_task') {
        const diff = diffTaskUpdate(taskPayload.task, args);
        if (!diff.changes.length) throw new Error('Nothing would change.');
        changes = diff.changes;
        before = diff.before;
    } else if (toolName === 'add_comment') {
        changes = [{ field: 'comment', to: clipValue(args.content) }];
    } else if (toolName === 'add_subtask') {
        changes = [{ field: 'subtask', to: clipValue(args.title) }];
    }

    const ref = db.collection(`users/${ctx.uid}/ai_proposals`).doc();
    const preview: ProposalPreview = {
        id: ref.id,
        tool: toolName,
        target: compact({ projectId, projectTitle: projectPayload.project.title, taskId, taskTitle: taskPayload?.task?.title }) as ProposalPreview['target'],
        changes
    };
    await ref.set({
        tenantId: ctx.tenantId,
        tool: toolName,
        args,
        before,
        preview,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + PROPOSAL_TTL_MS)
    });
    return preview;
};

/** Pure: the step that reverts an applied proposal. */
export const undoStepFor = (tool: string, args: Record<string, any>, before: Record<string, unknown> | null, payload: any): UndoStep | null => {
    const projectId = args.projectId;
    if (tool === 'create_task' && payload?.task?.id) return { method: 'DELETE', path: `/projects/${projectId}/tasks/${payload.task.id}` };
    if (tool === 'update_task' && before) return { method: 'PATCH', path: `/projects/${projectId}/tasks/${args.taskId}`, body: before };
    if (tool === 'add_comment' && payload?.comment?.id) return { method: 'DELETE', path: `/projects/${projectId}/comments/${payload.comment.id}` };
    if (tool === 'add_subtask' && payload?.subtask?.id) return { method: 'DELETE', path: `/projects/${projectId}/tasks/${args.taskId}/subtasks/${payload.subtask.id}` };
    return null;
};

const PERMISSIONS: Record<string, string> = { create_task: 'tasks:write', update_task: 'tasks:write', add_comment: 'comments:write', add_subtask: 'tasks:write' };

const idTokenFrom = (context: functions.https.CallableContext) => {
    const header = String(context.rawRequest?.headers?.authorization || '');
    return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const loadOwnProposal = async (context: functions.https.CallableContext, proposalId: unknown) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    if (typeof proposalId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(proposalId)) throw new functions.https.HttpsError('invalid-argument', 'Invalid proposal.');
    const ref = proposalRef(context.auth.uid, proposalId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new functions.https.HttpsError('not-found', 'Proposal not found or expired.');
    const idToken = idTokenFrom(context);
    if (!idToken) throw new functions.https.HttpsError('unauthenticated', 'Missing ID token.');
    return { ref, data: snapshot.data() as any, ctx: { idToken, uid: context.auth.uid, tenantId: snapshot.data()?.tenantId } as ToolContext };
};

const audit = (ctx: ToolContext, method: string, path: string, projectId: string, permission: string, status: number) =>
    writeAiAudit({
        tenantId: ctx.tenantId, kind: 'firebase', actorId: ctx.uid, credentialId: null, credentialLabel: null,
        clientName: 'ProjectFlow KI (in-app)', permission, method, path, projectId, status
    }).catch((error) => console.error('AI audit write failed', { tenantId: ctx.tenantId, message: error?.message }));

export const aiApplyProposal = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    const { ref, data: proposal, ctx } = await loadOwnProposal(context, data?.proposalId);
    if (proposal.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'This proposal was already handled.');
    if (proposal.expireAt?.toMillis?.() < Date.now()) throw new functions.https.HttpsError('deadline-exceeded', 'This proposal has expired.');
    const entry = findTool(proposal.tool);
    if (!entry || entry.kind !== 'write') throw new functions.https.HttpsError('invalid-argument', 'Unknown action.');

    // Claim first so a double click cannot apply twice.
    const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (fresh.data()?.status !== 'pending') return false;
        tx.update(ref, { status: 'applying' });
        return true;
    });
    if (!claimed) throw new functions.https.HttpsError('failed-precondition', 'This proposal was already handled.');

    try {
        const payload: any = await entry.run(ctx, proposal.args);
        const undo = undoStepFor(proposal.tool, proposal.args, proposal.before, payload);
        await ref.update({ status: 'applied', appliedAt: FieldValue.serverTimestamp(), undo, expireAt: Timestamp.fromMillis(Date.now() + UNDO_WINDOW_MS) });
        await audit(ctx, entry.name === 'update_task' ? 'PATCH' : 'POST', `ai:${entry.name}`, proposal.args.projectId, PERMISSIONS[entry.name], 200);
        const createdId = payload?.task?.id || payload?.comment?.id || payload?.subtask?.id || null;
        return { status: 'applied', canUndo: Boolean(undo), createdId };
    } catch (error: any) {
        await ref.update({ status: 'failed', error: String(error?.message || 'failed').slice(0, 300) });
        await audit(ctx, 'POST', `ai:${entry.name}`, proposal.args.projectId, PERMISSIONS[entry.name], 400);
        throw new functions.https.HttpsError('failed-precondition', error?.message || 'The change could not be applied.');
    }
});

export const aiUndoProposal = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    const { ref, data: proposal, ctx } = await loadOwnProposal(context, data?.proposalId);
    if (proposal.status !== 'applied' || !proposal.undo) throw new functions.https.HttpsError('failed-precondition', 'Nothing to undo.');
    if (proposal.appliedAt?.toMillis?.() < Date.now() - UNDO_WINDOW_MS) throw new functions.https.HttpsError('deadline-exceeded', 'Too late to undo.');
    const step: UndoStep = proposal.undo;
    const result = await callApi(ctx.idToken, step.method, step.path, { tenantId: ctx.tenantId, body: step.body });
    await audit(ctx, step.method, `ai:undo:${proposal.tool}`, proposal.args.projectId, PERMISSIONS[proposal.tool], result.status);
    if (result.status >= 400) throw new functions.https.HttpsError('failed-precondition', result.payload?.error || 'Undo failed.');
    await ref.update({ status: 'undone', undoneAt: FieldValue.serverTimestamp() });
    return { status: 'undone' };
});
