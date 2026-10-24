// Readable sentences for flow triggers and actions ("Wenn der Status sich zu Review ändert").
import type { FlowAction, FlowDefinition, FlowTrigger } from '../../services/domain/automationsService';

type T = (key: string) => string;

export interface FlowNameLookup {
    person: (uid: string) => string;
    project: (id: string) => string;
}

const fill = (text: string, values: Record<string, string>) =>
    Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(value), text);

export const statusLabel = (t: T, status: string | undefined) => (status ? t(`flows.status.${status}`) : t('flows.any'));
export const priorityLabel = (t: T, priority: string | undefined) => (priority ? t(`flows.priority.${priority}`) : '');

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export const triggerSentence = (trigger: FlowTrigger, t: T, names: FlowNameLookup): string => {
    const config = trigger.config || {};
    switch (trigger.type) {
        case 'task.status_changed':
            if (config.toStatus && config.fromStatus) {
                return fill(t('flows.sentence.trigger.statusFromTo'), { from: statusLabel(t, config.fromStatus), to: statusLabel(t, config.toStatus) });
            }
            if (config.toStatus) return fill(t('flows.sentence.trigger.statusTo'), { to: statusLabel(t, config.toStatus) });
            return t('flows.sentence.trigger.statusAny');
        case 'task.assigned':
            return config.assigneeId
                ? fill(t('flows.sentence.trigger.assignedTo'), { person: names.person(config.assigneeId) })
                : t('flows.sentence.trigger.assigned');
        case 'task.due':
        case 'task.overdue':
            return fill(t(`flows.sentence.trigger.${trigger.type === 'task.due' ? 'due' : 'overdue'}`), { time: config.time || '08:00' });
        case 'schedule': {
            const schedule = config.schedule;
            if (!schedule) return t('flows.trigger.schedule');
            return schedule.frequency === 'weekly'
                ? fill(t('flows.sentence.trigger.weekly'), { day: t(`flows.weekday.${schedule.weekday || 1}`), time: schedule.time })
                : fill(t('flows.sentence.trigger.daily'), { time: schedule.time });
        }
        default:
            return t(`flows.sentence.trigger.${trigger.type}`);
    }
};

const peopleText = (config: FlowAction['config'], t: T, names: FlowNameLookup) => {
    const parts = [
        ...((config.dynamic || []) as string[]).map((item) => t(`flows.people.${item}`)),
        ...((config.userIds || []) as string[]).map(names.person),
    ];
    return parts.length ? parts.join(', ') : t('flows.people.nobody');
};

export const actionSentence = (action: FlowAction, t: T, names: FlowNameLookup): string => {
    const c = action.config || {};
    switch (action.type) {
        case 'set_status':
            return fill(t('flows.sentence.action.set_status'), { status: statusLabel(t, c.status) });
        case 'set_field':
            if (c.field === 'priority') return fill(t('flows.sentence.action.priority'), { value: priorityLabel(t, c.value) });
            if (c.field === 'nextStep') return t('flows.sentence.action.nextStep');
            if (c.clear) return fill(t('flows.sentence.action.clearDate'), { field: t(`flows.field.${c.field}`) });
            return fill(t('flows.sentence.action.date'), { field: t(`flows.field.${c.field}`), days: String(c.relativeDays ?? 0) });
        case 'assign':
            return fill(t(`flows.sentence.action.assign.${c.mode || 'add'}`), { people: peopleText(c, t, names) });
        case 'notify':
            return fill(t('flows.sentence.action.notify'), { people: peopleText(c, t, names) });
        case 'create_task':
            return fill(t(c.asSubtask ? 'flows.sentence.action.create_subtask' : 'flows.sentence.action.create_task'), { title: c.title || '…' });
        case 'add_label':
        case 'remove_label':
            return fill(t(`flows.sentence.action.${action.type}`), { label: c.label || '…' });
        case 'move':
            return fill(t('flows.sentence.action.move'), { project: c.projectId ? names.project(c.projectId) : '…' });
        case 'ai':
            return t(`flows.sentence.action.ai.${c.mode || 'summarize'}`);
        case 'delay': {
            const minutes = Number(c.minutes) || 0;
            const [value, unit] = minutes % 1440 === 0 ? [minutes / 1440, 'days'] : minutes % 60 === 0 ? [minutes / 60, 'hours'] : [minutes, 'minutes'];
            return fill(t('flows.sentence.action.delay'), { value: String(value), unit: t(`flows.unit.${unit}`) });
        }
        default:
            return t(`flows.action.${action.type}`);
    }
};

