import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getProjectById, subscribeProjectTasks, toggleTaskStatus, updateTaskFields, deleteTask, getSubTasks, getProjectCategories } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { Task, Project, TaskCategory, ProjectGroup } from '../types';
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
    const [view, setView] = useState<'list' | 'board'>('list');
    const [allCategories, setAllCategories] = useState<TaskCategory[]>([]);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const location = useLocation();
    const confirm = useConfirm();

    // Permissions
    const { can } = useProjectPermissions(project);
    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem } = usePinnedTasks();

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
        if (!await confirm("Delete Task", "Are you sure you want to delete this task?")) return;
        try {
            await deleteTask(taskId);
        } catch (e) {
            console.error(e);
            setError('Failed to delete task.');
        }
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

    const TaskCard = ({ task, isBoard = false }: { task: Task; isBoard?: boolean }) => (
        <div
            onClick={() => navigate(`/project/${id}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
            className={`
                group relative flex ${isBoard ? 'flex-col' : 'flex-col md:flex-row md:items-center'} gap-4 p-5 rounded-[24px] border transition-all duration-300 cursor-pointer
                ${task.isCompleted
                    ? 'bg-slate-50/50 dark:bg-white/[0.01] border-slate-100 dark:border-white/5 opacity-80'
                    : task.convertedIdeaId
                        ? 'bg-gradient-to-r from-indigo-50/50 to-white dark:from-indigo-950/10 dark:to-transparent border-indigo-100 dark:border-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/10'
                        : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-[var(--color-primary)]/30 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5'
                }
            `}
        >
            {/* Left: Status & Main Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.isCompleted); }}
                    disabled={!can('canManageTasks')}
                    className={`
                        flex-shrink-0 size-7 rounded-xl border-2 flex items-center justify-center transition-all duration-300
                        ${!can('canManageTasks') ? 'opacity-30 cursor-not-allowed' : ''}
                        ${task.isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 rotate-0'
                            : 'border-slate-300 dark:border-white/20 hover:border-emerald-500 text-transparent bg-white dark:bg-transparent hover:rotate-12'}
                    `}
                >
                    <span className="material-symbols-outlined text-[18px] font-black">check</span>
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                        <h4 className={`text-lg font-bold truncate transition-all duration-300 ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]'}`}>
                            {task.title}
                        </h4>
                        {task.convertedIdeaId && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500 text-white shadow-sm shadow-indigo-500/20">
                                <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                Strategic
                            </div>
                        )}
                        {task.priority && (
                            <div className={`
                                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                ${task.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse' :
                                    task.priority === 'High' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                        task.priority === 'Medium' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                            'bg-slate-500/10 text-slate-500 border-slate-500/20'}
                            `}>
                                <span className="material-symbols-outlined text-[14px]">
                                    {task.priority === 'Urgent' ? 'error' :
                                        task.priority === 'High' ? 'keyboard_double_arrow_up' :
                                            task.priority === 'Medium' ? 'drag_handle' :
                                                'keyboard_arrow_down'}
                                </span>
                                {task.priority}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        {task.status && (
                            <div className={`
                                flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border transition-all duration-300
                                ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                                    task.status === 'In Progress' ? 'bg-blue-600/15 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]' :
                                        task.status === 'Review' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]' :
                                            task.status === 'Open' || task.status === 'Todo' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                                                task.status === 'Backlog' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 opacity-80' :
                                                    task.status === 'On Hold' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        task.status === 'Blocked' ? 'bg-rose-600/20 text-rose-500 border-rose-500/50 animate-pulse ring-1 ring-rose-500/20' :
                                                            'bg-slate-500/5 text-slate-400 border-slate-500/10'}
                            `}>
                                <span className="material-symbols-outlined text-[13px]">
                                    {task.status === 'Done' ? 'check_circle' :
                                        task.status === 'In Progress' ? 'sync' :
                                            task.status === 'Review' ? 'visibility' :
                                                task.status === 'Open' || task.status === 'Todo' ? 'play_circle' :
                                                    task.status === 'Backlog' ? 'inventory_2' :
                                                        task.status === 'On Hold' ? 'pause_circle' :
                                                            task.status === 'Blocked' ? 'dangerous' :
                                                                'circle'}
                                </span>
                                {task.status}
                            </div>
                        )}
                        {subtaskStats[task.id]?.total > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                                <span className="material-symbols-outlined text-[12px]">checklist</span>
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
                                        className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border"
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
                        <div className="flex -space-x-1.5 overflow-hidden py-1">
                            {task.assignedGroupIds?.map(gid => {
                                const group = projectGroups.find(g => g.id === gid);
                                if (!group) return null;
                                return (
                                    <div
                                        key={gid}
                                        className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#1E1E1E]"
                                        style={{ backgroundColor: group.color }}
                                        title={`Group: ${group.name}`}
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
            <div className={`flex ${isBoard ? 'flex-col w-full' : 'flex-col md:flex-row md:items-center md:ml-auto'} gap-6 pl-11 md:pl-0`}>
                {/* Minimal Timeline */}
                {task.startDate && task.dueDate && !task.isCompleted && (
                    <div className={`flex flex-col gap-1.5 ${isBoard ? 'w-full px-1' : 'w-full md:w-32'}`}>
                        <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative ring-1 ring-black/[0.02]">
                            {(() => {
                                const start = new Date(task.startDate).getTime();
                                const end = new Date(task.dueDate).getTime();
                                const now = new Date().getTime();
                                const total = end - start;
                                const elapsed = now - start;
                                const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                return (
                                    <div
                                        className={`h-full absolute top-0 left-0 rounded-full transition-all duration-1000 ${task.convertedIdeaId ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-[var(--color-primary)] shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.5)]'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                );
                            })()}
                        </div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter opacity-50">
                            <span>{new Date(task.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            <span className={new Date(task.dueDate) < new Date() ? 'text-rose-500' : ''}>
                                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {can('canManageTasks') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                            className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
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
                        className={`
                            size-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0
                            bg-slate-100 dark:bg-white/5
                            ${isPinned(task.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 shadow-sm'}
                        `}
                        title={isPinned(task.id) ? 'Unpin (Right-click to focus)' : 'Pin (Right-click to focus)'}
                    >
                        <span className={`material-symbols-outlined text-xl transition-colors duration-300 ${focusItemId === task.id ? 'text-amber-500' : 'text-white'}`}>
                            push_pin
                        </span>
                    </button>
                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[var(--color-text-main)] transition-all duration-300 group-hover:bg-[var(--color-primary)] group-hover:text-white group-hover:translate-x-1 shrink-0">
                        <span className="material-symbols-outlined text-xl">east</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 fade-in max-w-6xl mx-auto pb-20 px-4 md:px-0">

            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-4xl font-black text-[var(--color-text-main)] tracking-tight mb-2">
                        Project <span className="text-[var(--color-primary)]">Tasks</span>
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-lg font-medium opacity-80">
                        {project?.name ? `Managing work for ${project.name}` : 'Track and prioritize your project work.'}
                    </p>
                </div>
                {can('canManageTasks') && (
                    <Button
                        onClick={() => setShowCreateModal(true)}
                        icon={<span className="material-symbols-outlined font-bold">add</span>}
                        variant="primary"
                        size="lg"
                        className="shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all px-8 py-4 rounded-2xl"
                    >
                        New Task
                    </Button>
                )}
            </div>

            {/* Stats Row - Kept as requested but refined */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Open Tasks', val: stats.open, icon: 'list_alt', color: 'indigo' },
                    { label: 'Completed', val: stats.completed, icon: 'check_circle', color: 'emerald', progress: stats.progress },
                    { label: 'High Priority', val: stats.high, icon: 'priority_high', color: 'amber' },
                    { label: 'Urgent', val: stats.urgent, icon: 'warning', color: 'rose' }
                ].map((stat, idx) => (
                    <div key={idx} className={`p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-${stat.color}-100 dark:border-${stat.color}-500/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300`}>
                        <div className="absolute -right-2 -top-2 p-4 opacity-[0.05] group-hover:opacity-[0.15] group-hover:scale-110 transition-all duration-500">
                            <span className={`material-symbols-outlined text-8xl text-${stat.color}-500`}>{stat.icon}</span>
                        </div>
                        <div className="relative z-10">
                            <p className={`text-xs font-bold text-${stat.color}-600 dark:text-${stat.color}-400 uppercase tracking-[0.1em] mb-2`}>{stat.label}</p>
                            <div className="flex items-baseline gap-3">
                                <p className="text-4xl font-black text-[var(--color-text-main)]">{stat.val}</p>
                                {stat.progress !== undefined && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                        {stat.progress}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Interactive Controls Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 sticky top-6 z-20">
                <div className="flex flex-wrap gap-2">
                    <div className="flex bg-white/60 dark:bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 ring-1 ring-black/5">
                        {(['active', 'completed', 'all'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    relative flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize z-10
                                    ${filter === f
                                        ? 'text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                {filter === f && (
                                    <div className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl shadow-sm z-[-1] fade-in" />
                                )}
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-white/60 dark:bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 ring-1 ring-black/5">
                        {(['list', 'board'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`
                                    relative flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize z-10 flex items-center gap-2
                                    ${view === v
                                        ? 'text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                {view === v && (
                                    <div className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl shadow-sm z-[-1] fade-in" />
                                )}
                                <span className="material-symbols-outlined text-lg">{v === 'list' ? 'format_list_bulleted' : 'dashboard'}</span>
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative group w-full lg:w-96 shadow-xl shadow-black/5">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search project tasks..."
                        className="w-full bg-white/60 dark:bg-black/40 backdrop-blur-2xl border-none ring-1 ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl pl-12 pr-6 py-4 text-sm font-medium transition-all outline-none"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                </div>
            </div>

            {/* Enhanced View Area */}
            <div className="flex flex-col gap-4 min-h-[400px]">
                {filteredTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/30 dark:bg-white/[0.02] border-2 border-dashed border-black/5 dark:border-white/5 rounded-[32px] fade-in">
                        <div className="size-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-indigo-500/5">
                            <span className="material-symbols-outlined text-5xl text-indigo-500 animate-pulse">explore_off</span>
                        </div>
                        <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">No tasks matching your criteria</h3>
                        <p className="text-[var(--color-text-muted)] max-w-sm font-medium opacity-70">
                            Try adjusting your search terms or filters to find what you're looking for.
                        </p>
                        {can('canManageTasks') && (
                            <Button
                                variant="secondary"
                                className="mt-8 rounded-xl px-10"
                                onClick={() => setShowCreateModal(true)}
                            >
                                Create New Task
                            </Button>
                        )}
                    </div>
                ) : view === 'list' ? (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredTasks.map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(['Todo', 'In Progress', 'Done'] as const).map(columnStatus => (
                            <div key={columnStatus} className="flex flex-col gap-4">
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                                        {columnStatus}
                                    </h3>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white dark:bg-white/10 text-[var(--color-text-main)]">
                                        {filteredTasks.filter(t => t.status === columnStatus || (!t.status && columnStatus === 'Todo')).length}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {filteredTasks
                                        .filter(t => t.status === columnStatus || (!t.status && columnStatus === 'Todo'))
                                        .map(task => (
                                            <TaskCard key={task.id} task={task} isBoard />
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
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
