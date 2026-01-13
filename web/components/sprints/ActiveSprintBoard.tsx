import React from 'react';
import { differenceInDays, format } from 'date-fns';
import { Task, Sprint } from '../../types';
import { ProjectBoard } from '../../components/ProjectBoard';
import { Button } from '../../components/common/Button/Button';
import { Badge } from '../../components/common/Badge/Badge';
import { useLanguage } from '../../context/LanguageContext';
import { UpcomingSprintsList } from './UpcomingSprintsList';

interface ActiveSprintBoardProps {
    sprint: Sprint;
    tasks: Task[];
    upcomingSprints?: Sprint[];
    allTasks?: Task[];
    onCompleteSprint: () => void;
    onStartSprint?: (sprintId: string) => void;
    onSprintClick?: (sprint: Sprint) => void;
    renderTask: (task: Task) => React.ReactNode;
}

export const ActiveSprintBoard: React.FC<ActiveSprintBoardProps> = ({
    sprint,
    tasks,
    upcomingSprints = [],
    allTasks = [],
    onCompleteSprint,
    onStartSprint,
    onSprintClick,
    renderTask
}) => {
    const { t, dateFormat, dateLocale } = useLanguage();
    const daysLeft = differenceInDays(new Date(sprint.endDate), new Date());
    const isOverdue = daysLeft < 0;

    const daysLabel = isOverdue
        ? t('projectSprints.active.daysOverdue').replace('{count}', String(Math.abs(daysLeft)))
        : t('projectSprints.active.daysLeft').replace('{count}', String(daysLeft));

    return (
        <div className="sprint-board">
            <div className="sprint-board__header">
                <div className="sprint-board__header-main">
                    <div className="sprint-board__heading">
                        <Badge variant="neutral" className="sprint-board__badge">
                            {t('projectSprints.active.badge')}
                        </Badge>
                        <h2 className="sprint-board__title">{sprint.name}</h2>
                    </div>
                    {sprint.goal && (
                        <p className="sprint-board__goal">
                            <span className="sprint-board__goal-label">{t('projectSprints.active.goal')}</span>
                            <span className="sprint-board__goal-text">{sprint.goal}</span>
                        </p>
                    )}
                    <div className="sprint-board__meta">
                        <span className="sprint-board__meta-item">
                            <span className="material-symbols-outlined">calendar_today</span>
                            {format(new Date(sprint.startDate), dateFormat, { locale: dateLocale })}
                            <span className="sprint-board__meta-separator">-</span>
                            {format(new Date(sprint.endDate), dateFormat, { locale: dateLocale })}
                        </span>
                        <span className={`sprint-board__meta-item ${isOverdue ? 'is-overdue' : 'is-ontrack'}`}>
                            {daysLabel}
                        </span>
                    </div>
                </div>

                <Button
                    variant="primary"
                    onClick={onCompleteSprint}
                    className="sprint-board__complete"
                    icon={<span className="material-symbols-outlined">flag</span>}
                >
                    {t('projectSprints.active.complete')}
                </Button>
            </div>

            <div className="sprint-board__body">
                <ProjectBoard
                    tasks={tasks}
                    renderTask={renderTask}
                    stickyOffset="0px"
                />
            </div>

            <UpcomingSprintsList
                sprints={upcomingSprints}
                allTasks={allTasks}
                onStartSprint={onStartSprint}
                onSprintClick={onSprintClick}
            />
        </div>
    );
};
