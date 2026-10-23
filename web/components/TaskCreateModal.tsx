import { parseDateValue } from '../utils/taskDates';
﻿import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TASK_TITLE_MAX_LENGTH } from '../utils/taskLimits';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { getProjectCategories } from '../services/dataService';
import { addTask, createSubTask, getProjectTasks } from '../services/domain/tasksService';
import { getSharedProjects, getUserProjects } from '../services/domain/projectsService';
import { auth } from '../services/firebase';
import { readRecentProjectAccess } from '../utils/recentProjects';
import { IdeaGroup, Project, Task, TaskCategory, TaskStatus } from '../types';
import { AiTextAssist } from './ai/AiTextAssist';
import { Button } from './common/Button/Button';
import { Select } from './common/Select/Select';
import { Badge } from './common/Badge/Badge';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { DatePicker } from './common/DateTime/DatePicker';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { usePinnedTasks, PinnedItem } from '../context/PinnedTasksContext';
import { ProjectLabelsModal } from './ProjectLabelsModal';
import { InlineMenu } from './work/InlineMenu';
import { useLanguage } from '../context/LanguageContext';

const PRIORITY_OPTIONS = ['Urgent', 'High', 'Medium', 'Low'] as const;
const STATUS_OPTIONS: TaskStatus[] = ['Backlog', 'Open', 'In Progress', 'On Hold', 'Blocked', 'Done'];
// Sentinel option value for "Create label …" in the labels menu.
const CREATE_LABEL_VALUE = '__create_label__';

type Props = {
    projectId?: string;
    tenantId?: string;
    allowProjectSelect?: boolean;
    onClose: () => void;
    onCreated?: (tasks: Task[], categories: TaskCategory[]) => void;
    initialTaskFields?: Partial<Pick<Task, 'initiativeId' | 'priority' | 'status' | 'description' | 'dueDate'>>;
};

