import React, { useMemo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Initiative, Task } from '../../../types';
import { Badge } from '../../common/Badge/Badge';
import { useLanguage } from '../../../context/LanguageContext';
import './project-overview-work-views.scss';

type BoardLane = {
    id: string;
    title: string;
    subtitle?: string;
    initiative: Initiative | null;
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

export const ProjectOverviewWorkBoard: React.FC<ProjectOverviewWorkBoardProps> = ({
    tasks,
    initiatives,
    onTaskClick,
    onInitiativeClick,
    priorityLabels,
    statusLabels,
    dateFormat,
    dateLocale
}) => {
    const { t } = useLanguage();

    const lanes = useMemo<BoardLane[]>(() => {
        const initiativeLanes: BoardLane[] = initiatives.map((initiative) => ({
            id: initiative.id,
            title: initiative.title,
            subtitle: initiative.description?.trim() || undefined,
            initiative,
            tasks: tasks.filter((task) => task.initiativeId === initiative.id && !task.isCompleted && task.status !== 'Done')
        }));

        const standaloneTasks = tasks.filter((task) => !task.initiativeId);
        const standaloneLane: BoardLane = {
            id: '__standalone__',
            title: t('projectOverview.workspace.board.standalone'),
            subtitle: t('projectOverview.workspace.board.standaloneHint'),
            initiative: null,
            tasks: standaloneTasks
        };

        return [
            ...initiativeLanes,
            ...(standaloneTasks.length > 0 ? [standaloneLane] : [])
        ];
    }, [tasks, initiatives, t]);

    if (lanes.length === 0) {
        return (
            <div className="project-overview-work-board__empty">
                <span className="material-symbols-outlined">view_kanban</span>
                <p>{t('projectOverview.execution.noActiveTasks')}</p>
            </div>
        );
    }

    return (
        <div className="project-overview-work-board">
            {lanes.map((lane) => {
                const initiative = lane.initiative;
                const statusLabel = initiative?.status ? (statusLabels[initiative.status] || initiative.status) : undefined;

                return (
                    <section key={lane.id} className="project-overview-work-board__lane">
                        <div className="project-overview-work-board__lane-head">
                            {initiative ? (
                                <button
                                    type="button"
                                    className="project-overview-work-board__lane-main"
                                    onClick={() => onInitiativeClick(initiative)}
                                >
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                    <span className="project-overview-work-board__lane-copy">
                                        <strong>{lane.title}</strong>
                                        {lane.subtitle && <span>{lane.subtitle}</span>}
                                    </span>
                                </button>
                            ) : (
                                <div className="project-overview-work-board__lane-main">
                                    <span className="material-symbols-outlined">task_alt</span>
                                    <span className="project-overview-work-board__lane-copy">
                                        <strong>{lane.title}</strong>
                                        {lane.subtitle && <span>{lane.subtitle}</span>}
                                    </span>
                                </div>
                            )}
                            <div className="project-overview-work-board__lane-meta">
                                {statusLabel && <Badge variant="neutral">{statusLabel}</Badge>}
                                <Badge variant="neutral">
                                    {t('projectOverview.workspace.board.openCount').replace('{count}', String(lane.tasks.length))}
                                </Badge>
                            </div>
                        </div>
                        <div className="project-overview-work-board__lane-body">
                            {lane.tasks.length === 0 ? (
                                <div className="project-overview-work-board__lane-empty">
                                    {t('projectOverview.workspace.board.noOpenTasksInLane')}
                                </div>
                            ) : (
                                lane.tasks.map((task) => (
                                    <button
                                        key={task.id}
                                        type="button"
                                        className="project-overview-work-board__task"
                                        onClick={() => onTaskClick(task)}
                                    >
                                        <p className="project-overview-work-board__task-title">{task.title}</p>
                                        <div className="project-overview-work-board__task-meta">
                                            {task.status && (
                                                <span>{statusLabels[task.status] || task.status}</span>
                                            )}
                                            {task.priority && (
                                                <span>{priorityLabels[task.priority] || task.priority}</span>
                                            )}
                                            {task.dueDate && (
                                                <span>{format(new Date(task.dueDate), dateFormat, { locale: dateLocale })}</span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};
