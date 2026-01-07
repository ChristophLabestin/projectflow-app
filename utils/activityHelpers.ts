import { Activity } from '../types';
import { toMillis } from './time';
import { format } from 'date-fns';
import { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';

export const dateFormat = 'MMM d, yyyy';
export const dateLocale = enUS;

const buildTone = (colorVar: string, rgbVar: string, alpha = 0.12) => ({
    color: `var(${colorVar})`,
    bg: `rgba(var(${rgbVar}), ${alpha})`,
});

export const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    const successTone = buildTone('--color-success', '--color-success-rgb');
    const warningTone = buildTone('--color-warning', '--color-warning-rgb');
    const errorTone = buildTone('--color-error', '--color-error-rgb');
    const primaryTone = buildTone('--color-primary', '--color-primary-rgb');
    const neutralTone = buildTone('--color-text-muted', '--color-surface-hover-rgb', 0.6);

    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', ...errorTone };
        if (action.includes('reopened')) return { icon: 'undo', ...warningTone };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', ...successTone };
        return { icon: 'add_task', ...primaryTone };
    }
    if (type === 'issue') {
        if (action.includes('resolved') || action.includes('closed')) return { icon: 'check_circle', ...successTone };
        if (action.includes('reopened')) return { icon: 'undo', ...warningTone };
        return { icon: 'bug_report', ...errorTone };
    }
    if (type === 'status') return { icon: 'swap_horiz', ...primaryTone };
    if (type === 'report') return { icon: 'auto_awesome', ...primaryTone };
    if (type === 'comment') return { icon: 'chat_bubble', ...warningTone };
    if (type === 'file') return { icon: 'attach_file', ...neutralTone };
    if (type === 'member') return { icon: 'person_add', ...successTone };
    if (type === 'commit') return { icon: 'code', ...primaryTone };
    if (type === 'priority') return { icon: 'priority_high', ...errorTone };
    return { icon: 'more_horiz', ...neutralTone };
};

export const groupActivitiesByDate = (
    activities: Activity[],
    dateFormat?: string,
    dateLocale?: Locale,
    labels?: { today: string; yesterday: string }
) => {
    const groups: { [key: string]: Activity[] } = {};
    const todayLabel = labels?.today || 'Today';
    const yesterdayLabel = labels?.yesterday || 'Yesterday';

    activities.forEach(activity => {
        const date = new Date(toMillis(activity.createdAt));
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        let dateKey = '';

        if (date.toDateString() === today.toDateString()) {
            dateKey = todayLabel;
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateKey = yesterdayLabel;
        } else {
            // Use provided format/locale or fallback
            const formatString = dateFormat || 'MMMM d, yyyy';
            dateKey = format(date, formatString, { locale: dateLocale || enUS });
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
