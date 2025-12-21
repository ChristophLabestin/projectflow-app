import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getProjectCategories, getProjectTasks, getSubTasks, subscribeProjectTasks, toggleTaskStatus, updateTaskFields, deleteTask } from '../services/dataService';
import { IdeaGroup, Task, TaskStatus, TaskCategory } from '../types';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';

export const ProjectTasks = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
        return () => unsub();
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
        if (new URLSearchParams(location.search).get('newTask') === '1') setShowCreateModal(true);
    }, [location.search]);

    const handleToggle = async (taskId: string, currentStatus: boolean) => {
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
        if (!confirm(`Delete ${selectedIds.size} tasks?`)) return;
        try {
            await Promise.all(Array.from(selectedIds).map(id => deleteTask(id)));
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            setError('Failed to delete tasks.');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 fade-in max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="h2 text-[var(--color-text-main)]">Tasks</h1>
                    <p className="text-[var(--color-text-muted)] text-sm">Manage and track your project work.</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} icon={<span className="material-symbols-outlined">add</span>}>
                    New Task
                </Button>
            </div>

            <Card padding="none">
                {/* Filters */}
                <div className="p-4 border-b border-[var(--color-surface-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex bg-[var(--color-surface-hover)] rounded-lg p-1">
                        {(['all', 'active', 'completed'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize
                                    ${filter === f ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tasks..."
                            className="w-full sm:w-64"
                            icon={<span className="material-symbols-outlined">search</span>}
                        />
                    </div>
                </div>

                {/* Task List */}
                <div className="flex flex-col gap-2">
                    {filteredTasks.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-surface-border)] rounded-xl">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-20">checklist</span>
                            <p>No tasks found.</p>
                        </div>
                    ) : (
                        filteredTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => navigate(`/project/${id}/tasks/${task.id}`)}
                                className="group flex items-start gap-4 p-4 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] hover:border-[var(--color-surface-border-hover)] hover:shadow-sm transition-all cursor-pointer"
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.isCompleted); }}
                                    className={`
                                        mt-0.5 size-5 rounded-md border flex items-center justify-center transition-all duration-200
                                        ${task.isCompleted
                                            ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                                            : 'border-gray-300 dark:border-gray-600 bg-transparent hover:border-black dark:hover:border-white text-transparent'}
                                    `}
                                >
                                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                </button>

                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <span className={`text-sm font-medium leading-tight transition-colors group-hover:text-[var(--color-primary)] ${task.isCompleted ? 'text-gray-400 line-through' : 'text-[var(--color-text-main)]'}`}>
                                            {task.title}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)] min-h-[20px]">
                                        {task.priority && (
                                            <Badge size="sm" variant={task.priority === 'Urgent' ? 'error' : task.priority === 'High' ? 'warning' : 'secondary'}>
                                                {task.priority}
                                            </Badge>
                                        )}
                                        {task.status && task.status !== 'Todo' && (
                                            <Badge size="sm" variant="outline">{task.status}</Badge>
                                        )}
                                        {task.dueDate && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--color-surface-hover)]">
                                                <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                                                <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {subtaskStats[task.id]?.total > 0 && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--color-surface-hover)]">
                                                <span className="material-symbols-outlined text-[10px]">checklist</span>
                                                <span>{subtaskStats[task.id].done}/{subtaskStats[task.id].total}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="p-1 rounded-md text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-xs text-[var(--color-text-muted)] flex justify-between">
                    <span>{openCount} active tasks</span>
                    <span>{completedCount} completed</span>
                </div>
            </Card>

            {showCreateModal && id && (
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
