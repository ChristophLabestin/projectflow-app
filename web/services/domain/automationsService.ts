// Flows (automations): read via Firestore listeners, write only through callables
// (`functions/src/automations.ts`). Concept: brain/plans/flows-concept.md.
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import { toMillis } from '../../utils/time';

export type FlowTriggerType =
    | 'task.created'
    | 'task.status_changed'
    | 'task.assigned'
    | 'task.due'
    | 'task.overdue'
    | 'comment.created'
    | 'subtask.completed'
    | 'file.uploaded'
    | 'project.member_added'
    | 'schedule'
    | 'manual';

export type FlowActionType =
    | 'set_field'
    | 'assign'
    | 'set_status'
    | 'comment'
    | 'notify'
    | 'create_task'
    | 'add_label'
    | 'remove_label'
    | 'move'
    | 'ai'
    | 'delay';

export type FlowOperator =
    | 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'not_contains' | 'empty' | 'not_empty' | 'lt' | 'gt' | 'due_within_days' | 'ai';

export type FlowConditionField =
    | 'task.status' | 'task.priority' | 'task.labels' | 'task.assigneeIds' | 'task.createdBy' | 'task.dueDate'
    | 'task.title' | 'task.isSubtask' | 'project.id' | 'actor.id' | 'comment.text' | 'ai';

export type FlowDynamicPerson = 'assignees' | 'creator' | 'actor' | 'project_owner' | 'admins' | 'flow_owner' | 'event_users';

export interface FlowScheduleConfig {
    frequency: 'daily' | 'weekly';
    time: string;
    weekday?: number;
    timezone: string;
}

export interface FlowTrigger {
    type: FlowTriggerType;
    config: {
        fromStatus?: string;
        toStatus?: string;
        assigneeId?: string;
        schedule?: FlowScheduleConfig;
        time?: string;
        timezone?: string;
    };
}

/** KI-Bedingung (Decisions API). */
export interface FlowAiCondition {
    kind: 'predicate' | 'choice' | 'score';
    question: string;
    threshold?: number;
    choices?: string[];
    accept?: string[];
    minConfidence?: number;
    levels?: number;
    minScore?: number;
}

export interface FlowConditionRule {
    field: FlowConditionField;
    operator: FlowOperator;
    value?: string | string[] | number | boolean;
    ai?: FlowAiCondition;
}

export interface FlowAiDecision {
    key: string;
    kind: FlowAiCondition['kind'];
    question: string;
    passed: boolean;
    probability?: number;
    choice?: string;
    confidence?: number;
    score?: number;
    refused?: boolean;
}

export interface FlowConditionGroup {
    op: 'and' | 'or';
    rules: FlowConditionRule[];
}

export interface FlowConditions {
    op: 'and' | 'or';
    groups: FlowConditionGroup[];
}

export interface FlowAction {
    id: string;
    type: FlowActionType;
    config: Record<string, any>;
}

/** Editable definition (what the editor sends to `saveAutomation`). */
export interface FlowDefinition {
    name: string;
    description: string;
    scope: 'workspace' | 'project';
    projectId: string | null;
    enabled: boolean;
    trigger: FlowTrigger;
    conditions: FlowConditions;
    actions: FlowAction[];
    allowAutomationTrigger: boolean;
    order?: number;
    templateId?: string | null;
}

export type FlowRunStatus = 'running' | 'waiting' | 'succeeded' | 'failed' | 'skipped_limit' | 'cancelled';

export interface Flow extends FlowDefinition {
    id: string;
    ownerId: string;
    createdBy?: string;
    updatedBy?: string;
    updatedAtMs: number | null;
    nextRunAtMs: number | null;
    pausedReason: 'errors' | 'owner_lost_access' | null;
    stats: {
        lastRunAtMs: number | null;
        lastStatus: FlowRunStatus | null;
        lastRunId?: string;
        lastError?: string;
        consecutiveFailures: number;
    };
}

export interface FlowRunStep {
    actionId: string;
    type: FlowActionType;
    status: 'ok' | 'noop' | 'skipped' | 'failed';
    output?: string;
    error?: string;
    decision?: { choice: string; confidence: number };
}

export interface FlowRun {
    id: string;
    automationId: string;
    status: FlowRunStatus;
    trigger: string;
    projectId: string | null;
    taskId: string | null;
    depth: number;
    steps: FlowRunStep[];
    decisions: FlowAiDecision[];
    error?: string;
    skipReason?: string;
    attempt: number;
    startedAtMs: number | null;
    finishedAtMs: number | null;
    resumeAtMs: number | null;
}

const toFlow = (id: string, data: Record<string, any>): Flow => ({
    id,
    name: data.name || '',
    description: data.description || '',
    scope: data.scope === 'project' ? 'project' : 'workspace',
    projectId: data.projectId || null,
    enabled: data.enabled === true,
    trigger: data.trigger || { type: 'manual', config: {} },
    conditions: data.conditions || { op: 'and', groups: [] },
    actions: Array.isArray(data.actions) ? data.actions : [],
    allowAutomationTrigger: data.allowAutomationTrigger === true,
    order: Number(data.order) || 0,
    templateId: data.templateId || null,
    ownerId: data.ownerId || '',
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    updatedAtMs: toMillis(data.updatedAt) || null,
    nextRunAtMs: toMillis(data.nextRunAt) || null,
    pausedReason: data.pausedReason || null,
    stats: {
        lastRunAtMs: toMillis(data.stats?.lastRunAt) || null,
        lastStatus: data.stats?.lastStatus || null,
        lastRunId: data.stats?.lastRunId,
        lastError: data.stats?.lastError,
        consecutiveFailures: Number(data.stats?.consecutiveFailures) || 0,
    },
});

