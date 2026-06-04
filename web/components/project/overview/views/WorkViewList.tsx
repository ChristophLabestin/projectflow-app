import React from 'react';
import { format } from 'date-fns';
import type { WorkViewContext } from './shared/viewTypes';
import type { WorkItem } from './shared/useWorkItems';

const STATUS_VALUES = ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'];
const PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Urgent'];

const Row: React.FC<{ item: WorkItem; ctx: WorkViewContext }> = ({ item, ctx }) => {
    const { labels, dateFormat, dateLocale, canManageTasks, t, onItemClick, onToggleComplete, onUpdateItemStatus } = ctx;
    const due = item.dueDate ? new Date(item.dueDate) : null;
    const isOverdue = Boolean(due && due < new Date() && !item.isCompleted);
    const priorityClass = item.priority === 'Urgent' ? 'is-urgent' : item.priority === 'High' ? 'is-high' : '';

    return (
        <div data-status={item.status} className={`po-list__row ${item.isCompleted ? 'is-done' : ''}`.trim()}>
            {canManageTasks && item.kind === 'task' && item.task && (
                <button
                    type="button"
                    className={`po-list__check ${item.isCompleted ? 'is-checked' : ''}`.trim()}
                    onClick={() => onToggleComplete(item.task!)}
                    aria-label={item.title}
                >
                    <span className="material-symbols-outlined">check</span>
                </button>
            )}
            <button type="button" className="po-list__title" onClick={() => onItemClick(item)}>
                <span className={`po-list__kind po-list__kind--${item.kind}`}>
                    <span className="material-symbols-outlined">{item.kind === 'initiative' ? 'rocket_launch' : 'task_alt'}</span>
                </span>
                <span className="po-list__title-text">{item.title}</span>
            </button>
            {canManageTasks && item.kind === 'task' ? (
                <select
                    className="po-list__select"
                    data-status={item.status}
                    value={item.status}
                    onChange={(event) => onUpdateItemStatus(item, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('projectOverview.workspace.columns.status', 'Status')}
                >
                    {STATUS_VALUES.map((value) => (
                        <option key={value} value={value}>{labels.statusLabels[value] || value}</option>
                    ))}
                </select>
            ) : (
                <span className="po-list__pill" data-status={item.status}>{labels.statusLabels[item.status] || item.status}</span>
            )}
            <span className={`po-list__pill ${priorityClass}`.trim()}>
                {item.priority ? (labels.priorityLabels[item.priority] || item.priority) : '—'}
            </span>
            <span className={`po-list__due ${isOverdue ? 'is-overdue' : ''}`.trim()}>
                {due ? format(due, dateFormat, { locale: dateLocale }) : '—'}
            </span>
        </div>
    );
};

export const WorkViewList: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { groups, t } = ctx;

    if (groups.length === 0) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">task_alt</span>
                <p>{t('projectOverview.execution.noActiveTasks', 'No active work')}</p>
            </div>
        );
    }

    return (
        <div className="po-list">
            {groups.map((group) => (
                <section key={group.key} className="po-list__group">
                    <header className="po-list__group-head">
                        {ctx.groupBy === 'status' && <span className="po-list__group-dot" data-status={group.key} />}
                        <span className="po-list__group-title">{group.label}</span>
                        <span className="po-list__group-count">{group.items.length}</span>
                    </header>
                    <div className="po-list__rows">
                        {group.items.map((item) => (
                            <Row key={`${item.kind}-${item.id}`} item={item} ctx={ctx} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};
