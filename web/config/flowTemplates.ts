// Flow templates for the gallery (/flows). Each builds an editable draft; names come from i18n
// (`flows.templates.<id>.title|description`). Concept: brain/plans/flows-concept.md §4.
import type { FlowAction, FlowDefinition } from '../services/domain/automationsService';

export type FlowTemplateCategory = 'notify' | 'assign' | 'organize' | 'schedule' | 'ai';
export const FLOW_TEMPLATE_CATEGORIES: FlowTemplateCategory[] = ['notify', 'assign', 'organize', 'schedule', 'ai'];

export interface FlowTemplate {
    id: string;
    icon: string;
    category: FlowTemplateCategory;
    /** Draft without name/description (filled from i18n). `t` localises default texts. */
    build: (projectId: string | null, t: (key: string) => string) => Omit<FlowDefinition, 'name' | 'description'>;
}

const action = (index: number, type: FlowAction['type'], config: FlowAction['config']): FlowAction => ({ id: `a${index}`, type, config });

const base = (projectId: string | null) => ({
    scope: projectId ? 'project' as const : 'workspace' as const,
    projectId,
    enabled: true,
    conditions: { op: 'and' as const, groups: [] },
    allowAutomationTrigger: false,
});

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

export const FLOW_TEMPLATES: FlowTemplate[] = [
    {
        id: 'done_notify_creator',
        category: 'notify',
        icon: 'task_alt',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.status_changed', config: { toStatus: 'Done' } },
            actions: [action(1, 'notify', {
                userIds: [], dynamic: ['creator'], title: '{{task.title}}', message: t('flows.templates.done_notify_creator.text'), channels: { push: true, email: false },
            })],
        }),
    },
    {
        id: 'unassigned_to_owner',
        category: 'assign',
        icon: 'person_add',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.created', config: {} },
            conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'task.assigneeIds', operator: 'empty' }] }] },
            actions: [action(1, 'assign', { mode: 'add', userIds: [], dynamic: ['project_owner'] })],
        }),
    },
    {
        id: 'overdue_remind',
        category: 'notify',
        icon: 'alarm',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.overdue', config: { time: '08:00', timezone: timezone() } },
            actions: [action(1, 'notify', {
                userIds: [], dynamic: ['assignees'], title: '{{task.title}}', message: '{{task.dueDate}}', channels: { push: true, email: true },
            })],
        }),
    },
    {
        id: 'urgent_label_admins',
        category: 'organize',
        icon: 'priority_high',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.created', config: {} },
            conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'task.priority', operator: 'eq', value: 'Urgent' }] }] },
            actions: [
                action(1, 'add_label', { label: 'urgent' }),
                action(2, 'notify', { userIds: [], dynamic: ['admins'], title: '{{task.title}}', message: '{{project.title}}', channels: { push: true, email: false } }),
            ],
        }),
    },
    {
        id: 'review_assign_comment',
        category: 'assign',
        icon: 'rate_review',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.status_changed', config: { toStatus: 'Review' } },
            actions: [
                action(1, 'assign', { mode: 'add', userIds: [], dynamic: ['project_owner'] }),
                action(2, 'comment', { text: t('flows.templates.review_assign_comment.text') }),
            ],
        }),
    },
    {
        id: 'weekly_planning',
        category: 'schedule',
        icon: 'event_repeat',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'schedule', config: { schedule: { frequency: 'weekly', weekday: 1, time: '09:00', timezone: timezone() } } },
            actions: [action(1, 'create_task', {
                title: t('flows.templates.weekly_planning.text'), description: '', asSubtask: false, projectId, priority: 'Medium', status: 'Open', dueInDays: 0, userIds: [], dynamic: ['flow_owner'],
            })],
        }),
    },
    {
        id: 'member_onboarding',
        category: 'assign',
        icon: 'waving_hand',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'project.member_added', config: {} },
            actions: [action(1, 'create_task', {
                title: t('flows.templates.member_onboarding.text'), description: '', asSubtask: false, projectId: null, priority: 'Medium', status: 'Open', dueInDays: 7, userIds: [], dynamic: ['event_users'],
            })],
        }),
    },
    {
        id: 'ai_triage',
        category: 'ai',
        icon: 'auto_awesome',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.created', config: {} },
            actions: [action(1, 'ai', { mode: 'classify_priority', instructions: '' })],
        }),
    },
    {
        id: 'blocked_comment',
        category: 'organize',
        icon: 'block',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'comment.created', config: {} },
            conditions: { op: 'or', groups: [{ op: 'or', rules: [
                { field: 'comment.text', operator: 'contains', value: 'blockiert' },
                { field: 'comment.text', operator: 'contains', value: 'blocked' },
            ] }] },
            actions: [
                action(1, 'set_status', { status: 'Blocked' }),
                action(2, 'notify', { userIds: [], dynamic: ['project_owner'], title: '{{task.title}}', message: '{{comment.text}}', channels: { push: true, email: false } }),
            ],
        }),
    },
    {
        id: 'due_today_morning',
        category: 'notify',
        icon: 'today',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'task.due', config: { time: '08:00', timezone: timezone() } },
            actions: [action(1, 'notify', {
                userIds: [], dynamic: ['assignees'], title: '{{task.title}}', message: '{{project.title}}', channels: { push: true, email: false },
            })],
        }),
    },
    {
        id: 'subtask_done_comment',
        category: 'organize',
        icon: 'checklist_rtl',
        build: (projectId, t) => ({
            ...base(projectId),
            trigger: { type: 'subtask.completed', config: {} },
            conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'task.status', operator: 'not_in', value: ['Review', 'Done'] }] }] },
            actions: [action(1, 'comment', { text: t('flows.templates.subtask_done_comment.text') })],
        }),
    },
];

export const getFlowTemplate = (id: string | null | undefined) => FLOW_TEMPLATES.find((template) => template.id === id) || null;
