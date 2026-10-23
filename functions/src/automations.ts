// Flows (automations) — runtime: event trigger, scheduler, executor and callables.
// Pure rules live in automation-logic.ts. Concept: brain/plans/flows-concept.md.
//
// Permission model: a flow acts as the workspace bot (`writeVia.kind = 'automation'`, actor shows the
// flow name) but never beyond its owner (last editor): every run re-checks the owner's membership.
import * as functions from 'firebase-functions/v1';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { DocumentReference, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './init';
import { emitActivityEvent } from './activity-events';
import { createNotificationDoc, getActor } from './notification-writer';
import { loadAiPolicy } from './ai-store';
import { SUSPENDED_MESSAGE, assertTenantActive, isTenantSuspended, suspendedTenantIds } from './tenant-status';
import { AI_KEY_SECRETS, ownAiKeyFor } from './billing';
import { aiEnabledFor } from './billing-logic';
import { aiDecide, aiGenerate, DecideResult, GenerateRequest } from './ai-decide';
import { DraftContext, FLOW_DRAFT_SCHEMA, draftFromModel, flowDraftInstructions } from './automation-draft';
import {
    Action,
    AUTOMATION_LIMITS,
    AUTOMATION_SCHEMA_VERSION,
    AutomationDef,
    AutomationValidationError,
    EVENT_TO_TRIGGER,
    EvalContext,
    Json,
    PeopleContext,
    Role,
    StreamEvent,
    TASK_ACTIONS,
    TASK_PRIORITIES,
    TIME_TRIGGERS,
    AiDecisionRecord,
    addDays,
    aiQuestionFor,
    aiRulesOf,
    aiVerdictFor,
    aiWorkItemText,
    assigneesOf,
    canManageAutomation,
    checkLimits,
    flowQuotaFor,
    computeNextRunAt,
    conditionsNeedTask,
    dueScanDate,
    evaluateConditions,
    evaluateConditionsTri,
    flowTimeZone,
    hourKey,
    isTaskDone,
    isTransientError,
    labelsOf,
    loopGuard,
    matchesTrigger,
    minuteKey,
    monthKey,
    nextFailureState,
    normalizeAutomation,
    planTaskPatch,
    renderTemplate,
    resolvePeople,
    runIdFor,
    slotKey,
    statusTransition,
    subjectTaskId
} from './automation-logic';
import { localDateKey } from './tz-utils';

const REGION = 'europe-west3';
const ALREADY_EXISTS = 6;
const DAY_MS = 86400000;

const automationsCol = (tenantId: string) => db.collection(`tenants/${tenantId}/automations`);
const runsCol = (tenantId: string) => db.collection(`tenants/${tenantId}/automation_runs`);
const usageRef = (tenantId: string, nowMs: number) => db.doc(`tenants/${tenantId}/automation_usage/${monthKey(nowMs)}`);
const throttleRef = (tenantId: string, key: string) => db.doc(`tenants/${tenantId}/automation_throttle/${key.replace(/[^A-Za-z0-9_-]/g, '_')}`);
const taskRefOf = (tenantId: string, projectId: string, taskId: string) =>
    db.doc(`tenants/${tenantId}/projects/${projectId}/tasks/${taskId}`);
const projectRefOf = (tenantId: string, projectId: string) => db.doc(`tenants/${tenantId}/projects/${projectId}`);

const expireIn = (days: number) => Timestamp.fromMillis(Date.now() + days * DAY_MS);

/** Billing entitlements (null = legacy workspace in grace) and the resulting flow quota. */
const loadFlowQuota = async (tenantId: string) => {
    const [tenantSnap, entSnap] = await Promise.all([
        db.doc(`tenants/${tenantId}`).get(),
        db.doc(`tenants/${tenantId}/entitlements/plan`).get()
    ]);
    const entitlement = entSnap.exists ? (entSnap.data() as Json) : null;
    return { entitlement, quota: flowQuotaFor(entitlement, tenantSnap.data()) };
};

/** Billing codes (brain/plans/billing-entitlements-contract.md §3) used by Flows. */
export const FLOW_PLAN_ERRORS = {
    activeLimit: 'plan-flow-limit',
    runsLimit: 'plan-flow-runs-limit',
    aiLimit: 'plan-flow-ai-limit',
    aiNotEnabled: 'ai-not-enabled'
} as const;

const FLOW_SECRETS = ['OPENAI_API_KEY', ...AI_KEY_SECRETS];

// ---------------------------------------------------------------------------
// AI (narrow interface over ai-decide.ts; emulator tests answer from `_test/flowsAi`)
// ---------------------------------------------------------------------------

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

const emulatorFake = async (): Promise<Json | null> => {
    if (process.env.FUNCTIONS_EMULATOR !== 'true' && !process.env.FIRESTORE_EMULATOR_HOST) return null;
    const snap = await db.doc('_test/flowsAi').get();
    return snap.exists ? (snap.data() as Json) : null;
};

export const flowAi = {
    decide: async (request: Parameters<typeof aiDecide>[0]): Promise<DecideResult> => {
        const fake = await emulatorFake();
        if (!fake) return aiDecide(request);
        return {
            answers: request.questions.map((q) => (fake.answers?.[q.type] ? { ...fake.answers[q.type], type: q.type, name: q.name } : { type: 'refusal', name: q.name })),
            usage: ZERO_USAGE
        };
    },
    generate: async <T>(request: GenerateRequest): Promise<{ data: T; usage: typeof ZERO_USAGE }> => {
        const fake = await emulatorFake();
        if (!fake) return aiGenerate<T>(request);
        if (!fake.generate?.[request.schema.name]) throw new Error(`No fake AI output for ${request.schema.name}`);
        return { data: fake.generate[request.schema.name] as T, usage: ZERO_USAGE };
    }
};

// ---------------------------------------------------------------------------
// Run context
// ---------------------------------------------------------------------------

/** Persisted on the run so delays, resumes and retries see the same trigger data. */
interface RunContext {
    trigger: string;
    eventId: string | null;
    eventType: string | null;
    projectId: string | null;
    taskId: string | null;
    actorId: string | null;
    actorName: string;
    commentText: string;
    eventUserIds: string[];
    statusFrom: string | null;
    statusTo: string | null;
    vars: Record<string, string>;
}

const contextFromEvent = (event: StreamEvent): RunContext => {
    const actor = event.actor || {};
    const human = actor.kind === 'user' || actor.kind === 'ai';
    const { from, to } = statusTransition(event);
    const eventUserIds = Array.isArray(event.meta?.assigneeIds)
        ? event.meta!.assigneeIds
        : Array.isArray(event.meta?.userIds) ? event.meta!.userIds : [];
    return {
        trigger: EVENT_TO_TRIGGER[event.type] || event.type,
        eventId: event.id,
        eventType: event.type,
        projectId: event.projectId || null,
        taskId: subjectTaskId(event),
        actorId: human ? actor.id || null : null,
        actorName: String(actor.name || ''),
        commentText: String(event.meta?.snippet || ''),
        eventUserIds: eventUserIds.filter((id: unknown) => typeof id === 'string'),
        statusFrom: from,
        statusTo: to,
        vars: {}
    };
};

const emptyContext = (trigger: string, projectId: string | null, taskId: string | null, actorId: string | null = null): RunContext => ({
    trigger, eventId: null, eventType: null, projectId, taskId, actorId, actorName: '', commentText: '', eventUserIds: [],
    statusFrom: null, statusTo: null, vars: {}
});

// ---------------------------------------------------------------------------
// Membership helpers
// ---------------------------------------------------------------------------

const memberRole = async (tenantId: string, uid: string): Promise<Role | null> => {
    if (!uid) return null;
    const snap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
    const role = snap.exists ? snap.data()?.role : null;
    return role === 'Owner' || role === 'Admin' || role === 'Member' || role === 'Guest' ? role : null;
};

const adminIdsOf = async (tenantId: string): Promise<string[]> => {
    const snap = await db.collection(`tenants/${tenantId}/members`).where('role', 'in', ['Owner', 'Admin']).get();
    return snap.docs.map((doc) => doc.id);
};

const filterMembers = async (tenantId: string, uids: string[]): Promise<string[]> => {
    if (uids.length === 0) return [];
    const refs = uids.map((uid) => db.doc(`tenants/${tenantId}/members/${uid}`));
    const snaps = await db.getAll(...refs);
    return snaps.filter((snap) => snap.exists && snap.data()?.role !== 'Guest').map((snap) => snap.id);
};

// ---------------------------------------------------------------------------
// Starting runs (idempotency + limits in one transaction)
// ---------------------------------------------------------------------------

interface StartInput {
    tenantId: string;
    automationId: string;
    automation: Json;
    key: string;
    depth: number;
    context: RunContext;
    entityId: string;
    decisions?: AiDecisionRecord[];
}

/** Creates the run doc. `runId` null = duplicate or skipped (`skipReason` set when a limit hit). */
const startRun = async (input: StartInput): Promise<{ runId: string | null; skipReason?: string }> => {
    const { tenantId, automationId, automation, key, depth, context, entityId, decisions } = input;
    const now = Date.now();
    const runId = runIdFor(automationId, key);
    const runRef = runsCol(tenantId).doc(runId);
    const { quota: limits } = await loadFlowQuota(tenantId);
    const monthRef = usageRef(tenantId, now);
    const minuteRef = throttleRef(tenantId, `t_${minuteKey(now)}`);
    const entityRef = throttleRef(tenantId, `${automationId}_${entityId}_${hourKey(now)}`);

    const base = {
        automationId,
        automationName: automation.name || '',
        projectId: context.projectId,
        trigger: context.trigger,
        eventId: context.eventId,
        taskId: context.taskId,
        depth,
        context,
        ...(decisions?.length ? { decisions } : {}),
        steps: [],
        nextStep: 0,
        attempt: 1,
        startedAt: FieldValue.serverTimestamp(),
        expireAt: expireIn(AUTOMATION_LIMITS.runRetentionDays)
    };

    // The usage doc carries the current quota so the UI shows "x of y" without knowing the plan rules.
    const quotaFields = { runsLimit: limits.runsPerMonth, aiStepsLimit: limits.aiStepsPerMonth, activeLimit: limits.activeFlowsPerWorkspace, quotaTier: limits.tier || 'legacy' };
    return db.runTransaction(async (tx) => {
        const [run, month, minute, entity] = await tx.getAll(runRef, monthRef, minuteRef, entityRef);
        if (run.exists) return { runId: null };
        const decision = checkLimits({
            monthRuns: Number(month.data()?.runs || 0),
            minuteRuns: Number(minute.data()?.count || 0),
            entityHourRuns: Number(entity.data()?.count || 0),
            limits
        });
        if (!decision.ok) {
            tx.create(runRef, { ...base, status: 'skipped_limit', skipReason: decision.reason, finishedAt: FieldValue.serverTimestamp() });
            tx.set(monthRef, { month: monthKey(now), skipped: FieldValue.increment(1), ...quotaFields }, { merge: true });
            return { runId: null, skipReason: decision.reason };
        }
        tx.create(runRef, { ...base, status: 'running' });
        tx.set(monthRef, { month: monthKey(now), runs: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp(), ...quotaFields }, { merge: true });
        tx.set(minuteRef, { count: FieldValue.increment(1), expireAt: expireIn(1) }, { merge: true });
        tx.set(entityRef, { count: FieldValue.increment(1), expireAt: expireIn(1) }, { merge: true });
        return { runId };
    });
};

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

interface ExecState {
    tenantId: string;
    automationId: string;
    automation: Json;
    runId: string;
    depth: number;
    ctx: RunContext;
    ownerId: string;
    task: Json | null;
    taskRef: DocumentReference | null;
    project: Json | null;
    adminIds: string[] | null;
    today: string;
    dryRun: boolean;
}

interface StepResult {
    status: 'ok' | 'noop' | 'skipped';
    output?: string;
    /** Decisions API result of classify steps (shown in the run log). */
    decision?: { choice: string; confidence: number };
}

class StepError extends Error {
    constructor(message: string, readonly permanent = true) {
        super(message);
    }
}

const writeVia = (state: ExecState) => ({
    kind: 'automation',
    id: state.automationId,
    name: state.automation.name || 'Flow',
    runId: state.runId,
    depth: state.depth,
    at: FieldValue.serverTimestamp()
});

const projectTitle = (state: ExecState) => String(state.project?.title || state.project?.name || '');

const templateVars = (state: ExecState): Record<string, string> => {
    const task = state.task || {};
    return {
        'task.title': String(task.title || ''),
        'task.url': state.ctx.taskId && state.ctx.projectId ? `/project/${state.ctx.projectId}/tasks/${state.ctx.taskId}` : '',
        'task.status': String(task.status || ''),
        'task.priority': String(task.priority || ''),
        'task.dueDate': String(task.dueDate || '').slice(0, 10),
        'task.assignees': state.ctx.vars['task.assignees'] || '',
        'project.title': projectTitle(state),
        'actor.name': state.ctx.actorName,
        'comment.text': state.ctx.commentText,
        'ai.result': state.ctx.vars['ai.result'] || '',
        'now.date': state.today,
        'flow.name': String(state.automation.name || '')
    };
};

const render = (state: ExecState, text: string) => renderTemplate(text, templateVars(state)).text;

const peopleContext = async (state: ExecState): Promise<PeopleContext> => {
    if (state.adminIds === null) state.adminIds = await adminIdsOf(state.tenantId);
    return {
        task: state.task,
        actorId: state.ctx.actorId,
        projectOwnerId: state.project?.ownerId || null,
        adminIds: state.adminIds,
        flowOwnerId: state.ownerId,
        eventUserIds: state.ctx.eventUserIds
    };
};

const requireTask = (state: ExecState) => {
    if (!state.task || !state.taskRef) throw new StepError('This step needs a task, but the trigger has none (or it was deleted).');
};

const reloadTask = async (state: ExecState) => {
    if (!state.taskRef) return;
    const snap = await state.taskRef.get();
    state.task = snap.exists ? (snap.data() as Json) : null;
};

const loadProject = async (state: ExecState, projectId: string | null) => {
    if (!projectId) {
        state.project = null;
        return;
    }
    const snap = await projectRefOf(state.tenantId, projectId).get();
    state.project = snap.exists ? (snap.data() as Json) : null;
};

const addComment = async (state: ExecState, text: string, actionId: string) => {
    requireTask(state);
    const ref = db.doc(`tenants/${state.tenantId}/projects/${state.ctx.projectId}/comments/${runIdFor(state.runId, actionId)}`);
    try {
        await ref.create({
            projectId: state.ctx.projectId,
            targetId: state.ctx.taskId,
            targetType: 'task',
            userId: state.ownerId,
            userDisplayName: state.automation.name || 'Flow',
            userPhotoURL: '',
            content: text.slice(0, 5000),
            automationId: state.automationId,
            updatedBy: state.ownerId,
            writeVia: writeVia(state),
            createdAt: FieldValue.serverTimestamp()
        });
    } catch (error: any) {
        if (error?.code !== ALREADY_EXISTS) throw error;
    }
};

/**
 * One AI step on behalf of `uid` (flow owner, or the caller for "Flow aus Satz"). Server AI when the
 * plan enables it for that user (trial/grace/exempt or the AI add-on), else the user's own OpenAI key;
 * neither → `ai-not-enabled`. Server AI counts against the plan's monthly AI steps.
 */
const consumeAiStep = async (state: { tenantId: string; uid: string }): Promise<{ apiKey?: string }> => {
    const policy = await loadAiPolicy(state.tenantId);
    if (!policy.enabled) throw new StepError('AI is turned off for this workspace.');
    const { entitlement, quota } = await loadFlowQuota(state.tenantId);
    let apiKey: string | undefined;
    if (!aiEnabledFor(entitlement, state.uid)) {
        apiKey = (await ownAiKeyFor(state.uid)) || undefined;
        if (!apiKey) throw new StepError(FLOW_PLAN_ERRORS.aiNotEnabled);
    }
    // Own keys are the user's cost: only a sanity cap. Server AI: the plan's monthly AI steps.
    const limit = apiKey ? Math.max(quota.aiStepsPerMonth, AUTOMATION_LIMITS.aiStepsPerMonth) : quota.aiStepsPerMonth;
    const ref = usageRef(state.tenantId, Date.now());
    const denied = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (Number(snap.data()?.aiSteps || 0) >= limit) return true;
        tx.set(ref, { aiSteps: FieldValue.increment(1) }, { merge: true });
        return false;
    });
    if (denied) throw new StepError(FLOW_PLAN_ERRORS.aiLimit);
    return apiKey ? { apiKey } : {};
};

