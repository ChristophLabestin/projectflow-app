import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getUserProjects } from '../services/domain/projectsService';
import { addTask, deleteTask, getSubTasks, getUserTasks, toggleTaskStatus } from '../services/domain/tasksService';
import { Project, Task } from '../types';
import { Button } from '../components/common/Button/Button';
import { Badge } from '../components/common/Badge/Badge';
import { TextInput } from '../components/common/Input/TextInput';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useConfirm } from '../context/UIContext';
import { ProjectBoard } from '../components/ProjectBoard';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { isProjectIncludedInImportantSignals } from '../services/healthService';

const TaskCreateModal = lazy(() => import('../components/TaskCreateModal').then((module) => ({ default: module.TaskCreateModal })));

export const Tasks = () => {
    const { t, dateFormat, dateLocale, taskPageTranslationsReady, loadTaskPageTranslations } = useLanguage();
    const navigate = useNavigate();
    const confirm = useConfirm();

    // Data State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});

    // View State
    const [view, setView] = useState<'list' | 'board'>('list');
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title' | 'createdAt'>('dueDate');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [quickTitle, setQuickTitle] = useState('');
    const [quickProjectId, setQuickProjectId] = useState(() => localStorage.getItem('projectflow_quick_add_project') || '');
    const [quickAdding, setQuickAdding] = useState(false);

    // Additional Global Filters
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');

    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem } = usePinnedTasks();

    // Arrow Replacement for Search
    const handleSearchChange = useArrowReplacement((e) => setSearch(e.target.value));

    useEffect(() => {
        void loadTaskPageTranslations();
    }, [loadTaskPageTranslations]);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [taskData, projectData] = await Promise.all([getUserTasks(), getUserProjects()]);
                setTasks(taskData);
                setProjects(projectData.filter(isProjectIncludedInImportantSignals));
            } catch (error) {
                console.error('Failed to fetch tasks', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!projects.length) return;
        if (!quickProjectId || !projects.some((project) => project.id === quickProjectId)) {
            setQuickProjectId(projects[0].id);
        }
    }, [projects, quickProjectId]);

    const handleQuickAdd = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!quickTitle.trim() || !quickProjectId || quickAdding) return;
        setQuickAdding(true);
        try {
            const project = projects.find((entry) => entry.id === quickProjectId);
            await addTask(quickProjectId, quickTitle.trim(), undefined, undefined, 'Medium', undefined, project?.tenantId);
            localStorage.setItem('projectflow_quick_add_project', quickProjectId);
            const refreshed = await getUserTasks();
            setTasks(refreshed);
            setQuickTitle('');
        } catch (error) {
            console.error('Quick add failed', error);
        } finally {
            setQuickAdding(false);
        }
    };

    // Load Subtask Stats (visible tasks only)
    useEffect(() => {
        const loadSubtaskStats = async () => {
            if (!tasks.length) return;
            const visibleIds = new Set(
                tasks
                    .filter((task) => {
                        if (filter === 'active' && task.isCompleted) return false;
                        if (filter === 'completed' && !task.isCompleted) return false;
                        if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
                        if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
                        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
                        return true;
                    })
                    .slice(0, 40)
                    .map((task) => task.id)
            );
            if (!visibleIds.size) return;
            try {
                const entries = await Promise.all(tasks.filter((task) => visibleIds.has(task.id)).map(async (task) => {
                    const subs = await getSubTasks(task.id, task.projectId, task.tenantId);
                    const done = subs.filter(s => s.isCompleted).length;
                    return [task.id, { done, total: subs.length }] as const;
                }));
                setSubtaskStats(Object.fromEntries(entries));
            } catch (err) {
                console.warn(err);
            }
        };
        loadSubtaskStats();
    }, [tasks, filter, search, projectFilter, priorityFilter]);

    const handleToggle = async (task: Task) => {
        const currentStatus = task.isCompleted;
        // Optimistic update
        setTasks(prev => prev.map(item => item.id === task.id ? { ...item, isCompleted: !currentStatus } : item));
        await toggleTaskStatus(task.id, currentStatus, task.projectId, task.tenantId);
    };

    const handleDelete = async (task: Task) => {
        if (!await confirm({
            title: t('tasks.confirm.deleteTitle'),
            message: t('tasks.confirm.deleteMessage'),
            confirmText: t('common.delete'),
            variant: 'danger'
        })) return;
        try {
            await deleteTask(task.id, task.projectId, task.tenantId);
            setTasks(prev => prev.filter(item => item.id !== task.id));
        } catch (e) {
            console.error(e);
        }
    };

    const projectNameById = useMemo(() => {
        const entries = projects.map((project) => [project.id, project.title] as const);
        return Object.fromEntries(entries);
    }, [projects]);

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

    const filterSelectOptions = useMemo<SelectOption[]>(() => ([
        { value: 'active', label: t('tasks.filters.activity.active') },
        { value: 'completed', label: t('tasks.filters.activity.completed') },
        { value: 'all', label: t('tasks.filters.activity.all') }
    ]), [t]);

    const viewLabels = useMemo(() => ({
        list: t('tasks.view.list'),
        board: t('tasks.view.board')
    }), [t]);

    const sortOptions = useMemo<SelectOption[]>(() => ([
        { value: 'priority', label: t('tasks.sort.priority') },
        { value: 'dueDate', label: t('tasks.sort.dueDate') },
        { value: 'title', label: t('tasks.sort.title') },
        { value: 'createdAt', label: t('tasks.sort.created') }
    ]), [t]);

    const projectOptions = useMemo<SelectOption[]>(() => ([
        { value: 'all', label: t('tasks.filters.project.all') },
        ...projects.map((project) => ({ value: project.id, label: project.title }))
    ]), [projects, t]);

    const priorityOptions = useMemo<SelectOption[]>(() => ([
        { value: 'all', label: t('tasks.filters.priority.any') },
        { value: 'Urgent', label: t('tasks.priority.urgent') },
        { value: 'High', label: t('tasks.priority.high') },
        { value: 'Medium', label: t('tasks.priority.medium') },
        { value: 'Low', label: t('tasks.priority.low') }
    ]), [t]);

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

    const filteredTasks = useMemo(() => {
        let result = tasks.filter(task => {
            // Status Logic matching ProjectTasks
            if (filter === 'active' && task.isCompleted) return false;
            if (filter === 'completed' && !task.isCompleted) return false;

            // Search
            if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;

            // Project Filter
            if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;

            // Priority Filter
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

            return true;
        });

        // Sort
        return result.sort((a, b) => {
            switch (sortBy) {
                case 'priority': {
                    const pA = priorityMap[a.priority || 'Medium'] || 0;
                    const pB = priorityMap[b.priority || 'Medium'] || 0;
                    if (pA !== pB) return pB - pA;
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB;
                }
                case 'dueDate': {
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB;
                }
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'createdAt': {
                    const createdA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                    const createdB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                    return createdB - createdA;
                }
                default:
                    return 0;
            }
        });
    }, [tasks, filter, search, sortBy, projectFilter, priorityFilter]);

    // Stats Calculation
    const stats = useMemo(() => {
        const total = tasks.length;
        const open = tasks.filter(task => !task.isCompleted).length;
        const completed = tasks.filter(task => task.isCompleted).length;
        const urgent = tasks.filter(task => task.priority === 'Urgent' && !task.isCompleted).length;
        const high = tasks.filter(task => task.priority === 'High' && !task.isCompleted).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Also calculate 'due today' and 'overdue' to match previous View if desired,
        // but current design uses ProjectTasks stats style (Urgent/High/Open/Completed)
        return { total, open, completed, urgent, high, progress };
    }, [tasks]);

    const TaskCard = ({ task, isBoard = false }: { task: Task; isBoard?: boolean }) => {
        const isStrategic = Boolean(task.convertedIdeaId);
        const hasStart = Boolean(task.startDate);
        const hasDue = Boolean(task.dueDate);
        const showTimeline = !isStrategic && hasStart && hasDue && !task.isCompleted;
        const showDueDate = !isStrategic && !hasStart && hasDue && !task.isCompleted;
        const showStrategicTimeline = isStrategic && hasStart && hasDue && !task.isCompleted;
        const showStrategicDue = isStrategic && !hasStart && hasDue && !task.isCompleted;
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = !!dueDate && dueDate < new Date() && !task.isCompleted;

        const isBlocked = false; // Logic simplification for global view as per original

        const projectTitle = projectNameById[task.projectId];
        const cardVariant = task.isCompleted ? 'completed' : isBlocked ? 'blocked' : task.convertedIdeaId ? 'strategic' : 'default';

        return (
            <div
                onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}${task.tenantId ? `?tenant=${task.tenantId}` : ''}`)}
                className={`task-card ${cardVariant} ${isBoard ? 'is-board' : ''} priority-stripe priority-stripe--${(task.priority || 'medium').toLowerCase()}`}
            >
                {/* Left: Status & Main Info */}
                <div className="task-main-info">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggle(task); }}
                        className={`check-btn ${task.isCompleted ? 'checked' : ''}`}
                    >
                        <span className="material-symbols-outlined">check</span>
                    </button>

                    <div className="info-content">
                        <div className="title-row">
                            {/* Project Pill - NEW for Global View */}
                            {projectTitle && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/project/${task.projectId}`); }}
                                    className="project-pill"
                                >
                                    <span className="dot" />
                                    <span className="project-pill__label">{projectTitle}</span>
                                </button>
                            )}

                            <h4 className={`task-title ${task.isCompleted ? 'completed' : ''}`}>
                                {task.title}
                            </h4>
                            <div className="meta-row">
                                {task.convertedIdeaId && (
                                    <Badge variant="neutral" className="badge strategic">
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        {t('tasks.card.strategic')}
                                    </Badge>
                                )}
                                {task.priority && (
                                    <Badge variant="neutral" className={`badge priority-${task.priority.toLowerCase()}`}>
                                        <span className="material-symbols-outlined">
                                            {task.priority === 'Urgent' ? 'error' :
                                                task.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                    task.priority === 'Medium' ? 'drag_handle' :
                                                        'keyboard_arrow_down'}
                                        </span>
                                        {priorityLabels[task.priority as keyof typeof priorityLabels] || task.priority}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="meta-row">
                            {task.status && (
                                <Badge variant="neutral" className={`badge status ${task.status.toLowerCase().replace(' ', '-')}`}>
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
                                    {statusLabels[task.status as keyof typeof statusLabels] || task.status}
                                </Badge>
                            )}
                            {subtaskStats[task.id]?.total > 0 && (
                                <Badge variant="neutral" className="badge subtasks">
                                    <span className="material-symbols-outlined">checklist</span>
                                    {subtaskStats[task.id].done}/{subtaskStats[task.id].total}
                                </Badge>
                            )}
                            {(() => {
                                const cats = Array.isArray(task.category) ? task.category : [task.category].filter(Boolean);
                                return cats.map(catName => (
                                    <Badge key={catName as string} variant="neutral" className="badge category">
                                        {catName as string}
                                    </Badge>
                                ));
                            })()}
                        </div>
                    </div>
                </div>

                {/* Right: Timeline & Actions */}
                <div className={`task-actions-section ${isBoard ? 'is-board' : ''}`}>
                    {/* Minimal Timeline */}
                    {showStrategicTimeline && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--wide'}`}>
                            <div className="timeline-header">
                                <span className="timeline-label">
                                    <span className="material-symbols-outlined timeline-icon">timeline</span>
                                    {t('tasks.card.strategicTimeline')}
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
                        </div>
                    )}

                    {showStrategicDue && dueDate && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--wide'}`}>
                            <div className={`due-date-box ${isOverdue ? 'overdue' : 'normal'}`}>
                                <span className="material-symbols-outlined due-date-icon">event</span>
                                <div className="due-date-info">
                                    <span className="date-label">{t('tasks.card.strategicDue')}</span>
                                    <span className="date-val">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {showDueDate && dueDate && (
                        <div className={`timeline-widget ${isBoard ? 'timeline-widget--full' : 'timeline-widget--compact'}`}>
                            <div className={`due-date-box simple ${isOverdue ? 'overdue' : ''}`}>
                                <span className="material-symbols-outlined due-date-icon">event</span>
                                <div className="due-date-info">
                                    <span className="date-label">{t('tasks.card.due')}</span>
                                    <span className="date-val small">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="action-btn-group">
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
                                        projectId: task.projectId,
                                        tenantId: task.tenantId,
                                        priority: task.priority,
                                        isCompleted: task.isCompleted
                                    });
                                }
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setFocusItem(focusItemId === task.id ? null : task.id);
                            }}
                            className={`action-btn action-btn--pin ${isPinned(task.id) ? 'pinned' : 'unpinned'}`}
                            title={isPinned(task.id) ? t('tasks.actions.unpin') : t('tasks.actions.pin')}
                        >
                            <span className={`material-symbols-outlined action-btn__icon ${focusItemId === task.id ? 'action-btn__icon--focused' : ''}`}>
                                push_pin
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(task); }}
                            className="action-btn action-btn--delete"
                            title={t('tasks.actions.delete')}
                        >
                            <span className="material-symbols-outlined action-btn__icon">delete</span>
                        </button>
                    </div>
                </div>
            </div >
        );
    };

    if (loading || !taskPageTranslationsReady) return (
        <div className="workstream-page workstream-page--tasks">
            <div className="workstream-page__loading">
                <span className="material-symbols-outlined workstream-page__loading-icon">progress_activity</span>
            </div>
        </div>
    );

    const metricCards = [
        { label: t('tasks.stats.openTasks'), value: String(stats.open), meta: t('tasks.filters.activity.active') },
        { label: t('tasks.stats.completed'), value: String(stats.completed), meta: `${stats.progress}%` },
        { label: t('tasks.stats.highPriority'), value: String(stats.high), meta: t('tasks.filters.priority.label') },
        { label: t('tasks.stats.urgent'), value: String(stats.urgent), meta: t(`tasks.view.${view}`) }
    ];

    return (
        <div className="workstream-page workstream-page--tasks">
            <header className="workstream-page__hero">
                <div className="workstream-page__hero-copy">
                    <h1 className="workstream-page__title">{t('tasks.header.titleEmphasis')}</h1>
                    <p className="workstream-page__subtitle">{t('tasks.header.subtitle')}</p>
                </div>
                <div className="workstream-page__actions">
                    <Button
                        onClick={() => setShowCreateModal(true)}
                        icon={<span className="material-symbols-outlined">add</span>}
                        variant="primary"
                    >
                        {t('tasks.actions.newTask')}
                    </Button>
                </div>
            </header>

            <form className="workstream-page__quick-add" onSubmit={handleQuickAdd}>
                <TextInput
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder={t('tasks.quickAdd.placeholder')}
                    className="workstream-page__quick-add-input"
                    disabled={quickAdding || projects.length === 0}
                />
                <Select
                    value={quickProjectId}
                    onChange={(value) => setQuickProjectId(value)}
                    options={projectOptions.filter((option) => option.value !== 'all')}
                    placeholder={t('tasks.quickAdd.selectProject')}
                    className="workstream-page__quick-add-project"
                    disabled={quickAdding || projects.length === 0}
                />
                <Button type="submit" variant="primary" disabled={quickAdding || !quickTitle.trim() || !quickProjectId}>
                    {t('tasks.quickAdd.action')}
                </Button>
            </form>

            <div className="workstream-page__metrics">
                {metricCards.map((metric) => (
                    <div key={metric.label} className="workstream-page__metric">
                        <span className="workstream-page__metric-label">{metric.label}</span>
                        <span className="workstream-page__metric-value">{metric.value}</span>
                        <span className="workstream-page__metric-meta">{metric.meta}</span>
                    </div>
                ))}
            </div>

            <div className="workstream-page__command">
                <div className="workstream-page__command-left">
                    <TextInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder={t('tasks.search.placeholder')}
                        className="workstream-page__search"
                        leftElement={<span className="material-symbols-outlined">search</span>}
                    />
                    <div className="workstream-page__command-filters">
                        <Select
                            value={filter}
                            onChange={(value) => setFilter(value as typeof filter)}
                            options={filterSelectOptions}
                            className="workstream-page__select"
                        />
                        <Select
                            value={sortBy}
                            onChange={(value) => setSortBy(value as typeof sortBy)}
                            options={sortOptions}
                            placeholder={t('tasks.sort.label')}
                            className="workstream-page__select"
                        />
                        <Select
                            value={projectFilter}
                            onChange={(value) => setProjectFilter(String(value))}
                            options={projectOptions}
                            placeholder={t('tasks.filters.project.label')}
                            className="workstream-page__select"
                        />
                        <Select
                            value={priorityFilter}
                            onChange={(value) => setPriorityFilter(String(value))}
                            options={priorityOptions}
                            placeholder={t('tasks.filters.priority.label')}
                            className="workstream-page__select"
                        />
                    </div>
                </div>
                <div className="workstream-page__command-right">
                    <div className="workstream-page__view-toggle" role="group" aria-label={t('tasks.view.list')}>
                        {(['list', 'board'] as const).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setView(v)}
                                className={`workstream-page__view-btn ${view === v ? 'is-active' : ''}`}
                                aria-pressed={view === v}
                                title={viewLabels[v]}
                                aria-label={viewLabels[v]}
                            >
                                <span className="material-symbols-outlined">{v === 'list' ? 'format_list_bulleted' : 'dashboard'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="workstream-page__body">
                {filteredTasks.length === 0 ? (
                    <div className="workstream-page__empty">
                        <span className="material-symbols-outlined workstream-page__empty-icon">task_alt</span>
                        <h3>{t('tasks.empty.list.title')}</h3>
                        <p>{t('tasks.empty.list.description')}</p>
                        <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                            {t('tasks.empty.list.action')}
                        </Button>
                    </div>
                ) : view === 'list' ? (
                    <div className="workstream-page__list">
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

            {/* Create Task Modal */}
            {showCreateModal && (
                <Suspense fallback={null}>
                    <TaskCreateModal
                        projectId={projectFilter !== 'all' ? projectFilter : (projects[0]?.id || '')}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={async () => {
                            const taskData = await getUserTasks();
                            setTasks(taskData);
                            setShowCreateModal(false);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};
