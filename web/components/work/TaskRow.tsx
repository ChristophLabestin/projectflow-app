import React, { memo } from 'react';
import { format } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import type { Task } from '../../types';
import { daysFromToday, parseDateValue } from '../../utils/taskDates';
import { InlineMenu } from './InlineMenu';
import { getAssigneeIds, normalizeStatus, type WorkMember } from './workList';
import {
    assigneeMenuOptions,
    DueDatePicker,
    dueMenuOptions,
    priorityMenuOptions,
    shortDateFormat,
    statusMenuOptions,
    UNASSIGNED_VALUE,
    WorkAvatar
} from './workMenuOptions';

interface TaskRowProps {
    task: Task;
    members: WorkMember[];
    projectTitle?: string;
    subtasks?: { done: number; total: number };
    canEdit: boolean;
    saving?: boolean;
    /** Shows the selection checkbox (on hover, or always while the list is selecting). */
    selectable?: boolean;
    selected?: boolean;
    /** Explicit selection mode: a row click selects instead of opening. */
    selectOnClick?: boolean;
    /** `range` is set for Shift-clicks (select everything since the last click). */
    onSelectChange?: (task: Task, options: { range: boolean }) => void;
    onToggleComplete: (task: Task) => void;
    onUpdate: (task: Task, updates: Partial<Task>) => void;
    onOpen: (task: Task) => void;
    /** Context-specific trailing action (e.g. detach from initiative). */
    trailing?: React.ReactNode;
}

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
    selectOnClick,
    onSelectChange,
    onToggleComplete,
    onUpdate,
    onOpen,
    trailing
}: TaskRowProps) => {
    const { t, dateLocale } = useLanguage();
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
        return format(date, shortDateFormat(dateLocale), { locale: dateLocale });
    })();
    const dueTone = task.isCompleted || diff === null ? 'muted' : diff < 0 ? 'danger' : diff === 0 ? 'warning' : 'neutral';

    const setStatus = (next: string) => {
        onUpdate(task, next === 'Done'
            ? { status: 'Done', isCompleted: true }
            : { status: next as Task['status'], isCompleted: false });
    };

    const toggleAssignee = (uid: string) => {
        if (uid === UNASSIGNED_VALUE) {
            onUpdate(task, { assigneeId: '', assigneeIds: [] });
            return;
        }
        const next = assigneeIds.includes(uid) ? assigneeIds.filter((id) => id !== uid) : [...assigneeIds, uid];
        onUpdate(task, { assigneeId: next[0] || '', assigneeIds: next });
    };

    const selectLabel = t('work.row.select').replace('{title}', task.title);

    const openFromRow = (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest('button, input, a, label')) return;
        // Cmd/Ctrl-click and Shift-click select like in a file list; so does any click in selection mode.
        if (selectable && (selectOnClick || event.metaKey || event.ctrlKey || event.shiftKey)) {
            onSelectChange?.(task, { range: event.shiftKey });
            return;
        }
        onOpen(task);
    };

    return (
        <div
            className={`work-row ${task.isCompleted ? 'is-done' : ''} ${selected ? 'is-selected' : ''} ${saving ? 'is-saving' : ''}`}
            role="listitem"
            data-task-id={task.id}
            onClick={openFromRow}
        >
            {selectable && (
                <button
                    type="button"
                    role="checkbox"
                    className="work-row__select"
                    aria-checked={!!selected}
                    aria-label={selectLabel}
                    title={selectLabel}
                    onClick={(event) => onSelectChange?.(task, { range: event.shiftKey })}
                >
                    <span className="work-select-box" aria-hidden="true">
                        <span className="material-symbols-outlined">check</span>
                    </span>
                </button>
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
                <button type="button" className="work-row__title" onClick={(event) => (selectOnClick && selectable ? onSelectChange?.(task, { range: event.shiftKey }) : onOpen(task))}>
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
                    options={statusMenuOptions(t)}
                    value={status}
                    onSelect={setStatus}
                    disabled={!canEdit}
                    width={200}
                />
                <InlineMenu
                    label={`${t('work.row.changePriority')}: ${t(`work.priority.${priority}`)}`}
                    triggerClassName="work-pill work-pill--icon"
                    trigger={<span className={`work-priority work-priority--${priority.toLowerCase()}`} />}
                    options={priorityMenuOptions(t)}
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
                    options={dueMenuOptions(t, dateLocale, !!task.dueDate)}
                    value={task.dueDate || null}
                    onSelect={(next) => onUpdate(task, { dueDate: next })}
                    disabled={!canEdit}
                    width={230}
                    footer={(close) => (
                        <DueDatePicker label={t('work.due.pick')} value={task.dueDate} onPick={(date) => onUpdate(task, { dueDate: date })} close={close} />
                    )}
                />
                <InlineMenu
                    label={assignees.length
                        ? `${t('work.row.changeAssignee')}: ${assignees.map((member) => member.displayName).join(', ')}`
                        : t('work.row.assign')}
                    triggerClassName="work-pill work-pill--assignee"
                    trigger={assignees.length ? (
                        <span className="work-avatars">
                            {assignees.slice(0, 3).map((member) => <WorkAvatar key={member.uid} member={member} />)}
                            {assignees.length > 3 && <span className="work-avatars__more">+{assignees.length - 3}</span>}
                        </span>
                    ) : (
                        <span className="work-avatar work-avatar--sm work-avatar--empty" aria-hidden="true">
                            <span className="material-symbols-outlined">person_add</span>
                        </span>
                    )}
                    options={assigneeMenuOptions(t, members)}
                    selectedValues={assigneeIds.length ? assigneeIds : [UNASSIGNED_VALUE]}
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
