import { Activity } from '../types';
import { toMillis } from './time';
import { format } from 'date-fns';
import { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';

export const dateFormat = 'MMM d, yyyy';
export const dateLocale = enUS;

export const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        return { icon: 'add_task', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
    }
    if (type === 'status') return { icon: 'swap_horiz', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' };
    if (type === 'report') return { icon: 'auto_awesome', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' };
    if (type === 'comment') return { icon: 'chat_bubble', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
    if (type === 'file') return { icon: 'attach_file', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/10' };
    if (type === 'member') return { icon: 'person_add', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
    if (type === 'commit') return { icon: 'code', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
    if (type === 'priority') return { icon: 'priority_high', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    if (type === 'issue') return { icon: 'bug_report', color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    return { icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/50' };
};

export const groupActivitiesByDate = (activities: Activity[], dateFormat?: string, dateLocale?: Locale) => {
    const groups: { [key: string]: Activity[] } = {};

    activities.forEach(activity => {
        const date = new Date(toMillis(activity.createdAt));
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        let dateKey = '';

        if (date.toDateString() === today.toDateString()) {
            dateKey = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateKey = 'Yesterday';
        } else {
            // Use provided format/locale or fallback
            if (dateFormat && dateLocale) {
                dateKey = format(date, 'MMMM d, yyyy', { locale: dateLocale });
            } else {
                dateKey = format(date, 'MMMM d, yyyy', { locale: enUS });
            }
        }

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(activity);
    });

    return groups;
};

export const filterActivities = (activities: Activity[], filter: string, searchTerm: string) => {
    return activities.filter(activity => {
        const matchesFilter = filter === 'all' || activity.type === filter;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            activity.user.toLowerCase().includes(searchLower) ||
            activity.action.toLowerCase().includes(searchLower) ||
            (activity.details || '').toLowerCase().includes(searchLower) ||
            (activity.target || '').toLowerCase().includes(searchLower);

        return matchesFilter && matchesSearch;
    });
};