const taskDigest = async (state: ExecState): Promise<string> => {
    const task = state.task || {};
    const comments = await db.collection(`tenants/${state.tenantId}/projects/${state.ctx.projectId}/comments`)
        .where('targetId', '==', state.ctx.taskId).limit(20).get();
    const lines = comments.docs.map((doc) => `- ${doc.data().userDisplayName || 'User'}: ${String(doc.data().content || '').slice(0, 400)}`);
    return [
        `Title: ${task.title || ''}`,
        `Status: ${task.status || ''} · Priority: ${task.priority || ''} · Due: ${String(task.dueDate || '').slice(0, 10)}`,
        `Description: ${String(task.description || '').replace(/<[^>]+>/g, ' ').slice(0, 3000)}`,
        lines.length ? `Comments:\n${lines.join('\n')}` : ''
    ].join('\n');
};

const SUMMARY_SCHEMA = {
    name: 'flow_summary',
    schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false }
};
const COMMENT_SCHEMA = {
    name: 'flow_comment',
    schema: { type: 'object', properties: { comment: { type: 'string' } }, required: ['comment'], additionalProperties: false }
};
const TASK_SCHEMA = {
    name: 'flow_task',
    schema: {
        type: 'object',
        properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: [...TASK_PRIORITIES] },
            dueInDays: { anyOf: [{ type: 'integer' }, { type: 'null' }] }
        },
        required: ['title', 'description', 'priority', 'dueInDays'],
        additionalProperties: false
    }
};

