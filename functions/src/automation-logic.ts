// Flows (automations) — pure engine logic: schema normalisation, trigger matching, conditions,
// templates, loop guard, limits and schedules. No Firebase imports, safe to unit test.
// Concept: brain/plans/flows-concept.md. Event source: brain/plans/activity-events-contract.md.
import { localDateKey, resolveTimeZone, zonedParts, zonedTimeToUtcMs, parseClock, DEFAULT_TIMEZONE } from './tz-utils';

export type Json = Record<string, any>;

export const AUTOMATION_SCHEMA_VERSION = 1;

export const TRIGGER_TYPES = [
    'task.created',
    'task.status_changed',
    'task.assigned',
    'task.due',
    'task.overdue',
    'comment.created',
    'subtask.completed',
    'file.uploaded',
    'project.member_added',
    'schedule',
    'manual'
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Triggers fired by the scheduler instead of the event stream. */
export const TIME_TRIGGERS: ReadonlySet<TriggerType> = new Set(['task.due', 'task.overdue', 'schedule']);

/** Stream event type → trigger type. `task.completed` / `task.reopened` are status changes too. */
export const EVENT_TO_TRIGGER: Record<string, TriggerType> = {
    'task.created': 'task.created',
    'task.status_changed': 'task.status_changed',
    'task.completed': 'task.status_changed',
    'task.reopened': 'task.status_changed',
    'task.assigned': 'task.assigned',
    'comment.created': 'comment.created',
    'subtask.completed': 'subtask.completed',
    'file.uploaded': 'file.uploaded',
    'project.member_added': 'project.member_added'
};

export const ACTION_TYPES = [
    'set_field',
    'assign',
    'set_status',
    'comment',
    'notify',
    'create_task',
    'add_label',
    'remove_label',
    'move',
    'ai',
    'delay'
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const OPERATORS = ['eq', 'neq', 'in', 'not_in', 'contains', 'not_contains', 'empty', 'not_empty', 'lt', 'gt', 'due_within_days'] as const;
export type Operator = (typeof OPERATORS)[number];

export const CONDITION_FIELDS = [
    'task.status',
    'task.priority',
    'task.labels',
    'task.assigneeIds',
    'task.createdBy',
    'task.dueDate',
    'task.title',
    'task.isSubtask',
    'project.id',
    'actor.id',
    'comment.text'
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const TASK_STATUSES = ['Backlog', 'Todo', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'] as const;
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const SETTABLE_FIELDS = ['priority', 'dueDate', 'nextStep', 'startDate'] as const;
/** `event_users`: people named by the event (newly assigned users, new project members). */
export const DYNAMIC_PEOPLE = ['assignees', 'creator', 'actor', 'project_owner', 'admins', 'flow_owner', 'event_users'] as const;
export type DynamicPerson = (typeof DYNAMIC_PEOPLE)[number];

export const AUTOMATION_LIMITS = {
    activeFlowsPerWorkspace: 50,
    actionsPerFlow: 10,
    conditionGroups: 5,
    rulesPerGroup: 10,
    runsPerMonth: 2000,
    aiStepsPerMonth: 200,
    runsPerMinute: 60,
    runsPerEntityHour: 5,
    maxDepth: 3,
    consecutiveFailuresToPause: 5,
    autoRetries: 2,
    minDelayMinutes: 15,
    maxDelayMinutes: 30 * 24 * 60,
    runRetentionDays: 30,
    textMax: 2000,
    nameMax: 120,
    scheduledTaskBatch: 200
} as const;

export interface AutomationLimits {
    runsPerMonth: number;
    aiStepsPerMonth: number;
    activeFlowsPerWorkspace: number;
}

/** Plattform-admin override `tenants/{t}.limits.automations` (until plans exist). */
export const resolveLimits = (tenant: Json | null | undefined): AutomationLimits => {
    const raw = tenant?.limits?.automations || {};
    const pick = (key: keyof AutomationLimits) =>
        Number.isFinite(raw[key]) && raw[key] >= 0 ? Number(raw[key]) : AUTOMATION_LIMITS[key];
    return { runsPerMonth: pick('runsPerMonth'), aiStepsPerMonth: pick('aiStepsPerMonth'), activeFlowsPerWorkspace: pick('activeFlowsPerWorkspace') };
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface ConditionRule { field: ConditionField; operator: Operator; value?: unknown }
export interface ConditionGroup { op: 'and' | 'or'; rules: ConditionRule[] }
export interface Conditions { op: 'and' | 'or'; groups: ConditionGroup[] }
export interface ScheduleConfig { frequency: 'daily' | 'weekly'; time: string; weekday?: number; timezone: string }
export interface TriggerConfig {
    fromStatus?: string;
    toStatus?: string;
    assigneeId?: string;
    schedule?: ScheduleConfig;
    /** task.due / task.overdue: local time of the daily check. */
    time?: string;
    timezone?: string;
}
export interface Trigger { type: TriggerType; config: TriggerConfig }
export interface Action { id: string; type: ActionType; config: Json }

export interface AutomationDef {
    name: string;
    description: string;
    scope: 'workspace' | 'project';
    projectId: string | null;
    enabled: boolean;
    trigger: Trigger;
    conditions: Conditions;
    actions: Action[];
    allowAutomationTrigger: boolean;
    order: number;
    templateId: string | null;
}

export class AutomationValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AutomationValidationError';
    }
}

const fail = (message: string): never => {
    throw new AutomationValidationError(message);
};

const str = (value: unknown, max: number = AUTOMATION_LIMITS.textMax): string =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';

const strList = (value: unknown, max = 50): string[] =>
    Array.isArray(value) ? Array.from(new Set(value.map((item) => str(item, 200)).filter(Boolean))).slice(0, max) : [];

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const clock = (value: unknown, fallback = '09:00'): string => {
    const minutes = parseClock(value);
    if (minutes === null) return fallback;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const normalizeTrigger = (raw: Json): Trigger => {
    const type = oneOf(raw?.type, TRIGGER_TYPES) || fail('Unknown trigger type.');
    const config = (raw?.config && typeof raw.config === 'object' ? raw.config : {}) as Json;
    const out: TriggerConfig = {};
    if (type === 'task.status_changed') {
        const from = oneOf(config.fromStatus, TASK_STATUSES);
        const to = oneOf(config.toStatus, TASK_STATUSES);
        if (from) out.fromStatus = from;
        if (to) out.toStatus = to;
    }
    if (type === 'task.assigned' && str(config.assigneeId, 200)) out.assigneeId = str(config.assigneeId, 200);
    if (type === 'schedule') {
        const schedule = (config.schedule || {}) as Json;
        const frequency = oneOf(schedule.frequency, ['daily', 'weekly'] as const) || 'daily';
        out.schedule = {
            frequency,
            time: clock(schedule.time),
            timezone: resolveTimeZone(schedule.timezone),
            ...(frequency === 'weekly' ? { weekday: Math.min(7, Math.max(1, Math.round(Number(schedule.weekday) || 1))) } : {})
        };
    }
    if (type === 'task.due' || type === 'task.overdue') {
        out.time = clock(config.time, '08:00');
        out.timezone = resolveTimeZone(config.timezone);
    }
    return { type: type as TriggerType, config: out };
};

const normalizeConditions = (raw: Json | undefined): Conditions => {
    const groups = Array.isArray(raw?.groups) ? raw!.groups : [];
    if (groups.length > AUTOMATION_LIMITS.conditionGroups) fail(`At most ${AUTOMATION_LIMITS.conditionGroups} condition groups.`);
    return {
        op: raw?.op === 'or' ? 'or' : 'and',
        groups: groups.map((group: Json) => {
            const rules = Array.isArray(group?.rules) ? group.rules : [];
            if (rules.length > AUTOMATION_LIMITS.rulesPerGroup) fail(`At most ${AUTOMATION_LIMITS.rulesPerGroup} conditions per group.`);
            return {
                op: group?.op === 'or' ? 'or' : 'and',
                rules: rules.map((rule: Json) => {
                    const field = oneOf(rule?.field, CONDITION_FIELDS) || fail('Unknown condition field.');
                    const operator = oneOf(rule?.operator, OPERATORS) || fail('Unknown condition operator.');
                    const value = Array.isArray(rule.value)
                        ? strList(rule.value)
                        : typeof rule.value === 'number' || typeof rule.value === 'boolean'
                            ? rule.value
                            : str(rule.value, 500);
                    return { field, operator, ...(operator === 'empty' || operator === 'not_empty' ? {} : { value }) } as ConditionRule;
                })
            } as ConditionGroup;
        }).filter((group: ConditionGroup) => group.rules.length > 0)
    };
};

const people = (raw: Json): Json => ({
    userIds: strList(raw?.userIds, 20),
    dynamic: strList(raw?.dynamic, 7).filter((item) => (DYNAMIC_PEOPLE as readonly string[]).includes(item))
});

const normalizeAction = (raw: Json, index: number): Action => {
    const type = oneOf(raw?.type, ACTION_TYPES) || fail('Unknown action type.');
    const c = (raw?.config && typeof raw.config === 'object' ? raw.config : {}) as Json;
    const id = str(raw?.id, 40) || `a${index + 1}`;
    let config: Json = {};
    switch (type) {
        case 'set_field': {
            const field = oneOf(c.field, SETTABLE_FIELDS) || fail('Unknown field.');
            if (field === 'priority') config = { field, value: oneOf(c.value, TASK_PRIORITIES) || fail('Unknown priority.') };
            else if (field === 'dueDate' || field === 'startDate') {
                if (c.clear === true) config = { field, clear: true };
                else config = { field, relativeDays: Math.max(-365, Math.min(365, Math.round(Number(c.relativeDays) || 0))) };
            } else config = { field, value: str(c.value, 500) };
            break;
        }
        case 'assign': {
            const mode = oneOf(c.mode, ['add', 'replace', 'remove', 'clear'] as const) || 'add';
            config = { mode, ...people(c) };
            if (mode !== 'clear' && !config.userIds.length && !config.dynamic.length) fail('Choose who to assign.');
            break;
        }
        case 'set_status':
            config = { status: oneOf(c.status, TASK_STATUSES) || fail('Unknown status.') };
            break;
        case 'comment':
            config = { text: str(c.text) || fail('Comment text is required.') };
            break;
        case 'notify': {
            const channels = (c.channels || {}) as Json;
            config = {
                ...people(c),
                title: str(c.title, 200) || fail('Notification title is required.'),
                message: str(c.message, 1000),
                channels: { push: channels.push !== false, email: channels.email === true }
            };
            if (!config.userIds.length && !config.dynamic.length) fail('Choose who to notify.');
            break;
        }
        case 'create_task':
            config = {
                title: str(c.title, 300) || fail('Task title is required.'),
                description: str(c.description),
                asSubtask: c.asSubtask === true,
                projectId: str(c.projectId, 200) || null,
                priority: oneOf(c.priority, TASK_PRIORITIES) || 'Medium',
                status: oneOf(c.status, TASK_STATUSES) || 'Open',
                dueInDays: Number.isFinite(Number(c.dueInDays)) && c.dueInDays !== '' && c.dueInDays !== null
                    ? Math.max(0, Math.min(365, Math.round(Number(c.dueInDays)))) : null,
                ...people(c)
            };
            break;
        case 'add_label':
        case 'remove_label':
            config = { label: str(c.label, 80) || fail('Label is required.') };
            break;
        case 'move':
            config = { projectId: str(c.projectId, 200) || fail('Target project is required.') };
            break;
        case 'ai': {
            const mode = oneOf(c.mode, ['summarize', 'classify_label', 'classify_priority'] as const) || fail('Unknown AI mode.');
            config = { mode, instructions: str(c.instructions, 500) };
            if (mode === 'summarize') config.postComment = c.postComment !== false;
            if (mode === 'classify_label') {
                config.options = strList(c.options, 20);
                if (!config.options.length) fail('Classification needs at least one label option.');
            }
            break;
        }
        case 'delay': {
            const minutes = Math.round(Number(c.minutes) || 0);
            if (minutes < AUTOMATION_LIMITS.minDelayMinutes || minutes > AUTOMATION_LIMITS.maxDelayMinutes) {
                fail(`Delay must be between ${AUTOMATION_LIMITS.minDelayMinutes} minutes and 30 days.`);
            }
            config = { minutes };
            break;
        }
    }
    return { id, type: type as ActionType, config };
};

/** Validate client input into a stored definition. Throws AutomationValidationError. */
export const normalizeAutomation = (raw: Json): AutomationDef => {
    if (!raw || typeof raw !== 'object') fail('Flow definition is required.');
    const name = str(raw.name, AUTOMATION_LIMITS.nameMax) || fail('Name is required.');
    const scope = raw.scope === 'project' ? 'project' : 'workspace';
    const projectId = scope === 'project' ? str(raw.projectId, 200) || fail('Project flows need a project.') : null;
    const trigger = normalizeTrigger(raw.trigger || {});
    const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
    if (actionsRaw.length === 0) fail('Add at least one action.');
    if (actionsRaw.length > AUTOMATION_LIMITS.actionsPerFlow) fail(`At most ${AUTOMATION_LIMITS.actionsPerFlow} actions.`);
    const actions = actionsRaw.map(normalizeAction);
    const ids = new Set<string>();
    actions.forEach((action: Action, index: number) => {
        if (ids.has(action.id)) action.id = `a${index + 1}_${index}`;
        ids.add(action.id);
    });
    if (actions[actions.length - 1].type === 'delay') fail('A flow cannot end with a delay.');
    // Schedule/project-member flows have no task in context: task actions need create_task or none.
    const taskless = trigger.type === 'schedule' || trigger.type === 'project.member_added' || trigger.type === 'file.uploaded';
    if (taskless) {
        const bad = actions.find((action: Action) => TASK_ACTIONS.has(action.type) || (action.type === 'create_task' && action.config.asSubtask));
        if (bad) fail('This trigger has no task, so task actions are not available.');
    }
    return {
        name,
        description: str(raw.description, 500),
        scope,
        projectId,
        enabled: raw.enabled !== false,
        trigger,
        conditions: normalizeConditions(raw.conditions),
        actions,
        allowAutomationTrigger: raw.allowAutomationTrigger === true,
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 0,
        templateId: str(raw.templateId, 80) || null
    };
};

/** Actions that operate on the task in context. */
export const TASK_ACTIONS: ReadonlySet<ActionType> = new Set(['set_field', 'assign', 'set_status', 'comment', 'add_label', 'remove_label', 'move', 'ai']);

// ---------------------------------------------------------------------------
// Permissions (who may manage which flow)
// ---------------------------------------------------------------------------

export type Role = 'Owner' | 'Admin' | 'Member' | 'Guest';

export const canManageAutomation = (input: {
    role: Role | null;
    uid: string;
    scope: 'workspace' | 'project';
    project?: Json | null;
    allowMemberFlows: boolean;
}): boolean => {
    const { role, uid, scope, project } = input;
    if (role === 'Owner' || role === 'Admin') return true;
    if (role !== 'Member' || scope !== 'project' || !project) return false;
    if (project.ownerId === uid) return true;
    return input.allowMemberFlows;
};

/** May the flow owner (the flow's permission ceiling) act on this project right now? */
export const ownerCanReachProject = (role: Role | null, uid: string, project: Json | null | undefined): boolean => {
    if (!role || !project) return false;
    if (role === 'Owner' || role === 'Admin' || role === 'Member') return true;
    return false; // guests never own flows
};

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export interface StreamEvent {
    id: string;
    type: string;
    projectId: string | null;
    actor?: Json;
    cause?: Json;
    object?: Json;
    changes?: Json;
    meta?: Json;
}

export type SkipReason = 'self' | 'chain_disabled' | 'depth' | 'scope' | 'trigger_config';

/**
 * Loop guard. A flow never reacts to its own writes; other flows only when they opted in
 * (`allowAutomationTrigger`) and the chain stays within `maxDepth`. Returns the run depth or a skip.
 */
export const loopGuard = (
    automationId: string,
    automation: Pick<AutomationDef, 'allowAutomationTrigger'>,
    cause: Json | null | undefined
): { ok: true; depth: number } | { ok: false; reason: SkipReason } => {
    if (!cause || cause.kind !== 'automation') return { ok: true, depth: 1 };
    if (cause.id === automationId) return { ok: false, reason: 'self' };
    if (!automation.allowAutomationTrigger) return { ok: false, reason: 'chain_disabled' };
    const depth = (Number(cause.depth) || 1) + 1;
    if (depth > AUTOMATION_LIMITS.maxDepth) return { ok: false, reason: 'depth' };
    return { ok: true, depth };
};

/** Task the event is about (for task-centric triggers). */
export const subjectTaskId = (event: StreamEvent): string | null => {
    const object = event.object || {};
    if (object.type === 'task') return object.id || null;
    if (object.parentType === 'task' && object.parentId) return object.parentId;
    return null;
};

/** Does a stream event fire this flow's trigger (type, scope and trigger config)? */
export const matchesTrigger = (automation: Pick<AutomationDef, 'trigger' | 'scope' | 'projectId'>, event: StreamEvent): boolean => {
    const triggerType = EVENT_TO_TRIGGER[event.type];
    if (!triggerType || triggerType !== automation.trigger.type) return false;
    if (automation.scope === 'project' && automation.projectId !== event.projectId) return false;
    const config = automation.trigger.config || {};
    if (triggerType === 'task.status_changed') {
        const { from, to } = statusTransition(event);
        if (config.toStatus && config.toStatus !== to) return false;
        if (config.fromStatus && config.fromStatus !== from) return false;
    }
    if (triggerType === 'task.assigned' && config.assigneeId) {
        const added: string[] = Array.isArray(event.meta?.assigneeIds) ? event.meta!.assigneeIds : [];
        if (!added.includes(config.assigneeId)) return false;
    }
    if (triggerType === 'comment.created' && event.object?.parentType && event.object.parentType !== 'task') return false;
    return true;
};

/** from/to of a status event. `task.reopened` carries no target status (null = "any"). */
export const statusTransition = (event: StreamEvent): { from: string | null; to: string | null } => {
    if (event.type === 'task.completed') return { from: event.changes?.status?.from ?? null, to: 'Done' };
    if (event.type === 'task.reopened') return { from: 'Done', to: event.changes?.status?.to ?? null };
    return { from: event.changes?.status?.from ?? null, to: event.changes?.status?.to ?? null };
};

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export interface EvalContext {
    task: Json | null;
    taskId: string | null;
    projectId: string | null;
    actorId: string | null;
    commentText: string;
    /** `YYYY-MM-DD` today in the flow's zone. */
    today: string;
}

export const labelsOf = (task: Json | null | undefined): string[] => {
    const raw = task?.category;
    if (Array.isArray(raw)) return raw.filter((item) => typeof item === 'string' && item);
    return typeof raw === 'string' && raw ? [raw] : [];
};

export const assigneesOf = (task: Json | null | undefined): string[] => {
    if (!task) return [];
    const set = new Set<string>(Array.isArray(task.assigneeIds) ? task.assigneeIds.filter((id: unknown) => typeof id === 'string' && id) : []);
    if (typeof task.assigneeId === 'string' && task.assigneeId) set.add(task.assigneeId);
    return Array.from(set);
};

export const dateKeyOf = (value: unknown): string | null => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    if (value && typeof (value as any).toDate === 'function') return (value as any).toDate().toISOString().slice(0, 10);
    return null;
};

const fieldValue = (field: ConditionField, ctx: EvalContext): unknown => {
    const task = ctx.task || {};
    switch (field) {
        case 'task.status': return task.status ?? (task.isCompleted ? 'Done' : null);
        case 'task.priority': return task.priority ?? null;
        case 'task.labels': return labelsOf(task);
        case 'task.assigneeIds': return assigneesOf(task);
        case 'task.createdBy': return task.createdBy || task.ownerId || null;
        case 'task.dueDate': return dateKeyOf(task.dueDate);
        case 'task.title': return task.title ?? '';
        case 'task.isSubtask': return Boolean(task.parentTaskId);
        case 'project.id': return ctx.projectId;
        case 'actor.id': return ctx.actorId;
        case 'comment.text': return ctx.commentText;
    }
};

const isEmpty = (value: unknown) =>
    value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

const lower = (value: unknown) => String(value ?? '').toLowerCase();

const daysBetween = (fromKey: string, toKey: string): number =>
    Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86400000);

export const evaluateRule = (rule: ConditionRule, ctx: EvalContext): boolean => {
    const actual = fieldValue(rule.field, ctx);
    const expected = rule.value;
    const list = Array.isArray(expected) ? expected.map(String) : expected === undefined || expected === '' ? [] : [String(expected)];
    switch (rule.operator) {
        case 'empty': return isEmpty(actual);
        case 'not_empty': return !isEmpty(actual);
        case 'eq':
            if (Array.isArray(actual)) return list.length === actual.length && list.every((item) => actual.includes(item));
            if (typeof actual === 'boolean') return actual === (expected === true || expected === 'true');
            return lower(actual) === lower(expected);
        case 'neq': return !evaluateRule({ ...rule, operator: 'eq' }, ctx);
        case 'in':
            if (list.length === 0) return true; // nothing picked yet = no restriction
            if (Array.isArray(actual)) return actual.some((item) => list.includes(String(item)));
            return list.includes(String(actual));
        case 'not_in': return list.length === 0 || !evaluateRule({ ...rule, operator: 'in' }, ctx);
        case 'contains':
            if (Array.isArray(actual)) return list.every((item) => actual.map(lower).includes(lower(item)));
            return lower(actual).includes(lower(expected));
        case 'not_contains': return !evaluateRule({ ...rule, operator: 'contains' }, ctx);
        case 'lt':
        case 'gt': {
            if (actual === null || actual === undefined) return false;
            const a = rule.field === 'task.dueDate' ? String(actual) : Number(actual);
            const b = rule.field === 'task.dueDate' ? String(expected) : Number(expected);
            return rule.operator === 'lt' ? a < b : a > b;
        }
        case 'due_within_days': {
            if (typeof actual !== 'string') return false;
            const diff = daysBetween(ctx.today, actual);
            return diff >= 0 && diff <= (Number(expected) || 0);
        }
    }
    return false;
};

export const evaluateConditions = (conditions: Conditions | null | undefined, ctx: EvalContext): boolean => {
    const groups = conditions?.groups || [];
    if (groups.length === 0) return true;
    const groupResult = (group: ConditionGroup) =>
        group.op === 'or' ? group.rules.some((rule) => evaluateRule(rule, ctx)) : group.rules.every((rule) => evaluateRule(rule, ctx));
    return conditions!.op === 'or' ? groups.some(groupResult) : groups.every(groupResult);
};

/** Conditions that look at a task need one; taskless contexts fail them. */
export const conditionsNeedTask = (conditions: Conditions | null | undefined): boolean =>
    (conditions?.groups || []).some((group) => group.rules.some((rule) => rule.field.startsWith('task.')));

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const TEMPLATE_VARIABLES = [
    'task.title', 'task.url', 'task.status', 'task.priority', 'task.dueDate', 'task.assignees',
    'project.title', 'actor.name', 'comment.text', 'ai.result', 'now.date', 'flow.name'
] as const;

/** Replace `{{var}}`; unknown variables become '' and are reported. */
export const renderTemplate = (text: string, vars: Record<string, string>): { text: string; unknown: string[] } => {
    const unknown: string[] = [];
    const out = String(text || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, key: string) => {
        if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key] ?? '';
        unknown.push(key);
        return '';
    });
    return { text: out, unknown };
};

