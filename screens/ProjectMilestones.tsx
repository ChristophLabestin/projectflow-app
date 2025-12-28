import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Milestone } from '../types';
import { MilestoneModal } from '../components/Milestones/MilestoneModal';
import { useConfirm } from '../context/UIContext';
import { subscribeProjectMilestones, deleteMilestone, updateMilestone } from '../services/dataService';
import { toMillis } from '../utils/time';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const ProjectMilestones = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (t: string | null) => void }>();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined);
    const confirm = useConfirm();

    useEffect(() => {
        setTaskTitle('Milestones');
        if (!projectId) return;

        const unsub = subscribeProjectMilestones(projectId, (data) => {
            setMilestones(data);
            setLoading(false);
        });

        return () => {
            unsub();
            setTaskTitle(null);
        };
    }, [projectId, setTaskTitle]);

    const handleEdit = (milestone: Milestone) => {
        setEditingMilestone(milestone);
        setIsModalOpen(true);
    };

    const handleDelete = async (milestone: Milestone) => {
        if (!projectId) return;
        if (await confirm("Delete Milestone", `Are you sure you want to delete "${milestone.title}"?`)) {
            await deleteMilestone(projectId, milestone.id);
        }
    };

    const handleStatusToggle = async (milestone: Milestone) => {
        if (!projectId) return;
        const newStatus = milestone.status === 'Achieved' ? 'Pending' : 'Achieved';

        // Optimistic update for better UX
        const optimisticMilestones = milestones.map(m =>
            m.id === milestone.id ? { ...m, status: newStatus as any } : m
        );
        setMilestones(optimisticMilestones);

        await updateMilestone(projectId, milestone.id, { status: newStatus });
    };

    // Derived State
    const stats = useMemo(() => {
        const total = milestones.length;
        const achieved = milestones.filter(m => m.status === 'Achieved').length;
        const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;
        return { total, achieved, progress };
    }, [milestones]);

    const sortedMilestones = useMemo(() => {
        return [...milestones].sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
            return dateA - dateB;
        });
    }, [milestones]);

    const nextPendingIndex = sortedMilestones.findIndex(m => m.status === 'Pending');

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    if (!projectId) return <div>Project ID missing</div>;

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col gap-8 pb-20 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Roadmap
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-[var(--color-text-main)] mb-2">
                        Project Milestones
                    </h1>
                    <p className="text-[var(--color-text-muted)] max-w-xl">
                        Track your journey from start to finish. Visualize key achievements and upcoming deadlines in a unified timeline.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Mini Stat Card */}
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <div className="text-2xl font-bold text-[var(--color-text-main)]">
                            {stats.achieved} <span className="text-[var(--color-text-subtle)] text-lg">/ {stats.total}</span>
                        </div>
                        <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                            Milestones Achieved
                        </div>
                    </div>

                    <Button
                        onClick={() => { setEditingMilestone(undefined); setIsModalOpen(true); }}
                        variant="primary"
                        className="shadow-lg shadow-indigo-500/20"
                        icon={<span className="material-symbols-outlined">add</span>}
                    >
                        New Milestone
                    </Button>
                </div>
            </div>

            {/* Progress Bar (Visual Header) */}
            <Card padding="none" className="overflow-hidden relative h-2">
                <div className="absolute inset-0 bg-[var(--color-surface-hover)] w-full h-full" />
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out"
                    style={{ width: `${stats.progress}%` }}
                />
            </Card>

            {/* Timeline View */}
            <div className="relative pl-4 md:pl-0 mt-4">
                {/* Vertical Line */}
                <div className="absolute left-[27px] md:left-1/2 top-4 bottom-10 w-0.5 bg-[var(--color-surface-border)] -translate-x-1/2 hidden md:block" />
                <div className="absolute left-[27px] top-4 bottom-10 w-0.5 bg-[var(--color-surface-border)] -translate-x-1/2 md:hidden" />

                <div className="space-y-12">
                    {sortedMilestones.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="size-20 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)] opacity-50">map</span>
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">No milestones yet</h3>
                            <p className="text-[var(--color-text-muted)] max-w-xs mx-auto mb-6">
                                Start planning your project journey by adding your first milestone.
                            </p>
                            <Button
                                onClick={() => { setEditingMilestone(undefined); setIsModalOpen(true); }}
                                variant="outline"
                            >
                                add your first milestone
                            </Button>
                        </div>
                    ) : (
                        sortedMilestones.map((milestone, index) => {
                            const isPending = milestone.status === 'Pending';
                            const isAchieved = milestone.status === 'Achieved';
                            const isNextUp = index === nextPendingIndex;
                            const isPast = index < nextPendingIndex && isAchieved;

                            // Alternate sides for desktop
                            const isLeft = index % 2 === 0;

                            return (
                                <div key={milestone.id} className={`relative flex items-center md:justify-center group ${isAchieved ? 'opacity-70 hover:opacity-100 transition-opacity' : ''}`}>

                                    {/* Timeline Marker (Center) */}
                                    <div className={`
                                        absolute left-[27px] md:left-1/2 -translate-x-1/2 z-10 
                                        size-8 rounded-full border-4 flex items-center justify-center shadow-sm transition-all duration-300
                                        ${isAchieved
                                            ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900 text-white scale-90'
                                            : isNextUp
                                                ? 'bg-white dark:bg-[var(--color-surface-card)] border-indigo-500 text-indigo-500 scale-110 shadow-indigo-500/30'
                                                : 'bg-white dark:bg-[var(--color-surface-card)] border-[var(--color-surface-border)] text-[var(--color-text-subtle)]'
                                        }
                                    `}>
                                        <span className="material-symbols-outlined text-[14px] font-bold">
                                            {isAchieved ? 'check' : isNextUp ? 'near_me' : 'radio_button_unchecked'}
                                        </span>
                                    </div>

                                    {/* Content Card */}
                                    <div className={`
                                        ml-16 md:ml-0 w-full md:w-[45%] 
                                        ${isLeft ? 'md:mr-auto md:pr-12 md:text-right' : 'md:ml-auto md:pl-12 md:text-left'}
                                    `}>
                                        <Card
                                            padding="none"
                                            className={`
                                                relative overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg
                                                ${isNextUp
                                                    ? 'ring-2 ring-indigo-500/20 border-indigo-500/50 shadow-md'
                                                    : 'border-[var(--color-surface-border)]'
                                                }
                                            `}
                                        >
                                            <div className="p-5">
                                                <div className={`flex items-start gap-4 ${isLeft ? 'md:flex-row-reverse' : ''}`}>

                                                    {/* Date Badge */}
                                                    <div className={`
                                                        flex flex-col items-center justify-center p-2 rounded-xl shrink-0 min-w-[60px]
                                                        ${isNextUp
                                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                            : isAchieved
                                                                ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-500'
                                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                                                        }
                                                    `}>
                                                        {milestone.dueDate ? (
                                                            <>
                                                                <span className="text-xs uppercase font-bold tracking-wider opacity-70">
                                                                    {new Date(milestone.dueDate).toLocaleDateString(undefined, { month: 'short' })}
                                                                </span>
                                                                <span className="text-xl font-bold leading-none">
                                                                    {new Date(milestone.dueDate).getDate()}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="material-symbols-outlined">event</span>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className={`flex items-center gap-2 mb-1 ${isLeft ? 'md:justify-end' : ''}`}>
                                                            {isNextUp && (
                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 animate-pulse">
                                                                    Next Milestone
                                                                </span>
                                                            )}
                                                            {isAchieved && (
                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                                                    Completed
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h3 className={`text-lg font-bold mb-1 ${isAchieved ? 'text-[var(--color-text-muted)] decoration-slice' : 'text-[var(--color-text-main)]'}`}>
                                                            {milestone.title}
                                                        </h3>

                                                        {milestone.description && (
                                                            <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                                                                {milestone.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Actions Footer */}
                                                <div className={`mt-4 pt-3 border-t border-[var(--color-surface-border)] flex items-center gap-2 ${isLeft ? 'md:flex-row-reverse' : ''}`}>
                                                    <Button
                                                        size="sm"
                                                        variant={isAchieved ? "outline" : "primary"}
                                                        className={isAchieved ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" : ""}
                                                        onClick={() => handleStatusToggle(milestone)}
                                                    >
                                                        {isAchieved ? 'Mark Incomplete' : 'Achieve Milestone'}
                                                    </Button>
                                                    <div className="flex-1" />
                                                    <button
                                                        onClick={() => handleEdit(milestone)}
                                                        className="p-1.5 text-[var(--color-text-muted)] hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(milestone)}
                                                        className="p-1.5 text-[var(--color-text-muted)] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Status Stripe */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isAchieved ? 'bg-emerald-500' : isNextUp ? 'bg-indigo-500' : 'bg-transparent'
                                                }`} />
                                        </Card>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <MilestoneModal
                projectId={projectId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                milestone={editingMilestone}
            />
        </div>
    );
};
