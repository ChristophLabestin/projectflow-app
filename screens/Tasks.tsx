import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getUserTasks, toggleTaskStatus, addTask, getUserProjects } from '../services/dataService';
import { Project, Task } from '../types';
import { toMillis } from '../utils/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const user = auth.currentUser;
    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('open');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<'me' | 'all'>('me');
    const [search, setSearch] = useState('');

    // Sorting
    const [sortField, setSortField] = useState<'dueDate' | 'priority' | 'createdAt'>('dueDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Quick Add
    const [quickTitle, setQuickTitle] = useState('');
    const [quickProjectId, setQuickProjectId] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const [taskData, projectData] = await Promise.all([getUserTasks(), getUserProjects()]);
                setTasks(taskData);
                setProjects(projectData);
                if (projectData.length && !quickProjectId) setQuickProjectId(projectData[0].id);
            } catch (error) {
                console.error('Failed to fetch tasks', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    const handleToggle = async (e: React.MouseEvent, taskId: string, currentStatus: boolean) => {
        e.stopPropagation();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !currentStatus } : t)));
        await toggleTaskStatus(taskId, currentStatus);
    };

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickTitle.trim() || !quickProjectId) return;
        setQuickSaving(true);
        try {
            await addTask(quickProjectId, quickTitle.trim(), undefined, undefined, 'Medium', { status: 'Open' });
            const refreshed = await getUserTasks();
            setTasks(refreshed);
            setQuickTitle('');
        } catch (error) {
            console.error(error);
        } finally {
            setQuickSaving(false);
        }
    };

    const projectNameById = useMemo(() => {
        const entries = projects.map((p) => [p.id, p.title] as const);
        return Object.fromEntries(entries);
    }, [projects]);

    const stats = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfDay = startOfDay + 86400000;

        const dueToday = tasks.filter(t => {
            if (t.isCompleted || !t.dueDate) return false;
            const d = new Date(t.dueDate).getTime();
            return d >= startOfDay && d < endOfDay;
        }).length;

        const overdue = tasks.filter(t => {
            if (t.isCompleted || !t.dueDate) return false;
            return new Date(t.dueDate).getTime() < startOfDay;
        }).length;

        const highPriority = tasks.filter(t => !t.isCompleted && (t.priority === 'High' || t.priority === 'Urgent')).length;
        const activeProjects = new Set(tasks.filter(t => !t.isCompleted).map(t => t.projectId)).size;
        const completedTotal = tasks.filter(t => t.isCompleted).length;

        return { dueToday, overdue, highPriority, activeProjects, completedTotal };
    }, [tasks]);

    const filteredAndSortedTasks = useMemo(() => {
        let result = tasks;

        // 1. Filter
        result = result.filter(t => {
            // Status
            if (statusFilter === 'open' && t.isCompleted) return false;
            if (statusFilter === 'completed' && !t.isCompleted) return false;

            // Priority
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

            // Project
            if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;

            // Assignee
            if (assigneeFilter === 'me' && user) {
                const isAssignedToMe = t.assigneeId === user.uid || (t.assigneeIds && t.assigneeIds.includes(user.uid));
                if (!isAssignedToMe) return false;
            }

            // Search
            if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;

            return true;
        });

        // 2. Sort
        result.sort((a, b) => {
            let valA, valB;

            if (sortField === 'dueDate') {
                valA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY; // items without due date at bottom
                valB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            } else if (sortField === 'priority') {
                const priorityWeight = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                valA = priorityWeight[a.priority || 'Medium'] || 0;
                valB = priorityWeight[b.priority || 'Medium'] || 0;
            } else { // createdAt
                valA = toMillis(a.createdAt);
                valB = toMillis(b.createdAt);
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [tasks, statusFilter, priorityFilter, projectFilter, assigneeFilter, search, sortField, sortDirection, user]);

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
                        My <span className="text-[var(--color-primary)]">Focus</span>
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-lg font-medium opacity-80">
                        You have <span className="text-[var(--color-text-main)] font-bold">{stats.dueToday} tasks</span> due today and <span className="text-rose-500 font-bold">{stats.overdue} overdue</span>.
                    </p>
                </div>

                {/* Stats Row - Compact for this view */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 flex-1 max-w-4xl">
                    {[
                        { label: 'Attention', val: stats.overdue + stats.dueToday, icon: 'assignment_late', color: 'rose', sub: 'due soon' },
                        { label: 'Priority', val: stats.highPriority, icon: 'priority_high', color: 'amber', sub: 'critical' },
                        { label: 'Active', val: stats.activeProjects, icon: 'folder_open', color: 'indigo', sub: 'projects' },
                        { label: 'Completed', val: stats.completedTotal, icon: 'check_circle', color: 'emerald', sub: 'all time' }
                    ].map((stat, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl bg-white dark:bg-white/[0.03] border border-${stat.color}-100 dark:border-${stat.color}-500/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300`}>
                            <div className="absolute -right-2 -top-2 p-3 opacity-[0.05] group-hover:opacity-[0.15] group-hover:scale-110 transition-all duration-500">
                                <span className={`material-symbols-outlined text-6xl text-${stat.color}-500`}>{stat.icon}</span>
                            </div>
                            <div className="relative z-10">
                                <p className={`text-[10px] font-bold text-${stat.color}-600 dark:text-${stat.color}-400 uppercase tracking-[0.1em] mb-1`}>{stat.label}</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-black text-[var(--color-text-main)]">{stat.val}</p>
                                    <span className="text-[10px] font-medium opacity-60">{stat.sub}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area - Split View */}
            <div className="flex flex-col gap-6">

                {/* Glassmorphic Controls Bar */}
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 sticky top-6 z-20">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-white/60 dark:bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 ring-1 ring-black/5">
                            {(['open', 'completed', 'all'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`
                                        relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize z-10
                                        ${statusFilter === s
                                            ? 'text-[var(--color-primary)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                    `}
                                >
                                    {statusFilter === s && (
                                        <div className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl shadow-sm z-[-1] fade-in" />
                                    )}
                                    {s}
                                </button>
                            ))}
                        </div>

                        <div className="h-8 w-px bg-black/5 dark:bg-white/5 mx-2 hidden xl:block" />

                        {/* Secondary Filters - Styled Selects */}
                        <div className="flex flex-wrap gap-2">
                            <div className="relative group">
                                <select
                                    value={assigneeFilter}
                                    onChange={(e) => setAssigneeFilter(e.target.value as any)}
                                    className="appearance-none bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl pl-4 pr-8 py-2.5 text-sm font-bold text-[var(--color-text-main)] hover:bg-white dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer"
                                >
                                    <option value="me">Assigned to Me</option>
                                    <option value="all">Everything</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[16px] opacity-50">expand_more</span>
                            </div>

                            <div className="relative group">
                                <select
                                    value={priorityFilter}
                                    onChange={(e) => setPriorityFilter(e.target.value)}
                                    className="appearance-none bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl pl-4 pr-8 py-2.5 text-sm font-bold text-[var(--color-text-main)] hover:bg-white dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer"
                                >
                                    <option value="all">Any Priority</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[16px] opacity-50">expand_more</span>
                            </div>

                            <div className="relative group">
                                <select
                                    value={projectFilter}
                                    onChange={(e) => setProjectFilter(e.target.value)}
                                    className="appearance-none bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl pl-4 pr-8 py-2.5 text-sm font-bold text-[var(--color-text-main)] hover:bg-white dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all cursor-pointer max-w-[150px]"
                                >
                                    <option value="all">All Projects</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[16px] opacity-50">expand_more</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto">
                        <div className="relative group flex-1 xl:flex-none xl:w-80 shadow-xl shadow-black/5">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search tasks..."
                                className="w-full bg-white/60 dark:bg-black/40 backdrop-blur-2xl border-none ring-1 ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl pl-12 pr-6 py-4 text-sm font-medium transition-all outline-none"
                            />
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                        </div>
                        <button
                            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="size-[52px] rounded-2xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 ring-1 ring-black/5 shadow-xl shadow-black/5 flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            title={sortDirection === "asc" ? "Sort Ascending" : "Sort Descending"}
                        >
                            <span className="material-symbols-outlined">sort</span>
                        </button>
                    </div>
                </div>

                {/* Quick Add Bar */}
                {statusFilter !== 'completed' && (
                    <div className="bg-gradient-to-r from-white/80 to-white/40 dark:from-white/5 dark:to-white/[0.02] backdrop-blur-md rounded-[24px] p-2 pr-3 border border-white/40 dark:border-white/10 shadow-xl shadow-indigo-500/5 ring-1 ring-black/5 flex items-center gap-2 group focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:scale-[1.01] transition-all">
                        <div className="pl-4">
                            <span className="material-symbols-outlined text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">add_task</span>
                        </div>
                        <input
                            type="text"
                            value={quickTitle}
                            onChange={(e) => setQuickTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-lg font-medium text-[var(--color-text-main)] placeholder:font-normal placeholder:opacity-50"
                            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd(e)}
                        />
                        <div className="h-8 w-px bg-black/5 dark:bg-white/5 mx-2" />
                        <div className="relative w-48">
                            <select
                                value={quickProjectId}
                                onChange={(e) => setQuickProjectId(e.target.value)}
                                className="w-full appearance-none bg-transparent border-none focus:ring-0 text-xs font-bold text-[var(--color-text-subtle)] cursor-pointer pr-6 py-2 uppercase tracking-wide text-right hover:text-[var(--color-primary)] transition-colors"
                            >
                                <option value="" disabled>Select Project</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[16px] opacity-30">arrow_drop_down</span>
                        </div>
                        <Button
                            size="lg"
                            variant="primary"
                            disabled={!quickTitle || !quickProjectId}
                            onClick={handleQuickAdd}
                            isLoading={quickSaving}
                            className="rounded-xl shadow-lg shadow-indigo-500/20"
                        >
                            Add
                        </Button>
                    </div>
                )}

                {/* Task List */}
                <div className="flex flex-col gap-3 min-h-[400px]">
                    {filteredAndSortedTasks.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/30 dark:bg-white/[0.02] border-2 border-dashed border-black/5 dark:border-white/5 rounded-[32px] fade-in">
                            <div className="size-24 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent rounded-full flex items-center justify-center mb-6 ring-8 ring-[var(--color-primary)]/5">
                                <span className="material-symbols-outlined text-5xl text-[var(--color-primary)] animate-pulse-slow">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">All Caught Up!</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm font-medium opacity-70">
                                No tasks found matching your current filters. Enjoy your free time or add a new task to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredAndSortedTasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}${task.tenantId ? `?tenant=${task.tenantId}` : ''}`)}
                                    className={`
                                        group relative flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-[24px] border transition-all duration-300 cursor-pointer
                                        ${task.isCompleted
                                            ? 'bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-500/10 opacity-70'
                                            : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-[var(--color-primary)]/30 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5'
                                        }
                                    `}
                                >
                                    {/* Left: Checkbox & Info */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <button
                                            onClick={(e) => handleToggle(e, task.id, task.isCompleted)}
                                            className={`
                                                flex-shrink-0 size-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 z-10
                                                ${task.isCompleted
                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105 rotate-3'
                                                    : 'border-black/10 dark:border-white/10 text-transparent hover:border-emerald-500 hover:text-emerald-500/20 bg-transparent group-hover:scale-110'}
                                            `}
                                        >
                                            <span className="material-symbols-outlined text-[20px] font-bold">check</span>
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            {/* Top Meta Row */}
                                            <div className="flex items-center flex-wrap gap-2 mb-1.5">
                                                {task.projectId && (
                                                    <div
                                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/project/${task.projectId}`); }}
                                                    >
                                                        <span className={`size-1.5 rounded-full bg-[var(--color-primary)] shrink-0 group-hover:bg-white`}></span>
                                                        <span className="truncate max-w-[120px]">{projectNameById[task.projectId]}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <h4 className={`text-lg font-bold truncate transition-all duration-300 ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through decoration-2 decoration-emerald-500/30' : 'text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]'}`}>
                                                {task.title}
                                            </h4>

                                            {/* Bottom Meta Row */}
                                            <div className="flex flex-wrap items-center gap-4 mt-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                {task.dueDate && (
                                                    <div className={`flex items-center gap-1 text-xs font-bold ${new Date(task.dueDate) < new Date() && !task.isCompleted ? 'text-rose-500' : 'text-[var(--color-text-muted)]'}`}>
                                                        <span className="material-symbols-outlined text-[16px] filled">event</span>
                                                        {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </div>
                                                )}

                                                {task.priority && task.priority !== "Medium" && (
                                                    <div className={`
                                                        flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest
                                                        ${task.priority === 'Urgent' ? 'text-rose-500' :
                                                            task.priority === 'High' ? 'text-amber-500' :
                                                                'text-slate-400'}
                                                    `}>
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {task.priority === 'Urgent' ? 'error' : 'keyboard_double_arrow_up'}
                                                        </span>
                                                        {task.priority}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                                                    <span className={`size-2 rounded-full ${task.status === 'Done' ? 'bg-emerald-500' :
                                                            task.status === 'In Progress' ? 'bg-blue-500' :
                                                                'bg-slate-300'
                                                        }`} />
                                                    {task.status}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Action */}
                                    <div className="flex items-center gap-4 md:pl-6 md:border-l border-black/5 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                                        <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[var(--color-text-main)] transition-all duration-300 group-hover:bg-[var(--color-primary)] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[var(--color-primary)]/30 shrink-0">
                                            <span className="material-symbols-outlined text-xl">arrow_forward</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