export const TaskCreateModal: React.FC<Props> = ({ projectId, tenantId, allowProjectSelect, onClose, onCreated, initialTaskFields }) => {
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
    const [projectOptions, setProjectOptions] = useState<Project[]>([]);
    const activeProject = useMemo(
        () => projectOptions.find((project) => project.id === selectedProjectId),
        [projectOptions, selectedProjectId]
    );
    const activeProjectId = selectedProjectId;
    const activeTenantId = activeProject?.tenantId ?? tenantId;
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<Task['priority']>(initialTaskFields?.priority || 'Medium');
    const [description, setDescription] = useState(initialTaskFields?.description || '');
    const [dueDate, setDueDate] = useState<Date | null>(initialTaskFields?.dueDate ? parseDateValue(initialTaskFields.dueDate) : null);
    const [selectedCategories, setSelectedCategories] = useState<IdeaGroup[]>([]);
    const [status, setStatus] = useState<TaskStatus>(initialTaskFields?.status || 'Open');
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const inFlightRef = useRef(false);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<TaskCategory[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [pinOnCreate, setPinOnCreate] = useState(false);
    const [subtasks, setSubtasks] = useState<string[]>([]);
    const [newSubtask, setNewSubtask] = useState('');
    const [showLabelsModal, setShowLabelsModal] = useState(false);
    const [labelQuery, setLabelQuery] = useState('');
    const { t } = useLanguage();

    const handleTitleChange = useArrowReplacement((e) => setTitle(e.target.value));
    const handleDescriptionChange = useArrowReplacement((e) => setDescription(e.target.value));
    const handleSubtaskChange = useArrowReplacement((e) => setNewSubtask(e.target.value));

    const { pinItem } = usePinnedTasks();

    // Load the selectable project list when the modal allows picking a project
    // (e.g. opened from the Dashboard without a fixed project context).
    useEffect(() => {
        if (!allowProjectSelect) return;
        let cancelled = false;
        (async () => {
            const [owned, shared] = await Promise.all([
                getUserProjects(undefined, { hydrateAssets: false }).catch(() => []),
                getSharedProjects({ hydrateAssets: false }).catch(() => [])
            ]);
            if (cancelled) return;
            const deduped = new Map<string, Project>();
            [...owned, ...shared].forEach((project) => deduped.set(project.id, project));
            // Offer live projects only, most recently opened first, so the
            // preselection is the project you were just working in.
            const recents = readRecentProjectAccess(auth.currentUser?.uid);
            const list = Array.from(deduped.values())
                .filter((project) => project.id === projectId || (project.status !== 'Completed' && project.status !== 'Canceled'))
                .sort((a, b) => (recents[b.id] || 0) - (recents[a.id] || 0) || (a.title || '').localeCompare(b.title || ''));
            setProjectOptions(list);
            setSelectedProjectId((current) => current || list[0]?.id);
        })();
        return () => { cancelled = true; };
    }, [allowProjectSelect, projectId]);

    useEffect(() => {
        if (!activeProjectId) {
            setCategories([]);
            setTasks([]);
            return;
        }
        (async () => {
            try {
                const [catData, taskData] = await Promise.all([
                    getProjectCategories(activeProjectId, activeTenantId),
                    getProjectTasks(activeProjectId, activeTenantId)
                ]);
                setCategories(catData);
                setTasks(taskData);
            } catch (err) {
                console.error('Failed to load data for task modal', err);
            }
        })();
    }, [activeProjectId, activeTenantId]);

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
                    // Older projects carry labels without a name and non-string
                    // task categories; never let those crash the modal.
                    ...categories.map((c) => (typeof c?.name === 'string' ? c.name.trim() : '')),
                    ...tasks.flatMap((t) => {
                        const cats: unknown[] = Array.isArray(t.category) ? t.category : [t.category];
                        return cats.map((c) => (typeof c === 'string' ? c.trim() : ''));
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
        if (inFlightRef.current || !title.trim()) return;
        if (!activeProjectId) {
            setError(t('taskCreate.errors.noProject'));
            return;
        }
        inFlightRef.current = true;
        setIsAdding(true);
        setError(null);
        try {
            const categoriesToSave = Array.from(
                new Set([...selectedCategories])
            );
            const dueDateValue = dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined;

            // Create the task first
            const newTaskId = await addTask(activeProjectId, title.trim(), dueDateValue, undefined, priority, {
                description,
                category: categoriesToSave.length ? categoriesToSave : undefined,
                status,
                initiativeId: initialTaskFields?.initiativeId,
                assigneeIds,
                assignedGroupIds
            }, activeTenantId);

            // Create subtasks if any using createSubTask
            if (subtasks.length > 0 && newTaskId) {
                for (const subtaskTitle of subtasks) {
                    if (subtaskTitle.trim()) {
                        await createSubTask(activeProjectId, newTaskId, subtaskTitle.trim(), undefined, activeTenantId);
                    }
                }
            }

            // Pin the task if checkbox is checked
            if (pinOnCreate && newTaskId) {
                const newPinnedItem: PinnedItem = {
                    id: newTaskId,
                    type: 'task',
                    title: title.trim(),
                    projectId: activeProjectId,
                    tenantId: activeTenantId,
                    priority
                };
                pinItem(newPinnedItem);
            }

            const [refreshedTasks, refreshedCategories] = await Promise.all([
                getProjectTasks(activeProjectId, activeTenantId),
                getProjectCategories(activeProjectId, activeTenantId)
            ]);
            onCreated?.(refreshedTasks, refreshedCategories);
            onClose();
        } catch (err) {
            console.error('Failed to add task', err);
            setError(t('taskCreate.errors.createFailed'));
        } finally {
            inFlightRef.current = false;
            setIsAdding(false);
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

    const normalizedLabelQuery = labelQuery.trim().toLowerCase();
    const filteredLabelOptions = useMemo(
        () => categoryOptions.filter(
            (option) => !selectedCategories.includes(option) && option.toLowerCase().includes(normalizedLabelQuery)
        ),
        [categoryOptions, selectedCategories, normalizedLabelQuery]
    );
    const canCreateLabel = normalizedLabelQuery.length > 0
        && !categoryOptions.some((option) => option.toLowerCase() === normalizedLabelQuery)
        && !selectedCategories.some((option) => option.toLowerCase() === normalizedLabelQuery);

    const addLabel = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setSelectedCategories(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
        setLabelQuery('');
    };

    const handleLabelInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredLabelOptions.length > 0) {
                addLabel(filteredLabelOptions[0]);
            } else if (canCreateLabel) {
                addLabel(labelQuery.trim());
            }
        }
    };

    return createPortal(
        <div
            className="modal-overlay modal-overlay--open task-modal"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
                            maxLength={TASK_TITLE_MAX_LENGTH}
                            aria-label={t('tasks.quickAdd.placeholder')}
                            className="task-create__title-input"
                        />
                    </div>

                    {/* Toolbar Row */}
                    <div className="toolbar-row">
                        {/* Priority */}
                        <InlineMenu
                            label={t('taskCreate.priority.label')}
                            triggerClassName={`task-create__trigger task-create__trigger--priority priority-${(priority || 'Medium').toLowerCase()}`}
                            trigger={(
                                <>
                                    <span className="material-symbols-outlined">flag</span>
                                    {priorityLabels[priority || 'Medium']}
                                    <span className="material-symbols-outlined task-create__chevron">expand_more</span>
                                </>
                            )}
                            options={PRIORITY_OPTIONS.map((level) => ({
                                value: level,
                                label: priorityLabels[level] || level,
                                leading: <span className={`priority-dot priority-dot--${level.toLowerCase()}`} />,
                            }))}
                            value={priority}
                            onSelect={(value) => setPriority(value as Task['priority'])}
                            width={180}
                        />

                        {/* Status */}
                        <InlineMenu
                            label={t('taskCreate.status.label')}
                            triggerClassName="task-create__trigger"
                            trigger={(
                                <>
                                    <span className={`work-status-dot work-status-dot--${status.replace(/\s+/g, '-').toLowerCase()}`} />
                                    {statusLabels[status] || status}
                                    <span className="material-symbols-outlined task-create__chevron">expand_more</span>
                                </>
                            )}
                            options={STATUS_OPTIONS.map((value) => ({
                                value,
                                label: statusLabels[value] || value,
                                leading: <span className={`work-status-dot work-status-dot--${value.replace(/\s+/g, '-').toLowerCase()}`} />,
                            }))}
                            value={status}
                            onSelect={(value) => setStatus(value as TaskStatus)}
                            width={190}
                        />

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
                                    <button aria-label={t('common.close')}
                                        type="button"
                                        onClick={() => setSelectedCategories(prev => prev.filter(x => x !== catName))}
                                        className="task-create__category-remove"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </Badge>
                            );
                        })}

                        {/* Labels: multi-select with search / create */}
                        <InlineMenu
                            label={t('taskCreate.labels.button')}
                            triggerClassName="task-create__trigger task-create__trigger--muted"
                            trigger={(
                                <>
                                    <span className="material-symbols-outlined">sell</span>
                                    {t('taskCreate.labels.button')}
                                </>
                            )}
                            options={[
                                ...Array.from(new Set([...categoryOptions, ...selectedCategories]))
                                    .filter((option) => option.toLowerCase().includes(normalizedLabelQuery))
                                    .map((option) => ({
                                        value: option,
                                        label: option,
                                        leading: <span className="category-dot" style={{ backgroundColor: categories.find((cat) => cat.name === option)?.color || 'var(--color-text-muted)' }} />,
                                    })),
                                ...(canCreateLabel ? [{
                                    value: CREATE_LABEL_VALUE,
                                    label: t('taskCreate.labels.create').replace('{name}', labelQuery.trim()),
                                    leading: <span className="material-symbols-outlined">add</span>,
                                    dividerBefore: true,
                                }] : []),
                            ]}
                            selectedValues={selectedCategories}
                            onSelect={(value) => {
                                if (value === CREATE_LABEL_VALUE) {
                                    addLabel(labelQuery.trim());
                                    return;
                                }
                                setSelectedCategories((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
                            }}
                            emptyLabel={t('taskCreate.labels.empty')}
                            header={() => (
                                <input
                                    type="text"
                                    data-autofocus
                                    className="inline-menu__search"
                                    value={labelQuery}
                                    onChange={(e) => setLabelQuery(e.target.value)}
                                    onKeyDown={handleLabelInputKeyDown}
                                    placeholder={t('taskCreate.labels.searchPlaceholder')}
                                    aria-label={t('taskCreate.labels.searchPlaceholder')}
                                />
                            )}
                            footer={(close) => (
                                <button
                                    type="button"
                                    className="inline-menu__action"
                                    onClick={() => { close(); setShowLabelsModal(true); }}
                                >
                                    <span className="material-symbols-outlined">settings</span>
                                    {t('taskCreate.labels.manage')}
                                </button>
                            )}
                            width={240}
                        />
                    </div>

                    {/* Description */}
                    <div className="description-section">
                        <AiTextAssist
                            textareaRef={descriptionRef}
                            value={description}
                            onApply={setDescription}
                            field="description"
                            itemTitle={title}
                            projectTitle={activeProject?.title}
                        >
                            <TextArea
                                ref={descriptionRef}
                                value={description}
                                onChange={handleDescriptionChange}
                                placeholder={t('taskCreate.description.placeholder')}
                                rows={2}
                                aria-label={t('taskCreate.description.placeholder')}
                                className="task-create__description-input"
                            />
                        </AiTextAssist>
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
                                        <button aria-label={t('common.close')}
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
                            <TextInput
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
                                leftElement={<span className="material-symbols-outlined subtask-add-icon">add</span>}
                                className="task-create__subtask-input"
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

                    {allowProjectSelect && (
                        <div className="task-create__project-select">
                            <label className="section-label">{t('taskCreate.projectLabel')}</label>
                            <Select
                                value={selectedProjectId ?? null}
                                onChange={(value) => setSelectedProjectId(String(value))}
                                options={projectOptions.map((project) => ({ label: project.title, value: project.id }))}
                                placeholder={t('taskCreate.projectPlaceholder')}
                            />
                        </div>
                    )}

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
                                projectId={activeProjectId || ''}
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
                            <kbd>⌘</kbd>
                            <span>+</span>
                            <kbd>↵</kbd>
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
                    projectId={activeProjectId || ''}
                    tenantId={activeTenantId}
                    onLabelsChange={async () => {
                        if (!activeProjectId) return;
                        const catData = await getProjectCategories(activeProjectId, activeTenantId);
                        setCategories(catData);
                    }}
                />
            )}
        </div>,
        document.body
    );
};
