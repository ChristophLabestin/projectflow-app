// Editors for the three step kinds of a flow (Wenn → Falls → Dann). Pure controlled components.
import React from 'react';

import { Select } from '../common/Select/Select';
import { TextInput } from '../common/Input/TextInput';
import { TextArea } from '../common/Input/TextArea';
import { Checkbox } from '../common/Checkbox/Checkbox';
import type {
    FlowAction,
    FlowActionType,
    FlowConditionField,
    FlowConditionGroup,
    FlowConditionRule,
    FlowConditions,
    FlowDynamicPerson,
    FlowOperator,
    FlowTrigger,
    FlowTriggerType,
} from '../../services/domain/automationsService';
import { TASKLESS_TRIGGERS, TASK_ACTIONS, WEEKDAYS } from './flowText';

type T = (key: string) => string;

export interface FlowEditorOptions {
    t: T;
    members: { uid: string; name: string }[];
    projects: { id: string; title: string }[];
    /** Workspace flows may filter by project in conditions. */
    workspaceScope: boolean;
}

export const STATUSES = ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const TRIGGER_TYPES: FlowTriggerType[] = [
    'task.created', 'task.status_changed', 'task.assigned', 'task.due', 'task.overdue', 'comment.created',
    'subtask.completed', 'project.member_added', 'file.uploaded', 'schedule', 'manual',
];
export const ACTION_TYPES: FlowActionType[] = [
    'set_status', 'assign', 'set_field', 'add_label', 'remove_label', 'comment', 'notify', 'create_task', 'move', 'ai', 'delay',
];
const DYNAMIC: FlowDynamicPerson[] = ['assignees', 'creator', 'actor', 'project_owner', 'admins', 'flow_owner', 'event_users'];

export const VARIABLES = [
    'task.title', 'task.url', 'task.status', 'task.priority', 'task.dueDate', 'task.assignees',
    'project.title', 'actor.name', 'comment.text', 'ai.result', 'now.date', 'flow.name',
];

const Field: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
    <label className={`flow-field ${wide ? 'flow-field--wide' : ''}`.trim()}>
        <span className="flow-field__label">{label}</span>
        {children}
    </label>
);

const options = (values: string[], label: (value: string) => string) => values.map((value) => ({ value, label: label(value) }));

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

export const VariableChips: React.FC<{ t: T; onInsert: (token: string) => void }> = ({ t, onInsert }) => (
    <div className="flow-variables" aria-label={t('flows.variables.label')}>
        <span className="flow-variables__label">{t('flows.variables.label')}</span>
        {VARIABLES.map((variable) => (
            <button key={variable} type="button" className="flow-chip flow-chip--ghost" onClick={() => onInsert(`{{${variable}}}`)}
                title={t(`flows.variables.${variable}`)}>
                {t(`flows.variables.${variable}`)}
            </button>
        ))}
    </div>
);