const LANGUAGE_HINT = 'Write in the language of the task.';

/**
 * AI steps. Producing content (summarize, draft_comment, draft_task) uses Structured Outputs with a
 * strict schema; classification (classify_priority, classify_label) uses the Decisions API.
 */
const runAiStep = async (state: ExecState, action: Action): Promise<StepResult> => {
    requireTask(state);
    const c = action.config;
    if (state.dryRun) return { status: 'ok', output: `AI: ${c.mode}` };
    const { apiKey } = await consumeAiStep({ tenantId: state.tenantId, uid: state.ownerId });
    const input = await taskDigest(state);
    const extra = c.instructions ? `\nAdditional instructions from the flow: ${c.instructions}` : '';

    if (c.mode === 'classify_priority' || c.mode === 'classify_label') {
        const options: string[] = c.mode === 'classify_label' ? c.options : [...TASK_PRIORITIES];
        const question = c.mode === 'classify_label'
            ? `Which label fits this task best?${extra}`
            : `Which priority should this task have (Low, Medium, High, Urgent)?${extra}`;
        const { answers } = await flowAi.decide({
            apiKey,
            input,
            questions: [{ type: 'choice', name: 'pick', instructions: question, choices: options.map((value) => ({ value })) }]
        });
        const answer: any = answers.find((a) => a.name === 'pick');
        if (!answer || answer.type === 'refusal' || !options.includes(answer.choice)) return { status: 'noop', output: 'AI gave no answer' };
        const confidence = Math.round((Number(answer.confidence) || 0) * 1000) / 1000;
        const decision = { choice: String(answer.choice), confidence };
        if (confidence < (c.minConfidence ?? 0.5)) return { status: 'noop', output: `${answer.choice} (${confidence})`, decision };
        state.ctx.vars['ai.result'] = answer.choice;
        const synthetic: Action = c.mode === 'classify_label'
            ? { id: action.id, type: 'add_label', config: { label: answer.choice } }
            : { id: action.id, type: 'set_field', config: { field: 'priority', value: answer.choice } };
        const result = await performTaskPatch(state, synthetic);
        return { status: result.status, output: `${answer.choice} (${confidence})`, decision };
    }

    if (c.mode === 'draft_task') {
        const { data } = await flowAi.generate<{ title: string; description: string; priority: string; dueInDays: number | null }>({
            tier: 'fast',
            apiKey,
            instructions: `Formulate one concrete follow-up task for the work item. Short actionable title, 1-3 sentence description. ${LANGUAGE_HINT}${extra}`,
            input,
            schema: TASK_SCHEMA
        });
        state.ctx.vars['ai.result'] = data.title;
        const synthetic: Action = {
            id: action.id,
            type: 'create_task',
            config: {
                title: String(data.title || '').slice(0, 300),
                description: String(data.description || '').slice(0, 2000),
                asSubtask: c.asSubtask === true,
                projectId: c.projectId || null,
                priority: (TASK_PRIORITIES as readonly string[]).includes(data.priority) ? data.priority : 'Medium',
                status: 'Open',
                dueInDays: Number.isInteger(data.dueInDays) ? Math.max(0, Math.min(365, Number(data.dueInDays))) : null,
                userIds: [],
                dynamic: []
            }
        };
        if (!synthetic.config.title) return { status: 'noop', output: 'AI returned no title' };
        return performCreateTask(state, synthetic, { raw: true });
    }

    if (c.mode === 'draft_comment') {
        const { data } = await flowAi.generate<{ comment: string }>({
            tier: 'fast',
            apiKey,
            instructions: `Draft a short, helpful comment for the team on this work item (max. 4 sentences). ${LANGUAGE_HINT}${extra}`,
            input,
            schema: COMMENT_SCHEMA
        });
        const text = String(data.comment || '').trim();
        if (!text) return { status: 'noop', output: 'AI returned no comment' };
        state.ctx.vars['ai.result'] = text;
        await addComment(state, text, action.id);
        return { status: 'ok', output: text.slice(0, 300) };
    }

    const { data } = await flowAi.generate<{ summary: string }>({
        tier: 'fast',
        apiKey,
        instructions: `Summarize this work item in 2-4 short sentences for the team. ${LANGUAGE_HINT}${extra}`,
        input,
        schema: SUMMARY_SCHEMA
    });
    const text = String(data.summary || '').trim();
    state.ctx.vars['ai.result'] = text;
    if (c.postComment && text) await addComment(state, text, action.id);
    return { status: 'ok', output: text.slice(0, 300) };
};

const performTaskPatch = async (state: ExecState, action: Action): Promise<StepResult> => {
    requireTask(state);
    const patch = planTaskPatch(action, state.task!, { ...(await peopleContext(state)), today: state.today });
    if (!patch) return { status: 'noop' };
    if (state.dryRun) return { status: 'ok', output: JSON.stringify(patch) };
    const write: Json = { ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: state.ownerId, writeVia: writeVia(state) };
    Object.keys(write).forEach((key) => {
        if (write[key] === null) write[key] = FieldValue.delete();
    });
    await state.taskRef!.update(write);
    Object.assign(state.task!, patch);
    return { status: 'ok', output: JSON.stringify(patch).slice(0, 300) };
};

