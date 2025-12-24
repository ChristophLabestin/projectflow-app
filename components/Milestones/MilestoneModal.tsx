import React, { useState, useEffect } from 'react';
import { Milestone } from '../../types';
import { createMilestone, updateMilestone } from '../../services/dataService';

interface MilestoneModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    milestone?: Milestone; // If provided, we are in edit mode
}

export const MilestoneModal = ({ projectId, isOpen, onClose, milestone }: MilestoneModalProps) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<'Pending' | 'Achieved' | 'Missed'>('Pending');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (milestone) {
                setTitle(milestone.title);
                setDescription(milestone.description || '');
                setDueDate(milestone.dueDate || '');
                setStatus(milestone.status);
            } else {
                // Reset for create mode
                setTitle('');
                setDescription('');
                setDueDate('');
                setStatus('Pending');
            }
        }
    }, [isOpen, milestone]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (milestone) {
                await updateMilestone(projectId, milestone.id, {
                    title,
                    description,
                    dueDate,
                    status
                });
            } else {
                await createMilestone(projectId, {
                    title,
                    description,
                    dueDate,
                    status
                });
            }
            onClose();
        } catch (error) {
            console.error('Failed to save milestone', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-up ring-1 ring-white/10">
                <div className="px-6 py-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-hover)]/30">
                    <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                        {milestone ? 'Edit Milestone' : 'New Milestone'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                            placeholder="e.g. MVP Release"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all resize-none h-24"
                            placeholder="Optional description..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Due Date
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    {milestone && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                                Status
                            </label>
                            <div className="flex bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg p-1">
                                {(['Pending', 'Achieved', 'Missed'] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${status === s
                                                ? 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] shadow-sm'
                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            {milestone ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
