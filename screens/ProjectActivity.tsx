import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { toMillis } from '../utils/time';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');

const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') return { icon: 'task_alt', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (type === 'status') return { icon: 'flag', color: 'text-indigo-600', bg: 'bg-indigo-50' };
    if (type === 'report') return { icon: 'article', color: 'text-purple-600', bg: 'bg-purple-50' };
    if (type === 'priority') return { icon: 'priority_high', color: 'text-rose-600', bg: 'bg-rose-50' };
    return { icon: 'history', color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-surface-hover)]' };
};

export const ProjectActivity = () => {
    const { id } = useParams<{ id: string }>();
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        (async () => {
            const data = await getProjectActivity(id);
            setActivity(data);
            setLoading(false);
        })();
    }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6 fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="h2 text-[var(--color-text-main)]">Activity Log</h1>
                    <p className="text-[var(--color-text-muted)] text-sm">History of changes and updates.</p>
                </div>
                <Link to={`/project/${id}`}>
                    <button className="text-sm font-bold text-[var(--color-primary)] hover:underline">Back to Overview</button>
                </Link>
            </div>

            <Card padding="lg">
                <div className="space-y-8 relative">
                    {/* Vertical Line */}
                    <div className="absolute top-2 bottom-2 left-6 w-px bg-[var(--color-surface-border)]" />

                    {activity.length === 0 ? (
                        <p className="text-[var(--color-text-muted)] pl-12">No activity recorded yet.</p>
                    ) : (
                        activity.map((item) => {
                            const { icon, color, bg } = activityIcon(item.type, item.action);
                            return (
                                <div key={item.id} className="relative pl-12">
                                    <div className={`
                                        absolute left-1.5 top-0 size-9 rounded-full border-4 border-[var(--color-surface-paper)] 
                                        flex items-center justify-center ${bg} ${color}
                                     `}>
                                        <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[var(--color-text-main)] text-sm">{item.user}</span>
                                            <span className="text-xs text-[var(--color-text-subtle)]">• {new Date(toMillis(item.createdAt)).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-[var(--color-text-main)]">
                                            {cleanText(item.action)}
                                        </p>
                                        <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] mt-1">
                                            <p className="text-sm text-[var(--color-text-muted)]">
                                                {cleanText(item.details || item.target)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>
        </div>
    );
};