/** Text field with variable chips that append `{{var}}`. */
const TemplateText: React.FC<{
    t: T; label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string;
}> = ({ t, label, value, onChange, multiline, placeholder }) => (
    <div className="flow-field flow-field--wide">
        {multiline
            ? <TextArea label={label} value={value} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
            : <TextInput label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
        <VariableChips t={t} onInsert={(token) => onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}${token}`)} />
    </div>
);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const PeoplePicker: React.FC<{
    opts: FlowEditorOptions;
    label: string;
    userIds: string[];
    dynamic: string[];
    onChange: (next: { userIds: string[]; dynamic: string[] }) => void;
    allowed?: FlowDynamicPerson[];
}> = ({ opts, label, userIds, dynamic, onChange, allowed = DYNAMIC }) => {
    const { t, members } = opts;
    const toggle = (item: string) => onChange({
        userIds,
        dynamic: dynamic.includes(item) ? dynamic.filter((d) => d !== item) : [...dynamic, item],
    });
    const free = members.filter((member) => !userIds.includes(member.uid));
    return (
        <div className="flow-field flow-field--wide">
            <span className="flow-field__label">{label}</span>
            <div className="flow-people">
                {allowed.map((item) => (
                    <button key={item} type="button" aria-pressed={dynamic.includes(item)}
                        className={`flow-chip ${dynamic.includes(item) ? 'is-active' : ''}`.trim()} onClick={() => toggle(item)}>
                        {t(`flows.people.${item}`)}
                    </button>
                ))}
                {userIds.map((uid) => (
                    <span key={uid} className="flow-chip is-active">
                        {members.find((member) => member.uid === uid)?.name || uid}
                        <button type="button" className="flow-chip__remove" aria-label={t('flows.people.remove')}
                            onClick={() => onChange({ userIds: userIds.filter((id) => id !== uid), dynamic })}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </span>
                ))}
            </div>
            {free.length > 0 && (
                <Select
                    value=""
                    placeholder={t('flows.people.add')}
                    options={free.map((member) => ({ value: member.uid, label: member.name }))}
                    onChange={(value) => onChange({ userIds: [...userIds, String(value)], dynamic })}
                    className="flow-people__select"
                />
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

export const defaultTriggerConfig = (type: FlowTriggerType): FlowTrigger['config'] => {
    if (type === 'schedule') return { schedule: { frequency: 'weekly', weekday: 1, time: '09:00', timezone: timeZone() } };
    if (type === 'task.due' || type === 'task.overdue') return { time: '08:00', timezone: timeZone() };
    return {};
};

export const TriggerEditor: React.FC<{ opts: FlowEditorOptions; trigger: FlowTrigger; onChange: (trigger: FlowTrigger) => void }> = ({ opts, trigger, onChange }) => {
    const { t, members } = opts;
    const config = trigger.config || {};
    const set = (patch: Partial<FlowTrigger['config']>) => onChange({ ...trigger, config: { ...config, ...patch } });
    const schedule = config.schedule || { frequency: 'weekly' as const, weekday: 1, time: '09:00', timezone: timeZone() };
    const statusOptions = [{ value: '', label: t('flows.any') }, ...options(STATUSES, (s) => t(`flows.status.${s}`))];
    return (
        <div className="flow-fields">
            <Field label={t('flows.trigger.label')} wide>
                <Select
                    value={trigger.type}
                    options={options(TRIGGER_TYPES, (type) => t(`flows.trigger.${type}`))}
                    onChange={(value) => onChange({ type: value as FlowTriggerType, config: defaultTriggerConfig(value as FlowTriggerType) })}
                />
            </Field>
            {trigger.type === 'task.status_changed' && (
                <>
                    <Field label={t('flows.trigger.from')}>
                        <Select value={config.fromStatus || ''} options={statusOptions} onChange={(v) => set({ fromStatus: String(v) || undefined })} />
                    </Field>
                    <Field label={t('flows.trigger.to')}>
                        <Select value={config.toStatus || ''} options={statusOptions} onChange={(v) => set({ toStatus: String(v) || undefined })} />
                    </Field>
                </>
            )}
            {trigger.type === 'task.assigned' && (
                <Field label={t('flows.trigger.assignee')} wide>
                    <Select
                        value={config.assigneeId || ''}
                        options={[{ value: '', label: t('flows.anyone') }, ...members.map((m) => ({ value: m.uid, label: m.name }))]}
                        onChange={(v) => set({ assigneeId: String(v) || undefined })}
                    />
                </Field>
            )}
            {(trigger.type === 'task.due' || trigger.type === 'task.overdue') && (
                <Field label={t('flows.trigger.checkTime')}>
                    <input className="flow-time" type="time" value={config.time || '08:00'} onChange={(e) => set({ time: e.target.value })} />
                </Field>
            )}
            {trigger.type === 'schedule' && (
                <>
                    <Field label={t('flows.trigger.frequency')}>
                        <Select value={schedule.frequency} options={options(['daily', 'weekly'], (f) => t(`flows.frequency.${f}`))}
                            onChange={(v) => set({ schedule: { ...schedule, frequency: v as 'daily' | 'weekly' } })} />
                    </Field>
                    {schedule.frequency === 'weekly' && (
                        <Field label={t('flows.trigger.weekday')}>
                            <Select value={String(schedule.weekday || 1)} options={WEEKDAYS.map((d) => ({ value: String(d), label: t(`flows.weekday.${d}`) }))}
                                onChange={(v) => set({ schedule: { ...schedule, weekday: Number(v) } })} />
                        </Field>
                    )}
                    <Field label={t('flows.trigger.time')}>
                        <input className="flow-time" type="time" value={schedule.time} onChange={(e) => set({ schedule: { ...schedule, time: e.target.value } })} />
                    </Field>
                </>
            )}
            {(trigger.type === 'schedule' || trigger.type === 'task.due' || trigger.type === 'task.overdue') && (
                <p className="flow-hint">{t('flows.trigger.timezone').replace('{zone}', config.schedule?.timezone || config.timezone || timeZone())}</p>
            )}
            {trigger.type === 'manual' && <p className="flow-hint">{t('flows.trigger.manualHint')}</p>}
            {trigger.type === 'file.uploaded' && <p className="flow-hint">{t('flows.trigger.fileHint')}</p>}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

const FIELD_OPERATORS: Record<FlowConditionField, FlowOperator[]> = {
    'task.status': ['in', 'not_in'],
    'task.priority': ['in', 'not_in'],
    'task.labels': ['contains', 'not_contains', 'empty', 'not_empty'],
    'task.assigneeIds': ['contains', 'not_contains', 'empty', 'not_empty'],
    'task.createdBy': ['eq', 'neq'],
    'actor.id': ['eq', 'neq'],
    'task.dueDate': ['due_within_days', 'lt', 'gt', 'empty', 'not_empty'],
    'task.title': ['contains', 'not_contains'],
    'comment.text': ['contains', 'not_contains'],
    'task.isSubtask': ['eq'],
    'project.id': ['eq', 'neq'],
};

const defaultValue = (field: FlowConditionField, operator: FlowOperator): FlowConditionRule['value'] => {
    if (operator === 'empty' || operator === 'not_empty') return undefined;
    if (field === 'task.status') return ['Open'];
    if (field === 'task.priority') return ['High'];
    if (field === 'task.isSubtask') return true;
    if (operator === 'due_within_days') return 3;
    return '';
};

const RuleValue: React.FC<{ opts: FlowEditorOptions; rule: FlowConditionRule; onChange: (value: FlowConditionRule['value']) => void }> = ({ opts, rule, onChange }) => {
    const { t, members, projects } = opts;
    if (rule.operator === 'empty' || rule.operator === 'not_empty') return null;
    if (rule.field === 'task.status' || rule.field === 'task.priority') {
        const all = rule.field === 'task.status' ? STATUSES : PRIORITIES;
        const selected = Array.isArray(rule.value) ? rule.value : [];
        return (
            <div className="flow-people">
                {all.map((value) => (
                    <button key={value} type="button" aria-pressed={selected.includes(value)}
                        className={`flow-chip ${selected.includes(value) ? 'is-active' : ''}`.trim()}
                        onClick={() => onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value])}>
                        {t(`flows.${rule.field === 'task.status' ? 'status' : 'priority'}.${value}`)}
                    </button>
                ))}
            </div>
        );
    }
    if (rule.field === 'task.assigneeIds' || rule.field === 'task.createdBy' || rule.field === 'actor.id') {
        return <Select value={String(rule.value || '')} placeholder={t('flows.people.pick')}
            options={members.map((m) => ({ value: m.uid, label: m.name }))} onChange={(v) => onChange(String(v))} />;
    }
    if (rule.field === 'project.id') {
        return <Select value={String(rule.value || '')} placeholder={t('flows.project.pick')}
            options={projects.map((p) => ({ value: p.id, label: p.title }))} onChange={(v) => onChange(String(v))} />;
    }
    if (rule.field === 'task.isSubtask') {
        return <Select value={String(rule.value !== false)} options={[{ value: 'true', label: t('flows.yes') }, { value: 'false', label: t('flows.no') }]}
            onChange={(v) => onChange(v === 'true')} />;
    }
    if (rule.operator === 'due_within_days') {
        return <TextInput type="number" min={0} max={365} value={String(rule.value ?? 3)} aria-label={t('flows.condition.days')}
            rightElement={<span className="flow-unit">{t('flows.unit.days')}</span>} onChange={(e) => onChange(Number(e.target.value))} />;
    }
    if (rule.field === 'task.dueDate') {
        return <TextInput type="date" value={String(rule.value || '')} aria-label={t('flows.condition.date')} onChange={(e) => onChange(e.target.value)} />;
    }
    return <TextInput value={String(rule.value || '')} aria-label={t('flows.condition.value')} onChange={(e) => onChange(e.target.value)} />;
};

export const ConditionsEditor: React.FC<{
    opts: FlowEditorOptions;
    conditions: FlowConditions;
    taskless: boolean;
    commentTrigger: boolean;
    onChange: (conditions: FlowConditions) => void;
}> = ({ opts, conditions, taskless, commentTrigger, onChange }) => {
    const { t } = opts;
    const fields = (Object.keys(FIELD_OPERATORS) as FlowConditionField[]).filter((field) =>
        (field !== 'project.id' || opts.workspaceScope) && (field !== 'comment.text' || commentTrigger) && (!taskless || !field.startsWith('task.')));
    const setGroup = (index: number, group: FlowConditionGroup | null) => {
        const groups = conditions.groups.slice();
        if (group && group.rules.length) groups[index] = group;
        else groups.splice(index, 1);
        onChange({ ...conditions, groups });
    };
    const newRule = (): FlowConditionRule => {
        const field = fields[0];
        const operator = FIELD_OPERATORS[field][0];
        return { field, operator, value: defaultValue(field, operator) };
    };
    if (fields.length === 0) return <p className="flow-hint">{t('flows.condition.none')}</p>;
    return (
        <div className="flow-conditions">
            {conditions.groups.length > 1 && (
                <Field label={t('flows.condition.groupsJoin')} wide>
                    <Select value={conditions.op} options={[{ value: 'and', label: t('flows.condition.allGroups') }, { value: 'or', label: t('flows.condition.anyGroup') }]}
                        onChange={(v) => onChange({ ...conditions, op: v as 'and' | 'or' })} />
                </Field>
            )}
            {conditions.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="flow-condition-group">
                    {group.rules.length > 1 && (
                        <div className="flow-condition-group__join">
                            <Select value={group.op} options={[{ value: 'and', label: t('flows.condition.all') }, { value: 'or', label: t('flows.condition.any') }]}
                                onChange={(v) => setGroup(groupIndex, { ...group, op: v as 'and' | 'or' })} />
                        </div>
                    )}
                    {group.rules.map((rule, ruleIndex) => {
                        const setRule = (next: FlowConditionRule | null) => {
                            const rules = group.rules.slice();
                            if (next) rules[ruleIndex] = next;
                            else rules.splice(ruleIndex, 1);
                            setGroup(groupIndex, { ...group, rules });
                        };
                        return (
                            <div key={ruleIndex} className="flow-condition">
                                <Select value={rule.field} options={options(fields, (f) => t(`flows.condition.field.${f}`))}
                                    onChange={(v) => {
                                        const field = v as FlowConditionField;
                                        const operator = FIELD_OPERATORS[field][0];
                                        setRule({ field, operator, value: defaultValue(field, operator) });
                                    }} />
                                <Select value={rule.operator} options={options(FIELD_OPERATORS[rule.field], (o) => t(`flows.condition.op.${o}`))}
                                    onChange={(v) => setRule({ ...rule, operator: v as FlowOperator, value: defaultValue(rule.field, v as FlowOperator) })} />
                                <div className="flow-condition__value">
                                    <RuleValue opts={opts} rule={rule} onChange={(value) => setRule({ ...rule, value })} />
                                </div>
                                <button type="button" className="flow-icon-button" aria-label={t('flows.condition.remove')} onClick={() => setRule(null)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        );
                    })}
                    <button type="button" className="flow-link-button" onClick={() => setGroup(groupIndex, { ...group, rules: [...group.rules, newRule()] })}>
                        <span className="material-symbols-outlined">add</span>{t('flows.condition.addRule')}
                    </button>
                </div>
            ))}
            <button type="button" className="flow-link-button"
                onClick={() => onChange({ ...conditions, groups: [...conditions.groups, { op: 'and', rules: [newRule()] }] })}>
                <span className="material-symbols-outlined">add</span>
                {conditions.groups.length ? t('flows.condition.addGroup') : t('flows.condition.add')}
            </button>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const defaultActionConfig = (type: FlowActionType, projectId: string | null, t: T): FlowAction['config'] => {
    switch (type) {
        case 'set_status': return { status: 'Done' };
        case 'set_field': return { field: 'priority', value: 'High' };
        case 'assign': return { mode: 'add', userIds: [], dynamic: ['actor'] };
        case 'comment': return { text: '' };
        case 'notify': return { userIds: [], dynamic: ['assignees'], title: '{{task.title}}', message: '', channels: { push: true, email: false } };
        case 'create_task': return { title: '', description: '', asSubtask: false, projectId, priority: 'Medium', status: 'Open', dueInDays: null, userIds: [], dynamic: [] };
        case 'add_label':
        case 'remove_label': return { label: '' };
        case 'move': return { projectId: '' };
        case 'ai': return { mode: 'summarize', instructions: '', postComment: true };
        case 'delay': return { minutes: 60 };
    }
    return {};
};

export const availableActions = (triggerType: FlowTriggerType) =>
    ACTION_TYPES.filter((type) => !TASKLESS_TRIGGERS.has(triggerType) || !TASK_ACTIONS.has(type));

const DELAY_UNITS = [{ key: 'minutes', factor: 1 }, { key: 'hours', factor: 60 }, { key: 'days', factor: 1440 }];

export const ActionEditor: React.FC<{
    opts: FlowEditorOptions;
    action: FlowAction;
    triggerType: FlowTriggerType;
    onChange: (action: FlowAction) => void;
}> = ({ opts, action, triggerType, onChange }) => {
    const { t, projects } = opts;
    const c = action.config || {};
    const set = (patch: Record<string, unknown>) => onChange({ ...action, config: { ...c, ...patch } });
    const taskless = TASKLESS_TRIGGERS.has(triggerType);
    const typeSelect = (
        <Field label={t('flows.action.label')} wide>
            <Select value={action.type} options={options(availableActions(triggerType), (type) => t(`flows.action.${type}`))}
                onChange={(v) => onChange({ ...action, type: v as FlowActionType, config: defaultActionConfig(v as FlowActionType, null, t) })} />
        </Field>
    );
    const projectOptions = projects.map((p) => ({ value: p.id, label: p.title }));

    let body: React.ReactNode = null;
    switch (action.type) {
        case 'set_status':
            body = (
                <Field label={t('flows.field.status')}>
                    <Select value={c.status} options={options(STATUSES, (s) => t(`flows.status.${s}`))} onChange={(v) => set({ status: v })} />
                </Field>
            );
            break;
        case 'set_field':
            body = (
                <>
                    <Field label={t('flows.field.label')}>
                        <Select value={c.field} options={options(['priority', 'dueDate', 'startDate', 'nextStep'], (f) => t(`flows.field.${f}`))}
                            onChange={(v) => onChange({ ...action, config: v === 'priority' ? { field: v, value: 'High' } : v === 'nextStep' ? { field: v, value: '' } : { field: v, relativeDays: 0 } })} />
                    </Field>
                    {c.field === 'priority' && (
                        <Field label={t('flows.field.priority')}>
                            <Select value={c.value} options={options(PRIORITIES, (p) => t(`flows.priority.${p}`))} onChange={(v) => set({ value: v })} />
                        </Field>
                    )}
                    {c.field === 'nextStep' && <TemplateText t={t} label={t('flows.field.nextStep')} value={c.value || ''} onChange={(value) => set({ value })} />}
                    {(c.field === 'dueDate' || c.field === 'startDate') && (
                        <>
                            {!c.clear && (
                                <Field label={t('flows.field.relativeDays')}>
                                    <TextInput type="number" min={-365} max={365} value={String(c.relativeDays ?? 0)}
                                        rightElement={<span className="flow-unit">{t('flows.unit.days')}</span>}
                                        onChange={(e) => set({ relativeDays: Number(e.target.value) })} />
                                </Field>
                            )}
                            <Checkbox label={t('flows.field.clearDate')} checked={c.clear === true}
                                onChange={(e) => onChange({ ...action, config: e.target.checked ? { field: c.field, clear: true } : { field: c.field, relativeDays: 0 } })} />
                        </>
                    )}
                </>
            );
            break;
        case 'assign':
            body = (
                <>
                    <Field label={t('flows.assign.mode')}>
                        <Select value={c.mode || 'add'} options={options(['add', 'replace', 'remove', 'clear'], (m) => t(`flows.assign.${m}`))} onChange={(v) => set({ mode: v })} />
                    </Field>
                    {c.mode !== 'clear' && (
                        <PeoplePicker opts={opts} label={t('flows.assign.people')} userIds={c.userIds || []} dynamic={c.dynamic || []}
                            onChange={(next) => set(next)} />
                    )}
                </>
            );
            break;
        case 'comment':
            body = <TemplateText t={t} label={t('flows.comment.text')} multiline value={c.text || ''} onChange={(text) => set({ text })} />;
            break;
        case 'notify':
            body = (
                <>
                    <PeoplePicker opts={opts} label={t('flows.notify.recipients')} userIds={c.userIds || []} dynamic={c.dynamic || []} onChange={(next) => set(next)} />
                    <TemplateText t={t} label={t('flows.notify.title')} value={c.title || ''} onChange={(title) => set({ title })} />
                    <TemplateText t={t} label={t('flows.notify.message')} multiline value={c.message || ''} onChange={(message) => set({ message })} />
                    <div className="flow-field flow-field--wide">
                        <span className="flow-field__label">{t('flows.notify.channels')}</span>
                        <div className="flow-inline">
                            <Checkbox label={t('flows.notify.inApp')} checked disabled />
                            <Checkbox label={t('flows.notify.push')} checked={c.channels?.push !== false}
                                onChange={(e) => set({ channels: { ...c.channels, push: e.target.checked } })} />
                            <Checkbox label={t('flows.notify.email')} checked={c.channels?.email === true}
                                onChange={(e) => set({ channels: { ...c.channels, email: e.target.checked } })} />
                        </div>
                    </div>
                </>
            );
            break;
        case 'create_task':
            body = (
                <>
                    <TemplateText t={t} label={t('flows.create.title')} value={c.title || ''} onChange={(title) => set({ title })} />
                    {!taskless && (
                        <Checkbox label={t('flows.create.asSubtask')} checked={c.asSubtask === true} onChange={(e) => set({ asSubtask: e.target.checked })} />
                    )}
                    {!c.asSubtask && (
                        <Field label={t('flows.create.project')}>
                            <Select value={c.projectId || ''} options={[{ value: '', label: t('flows.create.sameProject') }, ...projectOptions]}
                                onChange={(v) => set({ projectId: String(v) || null })} />
                        </Field>
                    )}
                    {!c.asSubtask && (
                        <Field label={t('flows.field.priority')}>
                            <Select value={c.priority || 'Medium'} options={options(PRIORITIES, (p) => t(`flows.priority.${p}`))} onChange={(v) => set({ priority: v })} />
                        </Field>
                    )}
                    <Field label={t('flows.create.dueInDays')}>
                        <TextInput type="number" min={0} max={365} placeholder={t('flows.create.noDue')} value={c.dueInDays === null || c.dueInDays === undefined ? '' : String(c.dueInDays)}
                            rightElement={<span className="flow-unit">{t('flows.unit.days')}</span>}
                            onChange={(e) => set({ dueInDays: e.target.value === '' ? null : Number(e.target.value) })} />
                    </Field>
                    <PeoplePicker opts={opts} label={t('flows.create.assignees')} userIds={c.userIds || []} dynamic={c.dynamic || []} onChange={(next) => set(next)} />
                </>
            );
            break;
        case 'add_label':
        case 'remove_label':
            body = (
                <Field label={t('flows.label.name')}>
                    <TextInput value={c.label || ''} placeholder={t('flows.label.placeholder')} onChange={(e) => set({ label: e.target.value })} />
                </Field>
            );
            break;
        case 'move':
            body = (
                <Field label={t('flows.move.project')} wide>
                    <Select value={c.projectId || ''} placeholder={t('flows.project.pick')} options={projectOptions} onChange={(v) => set({ projectId: String(v) })} />
                </Field>
            );
            break;
        case 'ai':
            body = (
                <>
                    <Field label={t('flows.ai.mode')} wide>
                        <Select value={c.mode || 'summarize'} options={options(['summarize', 'classify_priority', 'classify_label'], (m) => t(`flows.ai.${m}`))}
                            onChange={(v) => onChange({ ...action, config: { mode: v, instructions: c.instructions || '', ...(v === 'summarize' ? { postComment: true } : {}), ...(v === 'classify_label' ? { options: [] } : {}) } })} />
                    </Field>
                    {c.mode === 'classify_label' && (
                        <Field label={t('flows.ai.options')} wide>
                            <TextInput value={(c.options || []).join(', ')} placeholder={t('flows.ai.optionsPlaceholder')}
                                onChange={(e) => set({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                        </Field>
                    )}
                    {c.mode === 'summarize' && (
                        <Checkbox label={t('flows.ai.postComment')} checked={c.postComment !== false} onChange={(e) => set({ postComment: e.target.checked })} />
                    )}
                    <Field label={t('flows.ai.instructions')} wide>
                        <TextInput value={c.instructions || ''} placeholder={t('flows.ai.instructionsPlaceholder')} onChange={(e) => set({ instructions: e.target.value })} />
                    </Field>
                    <p className="flow-hint">{t('flows.ai.hint')}</p>
                </>
            );
            break;
        case 'delay': {
            const minutes = Number(c.minutes) || 60;
            const unit = [...DELAY_UNITS].reverse().find((u) => minutes % u.factor === 0) || DELAY_UNITS[0];
            body = (
                <>
                    <Field label={t('flows.delay.amount')}>
                        <TextInput type="number" min={1} value={String(minutes / unit.factor)}
                            onChange={(e) => set({ minutes: Math.max(1, Number(e.target.value)) * unit.factor })} />
                    </Field>
                    <Field label={t('flows.delay.unit')}>
                        <Select value={unit.key} options={DELAY_UNITS.map((u) => ({ value: u.key, label: t(`flows.unit.${u.key}`) }))}
                            onChange={(v) => set({ minutes: (minutes / unit.factor) * (DELAY_UNITS.find((u) => u.key === v)?.factor || 1) })} />
                    </Field>
                    <p className="flow-hint">{t('flows.delay.hint')}</p>
                </>
            );
            break;
        }
    }
    return (
        <div className="flow-fields">
            {typeSelect}
            {body}
        </div>
    );
};