// ---------------------------------------------------------------------------
// Action planning (pure part: compute the patch for task actions)
// ---------------------------------------------------------------------------

export const addDays = (dateKey: string, days: number): string => {
    const ms = Date.parse(`${dateKey}T00:00:00Z`) + days * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
};

export interface PeopleContext {
    task: Json | null;
    actorId: string | null;
    projectOwnerId: string | null;
    adminIds: string[];
    flowOwnerId: string;
    eventUserIds?: string[];
}

export const resolvePeople = (spec: Json, ctx: PeopleContext): string[] => {
    const out = new Set<string>(Array.isArray(spec?.userIds) ? spec.userIds : []);
    for (const item of (spec?.dynamic || []) as DynamicPerson[]) {
        if (item === 'assignees') assigneesOf(ctx.task).forEach((id) => out.add(id));
        if (item === 'creator') {
            const creator = ctx.task?.createdBy || ctx.task?.ownerId;
            if (creator) out.add(creator);
        }
        if (item === 'actor' && ctx.actorId) out.add(ctx.actorId);
        if (item === 'project_owner' && ctx.projectOwnerId) out.add(ctx.projectOwnerId);
        if (item === 'admins') ctx.adminIds.forEach((id) => out.add(id));
        if (item === 'flow_owner' && ctx.flowOwnerId) out.add(ctx.flowOwnerId);
        if (item === 'event_users') (ctx.eventUserIds || []).forEach((id) => out.add(id));
    }
    out.delete('');
    return Array.from(out);
};

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