const toRun = (id: string, data: Record<string, any>): FlowRun => ({
    id,
    automationId: data.automationId,
    status: data.status,
    trigger: data.trigger || '',
    projectId: data.projectId || null,
    taskId: data.taskId || null,
    depth: Number(data.depth) || 1,
    steps: Array.isArray(data.steps) ? data.steps.filter(Boolean) : [],
    decisions: Array.isArray(data.decisions) ? data.decisions : [],
    error: data.error,
    skipReason: data.skipReason,
    attempt: Number(data.attempt) || 1,
    startedAtMs: toMillis(data.startedAt) || null,
    finishedAtMs: toMillis(data.finishedAt) || null,
    resumeAtMs: toMillis(data.resumeAt) || null,
});

export const subscribeFlows = (
    tenantId: string,
    callback: (flows: Flow[]) => void,
    onError?: (error: Error) => void
) => onSnapshot(
    collection(db, 'tenants', tenantId, 'automations'),
    (snap) => callback(snap.docs.map((d) => toFlow(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))),
    (error) => onError?.(error)
);

export const subscribeFlow = (
    tenantId: string,
    flowId: string,
    callback: (flow: Flow | null) => void,
    onError?: (error: Error) => void
) => onSnapshot(
    doc(db, 'tenants', tenantId, 'automations', flowId),
    (snap) => callback(snap.exists() ? toFlow(snap.id, snap.data()) : null),
    (error) => onError?.(error)
);

export const subscribeFlowRuns = (
    tenantId: string,
    flowId: string,
    callback: (runs: FlowRun[]) => void,
    onError?: (error: Error) => void,
    max = 50
) => onSnapshot(
    query(collection(db, 'tenants', tenantId, 'automation_runs'), where('automationId', '==', flowId), orderBy('startedAt', 'desc'), limit(max)),
    (snap) => callback(snap.docs.map((d) => toRun(d.id, d.data()))),
    (error) => onError?.(error)
);

export const subscribeFlowUsage = (
    tenantId: string,
    callback: (usage: { runs: number; aiSteps: number; skipped: number }) => void
) => onSnapshot(
    doc(db, 'tenants', tenantId, 'automation_usage', new Date().toISOString().slice(0, 7)),
    (snap) => callback({ runs: Number(snap.data()?.runs) || 0, aiSteps: Number(snap.data()?.aiSteps) || 0, skipped: Number(snap.data()?.skipped) || 0 }),
    () => callback({ runs: 0, aiSteps: 0, skipped: 0 })
);

const call = async <T>(name: string, data: Record<string, unknown>): Promise<T> => {
    const fn = httpsCallable(functions, name);
    const result = await fn(data);
    return result.data as T;
};

export const saveFlow = (tenantId: string, automation: FlowDefinition, id?: string | null) =>
    call<{ id: string }>('saveAutomation', { tenantId, automation, ...(id ? { id } : {}) });

export const setFlowEnabled = (tenantId: string, id: string, enabled: boolean) =>
    call<{ id: string; enabled: boolean }>('setAutomationEnabled', { tenantId, id, enabled });

export const deleteFlow = (tenantId: string, id: string) => call<{ id: string }>('deleteAutomation', { tenantId, id });

export const runFlow = (tenantId: string, id: string, target?: { taskId: string; projectId: string }) =>
    call<{ runId: string; status: FlowRunStatus }>('runAutomation', { tenantId, id, ...(target || {}) });

export const retryFlowRun = (tenantId: string, runId: string) =>
    call<{ runId: string; status: FlowRunStatus }>('retryAutomationRun', { tenantId, runId });

export interface FlowPreviewTask {
    id: string;
    projectId: string;
    title: string;
    status: string;
    priority: string;
    labels: string[];
    /** Only AI conditions decide; evaluated in the per-task test run. */
    aiPending?: boolean;
}

export interface FlowPreviewResult {
    scanned: number;
    total: number;
    tasks: FlowPreviewTask[];
}

export interface FlowDryRunResult {
    matches: boolean;
    decisions?: FlowAiDecision[];
    aiError?: string;
    steps: { actionId: string; type: FlowActionType; status: string; output?: string; error?: string }[];
}

export const previewFlow = (tenantId: string, automation: FlowDefinition) =>
    call<FlowPreviewResult>('previewAutomation', { tenantId, automation });

export const dryRunFlow = (tenantId: string, automation: FlowDefinition, taskId: string, projectId: string) =>
    call<FlowDryRunResult>('previewAutomation', { tenantId, automation, taskId, projectId });

/** Message of a callable error (validation messages from the server are user-facing). */
export const flowErrorMessage = (error: unknown): string => (error as { message?: string })?.message || '';

export interface FlowDraftResult {
    draft: FlowDefinition;
    warnings: ('unknown_person' | 'unknown_project' | 'dropped_condition' | 'dropped_action')[];
}

/** "Flow aus Satz": Structured Outputs draft, validated server-side, never saved or enabled. */
export const draftFlowFromText = (tenantId: string, text: string, projectId: string | null) =>
    call<FlowDraftResult>('draftAutomationFromText', {
        tenantId, text, projectId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    });
