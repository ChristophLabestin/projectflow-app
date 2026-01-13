import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Milestone } from '../../types';
import { subscribeProjectMilestones } from '../../services/dataService';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';

export const MilestoneCard = ({ projectId }: { projectId: string }) => {
    const navigate = useNavigate();
    const { dateFormat, dateLocale } = useLanguage();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = subscribeProjectMilestones(projectId, (data) => {
            setMilestones(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    // Derived states
    const total = milestones.length;
    const achieved = milestones.filter(m => m.status === 'Achieved').length;
    const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;

    // Find next pending milestone
    const nextMilestone = milestones
        .filter(m => m.status === 'Pending')
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))[0];

    const isOverdue = nextMilestone?.dueDate
        ? new Date(nextMilestone.dueDate) < new Date()
        : false;

    if (loading) {
        return (
            <div className="bg-card p-6 rounded-3xl border border-surface h-full animate-pulse">
                <div className="h-6 w-1/3 bg-surface-hover rounded mb-4" />
                <div className="h-20 bg-surface-hover rounded-xl" />
            </div>
        );
    }

    if (milestones.length === 0) {
        return (
            <div className="bg-card p-6 rounded-3xl border border-surface h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold font-display text-main">Milestones</h3>
                    <span className="material-symbols-outlined text-muted">flag</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-sm text-muted mb-3">No milestones set yet.</p>
                    <button
                        onClick={() => navigate(`/project/${projectId}/milestones`)}
                        className="text-xs font-bold text-primary hover:underline"
                    >
                        + Add Milestone
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => navigate(`/project/${projectId}/milestones`)}
            className="group bg-card p-6 rounded-3xl border border-surface h-full flex flex-col cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 relative overflow-hidden"
        >
            <div className="flex items-center justify-between mb-4 z-10 relative">
                <h3 className="text-lg font-bold font-display text-main">Milestones</h3>
                <div className="size-8 rounded-full bg-surface-hover flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </div>
            </div>

            <div className="flex-1 z-10 relative">
                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex items-end justify-between mb-1.5">
                        <span className="text-xs font-bold text-subtle uppercase tracking-wider">Progress</span>
                        <span className="text-sm font-bold text-main">{achieved}/{total}</span>
                    </div>
                    <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-surface">
                        <div
                            className="h-full bg-primary transition-all duration-500 rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Next Milestone Highlight */}
                {nextMilestone ? (
                    <div className={`p-3 rounded-xl border ${isOverdue ? 'bg-red-500/10 border-red-500/20' : 'bg-surface border-surface'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`material-symbols-outlined text-[16px] ${isOverdue ? 'text-red-500' : 'text-primary'}`}>
                                {isOverdue ? 'warning' : 'flag'}
                            </span>
                            <span className="text-xs font-bold uppercase text-subtle">Next Up</span>
                        </div>
                        <p className="text-sm font-bold text-main line-clamp-1">{nextMilestone.title}</p>
                        {nextMilestone.dueDate && (
                            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-bold' : 'text-muted'}`}>
                                Due {format(new Date(nextMilestone.dueDate), dateFormat, { locale: dateLocale })}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">All caught up!</p>
                        <p className="text-xs text-green-600/70 dark:text-green-400/70">All milestones achieved.</p>
                    </div>
                )}
            </div>

            {/* Decorative Background Icon */}
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[100px] text-[var(--color-surface-hover)] opacity-50 pointer-events-none group-hover:scale-110 transition-transform">
                flag
            </span>
        </div>
    );
};