const performNotify = async (state: ExecState, action: Action): Promise<StepResult> => {
    const c = action.config;
    const recipients = await filterMembers(state.tenantId, resolvePeople(c, await peopleContext(state)));
    if (recipients.length === 0) return { status: 'noop', output: 'No recipients' };
    if (state.dryRun) return { status: 'ok', output: `${recipients.length} recipient(s)` };
    const title = render(state, c.title);
    const message = render(state, c.message || '');
    const actor = { id: '', name: state.automation.name || 'Flow', photoURL: '' };
    for (const userId of recipients) {
        await createNotificationDoc({
            userId,
            tenantId: state.tenantId,
            type: 'automation_notice',
            title,
            message,
            ...(state.ctx.projectId ? { projectId: state.ctx.projectId } : {}),
            ...(state.ctx.taskId ? { taskId: state.ctx.taskId } : {}),
            ...(state.ctx.projectId
                ? { deepLink: state.ctx.taskId ? `/project/${state.ctx.projectId}/tasks/${state.ctx.taskId}` : `/project/${state.ctx.projectId}` }
                : {}),
            extra: { automationId: state.automationId, channels: c.channels || { push: true, email: false } }
        }, actor, runIdFor(state.runId, `${action.id}_${userId}`));
    }
    return { status: 'ok', output: `${recipients.length} recipient(s)` };
};

const performCreateTask = async (state: ExecState, action: Action, options: { raw?: boolean } = {}): Promise<StepResult> => {
    const c = action.config;
    const title = options.raw ? c.title : render(state, c.title);
    const assignees = await filterMembers(state.tenantId, resolvePeople(c, await peopleContext(state)));
    const dueDate = c.dueInDays === null || c.dueInDays === undefined ? null : addDays(state.today, c.dueInDays);
    const docId = runIdFor(state.runId, action.id);
    if (c.asSubtask) {
        requireTask(state);
        if (state.dryRun) return { status: 'ok', output: `Subtask: ${title}` };
        try {
            await state.taskRef!.collection('subtasks').doc(docId).create({
                projectId: state.ctx.projectId,
                tenantId: state.tenantId,
                ownerId: state.ownerId,
                title,
                isCompleted: false,
                ...(assignees.length ? { assigneeIds: assignees, assigneeId: assignees[0] } : {}),
                ...(dueDate ? { dueDate } : {}),
                updatedBy: state.ownerId,
                writeVia: writeVia(state),
                createdAt: FieldValue.serverTimestamp()
            });
        } catch (error: any) {
            if (error?.code !== ALREADY_EXISTS) throw error;
        }
        return { status: 'ok', output: `Subtask: ${title}` };
    }
    const projectId = c.projectId || state.ctx.projectId;
    if (!projectId) throw new StepError('Choose a project for the new task.');
    const project = await projectRefOf(state.tenantId, projectId).get();
    if (!project.exists) throw new StepError('The target project no longer exists.');
    if (state.dryRun) return { status: 'ok', output: `Task: ${title}` };
    try {
        await taskRefOf(state.tenantId, projectId, docId).create({
            projectId,
            tenantId: state.tenantId,
            ownerId: state.ownerId,
            createdBy: state.ownerId,
            title,
            description: options.raw ? c.description || '' : render(state, c.description || ''),
            status: c.status,
            isCompleted: c.status === 'Done',
            priority: c.priority,
            ...(assignees.length ? { assigneeIds: assignees, assigneeId: assignees[0] } : {}),
            ...(dueDate ? { dueDate } : {}),
            source: 'automation',
            automationId: state.automationId,
            updatedBy: state.ownerId,
            writeVia: writeVia(state),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
    } catch (error: any) {
        if (error?.code !== ALREADY_EXISTS) throw error;
    }
    return { status: 'ok', output: `Task: ${title}` };
};

/** Move = copy task, its subtasks and comments to the target project, then delete the originals. */
const performMove = async (state: ExecState, action: Action): Promise<StepResult> => {
    requireTask(state);
    const targetId = action.config.projectId;
    if (targetId === state.ctx.projectId) return { status: 'noop' };
    const target = await projectRefOf(state.tenantId, targetId).get();
    if (!target.exists) throw new StepError('The target project no longer exists.');
    if (state.dryRun) return { status: 'ok', output: `Move to ${target.data()?.title || targetId}` };
    const taskId = state.ctx.taskId!;
    const fromRef = state.taskRef!;
    const toRef = taskRefOf(state.tenantId, targetId, taskId);
    const [subtasks, comments] = await Promise.all([
        fromRef.collection('subtasks').get(),
        db.collection(`tenants/${state.tenantId}/projects/${state.ctx.projectId}/comments`).where('targetId', '==', taskId).get()
    ]);
    if (subtasks.size + comments.size > 220) throw new StepError('Task has too many subtasks/comments to move automatically.');
    const batch = db.batch();
    batch.set(toRef, { ...state.task, projectId: targetId, updatedBy: state.ownerId, updatedAt: FieldValue.serverTimestamp(), writeVia: writeVia(state) });
    subtasks.docs.forEach((doc) => {
        batch.set(toRef.collection('subtasks').doc(doc.id), { ...doc.data(), projectId: targetId });
        batch.delete(doc.ref);
    });
    comments.docs.forEach((doc) => {
        batch.set(db.doc(`tenants/${state.tenantId}/projects/${targetId}/comments/${doc.id}`), { ...doc.data(), projectId: targetId });
        batch.delete(doc.ref);
    });
    batch.delete(fromRef);
    await batch.commit();
    state.taskRef = toRef;
    state.ctx.projectId = targetId;
    state.project = target.data() as Json;
    return { status: 'ok', output: `Moved to ${target.data()?.title || targetId}` };
};

const performAction = async (state: ExecState, action: Action): Promise<StepResult> => {
    switch (action.type) {
        case 'set_field':
        case 'assign':
        case 'set_status':
        case 'add_label':
        case 'remove_label':
            return performTaskPatch(state, action);
        case 'comment': {
            requireTask(state);
            const text = render(state, action.config.text);
            if (!text.trim()) return { status: 'noop', output: 'Empty comment' };
            if (!state.dryRun) await addComment(state, text, action.id);
            return { status: 'ok', output: text.slice(0, 300) };
        }
        case 'notify':
            return performNotify(state, action);
        case 'create_task':
            return performCreateTask(state, action);
        case 'move':
            return performMove(state, action);
        case 'ai':
            return runAiStep(state, action);
        case 'delay':
            return { status: 'ok', output: `${action.config.minutes} min` };
    }
    return { status: 'skipped' };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetries = async (fn: () => Promise<StepResult>): Promise<StepResult> => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt >= AUTOMATION_LIMITS.autoRetries || !isTransientError(error)) throw error;
            await sleep(500 * 3 ** attempt);
        }
    }
};

const notifyPaused = async (tenantId: string, automationId: string, automation: Json, reason: string, recipients: string[]) => {
    const actor = { id: '', name: automation.name || 'Flow', photoURL: '' };
    for (const userId of Array.from(new Set(recipients.filter(Boolean)))) {
        await createNotificationDoc({
            userId,
            tenantId,
            type: 'automation_paused',
            title: automation.name || 'Flow',
            message: reason,
            deepLink: `/flows/${automationId}`,
            extra: { automationId, params: { flowName: automation.name || '', reason } }
        }, actor, `automation_paused_${automationId}_${Date.now()}`);
    }
};

