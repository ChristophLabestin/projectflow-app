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

        // Dependencies/Blocking logic requires checking specific project tasks logic which we don't have fully loaded here 
        // (we have all user tasks, so we MIGHT have the dependency if it's assigned to user, but not guaranteed).
        // Simplification: Skip dependency check for personal view unless we fetch ALL project tasks which getUserTasks might not do.
        // Assuming getUserTasks returns tasks assigned to user. Dependencies might be assigned to others.
        const isBlocked = false;
        const blockedBy: Task[] = [];

        const projectTitle = projectNameById[task.projectId];

        return (
            <div
                onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}${task.tenantId ? `?tenant=${task.tenantId}` : ''}`)}
                className={`
                    group relative flex ${isBoard ? 'flex-col' : 'flex-col md:flex-row md:items-center'} gap-4 p-5 rounded-[24px] border transition-all duration-300 cursor-pointer
                    ${task.isCompleted
                        ? 'bg-slate-50/50 dark:bg-white/[0.01] border-slate-100 dark:border-white/5 opacity-80'
                        : isBlocked
                            ? 'bg-orange-50/30 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
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
                        className={`
                        flex-shrink-0 size-7 rounded-xl border-2 flex items-center justify-center transition-all duration-300
                        ${task.isCompleted
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 rotate-0'
                                : 'border-slate-300 dark:border-white/20 hover:border-emerald-500 text-transparent bg-white dark:bg-transparent hover:rotate-12'}
                    `}
                    >
                        <span className="material-symbols-outlined text-[18px] font-black">check</span>
                    </button>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                            {/* Project Pill - NEW for Global View */}
                            {projectTitle && (
                                <div
                                    onClick={(e) => { e.stopPropagation(); navigate(`/project/${task.projectId}`); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer"
                                >
                                    <span className="size-1.5 rounded-full bg-slate-400 group-hover:bg-white/80" />
                                    {projectTitle}
                                </div>
                            )}

                            <h4 className={`text-lg font-bold truncate transition-all duration-300 ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]'}`}>
                                {task.title}
                            </h4>
                            {task.convertedIdeaId && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500 text-white shadow-sm shadow-indigo-500/20">
                                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                    {t('tasks.card.strategic')}
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
                                    {priorityLabels[task.priority as keyof typeof priorityLabels] || task.priority}
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
                                    {statusLabels[task.status as keyof typeof statusLabels] || task.status}
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
                                    // Use basic grey as we might not have all category colors loaded for all projects
                                    return (
                                        <div
                                            key={catName as string}
                                            className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-slate-500/10 text-slate-500 border-slate-500/20"
                                        >
                                            {catName as string}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

                {/* Right: Timeline & Actions */}
                <div className={`flex ${isBoard ? 'flex-col w-full' : 'flex-col md:flex-row md:items-center md:ml-auto'} gap-6 pl-11 md:pl-0`}>
                    {/* Minimal Timeline */}
                    {showStrategicTimeline && (
                        <div className={`flex flex-col gap-2 ${isBoard ? 'w-full px-1' : 'w-56'}`}>
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
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
                            <div className="h-2.5 bg-indigo-500/15 rounded-full overflow-hidden ring-1 ring-indigo-500/20">
                                {(() => {
                                    const start = new Date(task.startDate!).getTime();
                                    const end = new Date(task.dueDate!).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return (
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_0_16px_rgba(99,102,241,0.45)] transition-all duration-1000"
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                    {showTimeline && (
                        <div className={`flex flex-col gap-1.5 ${isBoard ? 'w-full px-1' : 'w-full md:w-32'}`}>
                            <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative ring-1 ring-black/[0.02]">
                                {(() => {
                                    const start = new Date(task.startDate!).getTime();
                                    const end = new Date(task.dueDate!).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return (
                                        <div
                                            className="h-full absolute top-0 left-0 rounded-full transition-all duration-1000 bg-[var(--color-primary)] shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.5)]"
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {showStrategicDue && dueDate && (
                        <div className={`flex flex-col gap-1.5 ${isBoard ? 'w-full px-1' : 'w-56'}`}>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm ${isOverdue ? 'border-rose-500/30 bg-rose-500/10 text-rose-500' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'}`}>
                                <span className="material-symbols-outlined text-[18px]">event</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">{t('tasks.card.strategicDue')}</span>
                                    <span className="text-sm font-semibold">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {showDueDate && dueDate && (
                        <div className={`flex flex-col gap-1.5 ${isBoard ? 'w-full px-1' : 'w-full md:w-32'}`}>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isOverdue ? 'border-rose-500/30 bg-rose-500/10 text-rose-500' : 'border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-[var(--color-text-main)]'}`}>
                                <span className="material-symbols-outlined text-[16px]">event</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">{t('tasks.card.due')}</span>
                                    <span className="text-xs font-semibold">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
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
                            className={`
                            size-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0
                            bg-slate-100 dark:bg-white/5
                            ${isPinned(task.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 shadow-sm'}
                        `}
                            title={isPinned(task.id) ? t('tasks.actions.unpin') : t('tasks.actions.pin')}
                        >
                            <span className={`material-symbols-outlined text-xl transition-colors duration-300 ${focusItemId === task.id ? 'text-amber-500' : 'text-white'}`}>
                                push_pin
                            </span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                            className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
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
        <div className="flex flex-col gap-8 fade-in max-w-6xl mx-auto pb-20 px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-4xl font-black text-[var(--color-text-main)] tracking-tight mb-2">
                        {t('tasks.header.titlePrefix')}{' '}
                        <span className="text-[var(--color-primary)]">{t('tasks.header.titleEmphasis')}</span>
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-lg font-medium opacity-80">
                        {t('tasks.header.subtitle')}
                    </p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    icon={<span className="material-symbols-outlined font-bold">add</span>}
                    variant="primary"
                    size="lg"
                    className="shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all px-8 py-4 rounded-2xl"
                >
                    {t('tasks.actions.newTask')}
                </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: t('tasks.stats.openTasks'), val: stats.open, icon: 'list_alt', color: 'indigo' },
                    { label: t('tasks.stats.completed'), val: stats.completed, icon: 'check_circle', color: 'emerald', progress: stats.progress },
                    { label: t('tasks.stats.highPriority'), val: stats.high, icon: 'priority_high', color: 'amber' },
                    { label: t('tasks.stats.urgent'), val: stats.urgent, icon: 'warning', color: 'rose' }
                ].map((stat, idx) => (
                    <div key={idx} className={`p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-${stat.color}-100 dark:border-${stat.color}-500/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300`}>
                        <div className="absolute -right-2 -top-2 p-4 opacity-[0.05] group-hover:opacity-[0.15] group-hover:scale-110 transition-all duration-500">
                            <span className={`material-symbols-outlined text-8xl text-${stat.color}-500`}>{stat.icon}</span>
                        </div>
                        <div className="relative z-10">
                            <p className={`text-xs font-bold text-${stat.color}-600 dark:text-${stat.color}-400 uppercase tracking-[0.1em] mb-2`}>{stat.label}</p>
                            <div className="flex items-baseline gap-3">
                                <p className="text-4xl font-black text-[var(--color-text-main)]">{stat.val}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 sticky top-0 z-20 py-4 bg-slate-50/80 dark:bg-[#0B0B0B]/80 backdrop-blur-xl -mx-4 px-4 md:mx-0 md:px-0 md:rounded-b-2xl transition-all duration-300">
                <div className="flex flex-wrap gap-2">
                    <div className="flex bg-white/60 dark:bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                        {(['active', 'completed', 'all'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    relative flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize z-10
                                    ${filter === f
                                        ? 'text-[var(--color-primary)] bg-white dark:bg-white/10 shadow-sm'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                {t(`tasks.filters.activity.${f}`)}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-white/60 dark:bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                        {(['list', 'board'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`
                                    relative flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize z-10 flex items-center gap-2
                                    ${view === v
                                        ? 'text-[var(--color-primary)] bg-white dark:bg-white/10 shadow-sm'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                <span className="material-symbols-outlined text-lg">{v === 'list' ? 'format_list_bulleted' : 'dashboard'}</span>
                                {t(`tasks.view.${v}`)}
                            </button>
                        ))}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative group/sort">
                        <button className="flex items-center gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-md px-4 py-4 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm text-sm font-bold text-[var(--color-text-main)] hover:border-[var(--color-primary)]/30 transition-all">
                            <span className="material-symbols-outlined text-lg">sort</span>
                            <span className="hidden sm:inline">{t('tasks.sort.label')}</span>
                            <span className="text-[var(--color-primary)] capitalize">
                                {sortLabels[sortBy]}
                            </span>
                            <span className="material-symbols-outlined text-sm opacity-50">expand_more</span>
                        </button>
                        <div className="absolute top-full left-0 mt-2 opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all bg-white dark:bg-[#1E1E1E] border border-[var(--color-surface-border)] rounded-xl shadow-2xl py-2 min-w-[160px] z-50">
                            {([
                                { value: 'priority', label: t('tasks.sort.priority'), icon: 'flag' },
                                { value: 'dueDate', label: t('tasks.sort.dueDate'), icon: 'event' },
                                { value: 'title', label: t('tasks.sort.title'), icon: 'sort_by_alpha' },
                                { value: 'createdAt', label: t('tasks.sort.created'), icon: 'schedule' }
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSortBy(opt.value)}
                                    className={`w-full px-4 py-2 text-left text-sm font-medium flex items-center gap-3 hover:bg-[var(--color-surface-hover)] transition-colors ${sortBy === opt.value ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'text-[var(--color-text-main)]'}`}
                                >
                                    <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Project Filter */}
                    <div className="relative group/proj">
                        <button className="flex items-center gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-md px-4 py-4 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm text-sm font-bold text-[var(--color-text-main)] hover:border-[var(--color-primary)]/30 transition-all max-w-[200px]">
                            <span className="material-symbols-outlined text-lg">folder_open</span>
                            <span className="truncate">
                                {projectFilter === 'all'
                                    ? t('tasks.filters.project.all')
                                    : projectNameById[projectFilter] || t('tasks.filters.project.unknown')}
                            </span>
                            <span className="material-symbols-outlined text-sm opacity-50">expand_more</span>
                        </button>
                        <div className="absolute top-full left-0 mt-2 opacity-0 invisible group-hover/proj:opacity-100 group-hover/proj:visible transition-all bg-white dark:bg-[#1E1E1E] border border-[var(--color-surface-border)] rounded-xl shadow-2xl py-2 min-w-[200px] z-50 max-h-[300px] overflow-y-auto">
                            <button
                                onClick={() => setProjectFilter('all')}
                                className={`w-full px-4 py-2 text-left text-sm font-medium flex items-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors ${projectFilter === 'all' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}
                            >
                                {t('tasks.filters.project.all')}
                            </button>
                            {projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setProjectFilter(p.id)}
                                    className={`w-full px-4 py-2 text-left text-sm font-medium flex items-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors ${projectFilter === p.id ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}
                                >
                                    <span className="truncate">{p.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative group w-full lg:w-96">
                    <input
                        type="text"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder={t('tasks.search.placeholder')}
                        className="w-full bg-white/60 dark:bg-white/5 backdrop-blur-md border-black/5 dark:border-white/5 ring-1 ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl pl-12 pr-6 py-4 text-sm font-medium transition-all outline-none"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                </div>
            </div>

            {/* Content using new styles */}
            <div className="flex flex-col gap-4 min-h-[400px]">
                {filteredTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/30 dark:bg-white/[0.02] border-2 border-dashed border-black/5 dark:border-white/5 rounded-[32px] fade-in">
                        <div className="size-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-indigo-500/5">
                            <span className="material-symbols-outlined text-5xl text-indigo-500 animate-pulse">explore_off</span>
                        </div>
                        <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">{t('tasks.empty.list.title')}</h3>
                        <p className="text-[var(--color-text-muted)] max-w-sm font-medium opacity-70">
                            {t('tasks.empty.list.description')}
                        </p>
                        <Button
                            variant="secondary"
                            className="mt-8 rounded-xl px-10"
                            onClick={() => setShowCreateModal(true)}
                        >
                            {t('tasks.empty.list.action')}
                        </Button>
                    </div>
                ) : view === 'list' ? (
                    <div className="grid grid-cols-1 gap-3">
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
