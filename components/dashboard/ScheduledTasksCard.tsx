import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Task, Issue } from '../../types';
import { Card } from '../ui/Card';
import { toMillis, toDate } from '../../utils/time';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';

interface ScheduledTasksCardProps {
    tasks: Task[];
    issues?: Issue[];
}


export const ScheduledTasksCard: React.FC<ScheduledTasksCardProps> = ({ tasks, issues = [] }) => {
    const { t, language, dateFormat, dateLocale } = useLanguage();
    const locale = language === 'de' ? 'de-DE' : 'en-US';
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

        // Filter for items due today (based on scheduledDate OR dueDate)
        const itemsDueToday = allItems.filter(item => {
            const date = getItemDate(item);
            return date && date.toDateString() === todayStr;
        });

        if (itemsDueToday.length > 0) {
            return {
                displayItems: itemsDueToday.sort((a, b) => {
                    // Sort by priority (Urgent > High > Medium > Low) then creation
                    const priorities = { 'Urgent': 3, 'High': 2, 'Medium': 1, 'Low': 0, undefined: 0 };
                    const pA = priorities[a.priority as keyof typeof priorities] || 0;
                    const pB = priorities[b.priority as keyof typeof priorities] || 0;
                    if (pA !== pB) return pB - pA;
                    return (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0);
                }),
                isToday: true
            };
        }

        // If no items today, get upcoming items
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
            .slice(0, 5); // Take top 5

        return {
            displayItems: upcomingItems,
            isToday: false
        };
    }, [tasks, issues]);

    if (displayItems.length === 0 && !isToday) {
        // Optional: Don't render if absolutely no scheduled tasks ever?
        // Or render empty state. Let's render empty state for consistency if desired, 
        // buy specs said "if not then list the next scheduled ones". If none, maybe show placeholder.
        return (
            <Card padding="md" className="scheduled-tasks-card">
                <div className="card-header">
                    <h3>{t('dashboard.scheduled.title')}</h3>
                    <span className="material-symbols-outlined icon empty">event</span>
                </div>
                <div className="empty-state">
                    {t('dashboard.scheduled.empty')}
                </div>
            </Card>
        );
    }

    return (
        <Card padding="md" className="scheduled-tasks-card">
            <div className="card-header">
                <h3>{isToday ? t('dashboard.scheduled.today') : t('dashboard.scheduled.upcoming')}</h3>
                <span className={`material-symbols-outlined icon ${isToday ? 'today' : 'upcoming'}`}>
                    {isToday ? 'today' : 'event_upcoming'}
                </span>
            </div>

            <div className="tasks-list">
                {displayItems.map(item => {
                    const isIssue = 'reporter' in item;
                    const priorityClass = item.priority ? item.priority.toLowerCase() : 'low';
                    const date = item.scheduledDate ? toDate(item.scheduledDate) : ('dueDate' in item ? toDate(item.dueDate) : null);

                    return (
                        <Link key={item.id} to={`/project/${item.projectId}/${isIssue ? 'issues' : 'tasks'}/${item.id}`} className="task-item">
                            <div className="item-row">
                                <div className="item-content">
                                    <div className="title-row">
                                        {isIssue && <span className="material-symbols-outlined bug-icon">bug_report</span>}
                                        <p className="task-title">{item.title}</p>
                                    </div>
                                    <div className="meta-row">

                                        {item.priority && (
                                            <span className={`priority-badge ${priorityClass}`}>
                                                {priorityLabels[item.priority as keyof typeof priorityLabels] || item.priority}
                                            </span>
                                        )}

                                        {!isToday && date && (
                                            <span className="date-badge">
                                                <span className="dot"></span>
                                                {format(date, dateFormat, { locale: dateLocale })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="material-symbols-outlined chevron">chevron_right</span>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </Card>
    );
};