const pauseAutomation = async (tenantId: string, automationId: string, automation: Json, reason: 'errors' | 'owner_lost_access', message: string) => {
    await automationsCol(tenantId).doc(automationId).update({
        enabled: false,
        pausedReason: reason,
        pausedAt: FieldValue.serverTimestamp(),
        nextRunAt: null
    });
    const recipients = reason === 'owner_lost_access' ? await adminIdsOf(tenantId) : [automation.ownerId];
    await notifyPaused(tenantId, automationId, automation, message, recipients);
};

export interface ExecuteOptions {
    fromStep?: number;
    ignoreDisabled?: boolean;
    /** Fail the run before any action (e.g. the AI condition could not be evaluated). */
    preError?: string;
}

/** Runs (or resumes) a stored run. Never throws: failures end in `status: failed`. */
export const executeRun = async (tenantId: string, runId: string, options: ExecuteOptions = {}): Promise<string> => {
    const runRef = runsCol(tenantId).doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) return 'missing';
    const run = runSnap.data() as Json;
    const automationRef = automationsCol(tenantId).doc(run.automationId);
    const automationSnap = await automationRef.get();
    const automation = automationSnap.data() as Json | undefined;

    const finish = async (status: string, extra: Json = {}) => {
        await runRef.update({ status, finishedAt: FieldValue.serverTimestamp(), ...extra });
        return status;
    };

    if (!automation) return finish('cancelled', { error: 'Flow was deleted.' });
    // Suspended workspaces (admin console) run nothing: covers events, schedules, resumes, retries, manual runs.
    if (await isTenantSuspended(tenantId)) return finish('skipped_suspended', { error: SUSPENDED_MESSAGE });
    if (!automation.enabled && !options.ignoreDisabled) return finish('cancelled', { error: 'Flow is paused.' });

    const ownerId = String(automation.ownerId || '');
    const ownerRole = await memberRole(tenantId, ownerId);
    if (!ownerRole || ownerRole === 'Guest') {
        await pauseAutomation(tenantId, run.automationId, automation, 'owner_lost_access',
            'The flow owner no longer has access to this workspace. Open the flow and save it to take it over.');
        return finish('failed', { error: 'Flow owner lost access.' });
    }

    const ctx = run.context as RunContext;
    const state: ExecState = {
        tenantId,
        automationId: run.automationId,
        automation,
        runId,
        depth: Number(run.depth) || 1,
        ctx,
        ownerId,
        task: null,
        taskRef: ctx.projectId && ctx.taskId ? taskRefOf(tenantId, ctx.projectId, ctx.taskId) : null,
        project: null,
        adminIds: null,
        today: localDateKey(Date.now(), flowTimeZone(automation.trigger)),
        dryRun: false
    };
    await Promise.all([reloadTask(state), loadProject(state, ctx.projectId)]);
    if (state.task) {
        const names = await Promise.all(assigneesOf(state.task).map((uid) => getActor(uid)));
        ctx.vars['task.assignees'] = names.map((actor) => actor.name).join(', ');
    }

    const actions: Action[] = Array.isArray(automation.actions) ? automation.actions : [];
    const steps: Json[] = Array.isArray(run.steps) ? run.steps.slice(0, options.fromStep ?? run.nextStep ?? 0) : [];
    let failedError: string | null = options.preError || null;

    for (let index = options.fromStep ?? run.nextStep ?? 0; !failedError && index < actions.length; index++) {
        const action = actions[index];
        if (action.type === 'delay') {
            steps[index] = { actionId: action.id, type: action.type, status: 'ok', output: `${action.config.minutes} min`, at: Timestamp.now() };
            await runRef.update({
                status: 'waiting',
                steps,
                nextStep: index + 1,
                context: ctx,
                resumeAt: Timestamp.fromMillis(Date.now() + Number(action.config.minutes) * 60000)
            });
            return 'waiting';
        }
        try {
            if (TASK_ACTIONS.has(action.type) && action.type !== 'ai') await reloadTask(state);
            const result = await withRetries(() => performAction(state, action));
            steps[index] = {
                actionId: action.id, type: action.type, status: result.status,
                ...(result.output ? { output: result.output } : {}),
                ...(result.decision ? { decision: result.decision } : {}),
                at: Timestamp.now()
            };
        } catch (error: any) {
            failedError = String(error?.message || error || 'Unknown error').slice(0, 500);
            steps[index] = { actionId: action.id, type: action.type, status: 'failed', error: failedError, at: Timestamp.now() };
            await runRef.update({ steps, nextStep: index, failedStep: index, context: ctx });
            break;
        }
    }

    const failed = failedError !== null;
    const status = await finish(failed ? 'failed' : 'succeeded', failed ? { error: failedError } : { steps, nextStep: actions.length, context: ctx });

    const nextFailure = nextFailureState(Number(automation.stats?.consecutiveFailures || 0), failed);
    await automationRef.update({
        'stats.lastRunAt': FieldValue.serverTimestamp(),
        'stats.lastStatus': status,
        'stats.lastRunId': runId,
        'stats.consecutiveFailures': nextFailure.consecutiveFailures,
        ...(failed ? { 'stats.lastError': failedError } : {})
    });
    if (failed) {
        await emitActivityEvent(tenantId, {
            type: 'automation.failed',
            actor: { kind: 'automation', id: null, name: automation.name || 'Flow', automationId: run.automationId, automationRunId: runId, automationDepth: state.depth },
            object: { type: 'automation', id: run.automationId, title: automation.name || 'Flow' },
            projectId: ctx.projectId || null,
            meta: { flowId: run.automationId, runId, error: failedError, path: `/flows/${run.automationId}` },
            source: 'automations'
        }, `automation_failed_${runId}_${run.attempt || 1}`);
        if (nextFailure.pause && automation.enabled) {
            await pauseAutomation(tenantId, run.automationId, automation, 'errors',
                `Paused after ${nextFailure.consecutiveFailures} failed runs in a row. Last error: ${failedError}`);
        }
    }
    return status;
};

// ---------------------------------------------------------------------------
// Event trigger
// ---------------------------------------------------------------------------

const evalContext = (task: Json | null, taskId: string | null, ctx: RunContext, today: string): EvalContext => ({
    task, taskId, projectId: ctx.projectId, actorId: ctx.actorId, commentText: ctx.commentText, today
});

interface ConditionOutcome {
    passed: boolean;
    decisions: AiDecisionRecord[];
    /** AI condition could not be evaluated (quota, policy, provider). */
    aiError?: string;
}

/**
 * Fresh-state condition check. Cheap rules first; the Decisions API is only called when the
 * outcome still depends on AI conditions (one request with all AI questions, one AI step).
 */
const conditionsPass = async (tenantId: string, automation: Json, ctx: RunContext): Promise<ConditionOutcome> => {
    let task: Json | null = null;
    if (ctx.projectId && ctx.taskId) {
        const snap = await taskRefOf(tenantId, ctx.projectId, ctx.taskId).get();
        task = snap.exists ? (snap.data() as Json) : null;
    }
    if (!task && conditionsNeedTask(automation.conditions)) return { passed: false, decisions: [] };
    const today = localDateKey(Date.now(), flowTimeZone(automation.trigger));
    const evalCtx = evalContext(task, ctx.taskId, ctx, today);
    const tri = evaluateConditionsTri(automation.conditions, evalCtx);
    if (tri !== null) return { passed: tri, decisions: [] };

    const rules = aiRulesOf(automation.conditions);
    try {
        const { apiKey } = await consumeAiStep({ tenantId, uid: String(automation.ownerId || '') });
        const project = ctx.projectId ? (await projectRefOf(tenantId, ctx.projectId).get()).data() : null;
        const input = aiWorkItemText({ task, projectTitle: project?.title, commentText: ctx.commentText, eventType: ctx.eventType });
        const { answers } = await flowAi.decide({ apiKey, input, questions: rules.map((rule) => aiQuestionFor(rule.key, rule.ai)) as any });
        const decisions = rules.map((rule) => aiVerdictFor(rule.key, rule.ai, answers.find((answer) => answer.name === rule.key) as Json | undefined));
        const verdicts = Object.fromEntries(decisions.map((decision) => [decision.key, decision.passed]));
        return { passed: evaluateConditions(automation.conditions, evalCtx, verdicts), decisions };
    } catch (error: any) {
        console.error('Flow AI condition failed', tenantId, error?.message);
        const message = String(error?.message || error).slice(0, 200);
        // Billing codes stay bare so the run log can translate them.
        return { passed: false, decisions: [], aiError: Object.values(FLOW_PLAN_ERRORS).includes(message as any) ? message : `AI condition could not be evaluated: ${message}` };
    }
};

