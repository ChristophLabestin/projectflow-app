import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/Button';
import { createIssue } from '../services/dataService';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { usePinnedTasks, PinnedItem } from '../context/PinnedTasksContext';

interface CreateIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    initialDescription?: string;
    initialTitle?: string;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
    isOpen,
    onClose,
    projectId,
    initialDescription = '',
    initialTitle = ''
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
    const [status, setStatus] = useState<'Open' | 'In Progress' | 'Resolved' | 'Closed'>('Open');
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [pinOnCreate, setPinOnCreate] = useState(false);

    const { pinItem } = usePinnedTasks();

    useEffect(() => {
        if (isOpen) {
            setTitle(initialTitle || '');
            setDescription(initialDescription || '');
            setPriority('Medium');
            setStatus('Open');
            setAssigneeIds([]);
            setPinOnCreate(false);
        }
    }, [isOpen, initialTitle, initialDescription]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;
        setIsAdding(true);
        try {
            const newIssueId = await createIssue(projectId, {
                title: title.trim(),
                description,
                priority,
                status,
                assigneeIds,
                assignedGroupIds
            });

            // Pin the issue if checkbox is checked
            if (pinOnCreate && newIssueId) {
                const newPinnedItem: PinnedItem = {
                    id: newIssueId,
                    type: 'issue',
                    title: title.trim(),
                    projectId,
                    priority
                };
                pinItem(newPinnedItem);
            }

            onClose();
        } catch (error) {
            console.error('Failed to create issue', error);
        } finally {
            setIsAdding(false);
        }
    };

    const priorityConfig: Record<string, { color: string; bg: string }> = {
        Urgent: { color: 'text-rose-500', bg: 'bg-rose-500/10' },
        High: { color: 'text-orange-500', bg: 'bg-orange-500/10' },
        Medium: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
        Low: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm px-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-surface-border)] animate-scale-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit}>
                    {/* Title Input - Large like Task Modal */}
                    <div className="px-6 pt-6 pb-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What's the issue?"
                            autoFocus
                            maxLength={100}
                            className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/50"
                        />
                    </div>

                    {/* Toolbar Row */}
                    <div className="px-6 pb-4 flex items-center gap-1 flex-wrap">
                        {/* Priority Dropdown */}
                        <div className="relative group">
                            <button
                                type="button"
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--color-surface-hover)] ${priorityConfig[priority].color}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">flag</span>
                                {priority}
                                <span className="material-symbols-outlined text-[14px] opacity-50">expand_more</span>
                            </button>
                            <div className="absolute left-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg shadow-xl py-1 min-w-[120px] z-10">
                                {(['Urgent', 'High', 'Medium', 'Low'] as const).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 hover:bg-[var(--color-surface-hover)] ${priority === p ? priorityConfig[p].color : 'text-[var(--color-text-main)]'}`}
                                    >
                                        <span className={`size-2 rounded-full ${priorityConfig[p].bg} ${priorityConfig[p].color.replace('text-', 'bg-')}`} />
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Status Dropdown */}
                        <div className="relative group">
                            <button
                                type="button"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]"
                            >
                                <span className="material-symbols-outlined text-[16px]">radio_button_unchecked</span>
                                {status}
                                <span className="material-symbols-outlined text-[14px] opacity-50">expand_more</span>
                            </button>
                            <div className="absolute left-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg shadow-xl py-1 min-w-[130px] z-10">
                                {(['Open', 'In Progress', 'Resolved', 'Closed'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={`w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-[var(--color-surface-hover)] ${status === s ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-main)]'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="px-6 pb-4">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the issue in detail..."
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
                        />
                    </div>

                    {/* Assignees */}
                    <div className="px-6 pb-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Assignees</label>
                            <MultiAssigneeSelector
                                projectId={projectId}
                                assigneeIds={assigneeIds}
                                assignedGroupIds={assignedGroupIds}
                                onChange={setAssigneeIds}
                                onGroupChange={setAssignedGroupIds}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-bg)]/50">
                        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] font-mono text-[10px]">⌥</kbd>
                            <span>+</span>
                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] font-mono text-[10px]">B</kbd>
                            <span className="ml-1">to toggle</span>
                        </span>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                                Cancel
                            </Button>

                            {/* Pin on Create Toggle */}
                            <button
                                type="button"
                                onClick={() => setPinOnCreate(!pinOnCreate)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pinOnCreate
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{pinOnCreate ? 'keep' : 'keep_off'}</span>
                                Pin on Create
                            </button>

                            <Button type="submit" size="sm" isLoading={isAdding} disabled={!title.trim()}>
                                Create Issue
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
