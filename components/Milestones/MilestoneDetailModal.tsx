import React from 'react';
import { Milestone } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';

interface MilestoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    milestone?: Milestone;
    onEdit: (milestone: Milestone) => void;
    taskStatusLookup: Record<string, { isCompleted: boolean; hasSubtasks: boolean; dueDate?: string; priority?: string }>;
    subtaskLookup: Record<string, { total: number; completed: number }>;
    ideaLookup: Record<string, string>;
}

export const MilestoneDetailModal = ({
    isOpen,
    onClose,
    milestone,
    onEdit,
    taskStatusLookup,
    subtaskLookup,
    ideaLookup
}: MilestoneDetailModalProps) => {
    const { dateLocale } = useLanguage();

    if (!isOpen || !milestone) return null;

    // Calculate Risk (Same logic as in ProjectMilestones to be consistent)
    const getMilestoneRisk = () => {
        if (milestone.status === 'Achieved') return 'Low';

        const now = new Date();
        const dueDate = milestone.dueDate ? new Date(milestone.dueDate) : null;

        // 1. Overdue = High Risk
        if (dueDate && dueDate < now) return 'High';

        // Link Tasks Progress
        let totalProgress = 0;
        if (milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0) {
            milestone.linkedTaskIds.forEach(tid => {
                const sub = subtaskLookup[tid];
                if (sub && sub.total > 0) {
                    totalProgress += (sub.completed / sub.total);
                } else {
                    const taskData = taskStatusLookup[tid];
                    if (taskData && taskData.isCompleted) {
                        totalProgress += 1;
                    }
                }
            });
        }
        const progress = milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0
            ? Math.round((totalProgress / milestone.linkedTaskIds.length) * 100)
            : 0;

        // 2. Time Criticality
        if (dueDate) {
            const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3 && progress < 50) return 'High';
            if (diffDays <= 7 && progress < 70) return 'Medium';
        }

        // 3. Task Priorities
        let hasUrgent = false;
        let hasHigh = false;
        milestone.linkedTaskIds?.forEach(tid => {
            const task = taskStatusLookup[tid];
            if (task && !task.isCompleted) {
                if (task.priority === 'Urgent') hasUrgent = true;
                if (task.priority === 'High') hasHigh = true;
            }
        });

        if (hasUrgent) return 'High';
        if (hasHigh) return 'Medium';

        return 'Low';
    };

    const risk = getMilestoneRisk();
    const isAchieved = milestone.status === 'Achieved';

    // Helper to get task title (we only have lookup for status/priority currently, not title in the lookup passed from parent. 
    // Parent only fetches status lookup? 
    // Wait, ProjectMilestones.tsx `taskStatusLookup` only stores boolean/priority/date. It DOES NOT store title.
    // If I want to list tasks names, I need them. 
    // `availableTasks` in MilestoneModal fetches them. 
    // ProjectMilestones doesn't seem to fetch all task TITLES for the whole project into a lookup?
    // It has `tasksQ` snapshot but only maps status.
    // I should update ProjectMilestones to include title in `taskStatusLookup` or separate `taskLookup`.

    // For now, I'll update `ProjectMilestones` to include title in the lookup, 
    // so I can display it here.

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-up ring-1 ring-white/10 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-hover)]/30">
                    <div className="flex items-center gap-3">
                        <Badge variant={isAchieved ? 'success' : 'neutral'}>
                            {milestone.status}
                        </Badge>
                        {risk !== 'Low' && !isAchieved && (
                            <Badge variant={risk === 'High' ? 'danger' : 'warning'}>
                                {risk} Risk
                            </Badge>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2 font-display">
                            {milestone.title}
                        </h2>
                        {milestone.description && (
                            <p className="text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                                {milestone.description}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[var(--color-surface-bg)] rounded-xl p-4 border border-[var(--color-surface-border)]">
                            <h4 className="text-xs font-bold uppercase text-[var(--color-text-subtle)] mb-2 tracking-wider">Due Date</h4>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-primary)]">calendar_today</span>
                                <span className="text-[var(--color-text-main)] font-medium">
                                    {milestone.dueDate
                                        ? format(new Date(milestone.dueDate), 'MMMM do, yyyy', { locale: dateLocale })
                                        : 'No due date set'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-[var(--color-surface-bg)] rounded-xl p-4 border border-[var(--color-surface-border)]">
                            <h4 className="text-xs font-bold uppercase text-[var(--color-text-subtle)] mb-2 tracking-wider">Linked Initiative</h4>
                            {milestone.linkedInitiativeId ? (
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-500">rocket_launch</span>
                                    <span className="text-[var(--color-text-main)] font-medium truncate">
                                        {ideaLookup[milestone.linkedInitiativeId] || 'Unknown Initiative'}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[var(--color-text-muted)] text-sm">No initiative linked</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined">task</span>
                            Linked Tasks ({milestone.linkedTaskIds?.length || 0})
                        </h3>

                        {milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0 ? (
                            <div className="space-y-2">
                                {milestone.linkedTaskIds.map(tid => {
                                    const task = taskStatusLookup[tid];
                                    const sub = subtaskLookup[tid];
                                    // Note: task.title is needed here. see previous comment.
                                    // I will assume for this step that taskStatusLookup has title, and I will add it to ProjectMilestones next.
                                    const title = (task as any)?.title || 'Task details unavailable';
                                    const isDone = task?.isCompleted;

                                    return (
                                        <div key={tid} className="flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)]">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--color-text-muted)]'}`}>
                                                    {isDone && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                                                </div>
                                                <span className={`text-sm truncate ${isDone ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>
                                                    {title}
                                                </span>
                                            </div>
                                            {sub && sub.total > 0 && (
                                                <span className="text-xs text-[var(--color-text-muted)] shrink-0 bg-[var(--color-surface-hover)] px-2 py-1 rounded">
                                                    {sub.completed}/{sub.total} subtasks
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-[var(--color-text-muted)] text-sm italic">No tasks linked to this milestone.</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--color-surface-border)] flex justify-end gap-3 bg-[var(--color-surface-hover)]/30">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            onClose();
                            onEdit(milestone);
                        }}
                        icon={<span className="material-symbols-outlined">edit</span>}
                    >
                        Edit Milestone
                    </Button>
                </div>
            </div>
        </div>
    );
};