/** Start a run for a matched trigger; AI-condition errors become a failed run (visible in the log). */
const startAndExecute = async (input: StartInput & { outcome: ConditionOutcome }): Promise<boolean> => {
    const { outcome, ...start } = input;
    if (!outcome.passed && !outcome.aiError) return false;
    const { runId } = await startRun({ ...start, decisions: outcome.decisions });
    if (!runId) return false;
    await executeRun(start.tenantId, runId, outcome.aiError ? { preError: outcome.aiError } : {});
    return true;
};

/** `cause` (contract v1.1); older events only carry the automation actor. */
const causeOfEvent = (event: StreamEvent): Json | null => {
    if (event.cause) return event.cause;
    if (event.actor?.kind !== 'automation') return null;
    return { kind: 'automation', id: event.actor.automationId || null, depth: Number(event.actor.automationDepth) || 1 };
};

export const handleActivityEvent = async (tenantId: string, event: StreamEvent): Promise<number> => {
    const triggerType = EVENT_TO_TRIGGER[event.type];
    if (!triggerType) return 0;
    // No run docs for suspended workspaces (no AI or quota spent either).
    if (await isTenantSuspended(tenantId)) return 0;
    const snap = await automationsCol(tenantId).where('enabled', '==', true).where('trigger.type', '==', triggerType).get();
    if (snap.empty) return 0;
    const docs = snap.docs.sort((a, b) => Number(a.data().order || 0) - Number(b.data().order || 0));
    let started = 0;
    for (const doc of docs) {
        const automation = doc.data() as Json;
        if (!matchesTrigger(automation as AutomationDef, event)) continue;
        const guard = loopGuard(doc.id, automation as AutomationDef, causeOfEvent(event));
        if (!guard.ok) {
            if (guard.reason === 'depth') console.warn(`Flow ${doc.id}: chain depth limit reached for event ${event.id}`);
            continue;
        }
        const ctx = contextFromEvent(event);
        const outcome = await conditionsPass(tenantId, automation, ctx);
        if (await startAndExecute({
            tenantId, automationId: doc.id, automation, key: event.id, depth: guard.depth, context: ctx,
            entityId: ctx.taskId || event.object?.id || 'none', outcome
        })) started++;
    }
    return started;
};

export const onAutomationEvent = functions.region(REGION)
    .runWith({ secrets: FLOW_SECRETS, timeoutSeconds: 300, memory: '512MB' })
    .firestore.document('tenants/{tenantId}/activity/{eventId}')
    .onCreate(async (snap, context) => {
        const { tenantId, eventId } = context.params as Record<string, string>;
        const data = snap.data() || {};
        if (!EVENT_TO_TRIGGER[data.type]) return;
        await handleActivityEvent(tenantId, { id: eventId, ...data } as StreamEvent);
    });

// ---------------------------------------------------------------------------
// Scheduler: time triggers + delayed runs
// ---------------------------------------------------------------------------

const tenantOf = (ref: DocumentReference) => ref.parent.parent!.id;

const dueTasks = async (tenantId: string, automation: Json, date: string) => {
    const end = `${date}`;
    const query = automation.scope === 'project' && automation.projectId
        ? db.collection(`tenants/${tenantId}/projects/${automation.projectId}/tasks`).where('dueDate', '>=', date).where('dueDate', '<=', end)
        : db.collectionGroup('tasks').where('tenantId', '==', tenantId).where('dueDate', '>=', date).where('dueDate', '<=', end);
    const snap = await query.limit(AUTOMATION_LIMITS.scheduledTaskBatch).get();
    return snap.docs.filter((doc) => !isTaskDone(doc.data()));
};

export const fireScheduledAutomation = async (ref: DocumentReference, automation: Json, slotMs: number): Promise<number> => {
    const tenantId = tenantOf(ref);
    const slot = slotKey(automation.trigger, slotMs);
    let started = 0;
    if (automation.trigger.type === 'schedule') {
        const ctx = emptyContext('schedule', automation.projectId || null, null);
        const outcome = await conditionsPass(tenantId, automation, ctx);
        return (await startAndExecute({ tenantId, automationId: ref.id, automation, key: slot, depth: 1, context: ctx, entityId: 'schedule', outcome })) ? 1 : 0;
    }
    const date = dueScanDate(automation.trigger, slotMs);
    for (const doc of await dueTasks(tenantId, automation, date)) {
        const projectId = doc.ref.parent.parent!.id;
        const ctx = emptyContext(automation.trigger.type, projectId, doc.id);
        const outcome = await conditionsPass(tenantId, automation, ctx);
        if (await startAndExecute({ tenantId, automationId: ref.id, automation, key: `${slot}_${doc.id}`, depth: 1, context: ctx, entityId: doc.id, outcome })) started++;
    }
    return started;
};

export const runAutomationSchedulesOnce = async (nowMs: number = Date.now()) => {
    const stats = { resumed: 0, scheduled: 0, suspended: 0 };
    const now = Timestamp.fromMillis(nowMs);

    const waiting = await db.collectionGroup('automation_runs').where('status', '==', 'waiting').where('resumeAt', '<=', now).limit(100).get();
    for (const doc of waiting.docs) {
        const claimed = await db.runTransaction(async (tx) => {
            const fresh = await tx.get(doc.ref);
            if (fresh.data()?.status !== 'waiting') return false;
            tx.update(doc.ref, { status: 'running', resumeAt: FieldValue.delete() });
            return true;
        });
        if (!claimed) continue;
        await executeRun(tenantOf(doc.ref), doc.id);
        stats.resumed++;
    }

    const due = await db.collectionGroup('automations').where('enabled', '==', true).where('nextRunAt', '<=', now).limit(100).get();
    const suspended = due.empty ? new Set<string>() : await suspendedTenantIds();
    for (const doc of due.docs) {
        const automation = doc.data() as Json;
        const slotMs = (automation.nextRunAt as Timestamp).toMillis();
        const next = computeNextRunAt(automation.trigger, nowMs);
        const claimed = await db.runTransaction(async (tx) => {
            const fresh = await tx.get(doc.ref);
            const current = fresh.data()?.nextRunAt as Timestamp | undefined;
            if (!fresh.data()?.enabled || !current || current.toMillis() !== slotMs) return false;
            tx.update(doc.ref, { nextRunAt: next === null ? null : Timestamp.fromMillis(next) });
            return true;
        });
        if (!claimed) continue;
        // Skip slots older than a day (e.g. after an outage) instead of replaying them.
        if (nowMs - slotMs > DAY_MS) continue;
        // Suspended workspace: the slot is consumed (nextRunAt moved on) but nothing runs.
        if (suspended.has(tenantOf(doc.ref))) {
            stats.suspended++;
            continue;
        }
        try {
            stats.scheduled += await fireScheduledAutomation(doc.ref, automation, slotMs);
        } catch (error) {
            console.error('runAutomationSchedules: flow failed', doc.ref.path, error);
        }
    }
    return stats;
};

