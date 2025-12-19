import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getProjectCategories, getSubTasks, subscribeProjectTasks, toggleTaskStatus, updateTaskFields, deleteTask } from '../services/dataService';
import { IdeaGroup, Task, TaskStatus, TaskCategory } from '../types';
import { TaskCreateModal } from '../components/TaskCreateModal';

export const ProjectTasks = () => {
    const { id } = useParams<{ id: string }>();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [priorityFilter, setPriorityFilter] = useState<'all' | Task['priority']>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<TaskStatus>('Open');
    const [bulkPriority, setBulkPriority] = useState<Task['priority']>('Medium');
    const [bulkCategories, setBulkCategories] = useState<IdeaGroup[]>([]);
    const [bulkCategoryInput, setBulkCategoryInput] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [categories, setCategories] = useState<TaskCategory[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const location = useLocation();

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        const unsub = subscribeProjectTasks(id, (taskData) => {
            setTasks(taskData);
            setLoading(false);
        });
        (async () => {
            try {
                const catData = await getProjectCategories(id);
                setCategories(catData);
            } catch (error) {
                console.error('Failed to load project categories', error);
            }
        })();
        return () => unsub();
    }, [id]);

    useEffect(() => {
        const loadSubtaskStats = async () => {
            if (!tasks.length) {
                setSubtaskStats({});
                return;
            }
            try {
                const entries = await Promise.all(tasks.map(async (t) => {
                    const subs = await getSubTasks(t.id);
                    const done = subs.filter(s => s.isCompleted).length;
                    return [t.id, { done, total: subs.length }] as const;
                }));
                setSubtaskStats(Object.fromEntries(entries));
            } catch (err) {
                console.warn('Failed to load subtask progress', err);
            }
        };
        loadSubtaskStats();
    }, [tasks]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('newTask') === '1') {
            setShowCreateModal(true);
        }
    }, [location.search]);

    const handleToggle = async (taskId: string, currentStatus: boolean) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus);
        if (selectedIds.has(taskId) && !currentStatus) {
            // Ensure Done status reflects completion in UI when toggling complete
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Done' } as Task : t));
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [tasks, filter, priorityFilter, statusFilter, search]);

    const categoryOptions = useMemo(
        () => Array.from(new Set([...categories.map(c => c.name.trim()), ...tasks.map(t => {
            const cats = Array.isArray(t.category) ? t.category : [t.category || ''];
            return cats.map(c => (c || '').trim()).join('|');
        })].flatMap(c => c.split('|')).filter(Boolean))),
        [categories, tasks]
    );
    const filteredBulkCategories = useMemo(
        () => categoryOptions.filter(c => c.toLowerCase().includes((bulkCategoryInput || '').toLowerCase()) && !bulkCategories.includes(c)),
        [categoryOptions, bulkCategoryInput, bulkCategories]
    );

    const openCount = tasks.filter(t => !t.isCompleted).length;
    const completedCount = tasks.filter(t => t.isCompleted).length;
    const urgentCount = tasks.filter(t => t.priority === 'Urgent').length;
    const selectedCount = selectedIds.size;

    const displayStatus = (task: Task): TaskStatus => {
        if (task.isCompleted) return 'Done';
        return task.status || 'Open';
    };

    const priorityBadgeClass = (priority?: Task['priority']) => {
        switch (priority) {
            case 'Urgent':
                return 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200';
            case 'High':
                return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200';
            case 'Medium':
                return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200';
            case 'Low':
                return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200';
            default:
                return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200';
        }
    };

    const priorityAccentClass = (priority?: Task['priority']) => {
        switch (priority) {
            case 'Urgent':
                return 'bg-rose-500';
            case 'High':
                return 'bg-amber-500';
            case 'Medium':
                return 'bg-blue-500';
            case 'Low':
                return 'bg-gray-400';
            default:
                return 'bg-gray-300';
        }
    };

    const statusBadgeClass = (status?: TaskStatus) => {
        switch (status) {
            case 'Backlog':
                return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200';
            case 'Open':
                return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200';
            case 'In Progress':
                return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200';
            case 'Blocked':
                return 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200';
            case 'Done':
                return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200';
            default:
                return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200';
        }
    };

    const toggleSelect = (taskId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredTasks.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTasks.map(t => t.id)));
        }
    };

    const handleBulkApply = async () => {
        if (!selectedIds.size) return;
        setBulkSaving(true);
        try {
            const categoriesToSave = Array.from(new Set([
                ...bulkCategories,
                ...(bulkCategoryInput.trim() ? [bulkCategoryInput.trim()] : [])
            ]));
            const updates = Array.from(selectedIds).map(id => updateTaskFields(id, {
                status: bulkStatus,
                priority: bulkPriority,
                category: categoriesToSave.length ? categoriesToSave : undefined
            }));
            await Promise.all(updates);
            if (id) {
                const [refreshedTasks, refreshedCategories] = await Promise.all([
                    getProjectTasks(id),
                    getProjectCategories(id)
                ]);
                setTasks(refreshedTasks);
                setCategories(refreshedCategories);
            }
            setSelectedIds(new Set());
            setBulkCategoryInput('');
        } catch (e) {
            console.error(e);
            setError('Failed to apply bulk changes.');
        } finally {
            setBulkSaving(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.size) return;
        setBulkDeleting(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => deleteTask(id)));
            if (id) {
                const refreshed = await getProjectTasks(id);
                setTasks(refreshed);
            }
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            setError('Failed to delete selected tasks.');
        } finally {
            setBulkDeleting(false);
        }
    };

    return (
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Project Tasks</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Tasks scoped to this project.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 text-sm font-bold bg-black text-white rounded-lg shadow-sm"
                >
                    New Task
                </button>
            </div>


            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex p-1 bg-gray-50 dark:bg-gray-800 rounded-lg w-full sm:w-auto overflow-x-auto">
                        <button 
                            onClick={() => setFilter('all')}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm whitespace-nowrap font-medium transition-colors ${filter === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}`}
                        >
                            All ({tasks.length})
                        </button>
                        <button 
                            onClick={() => setFilter('active')}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm whitespace-nowrap font-medium transition-colors ${filter === 'active' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}`}
                        >
                            Active ({openCount})
                        </button>
                        <button 
                             onClick={() => setFilter('completed')}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm whitespace-nowrap font-medium transition-colors ${filter === 'completed' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}`}
                        >
                            Completed ({completedCount})
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100 w-full sm:w-48"
                        />
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100">
                            <option value="all">Status</option>
                            <option value="Backlog">Backlog</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Done">Done</option>
                        </select>
                        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100 min-w-[120px]">
                            <option value="all">Priority</option>
                            <option value="Urgent">Urgent</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                                onChange={toggleSelectAll}
                                className="size-4 border border-gray-300 rounded"
                            />
                            Select all
                        </label>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Open: {openCount}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Done: {completedCount}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Urgent: {urgentCount}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedCount} selected</span>
                        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as TaskStatus)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800">
                            <option value="Backlog">Backlog</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Done">Done</option>
                        </select>
                        <select value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value as Task['priority'])} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 min-w-[120px]">
                            <option value="Urgent">Urgent</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                        <button
                            onClick={handleBulkApply}
                            disabled={bulkSaving || selectedCount === 0}
                            className="px-3 py-1.5 text-sm font-bold bg-black text-white rounded-lg disabled:opacity-50"
                        >
                            {bulkSaving ? 'Applying…' : 'Apply'}
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting || selectedCount === 0}
                            className="px-3 py-1.5 text-sm font-bold bg-rose-600 text-white rounded-lg disabled:opacity-50"
                        >
                            {bulkDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500" disabled={selectedCount === 0}>Clear</button>
                    </div>
                </div>
            </div>

            {showCreateModal && id && (
                <TaskCreateModal
                    projectId={id}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(updatedTasks, updatedCategories) => {
                        setTasks(updatedTasks);
                        setCategories(updatedCategories);
                        setShowCreateModal(false);
                        setError(null);
                    }}
                />
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                    <p className="text-gray-500 dark:text-gray-400">No tasks yet. Create the first one above.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTasks.map(task => (
                        <div key={task.id} className="group flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div className="pt-1">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(task.id)}
                                    onChange={() => toggleSelect(task.id)}
                                    className="size-5 border-2 border-slate-300 dark:border-slate-600 rounded cursor-pointer"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Link to={`/project/${id}/tasks/${task.id}`} className="text-sm font-extrabold text-gray-900 dark:text-white hover:underline block truncate">
                                                    {task.title}
                                                </Link>
                                                {task.priority && (
                                                    <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${priorityBadgeClass(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                )}
                                            </div>
                                            {task.description && <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{task.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {task.status && (
                                                <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 ${statusBadgeClass(displayStatus(task))}`}>
                                                    <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                                                    {displayStatus(task)}
                                                </span>
                                            )}
                                            {task.dueDate && (
                                                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleToggle(task.id, task.isCompleted)}
                                                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                                                    task.isCompleted
                                                        ? 'bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                                }`}
                                                title={task.isCompleted ? 'Mark as not done' : 'Mark as done'}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">{task.isCompleted ? 'check' : 'check_small'}</span>
                                                {task.isCompleted ? 'Done' : 'Complete'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        {(() => {
                                            const cats = Array.isArray(task.category) ? task.category : (task.category ? [task.category] : []);
                                            return cats.map(c => (
                                                <span key={c} className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium">
                                                    {c}
                                                </span>
                                            ));
                                        })()}
                                        {subtaskStats[task.id]?.total ? (
                                            <div className="flex items-center gap-2 w-full sm:w-auto min-w-[160px]">
                                                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div
                                                        className="h-full bg-slate-900 dark:bg-white rounded-full"
                                                        style={{ width: `${Math.round((subtaskStats[task.id].done / subtaskStats[task.id].total) * 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                    {subtaskStats[task.id].done}/{subtaskStats[task.id].total}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
