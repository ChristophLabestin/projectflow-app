// "Flow aus Satz": strict Structured Outputs schema that mirrors the engine's flow definition, and
// the converter from the model output to a validated draft. Pure module (unit tested).
import {
    ACTION_TYPES,
    AI_ACTION_MODES,
    AutomationDef,
    AutomationValidationError,
    CONDITION_FIELDS,
    DYNAMIC_PEOPLE,
    Json,
    OPERATORS,
    SETTABLE_FIELDS,
    TASK_PRIORITIES,
    TASK_STATUSES,
    TRIGGER_TYPES,
    normalizeAutomation
} from './automation-logic';

const nullable = (schema: Json): Json => ({ anyOf: [schema, { type: 'null' }] });
const str = { type: 'string' };
const strings = { type: 'array', items: { type: 'string' } };
const enumOf = (values: readonly string[]) => ({ type: 'string', enum: [...values] });
const object = (properties: Record<string, Json>): Json => ({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false
});

/** Strict JSON schema (every property required, nullable instead of optional). */
export const FLOW_DRAFT_SCHEMA = {
    name: 'flow_draft',
    schema: object({
        name: str,
        description: str,
        projectId: nullable(str),
        trigger: object({
            type: enumOf(TRIGGER_TYPES),
            fromStatus: nullable(enumOf(TASK_STATUSES)),
            toStatus: nullable(enumOf(TASK_STATUSES)),
            assigneeId: nullable(str),
            frequency: nullable(enumOf(['daily', 'weekly'])),
            weekday: nullable({ type: 'integer' }),
            time: nullable(str)
        }),
        conditionsOp: enumOf(['and', 'or']),
        conditions: {
            type: 'array',
            items: object({
                field: enumOf(CONDITION_FIELDS.filter((field) => field !== 'ai')),
                operator: enumOf(OPERATORS.filter((op) => op !== 'ai')),
                values: strings,
                number: nullable({ type: 'number' })
            })
        },
        aiCondition: object({
            kind: nullable(enumOf(['predicate', 'choice', 'score'])),
            question: nullable(str),
            threshold: nullable({ type: 'number' }),
            choices: nullable(strings),
            accept: nullable(strings),
            levels: nullable({ type: 'integer' }),
            minScore: nullable({ type: 'number' })
        }),
        actions: {
            type: 'array',
            items: object({
                type: enumOf(ACTION_TYPES),
                status: nullable(enumOf(TASK_STATUSES)),
                field: nullable(enumOf(SETTABLE_FIELDS)),
                priority: nullable(enumOf(TASK_PRIORITIES)),
                relativeDays: nullable({ type: 'integer' }),
                assignMode: nullable(enumOf(['add', 'replace', 'remove', 'clear'])),
                userIds: strings,
                dynamic: { type: 'array', items: enumOf(DYNAMIC_PEOPLE) },
                text: nullable(str),
                title: nullable(str),
                message: nullable(str),
                label: nullable(str),
                projectId: nullable(str),
                asSubtask: nullable({ type: 'boolean' }),
                dueInDays: nullable({ type: 'integer' }),
                minutes: nullable({ type: 'integer' }),
                aiMode: nullable(enumOf(AI_ACTION_MODES)),
                options: nullable(strings),
                email: nullable({ type: 'boolean' })
            })
        }
    })
};

export interface DraftContext {
    members: { uid: string; name: string }[];
    projects: { id: string; title: string }[];
    defaultProjectId: string | null;
    timezone: string;
    today: string;
}