/**
 * Patch for a field-level task action, or null when the task already has that state (no-op:
 * no write, so no follow-up event). Assign returns `assigneeIds` and clears legacy `assigneeId`.
 */
export const planTaskPatch = (action: Action, task: Json, ctx: PeopleContext & { today: string }): Json | null => {
    const c = action.config;
    switch (action.type) {
        case 'set_status': {
            if (task.status === c.status) return null;
            return { status: c.status, isCompleted: c.status === 'Done' };
        }
        case 'set_field': {
            if (c.field === 'priority') return task.priority === c.value ? null : { priority: c.value };
            if (c.field === 'nextStep') return (task.nextStep || '') === c.value ? null : { nextStep: c.value };
            if (c.clear) return task[c.field] ? { [c.field]: null } : null;
            const value = addDays(ctx.today, Number(c.relativeDays) || 0);
            return dateKeyOf(task[c.field]) === value ? null : { [c.field]: value };
        }
        case 'assign': {
            const current = assigneesOf(task);
            const people = resolvePeople(c, ctx);
            let next: string[];
            if (c.mode === 'clear') next = [];
            else if (c.mode === 'replace') next = people;
            else if (c.mode === 'remove') next = current.filter((id) => !people.includes(id));
            else next = Array.from(new Set([...current, ...people]));
            if (sameList(next, current) && !(task.assigneeId && !next.includes(task.assigneeId))) return null;
            return { assigneeIds: next, assigneeId: next[0] || null };
        }
        case 'add_label': {
            const labels = labelsOf(task);
            if (labels.some((label) => label.toLowerCase() === String(c.label).toLowerCase())) return null;
            return { category: [...labels, c.label] };
        }
        case 'remove_label': {
            const labels = labelsOf(task);
            const next = labels.filter((label) => label.toLowerCase() !== String(c.label).toLowerCase());
            return next.length === labels.length ? null : { category: next };
        }
    }
    return null;
};

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

