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
            <Card padding="md" className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="h5">{t('dashboard.scheduled.title')}</h3>
                    <span className="material-symbols-outlined text-[var(--color-text-subtle)]">event</span>
                </div>
                <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
                    {t('dashboard.scheduled.empty')}
                </div>
            </Card>
        );
    }

    return (
        <Card padding="md" className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="h5">{isToday ? t('dashboard.scheduled.today') : t('dashboard.scheduled.upcoming')}</h3>
                <span className={`material-symbols-outlined ${isToday ? 'text-emerald-500' : 'text-[var(--color-primary)]'}`}>
                    {isToday ? 'today' : 'event_upcoming'}
                </span>
            </div>

            <div className="flex-1 space-y-0 divide-y divide-[var(--color-surface-border)] -mx-2 px-2">
                {displayItems.map(item => {
                    const isIssue = 'reporter' in item;
                    const priorityColor = item.priority === 'Urgent' ? 'text-red-500' : item.priority === 'High' ? 'text-orange-500' : 'text-blue-500';
                    const date = item.scheduledDate ? toDate(item.scheduledDate) : ('dueDate' in item ? toDate(item.dueDate) : null);

                    return (
                        <Link key={item.id} to={`/project/${item.projectId}/${isIssue ? 'issues' : 'tasks'}/${item.id}`} className="block py-3 first:pt-2 last:pb-2 hover:bg-[var(--color-surface-hover)] -mx-2 px-4 rounded-lg transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1 pr-3">
                                    <div className="flex items-center gap-2">
                                        {isIssue && <span className="material-symbols-outlined text-[14px] text-rose-500">bug_report</span>}
                                        <p className="text-sm font-medium text-[var(--color-text-main)] truncate group-hover:text-[var(--color-primary)] transition-colors">{item.title}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">

                                        {item.priority && (
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityColor}`}>
                                                {priorityLabels[item.priority as keyof typeof priorityLabels] || item.priority}
                                            </span>
                                        )}

                                        {!isToday && date && (
                                            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                                <span className="size-1 rounded-full bg-[var(--color-text-muted)]"></span>
                                                {format(date, dateFormat, { locale: dateLocale })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">chevron_right</span>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </Card>
    );
};