export const runAutomationSchedules = onSchedule(
    { schedule: 'every 15 minutes', region: REGION, timeoutSeconds: 540, memory: '512MiB', secrets: FLOW_SECRETS },
    async () => {
        const stats = await runAutomationSchedulesOnce();
        console.log('runAutomationSchedules', JSON.stringify(stats));
    }
);

// ---------------------------------------------------------------------------
// Callables
// ---------------------------------------------------------------------------

const HttpsError = functions.https.HttpsError;

const requireAuth = (context: functions.https.CallableContext): string => {
    const uid = context.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required.');
    return uid;
};

const requireTenant = (data: Json): string => {
    const tenantId = typeof data?.tenantId === 'string' ? data.tenantId.trim() : '';
    if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId is required.');
    return tenantId;
};

const loadManageContext = async (tenantId: string, uid: string, scope: 'workspace' | 'project', projectId: string | null) => {
    const [role, tenantSnap, projectSnap] = await Promise.all([
        memberRole(tenantId, uid),
        db.doc(`tenants/${tenantId}`).get(),
        projectId ? projectRefOf(tenantId, projectId).get() : Promise.resolve(null)
    ]);
    if (!role) throw new HttpsError('permission-denied', 'You are not a member of this workspace.');
    if (projectId && !projectSnap?.exists) throw new HttpsError('not-found', 'Project not found.');
    const project = projectSnap?.exists ? (projectSnap.data() as Json) : null;
    const allowMemberFlows = tenantSnap.data()?.automationPolicy?.allowMemberFlows !== false;
    if (!canManageAutomation({ role, uid, scope, project, allowMemberFlows })) {
        throw new HttpsError('permission-denied', 'You are not allowed to manage this flow.');
    }
    return { role, tenant: tenantSnap.data() || {}, project };
};

const loadAutomationForManage = async (tenantId: string, uid: string, automationId: string) => {
    if (!automationId) throw new HttpsError('invalid-argument', 'Flow id is required.');
    const ref = automationsCol(tenantId).doc(automationId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Flow not found.');
    const automation = snap.data() as Json;
    await loadManageContext(tenantId, uid, automation.scope, automation.projectId || null);
    return { ref, automation };
};

const toDef = (raw: Json): AutomationDef => {
    try {
        return normalizeAutomation(raw);
    } catch (error) {
        if (error instanceof AutomationValidationError) throw new HttpsError('invalid-argument', error.message);
        throw error;
    }
};

/** Referenced users must be full members and referenced projects must exist. */
const validateReferences = async (tenantId: string, def: AutomationDef) => {
    const userIds = new Set<string>();
    const projectIds = new Set<string>();
    def.actions.forEach((action) => {
        (action.config.userIds || []).forEach((id: string) => userIds.add(id));
        if (action.config.projectId) projectIds.add(action.config.projectId);
        if (action.type === 'create_task' && !action.config.asSubtask && !action.config.projectId && !def.projectId &&
            (def.trigger.type === 'schedule' || def.trigger.type === 'manual')) {
            throw new HttpsError('invalid-argument', 'Choose a project for the new task.');
        }
    });
    if (def.trigger.config.assigneeId) userIds.add(def.trigger.config.assigneeId);
    const members = await filterMembers(tenantId, Array.from(userIds));
    if (members.length !== userIds.size) throw new HttpsError('invalid-argument', 'Some selected people are not workspace members.');
    for (const projectId of projectIds) {
        const snap = await projectRefOf(tenantId, projectId).get();
        if (!snap.exists) throw new HttpsError('invalid-argument', 'A selected project no longer exists.');
    }
};

const assertActiveLimit = async (tenantId: string, _tenant: Json, excludeId: string | null) => {
    const { quota: limits } = await loadFlowQuota(tenantId);
    const count = await automationsCol(tenantId).where('enabled', '==', true).count().get();
    let active = count.data().count;
    if (excludeId) {
        const current = await automationsCol(tenantId).doc(excludeId).get();
        if (current.data()?.enabled) active--;
    }
    if (active >= limits.activeFlowsPerWorkspace) {
        // Billing code (UI: "Kontingent erreicht"); nothing is disabled or deleted.
        throw new HttpsError('failed-precondition', FLOW_PLAN_ERRORS.activeLimit, { limit: limits.activeFlowsPerWorkspace, tier: limits.tier });
    }
};

/** All Flow callables refuse suspended workspaces (`failed-precondition`, reason `workspace-suspended`). */
const callable = (handler: (data: Json, context: functions.https.CallableContext) => Promise<unknown>) =>
    functions.region(REGION).runWith({ secrets: FLOW_SECRETS, timeoutSeconds: 120 }).https.onCall(async (data, context) => {
        await assertTenantActive(data?.tenantId);
        return handler(data, context);
    });

export const saveAutomation = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const id = typeof data?.id === 'string' && data.id.trim() ? data.id.trim() : null;
    const def = toDef(data?.automation);
    const { tenant } = await loadManageContext(tenantId, uid, def.scope, def.projectId);
    let existing: Json | null = null;
    if (id) existing = (await loadAutomationForManage(tenantId, uid, id)).automation;
    await validateReferences(tenantId, def);
    if (def.enabled) await assertActiveLimit(tenantId, tenant, id);

    const nextRunAt = def.enabled ? computeNextRunAt(def.trigger, Date.now()) : null;
    const doc: Json = {
        ...def,
        ownerId: uid,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
        nextRunAt: nextRunAt === null ? null : Timestamp.fromMillis(nextRunAt),
        pausedReason: null,
        schemaVersion: AUTOMATION_SCHEMA_VERSION,
        'stats.consecutiveFailures': 0
    };
    if (id && existing) {
        await automationsCol(tenantId).doc(id).update(doc);
        return { id };
    }
    const ref = automationsCol(tenantId).doc();
    delete doc['stats.consecutiveFailures'];
    await ref.create({
        ...doc,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        stats: { consecutiveFailures: 0, lastRunAt: null, lastStatus: null }
    });
    return { id: ref.id };
});

export const setAutomationEnabled = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const { ref, automation } = await loadAutomationForManage(tenantId, uid, String(data?.id || ''));
    const enabled = data?.enabled === true;
    if (enabled && !automation.enabled) {
        const tenant = (await db.doc(`tenants/${tenantId}`).get()).data() || {};
        await assertActiveLimit(tenantId, tenant, null);
    }
    const next = enabled ? computeNextRunAt(automation.trigger, Date.now()) : null;
    await ref.update({
        enabled,
        ownerId: uid,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
        pausedReason: null,
        nextRunAt: next === null ? null : Timestamp.fromMillis(next),
        'stats.consecutiveFailures': 0
    });
    return { id: ref.id, enabled };
});

export const deleteAutomation = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const { ref } = await loadAutomationForManage(tenantId, uid, String(data?.id || ''));
    await ref.delete();
    return { id: ref.id, deleted: true };
});

/** Manual trigger ("Flow ausführen"), optionally on one task. Works for every trigger type. */
export const runAutomation = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const { ref, automation } = await loadAutomationForManage(tenantId, uid, String(data?.id || ''));
    const taskId = typeof data?.taskId === 'string' && data.taskId ? data.taskId : null;
    const projectId = (typeof data?.projectId === 'string' && data.projectId) || automation.projectId || null;
    if (taskId && !projectId) throw new HttpsError('invalid-argument', 'projectId is required with taskId.');
    if (automation.scope === 'project' && projectId !== automation.projectId) throw new HttpsError('invalid-argument', 'Task is outside the flow project.');
    if (!taskId && (automation.actions as Action[]).some((action) => TASK_ACTIONS.has(action.type) || action.config?.asSubtask)) {
        throw new HttpsError('invalid-argument', 'Choose a task to run this flow on.');
    }
    const ctx = emptyContext('manual', projectId, taskId, uid);
    ctx.actorName = (await getActor(uid)).name;
    const { runId, skipReason } = await startRun({
        tenantId, automationId: ref.id, automation, key: `manual_${Date.now()}_${uid}`, depth: 1, context: ctx, entityId: taskId || 'manual'
    });
    if (!runId) {
        if (skipReason === 'month') throw new HttpsError('failed-precondition', FLOW_PLAN_ERRORS.runsLimit);
        throw new HttpsError('resource-exhausted', 'Flow run limit reached. Try again later.');
    }
    const status = await executeRun(tenantId, runId, { ignoreDisabled: true });
    return { runId, status };
});