/** Next UTC instant (> nowMs) at which a time trigger fires; null for event triggers. */
export const computeNextRunAt = (trigger: Trigger, nowMs: number): number | null => {
    if (!TIME_TRIGGERS.has(trigger.type)) return null;
    const config = trigger.config || {};
    const schedule = trigger.type === 'schedule' ? config.schedule : null;
    const timeZone = resolveTimeZone(schedule?.timezone || config.timezone || DEFAULT_TIMEZONE);
    const minutes = parseClock(schedule?.time || config.time || '08:00') ?? 8 * 60;
    for (let offset = 0; offset <= 8; offset++) {
        const local = zonedParts(nowMs + offset * 86400000, timeZone);
        const candidate = zonedTimeToUtcMs(local.year, local.month, local.day, Math.floor(minutes / 60), minutes % 60, timeZone);
        if (candidate <= nowMs) continue;
        if (schedule?.frequency === 'weekly') {
            const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() || 7; // 1 = Mon … 7 = Sun
            if (weekday !== (schedule.weekday || 1)) continue;
        }
        return candidate;
    }
    return null;
};

/** Slot id (local date + time) used in deterministic run ids of scheduled runs. */
export const slotKey = (trigger: Trigger, slotMs: number): string => {
    const zone = resolveTimeZone(trigger.config?.schedule?.timezone || trigger.config?.timezone);
    const p = zonedParts(slotMs, zone);
    return `${localDateKey(slotMs, zone)}T${String(p.hour).padStart(2, '0')}${String(p.minute).padStart(2, '0')}`;
};

