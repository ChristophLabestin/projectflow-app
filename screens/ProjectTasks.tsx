import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getProjectById, subscribeProjectTasks, toggleTaskStatus, updateTaskFields, deleteTask, getSubTasks } from '../services/dataService';
import { Task, Project } from '../types';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useConfirm } from '../context/UIContext';

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
    const location = useLocation();
    const confirm = useConfirm();

    // Permissions
    const { can } = useProjectPermissions(project);
    const { pinItem, unpinItem, isPinned } = usePinnedTasks();

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

            // Subscribe to tasks with the correct tenantId
            unsub = subscribeProjectTasks(id, (taskData) => {
                setTasks(taskData);
                setLoading(false);
            }, p.tenantId);
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

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;
            if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [tasks, filter, search]);

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
        if (!await confirm("Delete Tasks", `Delete ${selectedIds.size} tasks?`)) return;
        try {
            await Promise.all(Array.from(selectedIds).map((id: string) => deleteTask(id)));
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            setError('Failed to delete tasks.');
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

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 fade-in max-w-6xl mx-auto pb-12">

            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-main)] mb-2">Tasks</h1>
                    <p className="text-[var(--color-text-muted)] text-lg">Manage, track, and prioritize your project work.</p>
                </div>
                {can('canManageTasks') && (
                    <Button
                        onClick={() => setShowCreateModal(true)}
                        icon={<span className="material-symbols-outlined">add</span>}
                        variant="primary"
                        size="lg"
                        className="shadow-lg shadow-indigo-500/20"
                    >
                        New Task
                    </Button>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-[var(--color-surface-bg)] border border-indigo-100 dark:border-indigo-500/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-indigo-500">list_alt</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Open Tasks</p>
                        <p className="text-3xl font-bold text-[var(--color-text-main)]">{stats.open}</p>
                    </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-[var(--color-surface-bg)] border border-emerald-100 dark:border-emerald-500/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-emerald-500">check_circle</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Completed</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-[var(--color-text-main)]">{stats.completed}</p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                {stats.progress}%
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-[var(--color-surface-bg)] border border-amber-100 dark:border-amber-500/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-amber-500">priority_high</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">High Priority</p>
                        <p className="text-3xl font-bold text-[var(--color-text-main)]">{stats.high}</p>
                    </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-[var(--color-surface-bg)] border border-rose-100 dark:border-rose-500/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-rose-500">warning</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">Urgent</p>
                        <p className="text-3xl font-bold text-[var(--color-text-main)]">{stats.urgent}</p>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-10 backdrop-blur-xl bg-white/50 dark:bg-black/20 p-2 rounded-2xl border border-[var(--color-surface-border)] shadow-sm">

                {/* Tabs */}
                <div className="flex bg-[var(--color-surface-hover)] rounded-xl p-1 w-full md:w-auto">
                    {(['active', 'completed', 'all'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`
                                flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all capitalize
                                ${filter === f
                                    ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-black/5 dark:hover:bg-white/5'}
                            `}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-80 group">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tasks..."
                        className="w-full bg-[var(--color-surface-bg)] border-none ring-1 ring-[var(--color-surface-border)] focus:ring-2 focus:ring-[var(--color-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all"
                    />
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                </div>
            </div>

            {/* Task List */}
            <div className="flex flex-col gap-3">
                {filteredTasks.length === 0 ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-surface-border)] rounded-2xl bg-[var(--color-surface-bg)]/50">
                        <div className="bg-[var(--color-surface-hover)] p-4 rounded-full mb-4">
                            <span className="material-symbols-outlined text-4xl opacity-50">checklist_rtl</span>
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-1">No tasks found</h3>
                        <p className="max-w-xs mx-auto">Try adjusting your filters or search terms, or create a new task.</p>
                        {can('canManageTasks') && (
                            <Button variant="secondary" className="mt-6" onClick={() => setShowCreateModal(true)}>Create Task</Button>
                        )}
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => navigate(`/project/${id}/tasks/${task.id}`)}
                            className="group flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] hover:shadow-md hover:bg-white dark:hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer relative overflow-hidden"
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.isCompleted); }}
                                disabled={!can('canManageTasks')}
                                className={`
                                    flex-shrink-0 size-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 z-10
                                    ${!can('canManageTasks') ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${task.isCompleted
                                        ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-500/20'
                                        : 'border-[var(--color-surface-border)] hover:border-green-500 text-transparent bg-[var(--color-surface-paper)]'}
                                `}
                            >
                                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                            </button>

                            <div className="flex-1 min-w-0 flex flex-col gap-1 z-10">
                                <div className="flex items-center gap-3">
                                    <span className={`text-base font-semibold leading-tight transition-colors ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>
                                        {task.title}
                                    </span>
                                    {task.priority === 'Urgent' && <Badge size="sm" variant="danger" className="animate-pulse">Urgent</Badge>}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
                                    {task.priority && task.priority !== 'Urgent' && (
                                        <Badge size="sm" variant={task.priority === 'High' ? 'warning' : 'secondary'}>
                                            {task.priority}
                                        </Badge>
                                    )}
                                    {task.status && (
                                        <span className="flex items-center gap-1">
                                            <span className={`size-1.5 rounded-full ${task.status === 'Done' ? 'bg-green-500' : task.status === 'In Progress' ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                                            {task.status}
                                        </span>
                                    )}
                                    {task.dueDate && (
                                        <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.isCompleted ? 'text-rose-500 font-bold' : ''}`}>
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    )}
                                    {task.scheduledDate && (
                                        <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-md">
                                            <span className="material-symbols-outlined text-[14px]">event_available</span>
                                            <span>Scheduled {new Date(task.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    )}
                                    {subtaskStats[task.id]?.total > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">checklist</span>
                                            <span>{subtaskStats[task.id].done}/{subtaskStats[task.id].total}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 z-10 ${isPinned(task.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
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
                                    className={`
                                        p-2 rounded-full transition-all duration-200
                                        ${isPinned(task.id)
                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 scale-100'
                                            : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:scale-105'}
                                    `}
                                    title={isPinned(task.id) ? "Unpin" : "Pin for Quick Access"}
                                >
                                    <span className="material-symbols-outlined text-lg">{isPinned(task.id) ? 'push_pin' : 'push_pin'}</span>
                                </button>
                                {!isPinned(task.id) && (
                                    <div className="p-2 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-border)] transition-colors">
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
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
    );
};
