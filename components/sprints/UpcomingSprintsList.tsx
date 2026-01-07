import React from 'react';
import { differenceInDays, format } from 'date-fns';
import { Sprint, Task } from '../../types';
import { Button } from '../../components/common/Button/Button';
import { Badge } from '../../components/common/Badge/Badge';
import { useLanguage } from '../../context/LanguageContext';

interface UpcomingSprintsListProps {
    sprints: Sprint[];
    allTasks: Task[];
    onStartSprint?: (sprintId: string) => void;
    onSprintClick?: (sprint: Sprint) => void;
}

export const UpcomingSprintsList: React.FC<UpcomingSprintsListProps> = ({ sprints, allTasks, onStartSprint, onSprintClick }) => {
    const { t, dateFormat, dateLocale } = useLanguage();

    if (sprints.length === 0) return null;

    return (
        <div className="sprint-upcoming">
            <div className="sprint-upcoming__header">
                <span className="material-symbols-outlined">upcoming</span>
                <h3>{t('projectSprints.upcoming.title')}</h3>
            </div>
            <div className="sprint-upcoming__grid">
                {sprints.map(upcoming => {
                    const upcomingTasks = allTasks.filter(t => t.sprintId === upcoming.id);
                    const startsIn = differenceInDays(new Date(upcoming.startDate), new Date());
                    const startsLabel = startsIn <= 0
                        ? t('projectSprints.upcoming.startsToday')
                        : t('projectSprints.upcoming.startsIn').replace('{count}', String(startsIn));

                    return (
                        <div
                            key={upcoming.id}
                            onClick={() => onSprintClick?.(upcoming)}
                            className="sprint-upcoming__card"
                        >
                            <div className="sprint-upcoming__card-header">
                                <div>
                                    <div className="sprint-upcoming__title-row">
                                        <h4 className="sprint-upcoming__title">{upcoming.name}</h4>
                                        {upcoming.autoStart && (
                                            <Badge variant="warning" className="sprint-upcoming__auto" title={t('projectSprints.upcoming.autoTitle')}>
                                                {t('projectSprints.upcoming.auto')}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="sprint-upcoming__dates">
                                        <span className="material-symbols-outlined">calendar_today</span>
                                        {format(new Date(upcoming.startDate), dateFormat, { locale: dateLocale })}
                                        <span className="sprint-upcoming__date-separator">-</span>
                                        {format(new Date(upcoming.endDate), dateFormat, { locale: dateLocale })}
                                    </div>
                                </div>
                                {onStartSprint && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="sprint-upcoming__start"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onStartSprint(upcoming.id);
                                        }}
                                    >
                                        {t('projectSprints.upcoming.start')}
                                    </Button>
                                )}
                            </div>

                            {upcoming.goal && (
                                <p className="sprint-upcoming__goal">{upcoming.goal}</p>
                            )}

                            <div className="sprint-upcoming__footer">
                                <span className="sprint-upcoming__tasks">
                                    <span className="material-symbols-outlined">list_alt</span>
                                    {t('projectSprints.upcoming.tasks').replace('{count}', String(upcomingTasks.length))}
                                </span>
                                <span className="sprint-upcoming__starts">{startsLabel}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
