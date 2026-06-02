import React, { useMemo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Initiative, Task, TaskStatus } from '../../../types';
import { Badge } from '../../common/Badge/Badge';
import { useLanguage } from '../../../context/LanguageContext';
import './project-overview-work-views.scss';

export type OverviewWorkLaneStatus =
    | 'Backlog'
    | 'Planning'
    | 'Open'
    | 'In Progress'
    | 'Review'
    | 'On Hold'
    | 'Blocked';

type WorkItem =
    | { kind: 'task'; item: Task }
    | { kind: 'initiative'; item: Initiative };

type LaneConfig = {
    id: OverviewWorkLaneStatus;
    className: string;
    labelKey: string;
};

const WORK_LANES: LaneConfig[] = [
    { id: 'Backlog', className: 'is-backlog', labelKey: 'tasks.status.backlog' },
    { id: 'Planning', className: 'is-planning', labelKey: 'initiatives.status.planning' },
    { id: 'Open', className: 'is-open', labelKey: 'tasks.status.open' },
    { id: 'In Progress', className: 'is-in-progress', labelKey: 'tasks.status.inProgress' },
    { id: 'Review', className: 'is-review', labelKey: 'tasks.status.review' },
    { id: 'On Hold', className: 'is-on-hold', labelKey: 'tasks.status.onHold' },
    { id: 'Blocked', className: 'is-blocked', labelKey: 'tasks.status.blocked' }
];

const normalizeTaskStatus = (status?: TaskStatus | string): OverviewWorkLaneStatus => {
    if (!status || status === 'Todo' || status === 'Open') return 'Open';
    if (status === 'Planning') return 'Planning';
    if (status === 'Backlog') return 'Backlog';
    if (status === 'In Progress') return 'In Progress';
    if (status === 'Review') return 'Review';
    if (status === 'On Hold') return 'On Hold';
    if (status === 'Blocked') return 'Blocked';
    return 'Open';
};

const toWorkItemStatus = (entry: WorkItem): OverviewWorkLaneStatus => {
    if (entry.kind === 'initiative') {
        return normalizeTaskStatus(entry.item.status);
    }
    return normalizeTaskStatus(entry.item.status);
};

type ProjectOverviewWorkKanbanProps = {
    tasks: Task[];
    initiatives: Initiative[];
    onTaskClick: (task: Task) => void;
    onInitiativeClick: (initiative: Initiative) => void;
    priorityLabels: Record<string, string>;
    dateFormat: string;
    dateLocale: Locale;
};

export const ProjectOverviewWorkKanban: React.FC<ProjectOverviewWorkKanbanProps> = ({
    tasks,
    initiatives,
    onTaskClick,
    onInitiativeClick,
    priorityLabels,
    dateFormat,
    dateLocale
}) => {
    const { t } = useLanguage();

    const lanes = useMemo(() => {
        const items: WorkItem[] = [
            ...initiatives.map((item) => ({ kind: 'initiative' as const, item })),
            ...tasks.map((item) => ({ kind: 'task' as const, item }))
        ];

        return WORK_LANES.map((lane) => ({
            ...lane,
            label: t(lane.labelKey),
            items: items.filter((entry) => toWorkItemStatus(entry) === lane.id)
        }));
    }, [tasks, initiatives, t]);

    const renderPriority = (priority?: string) => {
        if (!priority) return null;
        const variant = priority === 'Urgent' ? 'error' : priority === 'High' ? 'warning' : 'neutral';
        return (
            <Badge variant={variant}>
                {priorityLabels[priority] || priority}
            </Badge>
        );
    };

    return (
        <div className="project-overview-work-kanban">
            {lanes.map((lane) => (
                <section
                    key={lane.id}
                    className={`project-overview-work-kanban__column ${lane.className}`.trim()}
                    aria-label={lane.label}
                >
                    <header className="project-overview-work-kanban__column-head">
                        <span className="project-overview-work-kanban__column-title">{lane.label}</span>
                        <span className="project-overview-work-kanban__column-count">{lane.items.length}</span>
                    </header>
                    <div className="project-overview-work-kanban__column-body">
                        {lane.items.length === 0 ? (
                            <div className="project-overview-work-kanban__empty">{t('tasks.board.empty')}</div>
                        ) : (
                            lane.items.map((entry) => {
                                const key = `${entry.kind}-${entry.item.id}`;
                                const title = entry.item.title;
                                const priority = entry.item.priority;
                                const dueDate = entry.item.dueDate ? new Date(entry.item.dueDate) : null;

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className="project-overview-work-kanban__card"
                                        onClick={() => (
                                            entry.kind === 'task'
                                                ? onTaskClick(entry.item)
                                                : onInitiativeClick(entry.item)
                                        )}
                                    >
                                        <span className={`project-overview-work-kanban__card-kind ${entry.kind === 'initiative' ? 'is-initiative' : ''}`.trim()}>
                                            <span className="material-symbols-outlined">
                                                {entry.kind === 'initiative' ? 'rocket_launch' : 'task_alt'}
                                            </span>
                                            {entry.kind === 'initiative'
                                                ? t('projectOverview.workspace.workItem.initiative')
                                                : t('projectOverview.workspace.workItem.task')}
                                        </span>
                                        <p className="project-overview-work-kanban__card-title">{title}</p>
                                        <div className="project-overview-work-kanban__card-meta">
                                            {renderPriority(priority)}
                                            {dueDate && (
                                                <span>{format(dueDate, dateFormat, { locale: dateLocale })}</span>
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
