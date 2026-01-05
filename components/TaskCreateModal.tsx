import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { addTask, getProjectCategories, getProjectTasks, createSubTask } from '../services/dataService';
import { IdeaGroup, Task, TaskCategory, TaskStatus } from '../types';
import { generateProjectDescription } from '../services/geminiService';
import { Button } from './ui/Button';
import { DatePicker } from './ui/DatePicker';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { usePinnedTasks, PinnedItem } from '../context/PinnedTasksContext';
import { ProjectLabelsModal } from './ProjectLabelsModal';
import { useLanguage } from '../context/LanguageContext';

type Props = {
    projectId: string;
    tenantId?: string;
    onClose: () => void;
    onCreated?: (tasks: Task[], categories: TaskCategory[]) => void;
};

export const TaskCreateModal: React.FC<Props> = ({ projectId, tenantId, onClose, onCreated }) => {
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<Task['priority']>('Medium');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<IdeaGroup[]>([]);
    const [status, setStatus] = useState<TaskStatus>('Open');
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<TaskCategory[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [pinOnCreate, setPinOnCreate] = useState(false);
    const [subtasks, setSubtasks] = useState<string[]>([]);
    const [newSubtask, setNewSubtask] = useState('');
    const [showLabelsModal, setShowLabelsModal] = useState(false);
    const { t } = useLanguage();

    const handleTitleChange = useArrowReplacement((e) => setTitle(e.target.value));
    const handleDescriptionChange = useArrowReplacement((e) => setDescription(e.target.value));
    const handleSubtaskChange = useArrowReplacement((e) => setNewSubtask(e.target.value));

    const { pinItem } = usePinnedTasks();

    useEffect(() => {
        (async () => {
            try {
                const [catData, taskData] = await Promise.all([
                    getProjectCategories(projectId, tenantId),
                    getProjectTasks(projectId, tenantId)
                ]);
                setCategories(catData);
                setTasks(taskData);
            } catch (err) {
                console.error('Failed to load data for task modal', err);
            }
        })();
    }, [projectId, tenantId]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const categoryOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...categories.map((c) => c.name.trim()),
                    ...tasks.flatMap((t) => {
                        const cats = Array.isArray(t.category) ? t.category : [t.category || ''];
                        return cats.map((c) => (c || '').trim());
                    })
                ].filter(Boolean))
            ),
        [categories, tasks]
    );

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;
        setIsAdding(true);
        setError(null);
        try {
            const categoriesToSave = Array.from(
                new Set([...selectedCategories])
            );

            // Create the task first
            const newTaskId = await addTask(projectId, title.trim(), dueDate || undefined, undefined, priority, {
                description,
                category: categoriesToSave.length ? categoriesToSave : undefined,
                status,
                assigneeIds,
                assignedGroupIds
            }, tenantId);

            // Create subtasks if any using createSubTask
            if (subtasks.length > 0 && newTaskId) {
                for (const subtaskTitle of subtasks) {
                    if (subtaskTitle.trim()) {
                        await createSubTask(projectId, newTaskId, subtaskTitle.trim(), undefined, tenantId);
                    }
                }
            }

            // Pin the task if checkbox is checked
            if (pinOnCreate && newTaskId) {
                const newPinnedItem: PinnedItem = {
                    id: newTaskId,
                    type: 'task',
                    title: title.trim(),
                    projectId,
                    priority
                };
                pinItem(newPinnedItem);
            }

            const [refreshedTasks, refreshedCategories] = await Promise.all([
                getProjectTasks(projectId, tenantId),
                getProjectCategories(projectId, tenantId)
            ]);
            onCreated?.(refreshedTasks, refreshedCategories);
            onClose();
        } catch (err) {
            console.error('Failed to add task', err);
            setError(t('taskCreate.errors.createFailed'));
        } finally {
            setIsAdding(false);
        }
    };

    const handleGenerateDescription = async () => {
        if (!title.trim()) return;
        setIsGeneratingDesc(true);
        try {
            const desc = await generateProjectDescription(title, description || 'Task details');
            setDescription(desc.slice(0, 280));
        } catch (err) {
            console.error('Failed to generate description', err);
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    const handleAddSubtask = () => {
        if (newSubtask.trim()) {
            setSubtasks(prev => [...prev, newSubtask.trim()]);
            setNewSubtask('');
        }
    };

    const handleRemoveSubtask = (index: number) => {
        setSubtasks(prev => prev.filter((_, i) => i !== index));
    };

    const priorityConfig: Record<string, { color: string; bg: string }> = {
        Urgent: { color: 'text-rose-500', bg: 'bg-rose-500/10' },
        High: { color: 'text-orange-500', bg: 'bg-orange-500/10' },
        Medium: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
        Low: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    };

    const priorityLabels: Record<string, string> = {
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low'),
    };

    const statusLabels: Record<string, string> = {
        Backlog: t('tasks.status.backlog'),
        Open: t('tasks.status.open'),
        'In Progress': t('tasks.status.inProgress'),
        'On Hold': t('tasks.status.onHold'),
        Blocked: t('tasks.status.blocked'),
        Done: t('tasks.status.done'),
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm px-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-card rounded-2xl shadow-2xl border border-surface animate-scale-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit}>
                    {/* Title Input - Large like Idea Modal */}
                    <div className="px-6 pt-6 pb-4">
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder={t('tasks.quickAdd.placeholder')}
                            autoFocus
                            maxLength={100}
                            className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-main placeholder:text-muted/50"
                        />
                    </div>

                    {/* Toolbar Row */}
                    <div className="px-6 pb-4 flex items-center gap-1 flex-wrap">
                        {/* Priority Dropdown */}
                        <div className="relative group">
                            <button
                                type="button"
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-surface-hover ${priorityConfig[priority].color}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">flag</span>
                                {priorityLabels[priority] || priority}
                                <span className="material-symbols-outlined text-[14px] opacity-50">expand_more</span>
                            </button>
                            <div className="absolute left-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all bg-card border border-surface rounded-lg shadow-xl py-1 min-w-[120px] z-10">
                                {(['Urgent', 'High', 'Medium', 'Low'] as const).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 hover:bg-surface-hover ${priority === p ? priorityConfig[p].color : 'text-main'}`}
                                    >
                                        <span className={`size-2 rounded-full ${priorityConfig[p].bg} ${priorityConfig[p].color.replace('text-', 'bg-')}`} />
                                        {priorityLabels[p] || p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Status Dropdown */}
                        <div className="relative group">
                            <button
                                type="button"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-main"
                            >
                                <span className="material-symbols-outlined text-[16px]">radio_button_unchecked</span>
                                {statusLabels[status] || status}
                                <span className="material-symbols-outlined text-[14px] opacity-50">expand_more</span>
                            </button>
                            <div className="absolute left-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all bg-card border border-surface rounded-lg shadow-xl py-1 min-w-[130px] z-10">
                                {(['Backlog', 'Open', 'In Progress', 'On Hold', 'Blocked', 'Done'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={`w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-surface-hover ${status === s ? 'text-primary' : 'text-main'}`}
                                    >
                                        {statusLabels[s] || s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-4 bg-surface-border mx-1" />

                        {/* Categories */}
                        {selectedCategories.map(catName => {
                            const catData = categories.find(c => c.name === catName);
                            const color = catData?.color || '#64748b';
                            return (
                                <span
                                    key={catName}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider shadow-sm"
                                    style={{ backgroundColor: color }}
                                >
                                    {catName}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCategories(prev => prev.filter(x => x !== catName))}
                                        className="hover:text-rose-200 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">close</span>
                                    </button>
                                </span>
                            );
                        })}

                        {/* Add Category */}
                        <div className="relative group">
                            <button
                                type="button"
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-main hover:bg-surface-hover transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">sell</span>
                                {t('taskCreate.labels.button')}
                            </button>
                            <div className="absolute left-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all bg-card border border-surface rounded-lg shadow-xl py-1 min-w-[160px] z-10 max-h-[250px] overflow-y-auto">
                                <div className="px-2 py-1 mb-1 border-b border-surface">
                                    <button
                                        type="button"
                                        onClick={() => setShowLabelsModal(true)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase text-primary hover:bg-[var(--color-accent)]/10 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">settings</span>
                                        {t('taskCreate.labels.manage')}
                                    </button>
                                </div>
                                {categoryOptions.filter(c => !selectedCategories.includes(c)).map(c => {
                                    const catData = categories.find(cat => cat.name === c);
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setSelectedCategories(prev => [...prev, c])}
                                            className="w-full px-3 py-1.5 text-left text-xs font-medium text-main hover:bg-surface-hover flex items-center gap-2"
                                        >
                                            <div className="size-2 rounded-full" style={{ backgroundColor: catData?.color || '#64748b' }} />
                                            {c}
                                        </button>
                                    );
                                })}
                                {categoryOptions.filter(c => !selectedCategories.includes(c)).length === 0 && (
                                    <div className="px-3 py-2 text-[10px] text-muted italic text-center">
                                        {t('taskCreate.labels.empty')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="px-6 pb-4">
                        <textarea
                            value={description}
                            onChange={handleDescriptionChange}
                            placeholder={t('taskCreate.description.placeholder')}
                            rows={2}
                            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-surface text-sm text-main placeholder:text-muted outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
                        />
                        {title && (
                            <button
                                type="button"
                                onClick={handleGenerateDescription}
                                disabled={isGeneratingDesc}
                                className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50"
                            >
                                {isGeneratingDesc ? (
                                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                )}
                                {t('taskCreate.description.generate')}
                            </button>
                        )}
                    </div>

                    {/* Subtasks Section */}
                    <div className="px-6 pb-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted uppercase tracking-wider">{t('taskCreate.subtasks.title')}</label>

                            {/* Existing subtasks */}
                            {subtasks.length > 0 && (
                                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                                    {subtasks.map((subtask, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group">
                                            <span className="material-symbols-outlined text-[16px] text-muted">check_box_outline_blank</span>
                                            <span className="flex-1 text-sm text-main">{subtask}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSubtask(idx)}
                                                className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add new subtask */}
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-muted">add</span>
                                <input
                                    type="text"
                                    value={newSubtask}
                                    onChange={handleSubtaskChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddSubtask();
                                        }
                                    }}
                                    placeholder={t('taskCreate.subtasks.placeholder')}
                                    className="flex-1 text-sm bg-transparent border-none outline-none text-main placeholder:text-muted"
                                />
                                {newSubtask && (
                                    <button
                                        type="button"
                                        onClick={handleAddSubtask}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        {t('common.add')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Due Date & Assignees - 2 Columns */}
                    <div className="px-6 pb-4 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted uppercase tracking-wider">{t('taskCreate.dueDate.label')}</label>
                            <DatePicker
                                value={dueDate}
                                onChange={setDueDate}
                                placeholder={t('taskCreate.dueDate.placeholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted uppercase tracking-wider">{t('taskCreate.assignees.label')}</label>
                            <MultiAssigneeSelector
                                projectId={projectId}
                                assigneeIds={assigneeIds}
                                assignedGroupIds={assignedGroupIds}
                                onChange={setAssigneeIds}
                                onGroupChange={setAssignedGroupIds}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-6 mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-surface flex items-center justify-between bg-surface/50">
                        <span className="text-xs text-muted flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-surface-hover font-mono text-[10px]">⌘</kbd>
                            <span>+</span>
                            <kbd className="px-1.5 py-0.5 rounded bg-surface-hover font-mono text-[10px]">↵</kbd>
                            <span className="ml-1">{t('taskCreate.footer.toCreate')}</span>
                        </span>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                                {t('common.cancel')}
                            </Button>

                            {/* Pin on Create Toggle */}
                            <button
                                type="button"
                                onClick={() => setPinOnCreate(!pinOnCreate)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pinOnCreate
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    : 'text-muted hover:bg-surface-hover hover:text-main'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{pinOnCreate ? 'keep' : 'keep_off'}</span>
                                
                            </button>

                            <Button type="submit" size="sm" isLoading={isAdding} disabled={!title.trim()}>
                                {t('taskCreate.actions.create')}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {showLabelsModal && (
                <ProjectLabelsModal
                    isOpen={showLabelsModal}
                    onClose={() => setShowLabelsModal(false)}
                    projectId={projectId}
                    tenantId={tenantId}
                    onLabelsChange={async () => {
                        const catData = await getProjectCategories(projectId, tenantId);
                        setCategories(catData);
                    }}
                />
            )}
        </div>,
        document.body
    );
};