export const flowDraftInstructions = (ctx: DraftContext) => [
    'You turn a one-sentence description into an automation ("flow") for the project management app ProjectFlow.',
    'A flow has exactly one trigger, optional conditions (all combined with conditionsOp) and 1-10 ordered actions.',
    'Use only ids from the lists below for people (userIds) and projects; prefer dynamic people (assignees, creator, actor, project_owner, admins, flow_owner, event_users) when the sentence names a role.',
    'Use an aiCondition only when the sentence needs judgement about text (e.g. "if the comment describes a blocker"); otherwise set every aiCondition field to null.',
    'Templates may use {{task.title}}, {{task.url}}, {{project.title}}, {{actor.name}}, {{comment.text}}, {{ai.result}}, {{now.date}}.',
    'Write name, texts and messages in the language of the sentence. Times are HH:mm. weekday: 1=Monday..7=Sunday.',
    `Today is ${ctx.today}, time zone ${ctx.timezone}.`,
    ctx.defaultProjectId ? `The user is in project ${ctx.defaultProjectId}; use it as projectId unless the sentence says workspace-wide.` : 'Use projectId null (whole workspace) unless the sentence names a project.',
    `Members: ${ctx.members.map((m) => `${m.uid}=${m.name}`).join('; ') || 'none'}`,
    `Projects: ${ctx.projects.map((p) => `${p.id}=${p.title}`).join('; ') || 'none'}`
].join('\n');

const has = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined && value !== ('' as any);

/** Model action → engine action config (drops null fields). */
const actionFromModel = (a: Json, index: number): Json => {
    const people = { userIds: a.userIds || [], dynamic: a.dynamic || [] };
    const base = { id: `a${index + 1}`, type: a.type };
    switch (a.type) {
        case 'set_status': return { ...base, config: { status: a.status } };
        case 'set_field':
            if (a.field === 'priority') return { ...base, config: { field: 'priority', value: a.priority } };
            if (a.field === 'nextStep') return { ...base, config: { field: 'nextStep', value: a.text || '' } };
            return { ...base, config: { field: a.field, relativeDays: a.relativeDays ?? 0 } };
        case 'assign': return { ...base, config: { mode: a.assignMode || 'add', ...people } };
        case 'comment': return { ...base, config: { text: a.text } };
        case 'notify': return { ...base, config: { ...people, title: a.title || '{{task.title}}', message: a.message || a.text || '', channels: { push: true, email: a.email === true } } };
        case 'create_task': return {
            ...base,
            config: { title: a.title, description: a.text || '', asSubtask: a.asSubtask === true, projectId: a.projectId, priority: a.priority || 'Medium', status: a.status || 'Open', dueInDays: a.dueInDays, ...people }
        };
        case 'add_label':
        case 'remove_label': return { ...base, config: { label: a.label } };
        case 'move': return { ...base, config: { projectId: a.projectId } };
        case 'ai': return { ...base, config: { mode: a.aiMode, instructions: a.text || '', options: a.options || [], asSubtask: a.asSubtask === true, projectId: a.projectId, postComment: true } };
        case 'delay': return { ...base, config: { minutes: a.minutes } };
    }
    return { ...base, config: {} };
};

export interface DraftResult {
    draft: AutomationDef;
    /** Problems the converter fixed or dropped (shown to the user). */
    warnings: string[];
}

/**
 * Convert and validate the model output. Invalid parts (unknown people/projects, broken actions or
 * conditions) are dropped with a warning; the draft is always disabled until the user saves it.
 */
