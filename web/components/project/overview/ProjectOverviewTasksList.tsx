import React from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Link } from 'react-router-dom';
import { Task } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

type SubtaskStats = Record<string, { done: number; total: number }>;

type ProjectOverviewTasksListProps = {
    projectId: string;
    tenantId?: string;
    tasks: Task[];
    subtaskStats: SubtaskStats;
    taskStatusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
    dateFormat: string;
    dateLocale: Locale;
    canManageTasks: boolean;
    isPinned: (taskId: string) => boolean;
    onToggleTask: (taskId: string, isCompleted: boolean, event: React.MouseEvent<HTMLButtonElement>) => void;
    onPinTask: (task: Task) => void;
    onUnpinTask: (taskId: string) => void;
    onTaskClick: (task: Task) => void;
};

export const ProjectOverviewTasksList: React.FC<ProjectOverviewTasksListProps> = ({
    projectId,
    tenantId,
    tasks,
    subtaskStats,
    taskStatusLabels,
    priorityLabels,
    dateFormat,
    dateLocale,
    canManageTasks,
    isPinned,
    onToggleTask,
    onPinTask,
    onUnpinTask,
    onTaskClick
}) => {
    const { t } = useLanguage();
    const tenantQuery = tenantId ? `?tenant=${tenantId}` : '';

    if (tasks.length === 0) {
        return (
            <div className="overview-workspace__empty">
                <span className="material-symbols-outlined">task_alt</span>
                <p>{t('projectOverview.execution.noActiveTasks')}</p>
            </div>
        );
    }

    return (
        <div className="project-overview-tasks-list">
            <div className="project-overview-tasks-list__head">
                <span className="project-overview-tasks-list__count">
                    {t('projectOverview.workspace.list.openCount').replace('{count}', tasks.length.toString())}
                </span>
                <Link
                    to={`/project/${projectId}/tasks${tenantQuery}`}
                    className="overview-workspace__link-btn"
                >
                    {t('nav.tasks')}
                    <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
            </div>
            <div className="overview-workspace__table">
                <div className="overview-workspace__table-head">
                    <span>{t('projectOverview.workspace.columns.title')}</span>
                    <span>{t('projectOverview.workspace.columns.status')}</span>
                    <span>{t('projectOverview.workspace.columns.priority')}</span>
                    <span>{t('projectOverview.workspace.columns.due')}</span>
                </div>
                {tasks.map((task) => {
                    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                    const isOverdue = Boolean(dueDate && dueDate < new Date() && !task.isCompleted);
                    const priorityKey = task.priority?.toLowerCase() || '';
                    const priorityClass = priorityKey === 'urgent'
                        ? 'is-urgent'
                        : priorityKey === 'high'
                            ? 'is-high'
                            : '';
                    const subtaskTotal = subtaskStats[task.id]?.total || 0;
                    const subtaskDone = subtaskStats[task.id]?.done || 0;

                    return (
                        <div
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className="overview-workspace__table-row"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onTaskClick(task);
                                }
                            }}
                        >
                            <div className="overview-workspace__cell--primary">
                                {canManageTasks && (
                                    <button
                                        type="button"
                                        onClick={(event) => onToggleTask(task.id, task.isCompleted, event)}
                                        className={`overview-workspace__checkbox ${task.isCompleted ? 'is-checked' : ''}`.trim()}
                                        aria-label={task.title}
                                    >
                                        <span className="material-symbols-outlined">check</span>
                                    </button>
                                )}
                                <div className="overview-workspace__row-copy">
                                    <strong className={task.isCompleted ? 'is-done' : ''}>{task.title}</strong>
                                    {subtaskTotal > 0 && (
                                        <span>
                                            {subtaskDone}/{subtaskTotal} {t('projectOverview.execution.subtasksLabel', 'Subtasks')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className="overview-workspace__pill">
                                {task.status ? (taskStatusLabels[task.status] || task.status) : '—'}
                            </span>
                            <span className={`overview-workspace__pill ${priorityClass}`.trim()}>
                                {task.priority ? (priorityLabels[task.priority] || task.priority) : '—'}
                            </span>
                            <div className="overview-workspace__cell--meta overview-workspace__row-actions">
                                {dueDate ? (
                                    <span className={isOverdue ? 'is-overdue' : ''}>
                                        {format(dueDate, dateFormat, { locale: dateLocale })}
                                    </span>
                                ) : (
                                    <span>—</span>
                                )}
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (isPinned(task.id)) {
                                            onUnpinTask(task.id);
                                        } else {
                                            onPinTask(task);
                                        }
                                    }}
                                    className={`overview-workspace__icon-btn ${isPinned(task.id) ? 'is-pinned' : ''}`.trim()}
                                    title={isPinned(task.id) ? t('projectOverview.execution.unpinTask') : t('projectOverview.execution.pinTask')}
                                >
                                    <span className="material-symbols-outlined">push_pin</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
