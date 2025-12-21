import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserTasks, toggleTaskStatus, addTask, getUserProjects } from '../services/dataService';
import { Project, Task } from '../types';
import { toMillis } from '../utils/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
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
                if (projectData.length) setQuickProjectId(projectData[0].id);
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

    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;
            if (search && ![t.title].some(v => v.toLowerCase().includes(search.toLowerCase()))) return false;
            return true;
        }).sort((a, b) => {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            return aDue - bDue;
        });
    }, [tasks, filter, search]);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 fade-in max-w-5xl mx-auto pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="h2 text-[var(--color-text-main)]">My Tasks</h1>
                <p className="text-[var(--color-text-muted)] text-sm">Aggregated view of tasks across all your projects.</p>
            </div>

            <Card padding="none">
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
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="w-full sm:w-64"
                        icon={<span className="material-symbols-outlined">search</span>}
                    />
                </div>

                {/* Quick Add */}
                <div className="p-4 bg-[var(--color-surface-hover)] border-b border-[var(--color-surface-border)]">
                    <form onSubmit={handleQuickAdd} className="flex gap-2">
                        <Input
                            value={quickTitle}
                            onChange={(e) => setQuickTitle(e.target.value)}
                            placeholder="Add a new task..."
                            className="flex-1"
                        />
                        <select
                            value={quickProjectId}
                            onChange={(e) => setQuickProjectId(e.target.value)}
                            className="h-10 rounded-md border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none max-w-[150px]"
                        >
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        <Button type="submit" isLoading={quickSaving} disabled={!quickTitle} icon={<span className="material-symbols-outlined">add</span>}>Add</Button>
                    </form>
                </div>

                <div className="divide-y divide-[var(--color-surface-border)]">
                    {filteredTasks.length === 0 ? (
                        <div className="p-12 text-center text-[var(--color-text-muted)]">
                            No tasks found.
                        </div>
                    ) : (
                        filteredTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}`)}
                                className="group flex items-center gap-4 p-4 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                            >
                                <button
                                    onClick={(e) => handleToggle(e, task.id, task.isCompleted)}
                                    className={`
                                        size-5 rounded-full border-2 flex items-center justify-center transition-colors
                                        ${task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--color-text-subtle)] text-transparent hover:border-emerald-500'}
                                    `}
                                >
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                </button>

                                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    <div className="md:col-span-6 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                            <span className={`${task.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>{task.title}</span>
                                        </div>
                                    </div>
                                    <div className="md:col-span-6 flex items-center justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                                        {task.projectId && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); navigate(`/project/${task.projectId}`); }}
                                                className="hover:text-[var(--color-primary)] hover:underline truncate max-w-[100px] cursor-pointer"
                                            >
                                                {projectNameById[task.projectId]}
                                            </div>
                                        )}
                                        {task.priority && <Badge size="sm" variant={task.priority === 'Urgent' ? 'danger' : 'secondary'}>{task.priority}</Badge>}
                                        {task.dueDate && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};
