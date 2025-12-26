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
        <div className="flex flex-col gap-8 fade-in max-w-6xl mx-auto pb-12">

            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-main)] mb-1">My Focus</h1>
                    <p className="text-[var(--color-text-muted)] text-lg">
                        You have <span className="text-[var(--color-text-main)] font-semibold">{stats.dueToday} tasks</span> due today and <span className="text-rose-500 font-semibold">{stats.overdue} overdue</span>.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card padding="md" className="flex flex-col gap-1 border-l-4 border-l-rose-500">
                        <span className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Attention Needed</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-[var(--color-text-main)]">{stats.overdue + stats.dueToday}</span>
                            <span className="text-sm text-[var(--color-text-muted)]">due soon</span>
                        </div>
                    </Card>

                    <Card padding="md" className="flex flex-col gap-1 border-l-4 border-l-amber-500">
                        <span className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">High Priority</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-[var(--color-text-main)]">{stats.highPriority}</span>
                            <span className="text-sm text-[var(--color-text-muted)]">critical tasks</span>
                        </div>
                    </Card>

                    <Card padding="md" className="flex flex-col gap-1 border-l-4 border-l-indigo-500">
                        <span className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Active Projects</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-[var(--color-text-main)]">{stats.activeProjects}</span>
                            <span className="text-sm text-[var(--color-text-muted)]">in progress</span>
                        </div>
                    </Card>

                    <Card padding="md" className="flex flex-col gap-1 border-l-4 border-l-emerald-500">
                        <span className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Total Completed</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-[var(--color-text-main)]">{stats.completedTotal}</span>
                            <span className="text-sm text-[var(--color-text-muted)]">all time</span>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col gap-4">

                {/* Sticky Toolbar */}
                <div className="sticky -top-4 sm:-top-6 lg:-top-8 z-40 bg-[var(--color-surface-bg)] py-4 border-b border-[var(--color-surface-border)] shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-center transition-all -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">

                    {/* Filter Tabs */}
                    <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-xl w-full lg:w-auto">
                        {(['open', 'completed', 'all'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`
                                    flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-semibold capitalize transition-all
                                    ${statusFilter === status
                                        ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm scale-100'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-black/5 dark:hover:bg-white/5'}
                                `}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
                        <div className="relative group min-w-[200px] flex-1 lg:flex-none">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search tasks..."
                                className="w-full bg-[var(--color-surface-bg)] border-none ring-1 ring-[var(--color-surface-border)] focus:ring-2 focus:ring-[var(--color-primary)] rounded-xl pl-10 pr-4 py-2 text-sm transition-all"
                            />
                            <span className="material-symbols-outlined absolute left-3 top-2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                        </div>

                        <div className="h-8 w-px bg-[var(--color-surface-border)] mx-1 shrink-0" />

                        <Select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value as 'me' | 'all')}
                            className="w-[150px] shrink-0"
                            size="sm"
                        >
                            <option value="me">Assigned to Me</option>
                            <option value="all">Everything</option>
                        </Select>

                        <Select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            className="w-[140px] shrink-0"
                            size="sm"
                        >
                            <option value="all">All Projects</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </Select>

                        <Select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="w-[130px] shrink-0"
                            size="sm"
                        >
                            <option value="all">Any Priority</option>
                            <option value="Urgent">Urgent</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </Select>

                        <button
                            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="size-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
                            title="Sort Direction"
                        >
                            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-main)]">
                                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Quick Add (Only Visible for Active) */}
                {statusFilter !== 'completed' && (
                    <div className="bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] rounded-xl p-2 flex gap-3 shadow-sm transition-all">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={quickTitle}
                                onChange={(e) => setQuickTitle(e.target.value)}
                                placeholder="Add a new task..."
                                className="w-full bg-transparent border-none focus:ring-0 p-2 text-sm text-[var(--color-text-main)] placeholder-[var(--color-text-muted)]"
                                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd(e)}
                            />
                        </div>
                        <div className="w-40 border-l border-[var(--color-surface-border)] pl-3">
                            <select
                                value={quickProjectId}
                                onChange={(e) => setQuickProjectId(e.target.value)}
                                className="w-full h-full bg-transparent border-none focus:ring-0 text-sm text-[var(--color-text-subtle)] cursor-pointer"
                            >
                                <option value="" disabled>Select Project</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                        <Button
                            size="sm"
                            variant="primary"
                            disabled={!quickTitle || !quickProjectId}
                            onClick={handleQuickAdd}
                            isLoading={quickSaving}
                            className="shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                        </Button>
                    </div>
                )}

                {/* Task List */}
                <div className="flex flex-col gap-3">
                    {filteredAndSortedTasks.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center">
                            <div className="bg-[var(--color-surface-hover)] p-6 rounded-full mb-4 animate-pulse">
                                <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)]">check</span>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">All Caught Up!</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm mx-auto">
                                No tasks found matching your current filters. Enjoy your free time or create a new task.
                            </p>
                        </div>
                    ) : (
                        filteredAndSortedTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}${task.tenantId ? `?tenant=${task.tenantId}` : ''}`)}
                                className="group bg-[var(--color-surface-paper)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all shadow-sm hover:shadow-md relative overflow-hidden"
                            >
                                {/* Left Checkbox */}
                                <button
                                    onClick={(e) => handleToggle(e, task.id, task.isCompleted)}
                                    className={`
                                        flex-shrink-0 size-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 z-10
                                        ${task.isCompleted
                                            ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-500/20 scale-105'
                                            : 'border-[var(--color-text-subtle)]/30 text-transparent hover:border-green-500 hover:text-green-500/20 bg-transparent'}
                                    `}
                                >
                                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                                </button>

                                {/* Task Details */}
                                <div className="flex-1 min-w-0 z-10">
                                    <div className="flex items-center gap-2 mb-1">
                                        {/* Project Badge */}
                                        {task.projectId && (
                                            <div
                                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide cursor-pointer hover:text-[var(--color-primary)] transition-colors max-w-[150px] truncate"
                                                onClick={(e) => { e.stopPropagation(); navigate(`/project/${task.projectId}`); }}
                                            >
                                                <span className="size-1.5 rounded-full bg-[var(--color-primary)] shrink-0"></span>
                                                <span className="truncate">{projectNameById[task.projectId]}</span>
                                            </div>
                                        )}
                                        {task.priority === 'Urgent' && <Badge size="sm" variant="danger" className="animate-pulse">Urgent</Badge>}
                                    </div>

                                    <h3 className={`text-base font-semibold leading-snug transition-all ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through decoration-2 decoration-[var(--color-surface-border)]' : 'text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]'}`}>
                                        {task.title}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                                        {task.dueDate && (
                                            <div className={`flex items-center gap-1 font-medium ${new Date(task.dueDate) < new Date() && !task.isCompleted ? 'text-rose-500' : ''}`}>
                                                <span className="material-symbols-outlined text-[14px]">event</span>
                                                {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                        )}
                                        {task.priority !== 'Urgent' && task.priority && (
                                            <div className="flex items-center gap-1">
                                                <span className={`size-1.5 rounded-full ${task.priority === 'High' ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                                                {task.priority} Priority
                                            </div>
                                        )}
                                        {task.status && (
                                            <div className={`
                                                flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-300
                                                ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                                                    task.status === 'In Progress' ? 'bg-blue-600/15 text-blue-400 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]' :
                                                        task.status === 'Review' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
                                                            task.status === 'Open' || task.status === 'Todo' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                                                                task.status === 'Backlog' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 opacity-80' :
                                                                    task.status === 'On Hold' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                        task.status === 'Blocked' ? 'bg-rose-600/20 text-rose-500 border-rose-500/50 animate-pulse' :
                                                                            'bg-slate-500/5 text-slate-400 border-slate-500/10'}
                                            `}>
                                                <span className="material-symbols-outlined text-[12px]">
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
                                    </div>
                                </div>

                                {/* Hover Action */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 z-10">
                                    <span className="text-xs font-semibold text-[var(--color-primary)]">Open</span>
                                    <div className="size-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </div>
                                </div>

                                {/* Background Accents */}
                                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white dark:from-[#1C1C1E] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