export const retryAutomationRun = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const runId = String(data?.runId || '');
    const runRef = runsCol(tenantId).doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) throw new HttpsError('not-found', 'Run not found.');
    const run = runSnap.data() as Json;
    await loadAutomationForManage(tenantId, uid, run.automationId);
    if (run.status !== 'failed') throw new HttpsError('failed-precondition', 'Only failed runs can be retried.');
    const fromStep = Number.isInteger(run.failedStep) ? run.failedStep : Number(run.nextStep || 0);
    await runRef.update({ status: 'running', attempt: FieldValue.increment(1), error: FieldValue.delete(), retriedBy: uid });
    const status = await executeRun(tenantId, runId, { fromStep, ignoreDisabled: true });
    return { runId, status };
});

const PREVIEW_SCAN = 300;
const PREVIEW_MATCHES = 20;

/**
 * Editor preview: which tasks would currently match the conditions (max 20 of the newest 300),
 * and — with `taskId` — a dry run that lists what each action would do without writing.
 */
export const previewAutomation = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const def = toDef(data?.automation);
    await loadManageContext(tenantId, uid, def.scope, def.projectId);
    const today = localDateKey(Date.now(), flowTimeZone(def.trigger));
    const taskId = typeof data?.taskId === 'string' && data.taskId ? data.taskId : null;

    if (taskId) {
        const projectId = String(data?.projectId || def.projectId || '');
        if (!projectId) throw new HttpsError('invalid-argument', 'projectId is required.');
        const taskRef = taskRefOf(tenantId, projectId, taskId);
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) throw new HttpsError('not-found', 'Task not found.');
        const ctx = emptyContext(def.trigger.type, projectId, taskId, uid);
        ctx.actorName = (await getActor(uid)).name;
        const task = taskSnap.data() as Json;
        // AI conditions are really evaluated here (one AI step), so the test run shows probabilities.
        const outcome = await conditionsPass(tenantId, { ...def, ownerId: uid } as unknown as Json, ctx);
        const matches = outcome.passed;
        const state: ExecState = {
            tenantId, automationId: 'preview', automation: { ...def, ownerId: uid }, runId: 'preview', depth: 1, ctx, ownerId: uid,
            task: { ...task }, taskRef, project: null, adminIds: null, today, dryRun: true
        };
        await loadProject(state, projectId);
        const steps: Json[] = [];
        for (const action of def.actions) {
            try {
                const result = action.type === 'ai'
                    ? { status: 'ok', output: `AI: ${action.config.mode}` }
                    : await performAction(state, action);
                steps.push({ actionId: action.id, type: action.type, ...result });
            } catch (error: any) {
                steps.push({ actionId: action.id, type: action.type, status: 'failed', error: String(error?.message || error) });
            }
        }
        return { matches, steps, decisions: outcome.decisions, ...(outcome.aiError ? { aiError: outcome.aiError } : {}) };
    }

    if (def.trigger.type === 'schedule' || def.trigger.type === 'project.member_added' || def.trigger.type === 'file.uploaded') {
        return { scanned: 0, total: 0, tasks: [] };
    }
    const query = def.scope === 'project' && def.projectId
        ? db.collection(`tenants/${tenantId}/projects/${def.projectId}/tasks`)
        : db.collectionGroup('tasks').where('tenantId', '==', tenantId);
    const snap = await query.limit(PREVIEW_SCAN).get();
    const ctx = emptyContext(def.trigger.type, def.projectId, null, uid);
    const dueDate = TIME_TRIGGERS.has(def.trigger.type) ? dueScanDate(def.trigger, Date.now()) : null;
    // AI conditions are not evaluated for the whole list (cost); tasks that only depend on them are
    // listed with `aiPending` and get a real answer in the per-task test run.
    const pending = new Set<string>();
    const matching = snap.docs.filter((doc) => {
        const task = doc.data();
        if (dueDate && (isTaskDone(task) || String(task.dueDate || '').slice(0, 10) !== dueDate)) return false;
        const projectId = doc.ref.parent.parent!.id;
        const tri = evaluateConditionsTri(def.conditions, evalContext(task, doc.id, { ...ctx, projectId }, today));
        if (tri === null) pending.add(doc.id);
        return tri !== false;
    });
    return {
        scanned: snap.size,
        total: matching.length,
        tasks: matching.slice(0, PREVIEW_MATCHES).map((doc) => ({
            id: doc.id,
            projectId: doc.ref.parent.parent!.id,
            title: String(doc.data().title || ''),
            status: String(doc.data().status || ''),
            priority: String(doc.data().priority || ''),
            labels: labelsOf(doc.data()),
            aiPending: pending.has(doc.id)
        }))
    };
});

const DRAFT_TEXT_MAX = 600;

/**
 * "Flow aus Satz": Structured Outputs turn one sentence into a flow definition in the engine's schema.
 * The result is validated (unknown people/projects and broken parts dropped with warnings) and
 * returned as a disabled draft — the client shows it in the editor, nothing is saved here.
 */
export const draftAutomationFromText = callable(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = requireTenant(data);
    const text = typeof data?.text === 'string' ? data.text.trim().slice(0, DRAFT_TEXT_MAX) : '';
    if (text.length < 8) throw new HttpsError('invalid-argument', 'Describe the flow in one sentence.');
    const role = await memberRole(tenantId, uid);
    if (!role || role === 'Guest') throw new HttpsError('permission-denied', 'Flows are available to workspace members.');
    let apiKey: string | undefined;
    try {
        ({ apiKey } = await consumeAiStep({ tenantId, uid }));
    } catch (error: any) {
        throw new HttpsError('failed-precondition', error?.message || 'AI is not available.');
    }
    const [membersSnap, projectsSnap] = await Promise.all([
        db.collection(`tenants/${tenantId}/members`).get(),
        db.collection(`tenants/${tenantId}/projects`).limit(200).get()
    ]);
    const projectId = typeof data?.projectId === 'string' && data.projectId ? data.projectId : null;
    const draftCtx: DraftContext = {
        members: membersSnap.docs
            .filter((doc) => doc.data().role !== 'Guest')
            .map((doc) => ({ uid: doc.id, name: String(doc.data().displayName || doc.data().email || doc.id) })),
        projects: projectsSnap.docs.map((doc) => ({ id: doc.id, title: String(doc.data().title || doc.id) })),
        defaultProjectId: projectId,
        timezone: typeof data?.timezone === 'string' ? data.timezone : 'Europe/Berlin',
        today: localDateKey(Date.now(), typeof data?.timezone === 'string' ? data.timezone : 'Europe/Berlin')
    };
    let raw: Json;
    try {
        raw = (await flowAi.generate<Json>({ apiKey, tier: 'agent', instructions: flowDraftInstructions(draftCtx), input: text, schema: FLOW_DRAFT_SCHEMA, maxOutputTokens: 3000 })).data;
    } catch (error: any) {
        console.error('draftAutomationFromText failed', error?.message);
        throw new HttpsError('unavailable', 'The AI could not draft this flow. Try again or rephrase.');
    }
    try {
        return draftFromModel(raw, draftCtx);
    } catch (error) {
        if (error instanceof AutomationValidationError) throw new HttpsError('invalid-argument', error.message);
        throw error;
    }
});