export const draftFromModel = (raw: Json, ctx: DraftContext): DraftResult => {
    const warnings: string[] = [];
    const memberIds = new Set(ctx.members.map((m) => m.uid));
    const projectIds = new Set(ctx.projects.map((p) => p.id));
    const knownProject = (id: unknown) => (typeof id === 'string' && projectIds.has(id) ? id : null);

    const projectId = knownProject(raw.projectId);
    if (raw.projectId && !projectId) warnings.push('unknown_project');
    const trigger = raw.trigger || {};
    const triggerConfig: Json = {};
    if (has(trigger.fromStatus)) triggerConfig.fromStatus = trigger.fromStatus;
    if (has(trigger.toStatus)) triggerConfig.toStatus = trigger.toStatus;
    if (has(trigger.assigneeId)) {
        if (memberIds.has(trigger.assigneeId)) triggerConfig.assigneeId = trigger.assigneeId;
        else warnings.push('unknown_person');
    }
    if (trigger.type === 'schedule') {
        triggerConfig.schedule = { frequency: trigger.frequency || 'weekly', weekday: trigger.weekday || 1, time: trigger.time || '09:00', timezone: ctx.timezone };
    }
    if (trigger.type === 'task.due' || trigger.type === 'task.overdue') {
        triggerConfig.time = trigger.time || '08:00';
        triggerConfig.timezone = ctx.timezone;
    }

    const rules: Json[] = [];
    for (const c of Array.isArray(raw.conditions) ? raw.conditions : []) {
        const value = c.operator === 'due_within_days' ? (c.number ?? 3)
            : c.field === 'task.isSubtask' ? (c.values?.[0] !== 'false')
                : ['in', 'not_in'].includes(c.operator) ? c.values || []
                    : (c.values || [])[0] ?? (c.number ?? '');
        const people = ['task.assigneeIds', 'task.createdBy', 'actor.id'].includes(c.field);
        if (people && typeof value === 'string' && value && !memberIds.has(value)) {
            warnings.push('unknown_person');
            continue;
        }
        rules.push({ field: c.field, operator: c.operator, value });
    }
    const ai = raw.aiCondition || {};
    if (ai.kind && ai.question) {
        rules.push({ field: 'ai', operator: 'ai', ai: { kind: ai.kind, question: ai.question, threshold: ai.threshold, choices: ai.choices, accept: ai.accept, levels: ai.levels, minScore: ai.minScore } });
    }

    const actions: Json[] = [];
    (Array.isArray(raw.actions) ? raw.actions : []).slice(0, 10).forEach((a: Json, index: number) => {
        const userIds = (a.userIds || []).filter((uid: string) => memberIds.has(uid));
        if (userIds.length !== (a.userIds || []).length) warnings.push('unknown_person');
        const projectRef = a.projectId ? knownProject(a.projectId) : null;
        if (a.projectId && !projectRef) warnings.push('unknown_project');
        actions.push(actionFromModel({ ...a, userIds, projectId: projectRef }, index));
    });

    const candidate = (parts: { rules: Json[]; actions: Json[] }) => ({
        name: raw.name || 'Flow',
        description: raw.description || '',
        scope: projectId ? 'project' : 'workspace',
        projectId,
        enabled: false,
        trigger: { type: trigger.type, config: triggerConfig },
        conditions: { op: 'and', groups: parts.rules.length ? [{ op: raw.conditionsOp === 'or' ? 'or' : 'and', rules: parts.rules }] : [] },
        actions: parts.actions,
        allowAutomationTrigger: false,
        templateId: 'from_text'
    });

    // Validate piece by piece so one broken part does not lose the whole draft.
    const keptRules = rules.filter((rule) => {
        try {
            normalizeAutomation(candidate({ rules: [rule], actions: [{ id: 'a1', type: 'comment', config: { text: 'x' } }] }));
            return true;
        } catch {
            warnings.push('dropped_condition');
            return false;
        }
    });
    const keptActions = actions.filter((action) => {
        try {
            normalizeAutomation(candidate({ rules: [], actions: [action] }));
            return true;
        } catch {
            warnings.push('dropped_action');
            return false;
        }
    }).map((action, index): Json => ({ ...action, id: `a${index + 1}` }));
    // Trailing delays are invalid.
    while (keptActions.length && keptActions[keptActions.length - 1].type === 'delay') {
        keptActions.pop();
        warnings.push('dropped_action');
    }
    if (!keptActions.length) throw new AutomationValidationError('The sentence did not describe an action the flow can do.');
    const draft = normalizeAutomation(candidate({ rules: keptRules, actions: keptActions }));
    return { draft, warnings: Array.from(new Set(warnings)) };
};