export const TRIGGER_ICONS: Record<string, string> = {
    'task.created': 'add_task',
    'task.status_changed': 'swap_horiz',
    'task.assigned': 'person_add',
    'task.due': 'today',
    'task.overdue': 'alarm',
    'comment.created': 'chat',
    'subtask.completed': 'checklist',
    'file.uploaded': 'upload_file',
    'project.member_added': 'group_add',
    schedule: 'event_repeat',
    manual: 'play_circle',
};

export const ACTION_ICONS: Record<string, string> = {
    set_field: 'edit',
    assign: 'person',
    set_status: 'swap_horiz',
    comment: 'chat',
    notify: 'notifications',
    create_task: 'add_task',
    add_label: 'label',
    remove_label: 'label_off',
    move: 'drive_file_move',
    ai: 'auto_awesome',
    delay: 'hourglass_empty',
};

/** Triggers without a task in context (task actions are not available). */
export const TASKLESS_TRIGGERS = new Set(['schedule', 'project.member_added', 'file.uploaded']);
export const TASK_ACTIONS = new Set(['set_field', 'assign', 'set_status', 'comment', 'add_label', 'remove_label', 'move', 'ai']);

/** Client-side validation (localised); the server validates again. Returns an i18n key or null. */
export const validateFlow = (flow: FlowDefinition): string | null => {
    if (!flow.name.trim()) return 'flows.error.name';
    if (flow.scope === 'project' && !flow.projectId) return 'flows.error.project';
    if (flow.actions.length === 0) return 'flows.error.noActions';
    if (flow.actions[flow.actions.length - 1].type === 'delay') return 'flows.error.endsWithDelay';
    for (const group of flow.conditions.groups) {
        for (const rule of group.rules) {
            if (rule.field !== 'ai' || !rule.ai) continue;
            if (rule.ai.question.trim().length < 3) return 'flows.error.aiQuestion';
            if (rule.ai.kind === 'choice' && ((rule.ai.choices || []).length < 2 || !(rule.ai.accept || []).length)) return 'flows.error.aiChoices';
        }
    }
    for (const action of flow.actions) {
        const problem = validateAction(action, flow);
        if (problem) return problem;
    }
    return null;
};

/** Problem of one action (i18n key) or null; used for the "incomplete" badge on step cards. */
export const validateAction = (action: FlowDefinition['actions'][number], flow: FlowDefinition): string | null => {
    const taskless = TASKLESS_TRIGGERS.has(flow.trigger.type);
    const c = action.config || {};
    if (taskless && (TASK_ACTIONS.has(action.type) || (action.type === 'create_task' && c.asSubtask))) return 'flows.error.tasklessAction';
    if (action.type === 'comment' && !String(c.text || '').trim()) return 'flows.error.commentText';
    if (action.type === 'notify' && !String(c.title || '').trim()) return 'flows.error.notifyTitle';
    if ((action.type === 'notify' || (action.type === 'assign' && c.mode !== 'clear'))
        && !(c.userIds || []).length && !(c.dynamic || []).length) return 'flows.error.people';
    if (action.type === 'create_task' && !String(c.title || '').trim()) return 'flows.error.taskTitle';
    if (action.type === 'create_task' && !c.asSubtask && !c.projectId && !flow.projectId
        && (flow.trigger.type === 'schedule' || flow.trigger.type === 'manual')) return 'flows.error.taskProject';
    if ((action.type === 'add_label' || action.type === 'remove_label') && !String(c.label || '').trim()) return 'flows.error.label';
    if (action.type === 'move' && !c.projectId) return 'flows.error.moveProject';
    if (action.type === 'ai' && c.mode === 'classify_label' && (c.options || []).length < 2) return 'flows.error.aiOptions';
    if (action.type === 'delay' && (Number(c.minutes) < 15 || Number(c.minutes) > 43200)) return 'flows.error.delay';
    return null;
};
