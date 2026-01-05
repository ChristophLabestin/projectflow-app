import React, { useEffect, useState } from 'react';
import { subscribeProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { Card } from './ui/Card';
import { toMillis, timeAgo } from '../utils/time';
import { Link } from 'react-router-dom';
import { activityIcon } from '../utils/activityHelpers';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');

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
                <Link to={`/project/${projectId}/activity`} className="text-xs text-muted hover:text-primary">View History</Link>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="material-symbols-outlined animate-spin text-subtle">progress_activity</span>
                    </div>
                ) : activity.length === 0 ? (
                    <p className="text-sm text-muted text-center py-4">No recent activity.</p>
                ) : (
                    activity.slice(0, 10).map((item, idx) => {
                        const { icon, color, bg } = activityIcon(item.type, item.action);
                        return (
                            <div key={item.id} className="flex gap-3 relative group">
                                {idx !== activity.length - 1 && <div className="absolute left-3.5 top-8 bottom-[-16px] w-px bg-surface-border group-last:hidden" />}
                                <div className={`size-7 rounded-full shrink-0 flex items-center justify-center ${bg} ${color}`}>
                                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                </div>
                                <div className="space-y-0.5 pb-1 min-w-0">
                                    <p className="text-sm text-main leading-snug truncate">
                                        <span className="font-semibold">{item.user}</span> <span className="text-muted">{item.action}</span>
                                    </p>
                                    <p className="text-xs text-subtle">{timeAgo(item.createdAt)}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Card>
    );
};
