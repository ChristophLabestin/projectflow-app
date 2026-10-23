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
import { generateServerText } from './ai-service';
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
    addDays,
    assigneesOf,
    canManageAutomation,
    checkLimits,
    computeNextRunAt,
    conditionsNeedTask,
    dueScanDate,
    evaluateConditions,
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
    resolveLimits,
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
}

/** Creates the run doc. Returns the run id, or null for duplicates / limit skips. */
const startRun = async (input: StartInput): Promise<string | null> => {
    const { tenantId, automationId, automation, key, depth, context, entityId } = input;
    const now = Date.now();
    const runId = runIdFor(automationId, key);
    const runRef = runsCol(tenantId).doc(runId);
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    const limits = resolveLimits(tenantSnap.data());
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
        steps: [],
        nextStep: 0,
        attempt: 1,
        startedAt: FieldValue.serverTimestamp(),
        expireAt: expireIn(AUTOMATION_LIMITS.runRetentionDays)
    };

    return db.runTransaction(async (tx) => {
        const [run, month, minute, entity] = await tx.getAll(runRef, monthRef, minuteRef, entityRef);
        if (run.exists) return null;
        const decision = checkLimits({
            monthRuns: Number(month.data()?.runs || 0),
            minuteRuns: Number(minute.data()?.count || 0),
            entityHourRuns: Number(entity.data()?.count || 0),
            limits
        });
        if (!decision.ok) {
            tx.create(runRef, { ...base, status: 'skipped_limit', skipReason: decision.reason, finishedAt: FieldValue.serverTimestamp() });
            tx.set(monthRef, { month: monthKey(now), skipped: FieldValue.increment(1) }, { merge: true });
            return null;
        }
        tx.create(runRef, { ...base, status: 'running' });
        tx.set(monthRef, { month: monthKey(now), runs: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(minuteRef, { count: FieldValue.increment(1), expireAt: expireIn(1) }, { merge: true });
        tx.set(entityRef, { count: FieldValue.increment(1), expireAt: expireIn(1) }, { merge: true });
        return runId;
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

const consumeAiStep = async (state: ExecState) => {
    const policy = await loadAiPolicy(state.tenantId);
    if (!policy.enabled) throw new StepError('AI is turned off for this workspace.');
    const tenantSnap = await db.doc(`tenants/${state.tenantId}`).get();
    const limits = resolveLimits(tenantSnap.data());
    const ref = usageRef(state.tenantId, Date.now());
    const denied = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (Number(snap.data()?.aiSteps || 0) >= limits.aiStepsPerMonth) return true;
        tx.set(ref, { aiSteps: FieldValue.increment(1) }, { merge: true });
        return false;
    });
    if (denied) throw new StepError(`Monthly limit of ${limits.aiStepsPerMonth} AI steps reached.`);
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

const runAiStep = async (state: ExecState, action: Action): Promise<StepResult> => {
    requireTask(state);
    const c = action.config;
    if (state.dryRun) return { status: 'ok', output: `AI: ${c.mode}` };
    await consumeAiStep(state);
    const input = await taskDigest(state);
    const extra = c.instructions ? `\nAdditional instructions: ${c.instructions}` : '';
    if (c.mode === 'summarize') {
        const text = await generateServerText(state.ownerId,
            `Summarize this project task in 2-4 short sentences for the team. Answer in the language of the task.${extra}`, input);
        state.ctx.vars['ai.result'] = text;
        if (c.postComment) await addComment(state, text, action.id);
        return { status: 'ok', output: text.slice(0, 300) };
    }
    const options: string[] = c.mode === 'classify_label' ? c.options : [...TASK_PRIORITIES];
    const answer = await generateServerText(state.ownerId,
        `Classify the task. Reply with exactly one option and nothing else. Options: ${options.join(', ')}.${extra}`, input);
    const picked = options.find((option) => answer.toLowerCase().includes(option.toLowerCase()));
    if (!picked) return { status: 'noop', output: `No option matched: ${answer.slice(0, 80)}` };
    state.ctx.vars['ai.result'] = picked;
    const synthetic: Action = c.mode === 'classify_label'
        ? { id: action.id, type: 'add_label', config: { label: picked } }
        : { id: action.id, type: 'set_field', config: { field: 'priority', value: picked } };
    const result = await performTaskPatch(state, synthetic);
    return { status: result.status, output: picked };
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

const performCreateTask = async (state: ExecState, action: Action): Promise<StepResult> => {
    const c = action.config;
    const title = render(state, c.title);
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
            description: render(state, c.description || ''),
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
    let failedError: string | null = null;

    for (let index = options.fromStep ?? run.nextStep ?? 0; index < actions.length; index++) {
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
            steps[index] = { actionId: action.id, type: action.type, status: result.status, ...(result.output ? { output: result.output } : {}), at: Timestamp.now() };
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

/** Fresh-state condition check. Returns false when the conditions need a task that is gone. */
const conditionsPass = async (tenantId: string, automation: Json, ctx: RunContext): Promise<boolean> => {
    let task: Json | null = null;
    if (ctx.projectId && ctx.taskId) {
        const snap = await taskRefOf(tenantId, ctx.projectId, ctx.taskId).get();
        task = snap.exists ? (snap.data() as Json) : null;
    }
    if (!task && conditionsNeedTask(automation.conditions)) return false;
    const today = localDateKey(Date.now(), flowTimeZone(automation.trigger));
    return evaluateConditions(automation.conditions, evalContext(task, ctx.taskId, ctx, today));
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
        if (!(await conditionsPass(tenantId, automation, ctx))) continue;
        const runId = await startRun({
            tenantId, automationId: doc.id, automation, key: event.id, depth: guard.depth, context: ctx,
            entityId: ctx.taskId || event.object?.id || 'none'
        });
        if (runId) {
            await executeRun(tenantId, runId);
            started++;
        }
    }
    return started;
};

export const onAutomationEvent = functions.region(REGION)
    .runWith({ secrets: ['OPENAI_API_KEY'], timeoutSeconds: 300, memory: '512MB' })
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
        if (!(await conditionsPass(tenantId, automation, ctx))) return 0;
        const runId = await startRun({ tenantId, automationId: ref.id, automation, key: slot, depth: 1, context: ctx, entityId: 'schedule' });
        if (runId) {
            await executeRun(tenantId, runId);
            started++;
        }
        return started;
    }
    const date = dueScanDate(automation.trigger, slotMs);
    for (const doc of await dueTasks(tenantId, automation, date)) {
        const projectId = doc.ref.parent.parent!.id;
        const ctx = emptyContext(automation.trigger.type, projectId, doc.id);
        if (!(await conditionsPass(tenantId, automation, ctx))) continue;
        const runId = await startRun({ tenantId, automationId: ref.id, automation, key: `${slot}_${doc.id}`, depth: 1, context: ctx, entityId: doc.id });
        if (runId) {
            await executeRun(tenantId, runId);
            started++;
        }
    }
    return started;
};

export const runAutomationSchedulesOnce = async (nowMs: number = Date.now()) => {
    const stats = { resumed: 0, scheduled: 0 };
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
        try {
            stats.scheduled += await fireScheduledAutomation(doc.ref, automation, slotMs);
        } catch (error) {
            console.error('runAutomationSchedules: flow failed', doc.ref.path, error);
        }
    }
    return stats;
};

export const runAutomationSchedules = onSchedule(
    { schedule: 'every 15 minutes', region: REGION, timeoutSeconds: 540, memory: '512MiB', secrets: ['OPENAI_API_KEY'] },
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

const assertActiveLimit = async (tenantId: string, tenant: Json, excludeId: string | null) => {
    const limits = resolveLimits(tenant);
    const count = await automationsCol(tenantId).where('enabled', '==', true).count().get();
    let active = count.data().count;
    if (excludeId) {
        const current = await automationsCol(tenantId).doc(excludeId).get();
        if (current.data()?.enabled) active--;
    }
    if (active >= limits.activeFlowsPerWorkspace) {
        throw new HttpsError('resource-exhausted', `At most ${limits.activeFlowsPerWorkspace} active flows per workspace.`);
    }
};

const callable = (handler: (data: Json, context: functions.https.CallableContext) => Promise<unknown>) =>
    functions.region(REGION).runWith({ secrets: ['OPENAI_API_KEY'], timeoutSeconds: 120 }).https.onCall(handler);

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
    const runId = await startRun({
        tenantId, automationId: ref.id, automation, key: `manual_${Date.now()}_${uid}`, depth: 1, context: ctx, entityId: taskId || 'manual'
    });
    if (!runId) throw new HttpsError('resource-exhausted', 'Flow run limit reached. Try again later.');
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
        const matches = evaluateConditions(def.conditions, evalContext(task, taskId, ctx, today));
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
        return { matches, steps };
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
    const matching = snap.docs.filter((doc) => {
        const task = doc.data();
        if (dueDate && (isTaskDone(task) || String(task.dueDate || '').slice(0, 10) !== dueDate)) return false;
        const projectId = doc.ref.parent.parent!.id;
        return evaluateConditions(def.conditions, evalContext(task, doc.id, { ...ctx, projectId }, today));
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
            labels: labelsOf(doc.data())
        }))
    };
});
