import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { subscribeProjectInitiatives, subscribeProjectTasks } from '../services/dataService';
import { getProjectCategories } from '../services/domain/projectMetaService';
import { deleteTask, getSubTasks, toggleTaskStatus, updateTaskFields } from '../services/domain/tasksService';
import { getProjectById } from '../services/domain/projectsService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { Initiative, Task, Project, TaskCategory, ProjectGroup } from '../types';
import { Button } from '../components/common/Button/Button';
import { Badge } from '../components/common/Badge/Badge';
import { TextInput } from '../components/common/Input/TextInput';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { InitiativeCreateModal } from '../components/InitiativeCreateModal';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useConfirm } from '../context/UIContext';
import { ProjectBoard } from '../components/ProjectBoard';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';

const TaskCreateModal = lazy(() => import('../components/TaskCreateModal').then((module) => ({ default: module.TaskCreateModal })));

type TaskPillEditorType = 'priority' | 'status' | 'dates' | 'initiative' | 'category';

const TASK_STATUS_OPTIONS = ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'] as const;
const TASK_PRIORITY_OPTIONS = ['Urgent', 'High', 'Medium', 'Low'] as const;

export const ProjectTasks = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInitiativeModal, setShowInitiativeModal] = useState(false);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const [view, setView] = useState<'list' | 'board'>('list');
    const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title' | 'createdAt'>('dueDate');
    const [allCategories, setAllCategories] = useState<TaskCategory[]>([]);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [taskPillEditor, setTaskPillEditor] = useState<{ taskId: string; type: TaskPillEditorType; anchorEl: HTMLElement } | null>(null);
    const [taskPillEditorPosition, setTaskPillEditorPosition] = useState({ top: 0, left: 0, width: 304 });
    const [savingInlineTaskId, setSavingInlineTaskId] = useState<string | null>(null);
    const location = useLocation();
    const confirm = useConfirm();
    const taskPillEditorRef = useRef<HTMLDivElement | null>(null);

    // Permissions
    const { can } = useProjectPermissions(project);
    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem, startFocusItem } = usePinnedTasks();
    const { dateFormat, dateLocale, t } = useLanguage();

    const handleSearchChange = useArrowReplacement((e) => setSearch(e.target.value));

    useEffect(() => {
        if (!id) return;
        setLoading(true);

        let unsub: (() => void) | undefined;

        // Fetch project metadata first to get tenantId
        getProjectById(id).then((p) => {
            setProject(p);
            if (!p) {
                setLoading(false);
                return;
            }

            // Fetch categories for label display
            getProjectCategories(id).then(setAllCategories).catch(console.error);

            // Subscribe to tasks with the correct tenantId
            unsub = subscribeProjectTasks(id, (taskData) => {
                setTasks(taskData);
                setLoading(false);
            }, p.tenantId);
            const unsubInitiatives = subscribeProjectInitiatives(id, setInitiatives, p.tenantId);

            // Subscribe to project groups
            const unsubGroups = subscribeProjectGroups(id, setProjectGroups, p.tenantId);

            // Chain unsubscribe
            const oldUnsub = unsub;
            unsub = () => {
                if (oldUnsub) oldUnsub();
                unsubInitiatives();
                unsubGroups();
            };
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });

        return () => {
            if (unsub) unsub();
        };
    }, [id]);

    useEffect(() => {
        const loadSubtaskStats = async () => {
            if (!tasks.length) return;
            try {
                const entries = await Promise.all(tasks.map(async (t) => {
                    const subs = await getSubTasks(t.id);
                    const done = subs.filter(s => s.isCompleted).length;
                    return [t.id, { done, total: subs.length }] as const;
                }));
                setSubtaskStats(Object.fromEntries(entries));
            } catch (err) {
                console.warn(err);
            }
        };
        loadSubtaskStats();
    }, [tasks]);

    useEffect(() => {
        if (new URLSearchParams(location.search).get('newTask') === '1') {
            // Only show if user can manage tasks, but we need to wait for project/permissions to load.
            // Ideally we'd check can('canManageTasks') here but it might be premature. 
            // We'll let the user try but hide the modal content or close it if permission denied?
            // Better: update the state only if permitted.
            setShowCreateModal(true);
        }
    }, [location.search]);

    useEffect(() => {
        setTaskPillEditor((current) => {
            if (!current) return current;
            return tasks.some((task) => task.id === current.taskId) ? current : null;
        });
    }, [tasks]);

    const handleToggle = async (taskId: string, currentStatus: boolean) => {
        if (!can('canManageTasks')) return;
        // Optimistic
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus);
    };

    const handleDelete = async (taskId: string) => {
        if (!can('canManageTasks')) return;
        if (!await confirm(t('projectTasks.confirm.delete.title'), t('projectTasks.confirm.delete.body'))) return;
        try {
            await deleteTask(taskId);
        } catch (e) {
            console.error(e);
            setError(t('projectTasks.error.delete'));
        }
    };

    const toDateInputValue = (value?: string) => {
        if (!value) return '';
        const matched = value.match(/^\d{4}-\d{2}-\d{2}/);
        return matched ? matched[0] : '';
    };

    const updateTaskInline = async (task: Task, updates: Partial<Task>) => {
        if (!id || !can('canManageTasks')) return;

        const previousTask = { ...task };
        setSavingInlineTaskId(task.id);
        setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...updates } : item)));

        try {
            await updateTaskFields(task.id, updates, id, project?.tenantId);
        } catch (err) {
            console.error(err);
            setTasks((prev) => prev.map((item) => (item.id === task.id ? previousTask : item)));
            setError(t('projectTasks.error.inlineUpdate'));
        } finally {
            setSavingInlineTaskId((current) => (current === task.id ? null : current));
        }
    };

    const handleQuickDateChange = async (task: Task, field: 'startDate' | 'dueDate', nextValue: string) => {
        if (!can('canManageTasks') || !id) return;

        const previousInputValue = toDateInputValue(task[field]);
        const normalizedNextValue = nextValue || '';
        if (previousInputValue === normalizedNextValue) return;

        const updates: Partial<Task> = field === 'startDate'
            ? { startDate: normalizedNextValue }
            : { dueDate: normalizedNextValue };

        await updateTaskInline(task, updates);
    };

    const openTaskPillEditor = (taskId: string, type: TaskPillEditorType, anchorEl: HTMLElement) => {
        setTaskPillEditor((current) => (
            current && current.taskId === taskId && current.type === type
                ? null
                : { taskId, type, anchorEl }
        ));
    };

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    const priorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);
    const statusLabels = useMemo(() => ({
        Done: t('tasks.status.done'),
        'In Progress': t('tasks.status.inProgress'),
        Review: t('tasks.status.review'),
        Open: t('tasks.status.open'),
        Todo: t('tasks.status.todo'),
        Backlog: t('tasks.status.backlog'),
        'On Hold': t('tasks.status.onHold'),
        Blocked: t('tasks.status.blocked')
    }), [t]);
    const filterLabels = useMemo(() => ({
        active: t('projectTasks.filters.active'),
        completed: t('projectTasks.filters.completed'),
        all: t('projectTasks.filters.all')
    }), [t]);
    const viewLabels = useMemo(() => ({
        list: t('projectTasks.view.list'),
        board: t('projectTasks.view.board')
    }), [t]);
    const sortOptions = useMemo<SelectOption[]>(() => ([
        { value: 'priority', label: t('projectTasks.sort.priority') },
        { value: 'dueDate', label: t('projectTasks.sort.dueDate') },
        { value: 'title', label: t('projectTasks.sort.title') },
        { value: 'createdAt', label: t('projectTasks.sort.created') },
    ]), [t]);

    useEffect(() => {
        if (!taskPillEditor) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (taskPillEditorRef.current?.contains(target)) return;
            if (target.closest(`[data-task-pill-trigger="${taskPillEditor.taskId}-${taskPillEditor.type}"]`)) return;
            setTaskPillEditor(null);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [taskPillEditor]);

    const editingTask = useMemo(
        () => (taskPillEditor ? tasks.find((task) => task.id === taskPillEditor.taskId) || null : null),
        [taskPillEditor, tasks]
    );

    const initiativeLookup = useMemo(
        () => Object.fromEntries(initiatives.map((initiative) => [initiative.id, initiative])),
        [initiatives]
    );

    useEffect(() => {
        if (!taskPillEditor) return;

        const updatePosition = () => {
            const { anchorEl, type } = taskPillEditor;
            if (!document.body.contains(anchorEl)) {
                setTaskPillEditor(null);
                return;
            }

            const width = type === 'dates' || type === 'category' || type === 'initiative' ? 320 : 280;
            const rect = anchorEl.getBoundingClientRect();
            const editorHeight = taskPillEditorRef.current?.getBoundingClientRect().height || 280;
            let left = rect.left;
            let top = rect.bottom + 10;

            if (left + width > window.innerWidth - 12) {
                left = Math.max(12, window.innerWidth - width - 12);
            }

            if (top + editorHeight > window.innerHeight - 12) {
                top = Math.max(12, rect.top - editorHeight - 10);
            }

            setTaskPillEditorPosition({ top, left, width });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [taskPillEditor]);

    const filteredTasks = useMemo(() => {
        const filtered = tasks.filter(t => {
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;
            if (search) {
                const normalizedSearch = search.toLowerCase();
                const initiativeTitle = t.initiativeId ? initiativeLookup[t.initiativeId]?.title || '' : '';
                const categories = Array.isArray(t.category) ? t.category : [t.category].filter(Boolean);
                const haystack = [
                    t.title,
                    t.description || '',
                    t.status || '',
                    t.priority || '',
                    initiativeTitle,
                    ...categories
                ].join(' ').toLowerCase();
                if (!haystack.includes(normalizedSearch)) return false;
            }
            return true;
        });

        // Apply sorting
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'priority': {
                    const pA = priorityMap[a.priority || 'Medium'] || 0;
                    const pB = priorityMap[b.priority || 'Medium'] || 0;
                    if (pA !== pB) return pB - pA; // Descending (Urgent first)
                    // Secondary sort by due date
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB;
                }
                case 'dueDate': {
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB; // Ascending (soonest first)
                }
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'createdAt': {
                    const createdA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                    const createdB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                    return createdB - createdA; // Descending (newest first)
                }
                default:
                    return 0;
            }
        });
    }, [tasks, filter, search, sortBy, initiativeLookup]);

    const openCount = tasks.filter(t => !t.isCompleted).length;
    const completedCount = tasks.filter(t => t.isCompleted).length;

    const toggleSelect = (taskId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.size) return;
        if (!can('canManageTasks')) return;
        if (!await confirm(
            t('projectTasks.confirm.bulkDelete.title'),
            t('projectTasks.confirm.bulkDelete.body').replace('{count}', String(selectedIds.size))
        )) return;
        try {
            await Promise.all(Array.from(selectedIds).map((id: string) => deleteTask(id)));
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            setError(t('projectTasks.error.bulkDelete'));
        }
    };

    const stats = useMemo(() => {
        const total = tasks.length;
        const open = tasks.filter(t => !t.isCompleted).length;
        const completed = tasks.filter(t => t.isCompleted).length;
        const urgent = tasks.filter(t => t.priority === 'Urgent' && !t.isCompleted).length;
        const high = tasks.filter(t => t.priority === 'High' && !t.isCompleted).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, open, completed, urgent, high, progress };
    }, [tasks]);

    const workbenchCards = useMemo(() => ([
        {
            label: t('projectTasks.workbench.focus'),
            value: filterLabels[filter],
            meta: t('projectTasks.workbench.focusMeta').replace('{view}', viewLabels[view])
        },
        {
            label: t('projectTasks.workbench.delivery'),
            value: String(stats.open),
            meta: t('projectTasks.workbench.deliveryMeta').replace('{count}', String(stats.high + stats.urgent))
        },
        {
            label: t('projectTasks.workbench.completion'),
            value: `${stats.progress}%`,
            meta: t('projectTasks.workbench.completionMeta')
                .replace('{done}', String(stats.completed))
                .replace('{total}', String(stats.total))
        }
    ]), [filter, filterLabels, stats, t, view, viewLabels]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'project-tasks-header',
            title: t('projectTasks.onboarding.header.title'),
            description: t('projectTasks.onboarding.header.description')
        },
        {
            id: 'stats',
            targetId: 'project-tasks-stats',
            title: t('projectTasks.onboarding.stats.title'),
            description: t('projectTasks.onboarding.stats.description'),
            placement: 'top'
        },
        {
            id: 'controls',
            targetId: 'project-tasks-controls',
            title: t('projectTasks.onboarding.controls.title'),
            description: t('projectTasks.onboarding.controls.description'),
            placement: 'top'
        },
        {
            id: 'tasks',
            targetId: 'project-tasks-view',
            title: t('projectTasks.onboarding.tasks.title'),
            description: t('projectTasks.onboarding.tasks.description')
        }
    ]), [t]);

    const {
        onboardingActive,
        stepIndex,
        setStepIndex,
        skip,
        finish
    } = useOnboardingTour('project_tasks', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });

    const TaskCard = ({ task, isBoard = false }: { task: Task; isBoard?: boolean }) => {
        const isActiveEditor = (type: TaskPillEditorType) => taskPillEditor?.taskId === task.id && taskPillEditor.type === type;
        const isSavingInline = savingInlineTaskId === task.id;
        const canQuickEditDates = can('canManageTasks');
        const isStrategic = Boolean(task.convertedIdeaId || task.legacyInitiativeRoot);
        const isInitiativeTask = Boolean(task.initiativeId && !task.legacyInitiativeRoot);
        const hasStart = Boolean(task.startDate);
        const hasDue = Boolean(task.dueDate);
        const showTimeline = !isStrategic && hasStart && hasDue && !task.isCompleted;
        const showDueDate = !isStrategic && !hasStart && hasDue && !task.isCompleted;
        const showStrategicTimeline = isStrategic && hasStart && hasDue && !task.isCompleted;
        const showStrategicDue = isStrategic && !hasStart && hasDue && !task.isCompleted;
        const showDueDateSetter = !hasDue && !task.isCompleted;
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = !!dueDate && dueDate < new Date() && !task.isCompleted;
        const priorityLabel = task.priority ? (priorityLabels[task.priority] || task.priority) : '';
        const statusLabel = task.status ? (statusLabels[task.status] || task.status) : '';
        const initiative = task.initiativeId ? initiativeLookup[task.initiativeId] : null;
        const initiativeLabel = initiative?.title || t('projectTasks.pill.initiativeNone');
        const dependencyCount = task.dependencies?.length || 0;
        const dependencyLabel = dependencyCount === 1
            ? t('projectTasks.badge.dependency')
            : t('projectTasks.badge.dependencies');

        const dependentTasks = task.dependencies?.map(depId => tasks.find(t => t.id === depId)).filter(Boolean) as Task[] || [];
        const blockedBy = dependentTasks.filter(t => !t.isCompleted);
        const isBlocked = blockedBy.length > 0;

        const cardVariant = task.isCompleted ? 'completed' : isBlocked ? 'blocked' : isStrategic || isInitiativeTask ? 'strategic' : 'default';
        const togglePillEditor = (type: TaskPillEditorType) => (e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            if (!canQuickEditDates) return;
            openTaskPillEditor(task.id, type, e.currentTarget);
        };

        return (
            <div
                onClick={() => navigate(`/project/${id}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                className={`task-card ${cardVariant} ${isBoard ? 'is-board' : ''}`}
            >
                {/* Left: Status & Main Info */}
                <div className="task-main-info">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.isCompleted); }}
                        disabled={!can('canManageTasks')}
                        className={`check-btn ${task.isCompleted ? 'checked' : ''} ${!can('canManageTasks') ? 'disabled' : ''}`}
                    >
                        <span className="material-symbols-outlined">check</span>
                    </button>

                    <div className="info-content">
                        <div className="title-row">
                            <h4 className={`task-title ${task.isCompleted ? 'completed' : ''}`}>
                                {task.title}
                            </h4>
                            <div className="meta-row">
                                {isStrategic && (
                                    <Badge variant="neutral" className="badge strategic">
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        {t('projectTasks.badge.strategic')}
                                    </Badge>
                                )}
                                {!task.legacyInitiativeRoot && isInitiativeTask && (
                                    <button
                                        type="button"
                                        className={`badge badge--interactive badge--initiative-link strategic ${can('canManageTasks') && isActiveEditor('initiative') ? 'badge--active' : ''}`}
                                        onClick={can('canManageTasks')
                                            ? togglePillEditor('initiative')
                                            : (event) => {
                                                event.stopPropagation();
                                                navigate(`/project/${id}/initiatives/${task.initiativeId}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`);
                                            }}
                                        data-task-pill-trigger={can('canManageTasks') ? `${task.id}-initiative` : undefined}
                                    >
                                        <span className="material-symbols-outlined">rocket_launch</span>
                                        <span>{initiativeLabel}</span>
                                    </button>
                                )}
                                {!task.legacyInitiativeRoot && !isInitiativeTask && can('canManageTasks') && (
                                    <button
                                        type="button"
                                        className={`badge badge--interactive badge--initiative-link strategic ${isActiveEditor('initiative') ? 'badge--active' : ''}`}
                                        onClick={togglePillEditor('initiative')}
                                        data-task-pill-trigger={`${task.id}-initiative`}
                                    >
                                        <span className="material-symbols-outlined">rocket_launch</span>
                                        <span>{t('projectTasks.pill.linkInitiative')}</span>
                                    </button>
                                )}
                                {task.legacyInitiativeRoot && task.initiativeId && (
                                    <button
                                        type="button"
                                        className="badge badge--interactive badge--initiative-link strategic"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(`/project/${id}/initiatives/${task.initiativeId}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`);
                                        }}
                                    >
                                        <span className="material-symbols-outlined">rocket_launch</span>
                                        <span>{t('projectTasks.pill.openInitiative')}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={`badge badge--interactive priority-${(task.priority || 'medium').toLowerCase()} ${isActiveEditor('priority') ? 'badge--active' : ''}`}
                                    onClick={togglePillEditor('priority')}
                                    data-task-pill-trigger={`${task.id}-priority`}
                                    disabled={!can('canManageTasks')}
                                >
                                    <span className="material-symbols-outlined">
                                        {task.priority === 'Urgent' ? 'error' :
                                            task.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                task.priority === 'Medium' ? 'drag_handle' :
                                                    'keyboard_arrow_down'}
                                    </span>
                                    {priorityLabel || t('tasks.priority.medium')}
                                </button>

                                {/* Blocked Indicator */}
                                {isBlocked && (
                                    <Badge variant="neutral" className="badge blocked">
                                        <span className="material-symbols-outlined">link_off</span>
                                        {t('projectTasks.badge.blocked')}
                                        <span className="blocked-tooltip">
                                            <span className="blocked-tooltip__title">{t('projectTasks.badge.blockedBy')}</span>
                                            <span className="blocked-tooltip__list">
                                                {blockedBy.map(blockedTask => (
                                                    <span key={blockedTask.id} className="blocked-tooltip__item">
                                                        <span className="material-symbols-outlined blocked-tooltip__icon">lock</span>
                                                        <span className="blocked-tooltip__text">{blockedTask.title}</span>
                                                    </span>
                                                ))}
                                            </span>
                                        </span>
                                    </Badge>
                                )}

                                {/* Dependency Count */}
                                {!isBlocked && (task.dependencies?.length || 0) > 0 && (
                                    <Badge variant="neutral" className="badge dependency">
                                        <span className="material-symbols-outlined">link</span>
                                        {dependencyCount} {dependencyLabel}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="meta-row">
                            <button
                                type="button"
                                className={`badge badge--interactive status ${(task.status || 'open').toLowerCase().replace(' ', '-')} ${isActiveEditor('status') ? 'badge--active' : ''}`}
                                onClick={togglePillEditor('status')}
                                data-task-pill-trigger={`${task.id}-status`}
                                disabled={!can('canManageTasks')}
                            >
                                <span className="material-symbols-outlined">
                                    {task.status === 'Done' ? 'check_circle' :
                                        task.status === 'In Progress' ? 'sync' :
                                            task.status === 'Review' ? 'visibility' :
                                                task.status === 'Open' || task.status === 'Todo' ? 'play_circle' :
                                                    task.status === 'Backlog' ? 'inventory_2' :
                                                        task.status === 'On Hold' ? 'pause_circle' :
                                                            task.status === 'Blocked' ? 'dangerous' :
                                                                'circle'}
                                </span>
                                {statusLabel || t('tasks.status.unknown')}
                            </button>
                            {subtaskStats[task.id]?.total > 0 && (
                                <Badge variant="neutral" className="badge subtasks">
                                    <span className="material-symbols-outlined">checklist</span>
                                    {subtaskStats[task.id].done}/{subtaskStats[task.id].total}
                                </Badge>
                            )}
                            {(() => {
                                const cats = Array.isArray(task.category) ? task.category : [task.category].filter(Boolean);
                                return cats.map(catName => {
                                    const catData = allCategories.find(c => c.name === catName);
                                    const color = catData?.color || '#64748b';
                                    return can('canManageTasks') ? (
                                        <button
                                            key={catName as string}
                                            type="button"
                                            className={`badge badge--interactive category ${isActiveEditor('category') ? 'badge--active' : ''}`}
                                            style={{
                                                backgroundColor: `${color}10`,
                                                color: color
                                            }}
                                            onClick={togglePillEditor('category')}
                                            data-task-pill-trigger={`${task.id}-category`}
                                        >
                                            {catName as string}
                                        </button>
                                    ) : (
                                        <Badge
                                            key={catName as string}
                                            variant="neutral"
                                            className="badge category"
                                            style={{
                                                backgroundColor: `${color}10`,
                                                color: color
                                            }}
                                        >
                                            {catName as string}
                                        </Badge>
                                    );
                                });
                            })()}
                            {can('canManageTasks') && (!task.category || (Array.isArray(task.category) && task.category.length === 0)) && (
                                <button
                                    type="button"
                                    className={`badge badge--interactive category ${isActiveEditor('category') ? 'badge--active' : ''}`}
                                    onClick={togglePillEditor('category')}
                                    data-task-pill-trigger={`${task.id}-category`}
                                >
                                    <span className="material-symbols-outlined">label</span>
                                    {t('projectTasks.pill.addCategory')}
                                </button>
                            )}
                        </div>

                        {/* Assignees Row */}
                        {(task.assignedGroupIds?.length > 0 || task.assigneeIds?.length > 0) && (
                            <div className="assignees-list">
                                {task.assignedGroupIds?.map(gid => {
                                    const group = projectGroups.find(g => g.id === gid);
                                    if (!group) return null;
                                    return (
                                        <div
                                            key={gid}
                                            className="avatar"
                                            style={{ backgroundColor: group.color }}
                                            title={t('projectTasks.groupLabel').replace('{name}', group.name)}
                                        >
                                            {group.name.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Timeline & Actions */}
                <div className={`task-actions-section ${isBoard ? 'is-board' : ''}`}>
                    {/* Minimal Timeline */}
                    {showStrategicTimeline && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--wide'}`.trim()}>
                            <div className="timeline-header">
                                <span className="timeline-label">
                                    <span className="material-symbols-outlined timeline-icon">timeline</span>
                                    {t('projectTasks.timeline.strategic')}
                                </span>
                                {(() => {
                                    const start = new Date(task.startDate!).getTime();
                                    const end = new Date(task.dueDate!).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return <span className="timeline-percent">{Math.round(pct)}%</span>;
                                })()}
                            </div>
                            <div className="timeline-bar">
                                {(() => {
                                    const start = new Date(task.startDate!).getTime();
                                    const end = new Date(task.dueDate!).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return (
                                        <div
                                            className="progress"
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })()}
                            </div>
                            <div className="dates-row">
                                <span>{t('projectTasks.timeline.start')} {format(new Date(task.startDate!), dateFormat, { locale: dateLocale })}</span>
                                {canQuickEditDates ? (
                                    <button
                                        type="button"
                                        onClick={togglePillEditor('dates')}
                                        data-task-pill-trigger={`${task.id}-dates`}
                                        className={`due-date-trigger ${new Date(task.dueDate!) < new Date() ? 'overdue' : ''} ${isActiveEditor('dates') ? 'active' : ''}`}
                                        title={isActiveEditor('dates') ? t('projectTasks.actions.quickDatesClose') : t('projectTasks.actions.quickDatesTitle')}
                                    >
                                        {t('projectTasks.timeline.due')} {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                    </button>
                                ) : (
                                    <span className={new Date(task.dueDate!) < new Date() ? 'overdue' : ''}>
                                        {t('projectTasks.timeline.due')} {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    {showTimeline && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--compact'}`}>
                            <div className="timeline-simple-bar">
                                {(() => {
                                    const start = new Date(task.startDate!).getTime();
                                    const end = new Date(task.dueDate!).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return (
                                        <div
                                            className="progress"
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })()}
                            </div>
                            <div className="dates-row">
                                <span>{format(new Date(task.startDate!), dateFormat, { locale: dateLocale })}</span>
                                {canQuickEditDates ? (
                                    <button
                                        type="button"
                                        onClick={togglePillEditor('dates')}
                                        data-task-pill-trigger={`${task.id}-dates`}
                                        className={`due-date-trigger due-date-trigger--compact ${new Date(task.dueDate!) < new Date() ? 'overdue' : ''} ${isActiveEditor('dates') ? 'active' : ''}`}
                                        title={isActiveEditor('dates') ? t('projectTasks.actions.quickDatesClose') : t('projectTasks.actions.quickDatesTitle')}
                                    >
                                        {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                    </button>
                                ) : (
                                    <span className={new Date(task.dueDate!) < new Date() ? 'overdue' : ''}>
                                        {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {showStrategicDue && dueDate && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--wide'}`}>
                            {canQuickEditDates ? (
                                <button
                                    type="button"
                                    onClick={togglePillEditor('dates')}
                                    data-task-pill-trigger={`${task.id}-dates`}
                                    className={`due-date-box due-date-trigger due-date-trigger--box ${isOverdue ? 'overdue' : 'normal'} ${isActiveEditor('dates') ? 'active' : ''}`}
                                    title={isActiveEditor('dates') ? t('projectTasks.actions.quickDatesClose') : t('projectTasks.actions.quickDatesTitle')}
                                >
                                    <span className="material-symbols-outlined due-date-icon">event</span>
                                    <div className="due-date-info">
                                        <span className="date-label">{t('projectTasks.timeline.strategicDue')}</span>
                                        <span className="date-val">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                    </div>
                                </button>
                            ) : (
                                <div className={`due-date-box ${isOverdue ? 'overdue' : 'normal'}`}>
                                    <span className="material-symbols-outlined due-date-icon">event</span>
                                    <div className="due-date-info">
                                        <span className="date-label">{t('projectTasks.timeline.strategicDue')}</span>
                                        <span className="date-val">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {showDueDate && dueDate && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--compact'}`}>
                            {canQuickEditDates ? (
                                <button
                                    type="button"
                                    onClick={togglePillEditor('dates')}
                                    data-task-pill-trigger={`${task.id}-dates`}
                                    className={`due-date-box simple due-date-trigger due-date-trigger--box ${isOverdue ? 'overdue' : ''} ${isActiveEditor('dates') ? 'active' : ''}`}
                                    title={isActiveEditor('dates') ? t('projectTasks.actions.quickDatesClose') : t('projectTasks.actions.quickDatesTitle')}
                                >
                                    <span className="material-symbols-outlined due-date-icon">event</span>
                                    <div className="due-date-info">
                                        <span className="date-label">{t('projectTasks.timeline.due')}</span>
                                        <span className="date-val small">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                    </div>
                                </button>
                            ) : (
                                <div className={`due-date-box simple ${isOverdue ? 'overdue' : ''}`}>
                                    <span className="material-symbols-outlined due-date-icon">event</span>
                                    <div className="due-date-info">
                                        <span className="date-label">{t('projectTasks.timeline.due')}</span>
                                        <span className="date-val small">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {showDueDateSetter && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--compact'}`}>
                            {canQuickEditDates ? (
                                <button
                                    type="button"
                                    onClick={togglePillEditor('dates')}
                                    data-task-pill-trigger={`${task.id}-dates`}
                                    className={`due-date-box simple due-date-trigger due-date-trigger--box due-date-trigger--empty ${isActiveEditor('dates') ? 'active' : ''}`}
                                    title={isActiveEditor('dates') ? t('projectTasks.actions.quickDatesClose') : t('projectTasks.actions.quickDatesTitle')}
                                >
                                    <span className="material-symbols-outlined due-date-icon">event_upcoming</span>
                                    <div className="due-date-info">
                                        <span className="date-label">{t('projectTasks.timeline.due')}</span>
                                        <span className="date-val small">{t('projectTasks.timeline.setDue')}</span>
                                    </div>
                                </button>
                            ) : (
                                <div className="due-date-box simple">
                                    <span className="material-symbols-outlined due-date-icon">event_upcoming</span>
                                    <div className="due-date-info">
                                        <span className="date-label">{t('projectTasks.timeline.due')}</span>
                                        <span className="date-val small">{t('projectTasks.timeline.setDue')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="action-btn-group">
                        {can('canManageTasks') && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                className="action-btn action-btn--delete"
                            >
                                <span className="material-symbols-outlined action-btn__icon">delete</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isPinned(task.id)) {
                                    unpinItem(task.id);
                                } else {
                                    pinItem({
                                        id: task.id,
                                        type: 'task',
                                        title: task.title,
                                        projectId: id!,
                                        priority: task.priority,
                                        isCompleted: task.isCompleted
                                    });
                                }
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                if (focusItemId === task.id) {
                                    setFocusItem(null);
                                } else {
                                    startFocusItem({
                                        id: task.id,
                                        type: 'task',
                                        title: task.title,
                                        projectId: id!,
                                        tenantId: task.tenantId,
                                        priority: task.priority,
                                        isCompleted: task.isCompleted
                                    });
                                }
                            }}
                            className={`action-btn action-btn--pin ${isPinned(task.id) ? 'pinned' : 'unpinned'}`}
                            title={isPinned(task.id) ? t('projectTasks.actions.unpinTitle') : t('projectTasks.actions.pinTitle')}
                        >
                            <span className={`material-symbols-outlined action-btn__icon ${focusItemId === task.id ? 'action-btn__icon--focused' : ''}`}>
                                push_pin
                            </span>
                        </button>
                        <div className="action-btn">
                            <span className="material-symbols-outlined action-btn__icon">east</span>
                        </div>
                    </div>
                </div>
            </div >
        );
    };

    const editingTaskStartDate = toDateInputValue(editingTask?.startDate);
    const editingTaskDueDate = toDateInputValue(editingTask?.dueDate);
    const editingTaskCategories = editingTask
        ? (Array.isArray(editingTask.category) ? editingTask.category : [editingTask.category].filter(Boolean))
        : [];

    if (loading) return (
        <div className="tasks-loading">
            <span className="material-symbols-outlined tasks-loading__icon">rotate_right</span>
        </div>
    );

    return (
        <>
            <div className="project-tasks-container">

                {/* Premium Header */}
                <div data-onboarding-id="project-tasks-header" className="tasks-header">
                    <div>
                        <h1>
                            {t('projectTasks.header.title')} <span>{t('projectTasks.header.titleEmphasis')}</span>
                        </h1>
                        <p className="subtitle">
                            {project?.title
                                ? t('projectTasks.header.subtitleWithProject').replace('{project}', project.title)
                                : t('projectTasks.header.subtitleFallback')}
                        </p>
                    </div>
                    {can('canManageTasks') && (
                        <div className="tasks-header__actions">
                            <Button
                                onClick={() => setShowInitiativeModal(true)}
                                icon={<span className="material-symbols-outlined">rocket_launch</span>}
                                variant="secondary"
                                size="lg"
                            >
                                {t('initiatives.create.action')}
                            </Button>
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                icon={<span className="material-symbols-outlined">add</span>}
                                variant="primary"
                                size="lg"
                                className="new-task-btn"
                            >
                                {t('projectTasks.actions.newTask')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="tasks-workbench">
                    {workbenchCards.map((card) => (
                        <div key={card.label} className="tasks-workbench__card">
                            <span className="tasks-workbench__label">{card.label}</span>
                            <span className="tasks-workbench__value">{card.value}</span>
                            <span className="tasks-workbench__meta">{card.meta}</span>
                        </div>
                    ))}
                </div>

                {/* Stats Row */}
                <div data-onboarding-id="project-tasks-stats" className="tasks-stats-grid">
                    {[
                        { label: t('projectTasks.stats.open'), val: stats.open, icon: 'list_alt', color: 'indigo' },
                        { label: t('projectTasks.stats.completed'), val: stats.completed, icon: 'check_circle', color: 'emerald', progress: stats.progress },
                        { label: t('projectTasks.stats.highPriority'), val: stats.high, icon: 'priority_high', color: 'amber' },
                        { label: t('projectTasks.stats.urgent'), val: stats.urgent, icon: 'warning', color: 'rose' }
                    ].map((stat, idx) => (
                        <div key={idx} className={`stat-card variant-${stat.color}`}>
                            <div className="bg-icon">
                                <span className="material-symbols-outlined">{stat.icon}</span>
                            </div>
                            <div className="content">
                                <p className="label">{stat.label}</p>
                                <div className="value-row">
                                    <p className="value">{stat.val}</p>
                                    {stat.progress !== undefined && (
                                        <Badge variant="neutral" className="badge">
                                            {stat.progress}%
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Interactive Controls Bar */}
                <div data-onboarding-id="project-tasks-controls" className="tasks-controls-bar">
                    <div className="controls-group-wrapper">
                        <div className="control-group">
                            {(['active', 'completed', 'all'] as const).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={`control-btn ${filter === f ? 'active' : ''}`}
                                >
                                    {filterLabels[f]}
                                </button>
                            ))}
                        </div>

                        <div className="control-group">
                            {(['list', 'board'] as const).map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setView(v)}
                                    className={`control-btn ${view === v ? 'active' : ''}`}
                                >
                                    <span className="material-symbols-outlined control-btn__icon">{v === 'list' ? 'format_list_bulleted' : 'dashboard'}</span>
                                    {viewLabels[v]}
                                </button>
                            ))}
                        </div>

                        <div className="tasks-selects">
                            <Select
                                label={t('projectTasks.sort.label')}
                                value={sortBy}
                                onChange={(value) => setSortBy(value as typeof sortBy)}
                                options={sortOptions}
                                className="tasks-select"
                            />
                        </div>
                    </div>

                    <div className="search-wrapper">
                        <TextInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder={t('projectTasks.search.placeholder')}
                            className="tasks-search"
                            leftElement={<span className="material-symbols-outlined">search</span>}
                        />
                    </div>
                </div>

                {/* Enhanced View Area */}
                <div data-onboarding-id="project-tasks-view" className="view-area-container">
                    {filteredTasks.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon-circle">
                                <span className="material-symbols-outlined">explore_off</span>
                            </div>
                            <h3>{t('projectTasks.empty.title')}</h3>
                            <p>
                                {t('projectTasks.empty.description')}
                            </p>
                            {can('canManageTasks') && (
                                <Button
                                    variant="secondary"
                                    className="create-btn"
                                    onClick={() => setShowCreateModal(true)}
                                >
                                    {t('projectTasks.actions.createTask')}
                                </Button>
                            )}
                        </div>
                    ) : view === 'list' ? (
                        <div className="task-list-grid">
                            {filteredTasks.map(task => (
                                <TaskCard key={task.id} task={task} />
                            ))}
                        </div>
                    ) : (
                        <ProjectBoard
                            tasks={filteredTasks}
                            renderTask={(task) => <TaskCard task={task} isBoard />}
                            stickyOffset="85px"
                        />
                    )}
                </div>

                {/* Check permission before showing modal */}
                {showCreateModal && id && can('canManageTasks') && (
                    <Suspense fallback={null}>
                        <TaskCreateModal
                            projectId={id}
                            onClose={() => setShowCreateModal(false)}
                            onCreated={(updated) => {
                                setTasks(updated);
                                setShowCreateModal(false);
                            }}
                        />
                    </Suspense>
                )}

                {showInitiativeModal && id && can('canManageTasks') && (
                    <InitiativeCreateModal
                        isOpen={showInitiativeModal}
                        projectId={id}
                        tenantId={project?.tenantId}
                        onClose={() => setShowInitiativeModal(false)}
                        onCreated={(initiativeId) => {
                            setShowInitiativeModal(false);
                            navigate(`/project/${id}/initiatives/${initiativeId}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`);
                        }}
                    />
                )}

                {can('canManageTasks') && taskPillEditor && editingTask && createPortal(
                    <div
                        className="task-pill-editor-popover"
                        ref={taskPillEditorRef}
                        style={{
                            top: `${taskPillEditorPosition.top}px`,
                            left: `${taskPillEditorPosition.left}px`,
                            width: `${taskPillEditorPosition.width}px`
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className={`task-pill-editor ${savingInlineTaskId === editingTask.id ? 'is-saving' : ''}`}>
                            <div className="task-pill-editor__header">
                                <div>
                                    <div className="task-pill-editor__eyebrow">{t(`projectTasks.editor.${taskPillEditor.type}.eyebrow`)}</div>
                                    <strong className="task-pill-editor__title">{editingTask.title}</strong>
                                </div>
                                <button type="button" className="task-pill-editor__close" onClick={() => setTaskPillEditor(null)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {taskPillEditor.type === 'priority' && (
                                <div className="task-pill-editor__options">
                                    {TASK_PRIORITY_OPTIONS.map((priority) => (
                                        <button
                                            key={priority}
                                            type="button"
                                            className={`task-pill-editor__option ${editingTask.priority === priority ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                const updates: Partial<Task> = { priority };
                                                void updateTaskInline(editingTask, updates);
                                                setTaskPillEditor(null);
                                            }}
                                        >
                                            <span className="material-symbols-outlined">
                                                {priority === 'Urgent' ? 'error' :
                                                    priority === 'High' ? 'keyboard_double_arrow_up' :
                                                        priority === 'Medium' ? 'drag_handle' :
                                                            'keyboard_arrow_down'}
                                            </span>
                                            {priorityLabels[priority]}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {taskPillEditor.type === 'status' && (
                                <div className="task-pill-editor__options">
                                    {TASK_STATUS_OPTIONS.map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            className={`task-pill-editor__option ${editingTask.status === status ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                const updates: Partial<Task> = { status, isCompleted: status === 'Done' };
                                                void updateTaskInline(editingTask, updates);
                                                setTaskPillEditor(null);
                                            }}
                                        >
                                            <span className="material-symbols-outlined">
                                                {status === 'Done' ? 'check_circle' :
                                                    status === 'In Progress' ? 'sync' :
                                                        status === 'Review' ? 'visibility' :
                                                            status === 'Open' ? 'play_circle' :
                                                                status === 'Backlog' ? 'inventory_2' :
                                                                    status === 'On Hold' ? 'pause_circle' :
                                                                        status === 'Blocked' ? 'dangerous' :
                                                                            'circle'}
                                            </span>
                                            {statusLabels[status] || status}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {taskPillEditor.type === 'initiative' && (
                                <div className="task-pill-editor__options">
                                    <button
                                            type="button"
                                            className={`task-pill-editor__option ${!editingTask.initiativeId ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                void updateTaskInline(editingTask, { initiativeId: '' });
                                                setTaskPillEditor(null);
                                            }}
                                        >
                                        <span className="material-symbols-outlined">remove_circle</span>
                                        {t('projectTasks.pill.initiativeNone')}
                                    </button>
                                    {initiatives.map((initiative) => (
                                        <button
                                            key={initiative.id}
                                            type="button"
                                            className={`task-pill-editor__option ${editingTask.initiativeId === initiative.id ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                void updateTaskInline(editingTask, { initiativeId: initiative.id });
                                                setTaskPillEditor(null);
                                            }}
                                        >
                                            <span className="material-symbols-outlined">rocket_launch</span>
                                            <span>{initiative.title}</span>
                                        </button>
                                    ))}
                                    {initiatives.length === 0 && (
                                        <div className="task-pill-editor__empty">{t('projectTasks.editor.initiative.empty')}</div>
                                    )}
                                    {editingTask.initiativeId && (
                                        <button
                                            type="button"
                                            className="task-pill-editor__link"
                                            onClick={() => navigate(`/project/${id}/initiatives/${editingTask.initiativeId}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                        >
                                            <span className="material-symbols-outlined">arrow_outward</span>
                                            {t('projectTasks.pill.openInitiative')}
                                        </button>
                                    )}
                                </div>
                            )}

                            {taskPillEditor.type === 'category' && (
                                <div className="task-pill-editor__options">
                                    {allCategories.map((category) => (
                                        <button
                                            key={category.id}
                                            type="button"
                                            className={`task-pill-editor__option ${editingTaskCategories.includes(category.name) ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                const nextCategories = editingTaskCategories.includes(category.name)
                                                    ? editingTaskCategories.filter((name) => name !== category.name)
                                                    : [...editingTaskCategories, category.name];
                                                void updateTaskInline(editingTask, { category: nextCategories });
                                            }}
                                        >
                                            <span className="task-pill-editor__swatch" style={{ backgroundColor: category.color || '#64748b' }} />
                                            <span>{category.name}</span>
                                        </button>
                                    ))}
                                    {allCategories.length === 0 && (
                                        <div className="task-pill-editor__empty">{t('projectTasks.editor.category.empty')}</div>
                                    )}
                                </div>
                            )}

                            {taskPillEditor.type === 'dates' && (
                                <div className="task-pill-editor__dates">
                                    <div className="quick-date-field">
                                        <label htmlFor={`task-start-date-${editingTask.id}`}>{t('projectTasks.timeline.start')}</label>
                                        <div className="quick-date-field__control">
                                            <input
                                                id={`task-start-date-${editingTask.id}`}
                                                type="date"
                                                value={editingTaskStartDate}
                                                max={editingTaskDueDate || undefined}
                                                aria-label={t('projectTasks.actions.quickStartAria')}
                                                disabled={savingInlineTaskId === editingTask.id}
                                                onChange={(event) => handleQuickDateChange(editingTask, 'startDate', event.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="quick-date-field__clear"
                                                disabled={savingInlineTaskId === editingTask.id || !editingTaskStartDate}
                                                onClick={() => handleQuickDateChange(editingTask, 'startDate', '')}
                                                title={t('projectTasks.actions.clearStartDate')}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="quick-date-field">
                                        <label htmlFor={`task-due-date-${editingTask.id}`}>{t('projectTasks.timeline.due')}</label>
                                        <div className="quick-date-field__control">
                                            <input
                                                id={`task-due-date-${editingTask.id}`}
                                                type="date"
                                                value={editingTaskDueDate}
                                                min={editingTaskStartDate || undefined}
                                                aria-label={t('projectTasks.actions.quickDueAria')}
                                                disabled={savingInlineTaskId === editingTask.id}
                                                onChange={(event) => handleQuickDateChange(editingTask, 'dueDate', event.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="quick-date-field__clear"
                                                disabled={savingInlineTaskId === editingTask.id || !editingTaskDueDate}
                                                onClick={() => handleQuickDateChange(editingTask, 'dueDate', '')}
                                                title={t('projectTasks.actions.clearDueDate')}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </div>
            <OnboardingOverlay
                isOpen={onboardingActive}
                steps={onboardingSteps}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                onFinish={finish}
                onSkip={skip}
            />
        </>
    );
};
