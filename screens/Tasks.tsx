import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getUserTasks, toggleTaskStatus, addTask, getUserProjects, deleteTask, getSubTasks, getProjectCategories } from '../services/dataService';
import { Project, Task, TaskCategory } from '../types';
import { toMillis } from '../utils/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useConfirm } from '../context/UIContext';
import { ProjectBoard } from '../components/ProjectBoard';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { useArrowReplacement } from '../hooks/useArrowReplacement';

export const Tasks = () => {
    const { t, language, dateFormat, dateLocale } = useLanguage();
    const locale = language === 'de' ? 'de-DE' : 'en-US';
    const navigate = useNavigate();
    const location = useLocation();
    const confirm = useConfirm();

    // Data State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const [allCategories, setAllCategories] = useState<TaskCategory[]>([]); // We might need to fetch basic cats or skip

    // View State
    const [view, setView] = useState<'list' | 'board'>('list');
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title' | 'createdAt'>('dueDate');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Additional Global Filters
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');

    const user = auth.currentUser;
    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem } = usePinnedTasks();

    // Arrow Replacement for Search
    const handleSearchChange = useArrowReplacement((e) => setSearch(e.target.value));

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [taskData, projectData] = await Promise.all([getUserTasks(), getUserProjects()]);
                setTasks(taskData);
                setProjects(projectData);
            } catch (error) {
                console.error('Failed to fetch tasks', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Load Subtask Stats
    useEffect(() => {
        const loadSubtaskStats = async () => {
            if (!tasks.length) return;
            try {
                // Optimization: only load for visible tasks if possible, but for now load all to match project view
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

    const handleToggle = async (taskId: string, currentStatus: boolean) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus);
    };

    const handleDelete = async (taskId: string) => {
        if (!await confirm(t('tasks.confirm.deleteTitle'), t('tasks.confirm.deleteMessage'))) return;
        try {
            await deleteTask(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) {
            console.error(e);
        }
    };

    const projectNameById = useMemo(() => {
        const entries = projects.map((p) => [p.id, p.title] as const);
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

    const sortLabels = useMemo(() => ({
        priority: t('tasks.sort.priority'),
        dueDate: t('tasks.sort.dueDate'),
        title: t('tasks.sort.title'),
        createdAt: t('tasks.sort.created')
    }), [t]);

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

    const filteredTasks = useMemo(() => {
        let result = tasks.filter(t => {
            // Status Logic matching ProjectTasks
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;

            // Search
            if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;

            // Project Filter
            if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;

            // Priority Filter
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

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
        const open = tasks.filter(t => !t.isCompleted).length;
        const completed = tasks.filter(t => t.isCompleted).length;
        const urgent = tasks.filter(t => t.priority === 'Urgent' && !t.isCompleted).length;
        const high = tasks.filter(t => t.priority === 'High' && !t.isCompleted).length;
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
        const blockedBy: Task[] = []; // Placeholder

        const projectTitle = projectNameById[task.projectId];
        const cardVariant = task.isCompleted ? 'completed' : isBlocked ? 'blocked' : task.convertedIdeaId ? 'strategic' : 'default';

        return (
            <div
                onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}${task.tenantId ? `?tenant=${task.tenantId}` : ''}`)}
                className={`task-card ${cardVariant} ${isBoard ? 'is-board' : ''}`}
            >
                {/* Left: Status & Main Info */}
                <div className="task-main-info">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.isCompleted); }}
                        className={`check-btn ${task.isCompleted ? 'checked' : ''}`}
                    >
                        <span className="material-symbols-outlined">check</span>
                    </button>

                    <div className="info-content">
                        <div className="title-row">
                            {/* Project Pill - NEW for Global View */}
                            {projectTitle && (
                                <div
                                    onClick={(e) => { e.stopPropagation(); navigate(`/project/${task.projectId}`); }}
                                    className="project-pill"
                                >
                                    <span className="dot" />
                                    {projectTitle}
                                </div>
                            )}

                            <h4 className={`task-title ${task.isCompleted ? 'completed' : ''}`}>
                                {task.title}
                            </h4>
                            <div className="meta-row">
                                {task.convertedIdeaId && (
                                    <div className="badge strategic">
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        {t('tasks.card.strategic')}
                                    </div>
                                )}
                                {task.priority && (
                                    <div className={`badge priority-${task.priority.toLowerCase()}`}>
                                        <span className="material-symbols-outlined">
                                            {task.priority === 'Urgent' ? 'error' :
                                                task.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                    task.priority === 'Medium' ? 'drag_handle' :
                                                        'keyboard_arrow_down'}
                                        </span>
                                        {priorityLabels[task.priority as keyof typeof priorityLabels] || task.priority}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="meta-row">
                            {task.status && (
                                <div className={`badge status ${task.status.toLowerCase().replace(' ', '-')}`}>
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
                                </div>
                            )}
                            {subtaskStats[task.id]?.total > 0 && (
                                <div className="badge subtasks">
                                    <span className="material-symbols-outlined">checklist</span>
                                    {subtaskStats[task.id].done}/{subtaskStats[task.id].total}
                                </div>
                            )}
                            {(() => {
                                const cats = Array.isArray(task.category) ? task.category : [task.category].filter(Boolean);
                                return cats.map(catName => (
                                    <div key={catName as string} className="badge category" style={{ borderColor: 'rgba(100, 116, 139, 0.2)', color: '#64748b', backgroundColor: 'rgba(100, 116, 139, 0.1)' }}>
                                        {catName as string}
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>

                {/* Right: Timeline & Actions */}
                <div className={`task-actions-section ${isBoard ? 'is-board' : ''}`}>
                    {/* Minimal Timeline */}
                    {showStrategicTimeline && (
                        <div className={`timeline-widget ${isBoard ? 'w-full' : 'w-56'}`}>
                            <div className="timeline-header">
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">timeline</span>
                                    {t('tasks.card.strategicTimeline')}
                                </span>
                                {(() => {
                                    const start = new Date(task.startDate!).getTime();
                                    const end = new Date(task.dueDate!).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return <span>{Math.round(pct)}%</span>;
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
                        <div className={`timeline-widget ${isBoard ? 'w-full' : 'w-32'}`}>
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
                        <div className={`timeline-widget ${isBoard ? 'w-full' : 'w-56'}`}>
                            <div className={`due-date-box ${isOverdue ? 'overdue' : 'normal'}`}>
                                <span className="material-symbols-outlined text-[18px]">event</span>
                                <div className="flex flex-col">
                                    <span className="date-label">{t('tasks.card.strategicDue')}</span>
                                    <span className="date-val">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {showDueDate && dueDate && (
                        <div className={`timeline-widget ${isBoard ? 'w-full' : 'w-32'}`}>
                            <div className={`due-date-box simple ${isOverdue ? 'overdue' : ''}`}>
                                <span className="material-symbols-outlined text-[16px]">event</span>
                                <div className="flex flex-col">
                                    <span className="date-label">{t('tasks.card.due')}</span>
                                    <span className="date-val small">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="action-btn-group">
                        <button
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
                                        priority: task.priority,
                                        isCompleted: task.isCompleted
                                    });
                                }
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setFocusItem(focusItemId === task.id ? null : task.id);
                            }}
                            className={`action-btn pin ${isPinned(task.id) ? 'pinned' : 'unpinned'}`}
                            title={isPinned(task.id) ? t('tasks.actions.unpin') : t('tasks.actions.pin')}
                        >
                            <span className={`material-symbols-outlined text-xl transition-colors duration-300 ${focusItemId === task.id ? 'text-amber-500' : 'text-inherit'}`}>
                                push_pin
                            </span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                            className="action-btn delete"
                            title={t('tasks.actions.delete')}
                        >
                            <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                    </div>
                </div>
            </div >
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="project-tasks-container">
            {/* Header */}
            <div className="tasks-header">
                <div>
                    <h1>
                        {t('tasks.header.titlePrefix')}{' '}
                        <span>{t('tasks.header.titleEmphasis')}</span>
                    </h1>
                    <p className="subtitle">
                        {t('tasks.header.subtitle')}
                    </p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    icon={<span className="material-symbols-outlined font-bold">add</span>}
                    variant="primary"
                    size="lg"
                    className="new-task-btn"
                >
                    {t('tasks.actions.newTask')}
                </Button>
            </div>

            {/* Stats Row */}
            <div className="tasks-stats-grid">
                {[
                    { label: t('tasks.stats.openTasks'), val: stats.open, icon: 'list_alt', color: 'indigo' },
                    { label: t('tasks.stats.completed'), val: stats.completed, icon: 'check_circle', color: 'emerald', progress: stats.progress },
                    { label: t('tasks.stats.highPriority'), val: stats.high, icon: 'priority_high', color: 'amber' },
                    { label: t('tasks.stats.urgent'), val: stats.urgent, icon: 'warning', color: 'rose' }
                ].map((stat, idx) => (
                    <div key={idx} className={`stat-card variant-${stat.color}`}>
                        <div className="bg-icon">
                            <span className="material-symbols-outlined">{stat.icon}</span>
                        </div>
                        <div className="content">
                            <p className="label">{stat.label}</p>
                            <div className="value-row">
                                <p className="value">{stat.val}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls Bar */}
            <div className="tasks-controls-bar">
                <div className="controls-group-wrapper">
                    <div className="control-group">
                        {(['active', 'completed', 'all'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`control-btn ${filter === f ? 'active' : ''}`}
                            >
                                {t(`tasks.filters.activity.${f}`)}
                            </button>
                        ))}
                    </div>

                    <div className="control-group">
                        {(['list', 'board'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`control-btn ${view === v ? 'active' : ''}`}
                            >
                                <span className="material-symbols-outlined text-lg">{v === 'list' ? 'format_list_bulleted' : 'dashboard'}</span>
                                {t(`tasks.view.${v}`)}
                            </button>
                        ))}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="sort-dropdown">
                        <button className="sort-btn">
                            <span className="material-symbols-outlined text-lg">sort</span>
                            <span className="hidden sm:inline">{t('tasks.sort.label')}</span>
                            <span className="active-sort">
                                {sortLabels[sortBy]}
                            </span>
                            <span className="material-symbols-outlined chevron">expand_more</span>
                        </button>
                        <div className="sort-menu">
                            {([
                                { value: 'priority', label: t('tasks.sort.priority'), icon: 'flag' },
                                { value: 'dueDate', label: t('tasks.sort.dueDate'), icon: 'event' },
                                { value: 'title', label: t('tasks.sort.title'), icon: 'sort_by_alpha' },
                                { value: 'createdAt', label: t('tasks.sort.created'), icon: 'schedule' }
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSortBy(opt.value)}
                                    className={`menu-item ${sortBy === opt.value ? 'selected' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Project Filter */}
                    <div className="project-filter-dropdown">
                        <button className="filter-btn">
                            <span className="material-symbols-outlined text-lg">folder_open</span>
                            <span className="truncate">
                                {projectFilter === 'all'
                                    ? t('tasks.filters.project.all')
                                    : projectNameById[projectFilter] || t('tasks.filters.project.unknown')}
                            </span>
                            <span className="material-symbols-outlined chevron">expand_more</span>
                        </button>
                        <div className="filter-menu">
                            <button
                                onClick={() => setProjectFilter('all')}
                                className={`menu-item ${projectFilter === 'all' ? 'selected' : ''}`}
                            >
                                {t('tasks.filters.project.all')}
                            </button>
                            {projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setProjectFilter(p.id)}
                                    className={`menu-item ${projectFilter === p.id ? 'selected' : ''}`}
                                >
                                    <span className="truncate">{p.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="search-wrapper">
                    <input
                        type="text"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder={t('tasks.search.placeholder')}
                    />
                    <span className="material-symbols-outlined search-icon">search</span>
                </div>
            </div>

            {/* Content using new styles */}
            <div className="view-area-container">
                {filteredTasks.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon-circle">
                            <span className="material-symbols-outlined animate-pulse">explore_off</span>
                        </div>
                        <h3>{t('tasks.empty.list.title')}</h3>
                        <p>
                            {t('tasks.empty.list.description')}
                        </p>
                        <Button
                            variant="secondary"
                            className="create-btn"
                            onClick={() => setShowCreateModal(true)}
                        >
                            {t('tasks.empty.list.action')}
                        </Button>
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

            {/* Create Task Modal */}
            {showCreateModal && (
                <TaskCreateModal
                    projectId={projectFilter !== 'all' ? projectFilter : (projects[0]?.id || '')}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={async () => {
                        const taskData = await getUserTasks();
                        setTasks(taskData);
                        setShowCreateModal(false);
                    }}
                />
            )}
        </div>
    );
};
