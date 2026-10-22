import React, { memo } from 'react';
import { format } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import type { Task } from '../../types';
import { addDaysFromToday, daysFromToday, nextMonday, parseDateValue, toIsoDate } from '../../utils/taskDates';
import { InlineMenu, type InlineMenuOption } from './InlineMenu';
import {
    getAssigneeIds,
    normalizeStatus,
    WORK_PRIORITIES,
    WORK_STATUSES,
    type WorkMember
} from './workList';
import { initialsOf } from '../../utils/initials';

interface TaskRowProps {
    task: Task;
    members: WorkMember[];
    projectTitle?: string;
    subtasks?: { done: number; total: number };
    canEdit: boolean;
    saving?: boolean;
    selectable?: boolean;
    selected?: boolean;
    onSelectChange?: (task: Task, selected: boolean) => void;
    onToggleComplete: (task: Task) => void;
    onUpdate: (task: Task, updates: Partial<Task>) => void;
    onOpen: (task: Task) => void;
    /** Context-specific trailing action (e.g. detach from initiative). */
    trailing?: React.ReactNode;
}

const initials = (name: string) => initialsOf(name, '?');

const Avatar = ({ member, size = 'sm' }: { member?: WorkMember; size?: 'sm' | 'xs' }) => (
    <span className={`work-avatar work-avatar--${size}`} aria-hidden="true">
        {member?.photoURL ? <img src={member.photoURL} alt="" /> : initials(member?.displayName || '?')}
    </span>
);

/**
 * One task in a work list. Frequent edits (status, priority, due date,
 * assignee) are inline menus; everything else lives in the task detail.
 */
