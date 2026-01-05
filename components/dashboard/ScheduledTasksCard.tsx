import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Task, Issue } from '../../types';
import { Card } from '../common/Card/Card';
import { toDate, toMillis } from '../../utils/time';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import './dashboard-cards.scss';

interface ScheduledTasksCardProps {
    tasks: Task[];
    issues?: Issue[];
}

export const ScheduledTasksCard: React.FC<ScheduledTasksCardProps> = ({ tasks, issues = [] }) => {
    const { t, language, dateFormat, dateLocale } = useLanguage();
    const priorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);

    const { displayItems, isToday } = useMemo(() => {
        const now = new Date();
        const todayStr = now.toDateString();

        const openTasks = tasks.filter(t => !t.isCompleted);
        const openIssues = issues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');

        const getItemDate = (item: Task | Issue): Date | null => {
            if (item.scheduledDate) return toDate(item.scheduledDate);
            if ('dueDate' in item && item.dueDate) return toDate(item.dueDate);
            return null;
        };

        const allItems = [...openTasks, ...openIssues];

        const itemsDueToday = allItems.filter(item => {
            const date = getItemDate(item);
            return date && date.toDateString() === todayStr;
        });

        if (itemsDueToday.length > 0) {
            return {
                displayItems: itemsDueToday.sort((a, b) => {
                    const priorities = { 'Urgent': 3, 'High': 2, 'Medium': 1, 'Low': 0, undefined: 0 };
                    const pA = priorities[a.priority as keyof typeof priorities] || 0;
                    const pB = priorities[b.priority as keyof typeof priorities] || 0;
                    if (pA !== pB) return pB - pA;
                    return (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0);
                }),
                isToday: true
            };
        }

        const upcomingItems = allItems
            .filter(item => {
                const date = getItemDate(item);
                return date && date.getTime() > now.getTime();
            })
            .sort((a, b) => {
                const dateA = getItemDate(a)?.getTime() || 0;
                const dateB = getItemDate(b)?.getTime() || 0;
                return dateA - dateB;
            })
            .slice(0, 5);

        return {
            displayItems: upcomingItems,
            isToday: false
        };
    }, [tasks, issues]);

    if (displayItems.length === 0 && !isToday) {
        return (
            <Card className="scheduled-card dashboard__card--padded">
                <div className="dashboard-card-header">
                    <h3 className="h5">{t('dashboard.scheduled.title')}</h3>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-subtle)' }}>event</span>
                </div>
                <div className="scheduled-card__empty">
                    {t('dashboard.scheduled.empty')}
                </div>
            </Card>
        );
    }

    return (
        <Card className="scheduled-card dashboard__card--padded">
            <div className="dashboard-card-header">
                <h3 className="h5">{isToday ? t('dashboard.scheduled.today') : t('dashboard.scheduled.upcoming')}</h3>
                <span className="material-symbols-outlined" style={{ color: isToday ? 'var(--color-success)' : 'var(--color-primary)' }}>
                    {isToday ? 'today' : 'event_upcoming'}
                </span>
            </div>

            <div className="scheduled-card__list">
                {displayItems.map(item => {
                    const isIssue = 'reporter' in item;
                    const date = item.scheduledDate ? toDate(item.scheduledDate) : ('dueDate' in item ? toDate(item.dueDate) : null);
                    const priorityClass = item.priority ? `scheduled-card__item-tag--${item.priority.toLowerCase()}` : '';

                    return (
                        <Link key={item.id} to={`/project/${item.projectId}/${isIssue ? 'issues' : 'tasks'}/${item.id}`} className="scheduled-card__item group">
                            <div className="scheduled-card__item-content">
                                <div className="scheduled-card__item-main">
                                    <div className="scheduled-card__item-title-row">
                                        {isIssue && <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-error)' }}>bug_report</span>}
                                        <p className="scheduled-card__item-title">{item.title}</p>
                                    </div>
                                    <div className="scheduled-card__item-meta">
                                        {item.priority && (
                                            <span className={`scheduled-card__item-tag ${priorityClass}`}>
                                                {priorityLabels[item.priority as keyof typeof priorityLabels] || item.priority}
                                            </span>
                                        )}

                                        {!isToday && date && (
                                            <span className="scheduled-card__item-date">
                                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                                                {format(date, dateFormat, { locale: dateLocale })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="material-symbols-outlined scheduled-card__item-arrow">chevron_right</span>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </Card>
    );
};
