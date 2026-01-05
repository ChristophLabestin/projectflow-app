import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';
import { getProjectById, subscribeProjectTasks, toggleTaskStatus, updateTaskFields, deleteTask, getSubTasks, getProjectCategories } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { Task, Project, TaskCategory, ProjectGroup } from '../types';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useConfirm } from '../context/UIContext';
import { ProjectBoard } from '../components/ProjectBoard';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';

export const ProjectTasks = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const [view, setView] = useState<'list' | 'board'>('list');
    const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title' | 'createdAt'>('dueDate');
    const [allCategories, setAllCategories] = useState<TaskCategory[]>([]);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const location = useLocation();
    const confirm = useConfirm();

    // Permissions
    const { can } = useProjectPermissions(project);
    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem } = usePinnedTasks();
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

            // Subscribe to project groups
            const unsubGroups = subscribeProjectGroups(id, setProjectGroups, p.tenantId);

            // Chain unsubscribe
            const oldUnsub = unsub;
            unsub = () => {
                if (oldUnsub) oldUnsub();
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
    const sortLabels = useMemo(() => ({
        priority: t('projectTasks.sort.priority'),
        dueDate: t('projectTasks.sort.dueDate'),
        title: t('projectTasks.sort.title'),
        createdAt: t('projectTasks.sort.created')
    }), [t]);

    const filteredTasks = useMemo(() => {
        const filtered = tasks.filter(t => {
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;
            if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
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
    }, [tasks, filter, search, sortBy]);

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
        const isStrategic = Boolean(task.convertedIdeaId);
        const hasStart = Boolean(task.startDate);
        const hasDue = Boolean(task.dueDate);
        const showTimeline = !isStrategic && hasStart && hasDue && !task.isCompleted;
        const showDueDate = !isStrategic && !hasStart && hasDue && !task.isCompleted;
        const showStrategicTimeline = isStrategic && hasStart && hasDue && !task.isCompleted;
        const showStrategicDue = isStrategic && !hasStart && hasDue && !task.isCompleted;
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = !!dueDate && dueDate < new Date() && !task.isCompleted;
        const priorityLabel = task.priority ? (priorityLabels[task.priority] || task.priority) : '';
        const statusLabel = task.status ? (statusLabels[task.status] || task.status) : '';
        const dependencyCount = task.dependencies?.length || 0;
        const dependencyLabel = dependencyCount === 1
            ? t('projectTasks.badge.dependency')
            : t('projectTasks.badge.dependencies');

        const dependentTasks = task.dependencies?.map(depId => tasks.find(t => t.id === depId)).filter(Boolean) as Task[] || [];
        const blockedBy = dependentTasks.filter(t => !t.isCompleted);
        const isBlocked = blockedBy.length > 0;

        const cardVariant = task.isCompleted ? 'completed' : isBlocked ? 'blocked' : task.convertedIdeaId ? 'strategic' : 'default';

        return (
            <div
                onClick={() => navigate(`/project/${id}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                className={`task-card ${cardVariant} ${isBoard ? 'is-board' : ''}`}
            >
                {/* Left: Status & Main Info */}
                <div className="task-main-info">
                    <button
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
                                {task.convertedIdeaId && (
                                    <div className="badge strategic">
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        {t('projectTasks.badge.strategic')}
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
                                        {priorityLabel}
                                    </div>
                                )}

                                {/* Blocked Indicator */}
                                {isBlocked && (
                                    <div className="badge blocked group/blocked">
                                        <span className="material-symbols-outlined">link_off</span>
                                        {t('projectTasks.badge.blocked')}
                                        {/* Tooltip */}
                                        <div className="absolute left-0 top-full mt-2 w-48 p-3 bg-white dark:bg-[#1E1E1E] rounded-xl border border-orange-200 dark:border-orange-500/20 shadow-xl opacity-0 invisible group-hover/blocked:opacity-100 group-hover/blocked:visible transition-all z-50">
                                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">{t('projectTasks.badge.blockedBy')}</p>
                                            <div className="flex flex-col gap-1.5">
                                                {blockedBy.map(t => (
                                                    <div key={t.id} className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[12px] text-orange-400">lock</span>
                                                        <span className="text-xs font-medium truncate text-[var(--color-text-main)] w-full">
                                                            {t.title}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Dependency Count */}
                                {!isBlocked && (task.dependencies?.length || 0) > 0 && (
                                    <div className="badge dependency">
                                        <span className="material-symbols-outlined">link</span>
                                        {dependencyCount} {dependencyLabel}
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
                                    {statusLabel || t('tasks.status.unknown')}
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
                                return cats.map(catName => {
                                    const catData = allCategories.find(c => c.name === catName);
                                    const color = catData?.color || '#64748b';
                                    return (
                                        <div
                                            key={catName as string}
                                            className="badge category"
                                            style={{
                                                backgroundColor: `${color}10`,
                                                color: color,
                                                borderColor: `${color}30`
                                            }}
                                        >
                                            {catName as string}
                                        </div>
                                    );
                                });
                            })()}
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
                        <div className={`timeline-widget ${isBoard ? 'w-full' : 'w-56'}`}>
                            <div className="timeline-header">
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">timeline</span>
                                    {t('projectTasks.timeline.strategic')}
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
                            <div className="dates-row">
                                <span>{t('projectTasks.timeline.start')} {format(new Date(task.startDate!), dateFormat, { locale: dateLocale })}</span>
                                <span className={new Date(task.dueDate!) < new Date() ? 'overdue' : ''}>
                                    {t('projectTasks.timeline.due')} {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                </span>
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
                            <div className="dates-row">
                                <span>{format(new Date(task.startDate!), dateFormat, { locale: dateLocale })}</span>
                                <span className={new Date(task.dueDate!) < new Date() ? 'overdue' : ''}>
                                    {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                </span>
                            </div>
                        </div>
                    )}

                    {showStrategicDue && dueDate && (
                        <div className={`timeline-widget ${isBoard ? 'w-full' : 'w-56'}`}>
                            <div className={`due-date-box ${isOverdue ? 'overdue' : 'normal'}`}>
                                <span className="material-symbols-outlined text-[18px]">event</span>
                                <div className="flex flex-col">
                                    <span className="date-label">{t('projectTasks.timeline.strategicDue')}</span>
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
                                    <span className="date-label">{t('projectTasks.timeline.due')}</span>
                                    <span className="date-val small">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="action-btn-group">
                        {can('canManageTasks') && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                className="action-btn delete"
                            >
                                <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                        )}
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
                                        projectId: id!,
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
                            title={isPinned(task.id) ? t('projectTasks.actions.unpinTitle') : t('projectTasks.actions.pinTitle')}
                        >
                            <span className={`material-symbols-outlined text-xl transition-colors duration-300 ${focusItemId === task.id ? 'text-amber-500' : 'text-inherit'}`}>
                                push_pin
                            </span>
                        </button>
                        <div className="action-btn">
                            <span className="material-symbols-outlined text-xl">east</span>
                        </div>
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
        <>
            <div className="project-tasks-container">

                {/* Premium Header */}
                <div data-onboarding-id="project-tasks-header" className="tasks-header">
                    <div>
                        <h1>
                            {t('projectTasks.header.title')} <span>{t('projectTasks.header.titleEmphasis')}</span>
                        </h1>
                        <p className="subtitle">
                            {project?.name
                                ? t('projectTasks.header.subtitleWithProject').replace('{project}', project.name)
                                : t('projectTasks.header.subtitleFallback')}
                        </p>
                    </div>
                    {can('canManageTasks') && (
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            icon={<span className="material-symbols-outlined font-bold">add</span>}
                            variant="primary"
                            size="lg"
                            className="new-task-btn"
                        >
                            {t('projectTasks.actions.newTask')}
                        </Button>
                    )}
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
                                        <span className="badge">
                                            {stat.progress}%
                                        </span>
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
                                    onClick={() => setView(v)}
                                    className={`control-btn ${view === v ? 'active' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-lg">{v === 'list' ? 'format_list_bulleted' : 'dashboard'}</span>
                                    {viewLabels[v]}
                                </button>
                            ))}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="sort-dropdown">
                            <button className="sort-btn">
                                <span className="material-symbols-outlined text-lg">sort</span>
                                <span className="hidden sm:inline">{t('projectTasks.sort.label')}</span>
                                <span className="active-sort">
                                    {sortLabels[sortBy]}
                                </span>
                                <span className="material-symbols-outlined chevron">expand_more</span>
                            </button>
                            <div className="sort-menu">
                                {([
                                    { value: 'priority', label: t('projectTasks.sort.priority'), icon: 'flag' },
                                    { value: 'dueDate', label: t('projectTasks.sort.dueDate'), icon: 'event' },
                                    { value: 'title', label: t('projectTasks.sort.title'), icon: 'sort_by_alpha' },
                                    { value: 'createdAt', label: t('projectTasks.sort.created'), icon: 'schedule' }
                                ] as const).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSortBy(opt.value)}
                                        className={`menu-item ${sortBy === opt.value ? 'selected' : ''}`}
                                    >
                                        <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                                        {opt.label}
                                        {sortBy === opt.value && (
                                            <span className="material-symbols-outlined text-sm ml-auto">check</span>
                                        )}
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
                            placeholder={t('projectTasks.search.placeholder')}
                        />
                        <span className="material-symbols-outlined search-icon">search</span>
                    </div>
                </div>

                {/* Enhanced View Area */}
                <div data-onboarding-id="project-tasks-view" className="view-area-container">
                    {filteredTasks.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon-circle">
                                <span className="material-symbols-outlined animate-pulse">explore_off</span>
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
                    <TaskCreateModal
                        projectId={id}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={(updated) => {
                            setTasks(updated);
                            setShowCreateModal(false);
                        }}
                    />
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
