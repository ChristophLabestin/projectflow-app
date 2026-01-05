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
            className="modal-overlay"
            onClick={onClose}
        >
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit} className="task-create-form">
                    {/* Title Input */}
                    <div className="title-input-section">
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder={t('tasks.quickAdd.placeholder')}
                            autoFocus
                            maxLength={100}
                        />
                    </div>

                    {/* Toolbar Row */}
                    <div className="toolbar-row">
                        {/* Priority Dropdown */}
                        <div className="dropdown-group group">
                            <button
                                type="button"
                                className={`trigger-btn ${priorityConfig[priority].color}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">flag</span>
                                {priorityLabels[priority] || priority}
                                <span className="material-symbols-outlined chevron">expand_more</span>
                            </button>
                            <div className="dropdown-menu">
                                {(['Urgent', 'High', 'Medium', 'Low'] as const).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={priority === p ? priorityConfig[p].color : ''}
                                    >
                                        <span className={`size-2 rounded-full ${priorityConfig[p].bg} ${priorityConfig[p].color.replace('text-', 'bg-')}`} />
                                        {priorityLabels[p] || p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Status Dropdown */}
                        <div className="dropdown-group group">
                            <button
                                type="button"
                                className="trigger-btn text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                            >
                                <span className="material-symbols-outlined text-[16px]">radio_button_unchecked</span>
                                {statusLabels[status] || status}
                                <span className="material-symbols-outlined chevron">expand_more</span>
                            </button>
                            <div className="dropdown-menu">
                                {(['Backlog', 'Open', 'In Progress', 'On Hold', 'Blocked', 'Done'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={status === s ? 'text-[var(--color-accent)]' : ''}
                                    >
                                        {statusLabels[s] || s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="divider" />

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
                        <div className="dropdown-group group">
                            <button
                                type="button"
                                className="trigger-btn text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                            >
                                <span className="material-symbols-outlined text-[14px]">sell</span>
                                {t('taskCreate.labels.button')}
                            </button>
                            <div className="dropdown-menu">
                                <div className="p-1 border-b border-[var(--color-surface-border)] mb-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowLabelsModal(true)}
                                        className="text-[var(--color-accent)] font-bold uppercase"
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
                                        >
                                            <div className="size-2 rounded-full" style={{ backgroundColor: catData?.color || '#64748b' }} />
                                            {c}
                                        </button>
                                    );
                                })}
                                {categoryOptions.filter(c => !selectedCategories.includes(c)).length === 0 && (
                                    <div className="p-2 text-[10px] text-[var(--color-text-muted)] italic text-center">
                                        {t('taskCreate.labels.empty')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="description-section">
                        <textarea
                            value={description}
                            onChange={handleDescriptionChange}
                            placeholder={t('taskCreate.description.placeholder')}
                            rows={2}
                        />
                        {title && (
                            <button
                                type="button"
                                onClick={handleGenerateDescription}
                                disabled={isGeneratingDesc}
                                className="generate-btn"
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
                    <div className="subtasks-section">
                        <div className="space-y-2">
                            <label className="section-label">{t('taskCreate.subtasks.title')}</label>

                            {/* Existing subtasks */}
                            {subtasks.length > 0 && (
                                <div className="subtask-list">
                                    {subtasks.map((subtask, idx) => (
                                        <div key={idx} className="subtask-item group">
                                            <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">check_box_outline_blank</span>
                                            <span className="flex-1 text-sm text-[var(--color-text-main)]">{subtask}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSubtask(idx)}
                                                className="remove-btn"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add new subtask */}
                            <div className="add-subtask-row">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">add</span>
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
                                />
                                {newSubtask && (
                                    <button
                                        type="button"
                                        onClick={handleAddSubtask}
                                        className="text-xs text-[var(--color-accent)] hover:underline"
                                    >
                                        {t('common.add')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Due Date & Assignees - 2 Columns */}
                    <div className="fields-grid">
                        <div className="space-y-2">
                            <label className="section-label">{t('taskCreate.dueDate.label')}</label>
                            <DatePicker
                                value={dueDate}
                                onChange={setDueDate}
                                placeholder={t('taskCreate.dueDate.placeholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="section-label">{t('taskCreate.assignees.label')}</label>
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
                    <div className="modal-footer">
                        <span className="keyboard-hints">
                            <kbd>⌘</kbd>
                            <span>+</span>
                            <kbd>↵</kbd>
                            <span className="ml-1">{t('taskCreate.footer.toCreate')}</span>
                        </span>
                        <div className="actions">
                            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                                {t('common.cancel')}
                            </Button>

                            {/* Pin on Create Toggle */}
                            <button
                                type="button"
                                onClick={() => setPinOnCreate(!pinOnCreate)}
                                className={`pin-toggle ${pinOnCreate ? 'active' : ''}`}
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