export const flowTimeZone = (trigger: Trigger): string =>
    resolveTimeZone(trigger.config?.schedule?.timezone || trigger.config?.timezone);

/** Local date the due/overdue scan looks for: today (due) or yesterday (overdue). */
export const dueScanDate = (trigger: Trigger, slotMs: number): string => {
    const today = localDateKey(slotMs, flowTimeZone(trigger));
    return trigger.type === 'task.overdue' ? addDays(today, -1) : today;
};

export const isTaskDone = (task: Json | null | undefined): boolean =>
    Boolean(task && (task.isCompleted === true || task.status === 'Done'));

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export const runIdFor = (automationId: string, key: string): string =>
    `${automationId}_${key}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 300);

export const monthKey = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 7);
export const minuteKey = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 16).replace(/[-:T]/g, '');
export const hourKey = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 13).replace(/[-:T]/g, '');

export type LimitDecision = { ok: true } | { ok: false; reason: 'month' | 'minute' | 'entity' };

export const checkLimits = (input: {
    monthRuns: number;
    minuteRuns: number;
    entityHourRuns: number;
    limits: AutomationLimits;
}): LimitDecision => {
    if (input.monthRuns >= input.limits.runsPerMonth) return { ok: false, reason: 'month' };
    if (input.minuteRuns >= AUTOMATION_LIMITS.runsPerMinute) return { ok: false, reason: 'minute' };
    if (input.entityHourRuns >= AUTOMATION_LIMITS.runsPerEntityHour) return { ok: false, reason: 'entity' };
    return { ok: true };
};

/** Errors worth an automatic retry (Firestore/HTTP transient codes). */
export const isTransientError = (error: any): boolean => {
    const code = error?.code;
    return code === 4 || code === 10 || code === 13 || code === 14 || code === 'unavailable' || code === 'deadline-exceeded' ||
        code === 'aborted' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || (typeof error?.status === 'number' && error.status >= 500);
};

/** Next failure state of a flow after a run finished. */
export const nextFailureState = (consecutiveFailures: number, failed: boolean): { consecutiveFailures: number; pause: boolean } => {
    if (!failed) return { consecutiveFailures: 0, pause: false };
    const next = (consecutiveFailures || 0) + 1;
    return { consecutiveFailures: next, pause: next >= AUTOMATION_LIMITS.consecutiveFailuresToPause };
};
