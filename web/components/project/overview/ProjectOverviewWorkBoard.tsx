import React, { useMemo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Initiative, Task, TaskStatus } from '../../../types';
import { Badge } from '../../common/Badge/Badge';
import { useLanguage } from '../../../context/LanguageContext';
import './project-overview-work-views.scss';

type BoardLane = {
    id: string;
    status: TaskStatus;
    title: string;
    statuses: TaskStatus[];
    tasks: Task[];
};

type ProjectOverviewWorkBoardProps = {
    tasks: Task[];
    initiatives: Initiative[];
    onTaskClick: (task: Task) => void;
    onInitiativeClick: (initiative: Initiative) => void;
    priorityLabels: Record<string, string>;
    statusLabels: Record<string, string>;
    dateFormat: string;
    dateLocale: Locale;
};

const BOARD_LANES: Array<Omit<BoardLane, 'title' | 'tasks'>> = [
    { id: 'backlog', status: 'Backlog', statuses: ['Backlog'] },
    { id: 'todo', status: 'Open', statuses: ['Todo', 'Open'] },
    { id: 'in-progress', status: 'In Progress', statuses: ['In Progress'] },
    { id: 'review', status: 'Review', statuses: ['Review'] },
    { id: 'on-hold', status: 'On Hold', statuses: ['On Hold'] },
    { id: 'blocked', status: 'Blocked', statuses: ['Blocked'] },
    { id: 'done', status: 'Done', statuses: ['Done'] }
];

const priorityVariant = (priority?: string): 'neutral' | 'warning' | 'error' =>
    priority === 'Urgent' ? 'error' : priority === 'High' ? 'warning' : 'neutral';

export const ProjectOverviewWorkBoard: React.FC<ProjectOverviewWorkBoardProps> = ({
    tasks,
    initiatives,
    onTaskClick,
    priorityLabels,
    statusLabels,
    dateFormat,
    dateLocale
}) => {
    const { t } = useLanguage();

    const initiativeLookup = useMemo(
        () => Object.fromEntries(initiatives.map((initiative) => [initiative.id, initiative])),
        [initiatives]
    );

    const lanes = useMemo<BoardLane[]>(() => (
        BOARD_LANES.map((lane) => ({
            ...lane,
            title: lane.status === 'Open'
                ? t('tasks.status.todo')
                : statusLabels[lane.status] || lane.status,
            tasks: tasks.filter((task) => {
                if (lane.id === 'todo') {
                    return !task.status || lane.statuses.includes(task.status);
                }
                return Boolean(task.status && lane.statuses.includes(task.status));
            })
        }))
    ), [statusLabels, tasks, t]);

    if (tasks.length === 0) {
        return (
            <div className="project-overview-work-board__empty">
                <span className="material-symbols-outlined">view_column</span>
                <p>{t('projectOverview.execution.noActiveTasks')}</p>
            </div>
        );
    }

    return (
        <div className="project-overview-work-board project-overview-work-board--status">
            {lanes.map((lane) => (
                <section
                    key={lane.id}
                    data-status={lane.status}
                    className="project-overview-work-board__lane"
                    aria-label={lane.title}
                >
                    <div className="project-overview-work-board__lane-head">
                        <div className="project-overview-work-board__lane-main">
                            <span className="project-overview-work-board__dot" />
                            <span className="project-overview-work-board__lane-copy">
                                <strong>{lane.title}</strong>
                            </span>
                        </div>
                        <div className="project-overview-work-board__lane-meta">
                            <span className="project-overview-work-board__count">
                                {lane.tasks.length}
                            </span>
                        </div>
                    </div>
                    <div className="project-overview-work-board__lane-body">
                        {lane.tasks.length === 0 ? (
                            <div className="project-overview-work-board__lane-empty">
                                {t('tasks.board.empty')}
                            </div>
                        ) : (
                            lane.tasks.map((task) => {
                                const initiative = task.initiativeId ? initiativeLookup[task.initiativeId] : null;

                                return (
                                    <button
                                        key={task.id}
                                        type="button"
                                        className="project-overview-work-board__task"
                                        data-status={task.status || 'Open'}
                                        onClick={() => onTaskClick(task)}
                                    >
                                        {initiative && (
                                            <span className="project-overview-work-board__task-kind is-initiative">
                                                <span className="material-symbols-outlined">rocket_launch</span>
                                                {initiative.title}
                                            </span>
                                        )}
                                        <p className="project-overview-work-board__task-title">{task.title}</p>
                                        <div className="project-overview-work-board__task-meta">
                                            {task.priority && (
                                                <Badge variant={priorityVariant(task.priority)}>
                                                    {priorityLabels[task.priority] || task.priority}
                                                </Badge>
                                            )}
                                            {task.dueDate && (
                                                <span>{format(new Date(task.dueDate), dateFormat, { locale: dateLocale })}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>
            ))}
        </div>
    );
};
