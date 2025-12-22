import React, { useEffect, useState } from 'react';
import { subscribeProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { Card } from './ui/Card';
import { toMillis, timeAgo } from '../utils/time';
import { Link } from 'react-router-dom';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');

const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        return { icon: 'add_task', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
    }
    if (type === 'status') return { icon: 'swap_horiz', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' };
    if (type === 'report') return { icon: 'auto_awesome', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' };
    if (type === 'comment') return { icon: 'chat_bubble', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (type === 'file') return { icon: 'attach_file', color: 'text-slate-600', bg: 'bg-slate-100' };
    if (type === 'member') return { icon: 'person_add', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
    if (type === 'commit') return { icon: 'code', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (type === 'priority') return { icon: 'priority_high', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    return { icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/50' };
};

export const RecentActivityCard = ({ projectId }: { projectId: string }) => {
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = subscribeProjectActivity(projectId, (data) => {
            setActivity(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    return (
        <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="h4">Recent Activity</h3>
                <Link to={`/project/${projectId}/activity`} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">View History</Link>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="material-symbols-outlined animate-spin text-[var(--color-text-subtle)]">progress_activity</span>
                    </div>
                ) : activity.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No recent activity.</p>
                ) : (
                    activity.slice(0, 10).map((item, idx) => {
                        const { icon, color, bg } = activityIcon(item.type, item.action);
                        return (
                            <div key={item.id} className="flex gap-3 relative group">
                                {idx !== activity.length - 1 && <div className="absolute left-3.5 top-8 bottom-[-16px] w-px bg-[var(--color-surface-border)] group-last:hidden" />}
                                <div className={`size-7 rounded-full shrink-0 flex items-center justify-center ${bg} ${color}`}>
                                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                </div>
                                <div className="space-y-0.5 pb-1 min-w-0">
                                    <p className="text-sm text-[var(--color-text-main)] leading-snug truncate">
                                        <span className="font-semibold">{item.user}</span> <span className="text-[var(--color-text-muted)]">{item.action}</span>
                                    </p>
                                    <p className="text-xs text-[var(--color-text-subtle)]">{timeAgo(item.createdAt)}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Card>
    );
};
