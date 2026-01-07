import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { addTask, getProjectCategories, getProjectTasks, createSubTask } from '../services/dataService';
import { IdeaGroup, Task, TaskCategory, TaskStatus } from '../types';
import { generateProjectDescription } from '../services/geminiService';
import { Button } from './common/Button/Button';
import { Badge } from './common/Badge/Badge';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { DatePicker } from './common/DateTime/DatePicker';
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
    const [dueDate, setDueDate] = useState<Date | null>(null);
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

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;
        setIsAdding(true);
        setError(null);
        try {
            const categoriesToSave = Array.from(
                new Set([...selectedCategories])
            );
            const dueDateValue = dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined;

            // Create the task first
            const newTaskId = await addTask(projectId, title.trim(), dueDateValue, undefined, priority, {
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

    return createPortal(
        <div
            className="modal-overlay task-modal"
            onClick={onClose}
        >
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit} className="task-create-form">
                    {/* Title Input */}
                    <div className="title-input-section">
                        <TextInput
                            value={title}
                            onChange={handleTitleChange}
                            placeholder={t('tasks.quickAdd.placeholder')}
                            autoFocus
                            maxLength={100}
                            aria-label={t('tasks.quickAdd.placeholder')}
                            className="task-create__title-input"
                        />
                    </div>

                    {/* Toolbar Row */}
                    <div className="toolbar-row">
                        {/* Priority Dropdown */}
                        <div className="dropdown-group">
                            <button
                                type="button"
                                className={`trigger-btn trigger-btn--priority priority-${priority.toLowerCase()}`}
                            >
                                <span className="material-symbols-outlined trigger-icon">flag</span>
                                {priorityLabels[priority] || priority}
                                <span className="material-symbols-outlined chevron">expand_more</span>
                            </button>
                            <div className="dropdown-menu">
                                {(['Urgent', 'High', 'Medium', 'Low'] as const).map(level => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setPriority(level)}
                                        className={`dropdown-item priority-${level.toLowerCase()} ${priority === level ? 'selected' : ''}`}
                                    >
                                        <span className={`priority-dot priority-dot--${level.toLowerCase()}`} />
                                        {priorityLabels[level] || level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Status Dropdown */}
                        <div className="dropdown-group">
                            <button
                                type="button"
                                className="trigger-btn trigger-btn--status"
                            >
                                <span className="material-symbols-outlined trigger-icon">radio_button_unchecked</span>
                                {statusLabels[status] || status}
                                <span className="material-symbols-outlined chevron">expand_more</span>
                            </button>
                            <div className="dropdown-menu">
                                {(['Backlog', 'Open', 'In Progress', 'On Hold', 'Blocked', 'Done'] as const).map(value => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStatus(value)}
                                        className={`dropdown-item status-${value.toLowerCase().replace(' ', '-')} ${status === value ? 'selected' : ''}`}
                                    >
                                        {statusLabels[value] || value}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="divider" />

                        {/* Categories */}
                        {selectedCategories.map(catName => {
                            const catData = categories.find(c => c.name === catName);
                            const color = catData?.color || 'var(--color-text-muted)';
                            return (
                                <Badge
                                    key={catName}
                                    variant="neutral"
                                    className="task-create__category-tag"
                                    style={{ backgroundColor: color }}
                                >
                                    <span className="task-create__category-text">{catName}</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCategories(prev => prev.filter(x => x !== catName))}
                                        className="task-create__category-remove"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </Badge>
                            );
                        })}

                        {/* Add Category */}
                        <div className="dropdown-group">
                            <button
                                type="button"
                                className="trigger-btn trigger-btn--labels"
                            >
                                <span className="material-symbols-outlined trigger-icon">sell</span>
                                {t('taskCreate.labels.button')}
                            </button>
                            <div className="dropdown-menu">
                                <div className="dropdown-menu__header">
                                    <button
                                        type="button"
                                        onClick={() => setShowLabelsModal(true)}
                                        className="dropdown-menu__action"
                                    >
                                        <span className="material-symbols-outlined">settings</span>
                                        {t('taskCreate.labels.manage')}
                                    </button>
                                </div>
                                {categoryOptions.filter(c => !selectedCategories.includes(c)).map(option => {
                                    const catData = categories.find(cat => cat.name === option);
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setSelectedCategories(prev => [...prev, option])}
                                            className="dropdown-item"
                                        >
                                            <span className="category-dot" style={{ backgroundColor: catData?.color || 'var(--color-text-muted)' }} />
                                            {option}
                                        </button>
                                    );
                                })}
                                {categoryOptions.filter(c => !selectedCategories.includes(c)).length === 0 && (
                                    <div className="dropdown-menu__empty">
                                        {t('taskCreate.labels.empty')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="description-section">
                        <TextArea
                            value={description}
                            onChange={handleDescriptionChange}
                            placeholder={t('taskCreate.description.placeholder')}
                            rows={2}
                            aria-label={t('taskCreate.description.placeholder')}
                            className="task-create__description-input"
                        />
                        {title && (
                            <button
                                type="button"
                                onClick={handleGenerateDescription}
                                disabled={isGeneratingDesc}
                                className="generate-btn"
                            >
                                <span className="material-symbols-outlined generate-icon">
                                    {isGeneratingDesc ? 'progress_activity' : 'auto_awesome'}
                                </span>
                                {t('taskCreate.description.generate')}
                            </button>
                        )}
                    </div>

                    {/* Subtasks Section */}
                    <div className="subtasks-section">
                        <label className="section-label">{t('taskCreate.subtasks.title')}</label>

                        {/* Existing subtasks */}
                        {subtasks.length > 0 && (
                            <div className="subtask-list">
                                {subtasks.map((subtask, idx) => (
                                    <div key={idx} className="subtask-item">
                                        <span className="material-symbols-outlined subtask-icon">check_box_outline_blank</span>
                                        <span className="subtask-text">{subtask}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSubtask(idx)}
                                            className="remove-btn"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new subtask */}
                        <div className="add-subtask-row">
                            <span className="material-symbols-outlined subtask-add-icon">add</span>
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
                                    className="add-subtask-btn"
                                >
                                    {t('common.add')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Due Date & Assignees - 2 Columns */}
                    <div className="fields-grid">
                        <div className="task-field">
                            <label className="section-label">{t('taskCreate.dueDate.label')}</label>
                            <DatePicker
                                value={dueDate}
                                onChange={setDueDate}
                                placeholder={t('taskCreate.dueDate.placeholder')}
                            />
                        </div>
                        <div className="task-field">
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
                        <div className="task-create-form__error">
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="modal-footer">
                        <span className="keyboard-hints">
                            <kbd>ƒO~</kbd>
                            <span>+</span>
                            <kbd>ƒÅæ</kbd>
                            <span className="keyboard-hints__label">{t('taskCreate.footer.toCreate')}</span>
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
                                title={t('taskCreate.pin.label')}
                                aria-label={t('taskCreate.pin.label')}
                            >
                                <span className="material-symbols-outlined">{pinOnCreate ? 'keep' : 'keep_off'}</span>
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