export const TaskRow = memo(({
    task,
    members,
    projectTitle,
    subtasks,
    canEdit,
    saving,
    selectable,
    selected,
    onSelectChange,
    onToggleComplete,
    onUpdate,
    onOpen,
    trailing
}: TaskRowProps) => {
    const { t, dateLocale } = useLanguage();
    const isGerman = dateLocale?.code?.startsWith('de');
    const shortDate = isGerman ? 'd. MMM' : 'MMM d';
    const status = normalizeStatus(task);
    const priority = task.priority || 'Medium';
    const assigneeIds = getAssigneeIds(task);
    const assignees = assigneeIds.map((uid) => members.find((member) => member.uid === uid) || { uid, displayName: t('work.assignee.unknown') });
    const diff = daysFromToday(task.dueDate);

    const dueLabel = (() => {
        if (diff === null || !task.dueDate) return t('work.due.none');
        if (diff < 0 && !task.isCompleted) return t('work.due.overdueDays').replace('{count}', String(-diff));
        if (diff === 0) return t('work.due.today');
        if (diff === 1) return t('work.due.tomorrow');
        const date = parseDateValue(task.dueDate);
        if (diff > 1 && diff < 7) return format(date, 'EEEE', { locale: dateLocale });
        return format(date, shortDate, { locale: dateLocale });
    })();
    const dueTone = task.isCompleted || diff === null ? 'muted' : diff < 0 ? 'danger' : diff === 0 ? 'warning' : 'neutral';

    const statusOptions: InlineMenuOption[] = WORK_STATUSES.map((value) => ({
        value,
        label: t(`work.status.${value}`),
        leading: <span className={`work-status-dot work-status-dot--${value.replace(/\s+/g, '-').toLowerCase()}`} />
    }));
    const priorityOptions: InlineMenuOption[] = WORK_PRIORITIES.map((value) => ({
        value,
        label: t(`work.priority.${value}`),
        leading: <span className={`work-priority work-priority--${value.toLowerCase()}`} />
    }));
    const dueOptions: InlineMenuOption[] = [
        { value: toIsoDate(new Date()), label: t('work.due.today'), hint: format(new Date(), 'EEE', { locale: dateLocale }) },
        { value: toIsoDate(addDaysFromToday(1)), label: t('work.due.tomorrow'), hint: format(addDaysFromToday(1), 'EEE', { locale: dateLocale }) },
        { value: toIsoDate(nextMonday()), label: t('work.due.nextWeek'), hint: format(nextMonday(), `EEE ${shortDate}`, { locale: dateLocale }) },
        ...(task.dueDate ? [{ value: '', label: t('work.due.clear') }] : [])
    ];
    const assigneeOptions: InlineMenuOption[] = [
        ...members.map((member) => ({ value: member.uid, label: member.displayName, leading: <Avatar member={member} size="xs" /> })),
        { value: '__none__', label: t('work.assignee.unassigned'), leading: <span className="material-symbols-outlined">person_off</span> }
    ];

    const setStatus = (next: string) => {
        onUpdate(task, next === 'Done'
            ? { status: 'Done', isCompleted: true }
            : { status: next as Task['status'], isCompleted: false });
    };

    const toggleAssignee = (uid: string) => {
        if (uid === '__none__') {
            onUpdate(task, { assigneeId: '', assigneeIds: [] });
            return;
        }
        const next = assigneeIds.includes(uid) ? assigneeIds.filter((id) => id !== uid) : [...assigneeIds, uid];
        onUpdate(task, { assigneeId: next[0] || '', assigneeIds: next });
    };

    const openFromRow = (event: React.MouseEvent | React.KeyboardEvent) => {
        if ((event.target as HTMLElement).closest('button, input, a, label')) return;
        onOpen(task);
    };

    return (
        <div
            className={`work-row ${task.isCompleted ? 'is-done' : ''} ${selected ? 'is-selected' : ''} ${saving ? 'is-saving' : ''}`}
            role="listitem"
            onClick={openFromRow}
        >
            {selectable && (
                <label className="work-row__select" aria-label={t('work.row.select').replace('{title}', task.title)}>
                    <input type="checkbox" aria-label={t('work.row.select').replace('{title}', task.title)} checked={!!selected} onChange={(event) => onSelectChange?.(task, event.target.checked)} />
                </label>
            )}
            <button
                type="button"
                className={`work-row__check ${task.isCompleted ? 'is-checked' : ''}`}
                onClick={() => onToggleComplete(task)}
                disabled={!canEdit}
                aria-pressed={task.isCompleted}
                aria-label={t(task.isCompleted ? 'work.row.reopen' : 'work.row.complete').replace('{title}', task.title)}
            >
                <span className="material-symbols-outlined">check</span>
            </button>

            <div className="work-row__main">
                <button type="button" className="work-row__title" onClick={() => onOpen(task)}>
                    {task.title}
                </button>
                <div className="work-row__meta">
                    {projectTitle && <span className="work-row__project">{projectTitle}</span>}
                    {status === 'Blocked' && task.blockerNote && (
                        <span className="work-row__blocker" title={task.blockerNote}>
                            <span className="material-symbols-outlined">block</span>{task.blockerNote}
                        </span>
                    )}
                    {!!subtasks?.total && (
                        <span className="work-row__subtasks">
                            <span className="material-symbols-outlined">checklist</span>{subtasks.done}/{subtasks.total}
                        </span>
                    )}
                </div>
            </div>

            <div className="work-row__controls">
                <InlineMenu
                    label={`${t('work.row.changeStatus')}: ${t(`work.status.${status}`)}`}
                    triggerClassName={`work-pill work-pill--status work-pill--${status.replace(/\s+/g, '-').toLowerCase()}`}
                    trigger={t(`work.status.${status}`)}
                    options={statusOptions}
                    value={status}
                    onSelect={setStatus}
                    disabled={!canEdit}
                    width={200}
                />
                <InlineMenu
                    label={`${t('work.row.changePriority')}: ${t(`work.priority.${priority}`)}`}
                    triggerClassName="work-pill work-pill--icon"
                    trigger={<span className={`work-priority work-priority--${priority.toLowerCase()}`} />}
                    options={priorityOptions}
                    value={priority}
                    onSelect={(next) => onUpdate(task, { priority: next as Task['priority'] })}
                    disabled={!canEdit}
                    width={180}
                />
                <InlineMenu
                    label={`${t('work.row.changeDue')}: ${dueLabel}`}
                    triggerClassName={`work-pill work-pill--due work-pill--${dueTone}`}
                    trigger={(
                        <>
                            <span className="material-symbols-outlined">event</span>
                            <span>{dueLabel}</span>
                        </>
                    )}
                    options={dueOptions}
                    value={task.dueDate || null}
                    onSelect={(next) => onUpdate(task, { dueDate: next })}
                    disabled={!canEdit}
                    width={230}
                    footer={(close) => (
                        <label className="inline-menu__date">
                            <span>{t('work.due.pick')}</span>
                            <input
                                type="date"
                                defaultValue={task.dueDate?.slice(0, 10) || ''}
                                onChange={(event) => {
                                    if (!event.target.value) return;
                                    onUpdate(task, { dueDate: event.target.value });
                                    close();
                                }}
                            />
                        </label>
                    )}
                />
                <InlineMenu
                    label={assignees.length
                        ? `${t('work.row.changeAssignee')}: ${assignees.map((member) => member.displayName).join(', ')}`
                        : t('work.row.assign')}
                    triggerClassName="work-pill work-pill--assignee"
                    trigger={assignees.length ? (
                        <span className="work-avatars">
                            {assignees.slice(0, 3).map((member) => <Avatar key={member.uid} member={member} />)}
                            {assignees.length > 3 && <span className="work-avatars__more">+{assignees.length - 3}</span>}
                        </span>
                    ) : (
                        <span className="work-avatar work-avatar--sm work-avatar--empty" aria-hidden="true">
                            <span className="material-symbols-outlined">person_add</span>
                        </span>
                    )}
                    options={assigneeOptions}
                    selectedValues={assigneeIds.length ? assigneeIds : ['__none__']}
                    onSelect={toggleAssignee}
                    disabled={!canEdit}
                    width={240}
                />
                {trailing}
            </div>
        </div>
    );
});

TaskRow.displayName = 'TaskRow';
