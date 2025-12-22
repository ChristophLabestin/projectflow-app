import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Milestone } from '../types';
import { subscribeProjectMilestones, updateMilestone, deleteMilestone } from '../services/dataService';
import { MilestoneModal } from '../components/Milestones/MilestoneModal';
import { GlobalConfirmationModal } from '../components/ui/GlobalConfirmationModal';

export const ProjectMilestones = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (t: string | null) => void }>();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined);

    // Filter state
    const [filter, setFilter] = useState<'All' | 'Pending' | 'Achieved'>('All');

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
        if (window.confirm(`Are you sure you want to delete "${milestone.title}"?`)) {
            await deleteMilestone(projectId, milestone.id);
        }
    };

    const handleStatusToggle = async (milestone: Milestone) => {
        if (!projectId) return;
        const newStatus = milestone.status === 'Achieved' ? 'Pending' : 'Achieved';
        await updateMilestone(projectId, milestone.id, { status: newStatus });
    };

    const filteredMilestones = milestones.filter(m => {
        if (filter === 'All') return true;
        return m.status === filter;
    });

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
            </div>
        );
    }

    if (!projectId) return <div>Project ID missing</div>;

    return (
        <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-fade-up h-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <span className="app-pill w-fit mb-2">Roadmap</span>
                    <h1 className="text-3xl font-display font-bold text-ink">Project Milestones</h1>
                    <p className="text-muted text-sm">Track key achievements and deadlines.</p>
                </div>
                <button
                    onClick={() => { setEditingMilestone(undefined); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-[var(--color-primary)]/20"
                >
                    <span className="material-symbols-outlined">add</span>
                    New Milestone
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 pb-2 border-b border-[var(--color-surface-border)] overflow-x-auto">
                {(['All', 'Pending', 'Achieved'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${filter === f
                                ? 'bg-[var(--color-text-main)] text-[var(--color-surface-bg)]'
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-8">
                {filteredMilestones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-[var(--color-surface-card)] rounded-3xl border border-dashed border-[var(--color-surface-border)]">
                        <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)] mb-3">flag</span>
                        <p className="text-[var(--color-text-muted)] font-medium">No milestones found.</p>
                        {filter !== 'All' && (
                            <button
                                onClick={() => setFilter('All')}
                                className="mt-2 text-sm text-[var(--color-primary)] hover:underline font-bold"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredMilestones.map((milestone) => (
                        <div
                            key={milestone.id}
                            className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all ${milestone.status === 'Achieved'
                                    ? 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] opacity-75'
                                    : 'bg-[var(--color-surface-card)] border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50 hover:shadow-md'
                                }`}
                        >
                            {/* Checkbox */}
                            <button
                                onClick={() => handleStatusToggle(milestone)}
                                className={`mt-1 size-6 rounded-full border-2 flex items-center justify-center transition-all ${milestone.status === 'Achieved'
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'border-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
                                    }`}
                            >
                                {milestone.status === 'Achieved' && <span className="material-symbols-outlined text-sm">check</span>}
                            </button>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <h3 className={`text-lg font-bold truncate ${milestone.status === 'Achieved' ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>
                                        {milestone.title}
                                    </h3>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(milestone)}
                                            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(milestone)}
                                            className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                                {milestone.description && (
                                    <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-2">{milestone.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-3">
                                    {milestone.dueDate && (
                                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${new Date(milestone.dueDate) < new Date() && milestone.status !== 'Achieved'
                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                                            }`}>
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            {new Date(milestone.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${milestone.status === 'Achieved'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : milestone.status === 'Missed'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                        {milestone.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
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
