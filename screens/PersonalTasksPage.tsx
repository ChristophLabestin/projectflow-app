import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import {
    getPersonalTasks,
    addPersonalTask,
    deletePersonalTask,
    togglePersonalTaskStatus,
    movePersonalTaskToProject,
    getUserProjects
} from '../services/dataService';
import { PersonalTask, Project } from '../types';
import { toMillis } from '../utils/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useConfirm, useToast } from '../context/UIContext';

export const PersonalTasksPage = () => {
    const [tasks, setTasks] = useState<PersonalTask[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('open');
    const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
    const [showMoveDropdown, setShowMoveDropdown] = useState<string | null>(null);
    const confirm = useConfirm();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [taskData, projectData] = await Promise.all([
                getPersonalTasks(),
                getUserProjects()
            ]);
            setTasks(taskData);
            setProjects(projectData);
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        setSaving(true);
        try {
            await addPersonalTask(newTaskTitle.trim());
            setNewTaskTitle('');
            await fetchData();
        } catch (error) {
            console.error('Failed to add personal task', error);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (e: React.MouseEvent, taskId: string, currentStatus: boolean) => {
        e.stopPropagation();
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        try {
            await togglePersonalTaskStatus(taskId, currentStatus);
        } catch (error) {
            console.error('Failed to toggle task', error);
            // Revert on error
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: currentStatus } : t));
        }
    };

    const handleDelete = async (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation();

        const confirmed = await confirm({
            title: 'Delete Personal Task',
            message: 'Are you sure you want to delete this task? This action cannot be undone.',
            confirmText: 'Delete',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            await deletePersonalTask(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (error) {
            console.error('Failed to delete task', error);
        }
    };

    const handleMoveToProject = async (taskId: string, projectId: string) => {
        setMovingTaskId(taskId);
        setShowMoveDropdown(null);

        try {
            const newTaskId = await movePersonalTaskToProject(taskId, projectId);
            setTasks(prev => prev.filter(t => t.id !== taskId));

            const project = projects.find(p => p.id === projectId);
            showSuccess(`Task moved to "${project?.title || 'project'}"`);

            // Optionally navigate to the new task
            navigate(`/project/${projectId}/tasks/${newTaskId}`);
        } catch (error: any) {
            console.error('Failed to move task', error);
            showError(`Failed to move task: ${error.message}`);
        } finally {
            setMovingTaskId(null);
        }
    };

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.isCompleted).length;
        const open = total - completed;
        return { total, completed, open };
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks
            .filter(t => {
                if (statusFilter === 'open') return !t.isCompleted;
                if (statusFilter === 'completed') return t.isCompleted;
                return true;
            })
            .sort((a, b) => {
                // Incomplete first, then by creation date
                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                return toMillis(b.createdAt) - toMillis(a.createdAt);
            });
    }, [tasks, statusFilter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">
                    rotate_right
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 fade-in max-w-3xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-[var(--color-text-main)]">Personal Tasks</h1>
                <p className="text-[var(--color-text-muted)]">
                    Your private tasks, not associated with any project.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card padding="md" className="flex flex-col items-center border-l-4 border-l-indigo-500">
                    <span className="text-2xl font-bold text-[var(--color-text-main)]">{stats.total}</span>
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Total</span>
                </Card>
                <Card padding="md" className="flex flex-col items-center border-l-4 border-l-amber-500">
                    <span className="text-2xl font-bold text-[var(--color-text-main)]">{stats.open}</span>
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Open</span>
                </Card>
                <Card padding="md" className="flex flex-col items-center border-l-4 border-l-emerald-500">
                    <span className="text-2xl font-bold text-[var(--color-text-main)]">{stats.completed}</span>
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Done</span>
                </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-xl">
                {(['open', 'completed', 'all'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`
                            flex-1 px-6 py-2 rounded-lg text-sm font-semibold capitalize transition-all
                            ${statusFilter === status
                                ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                        `}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Add Task Form */}
            <form onSubmit={handleAddTask} className="flex gap-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Add a new personal task..."
                        className="w-full bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 rounded-xl px-4 py-3 text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] transition-all"
                    />
                </div>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={!newTaskTitle.trim()}
                    isLoading={saving}
                    className="shrink-0"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Task
                </Button>
            </form>

            {/* Task List */}
            <div className="flex flex-col gap-3">
                {filteredTasks.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center">
                        <div className="bg-[var(--color-surface-hover)] p-6 rounded-full mb-4">
                            <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)]">
                                {statusFilter === 'completed' ? 'task_alt' : 'check_circle'}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">
                            {statusFilter === 'completed' ? 'No completed tasks yet' : 'All caught up!'}
                        </h3>
                        <p className="text-[var(--color-text-muted)] max-w-sm">
                            {statusFilter === 'completed'
                                ? 'Complete some tasks to see them here.'
                                : 'Add a personal task to get started.'}
                        </p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => navigate(`/personal-tasks/${task.id}`)}
                            className="group bg-[var(--color-surface-paper)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-xl p-4 flex items-center gap-4 transition-all shadow-sm hover:shadow-md relative cursor-pointer"
                        >
                            {/* Checkbox */}
                            <button
                                onClick={(e) => handleToggle(e, task.id, task.isCompleted)}
                                className={`
                                    flex-shrink-0 size-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300
                                    ${task.isCompleted
                                        ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-500/20'
                                        : 'border-[var(--color-text-subtle)]/30 text-transparent hover:border-green-500 hover:text-green-500/20 bg-transparent'}
                                `}
                            >
                                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                            </button>

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                                <h3 className={`text-base font-semibold leading-snug transition-all ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through decoration-2' : 'text-[var(--color-text-main)]'}`}>
                                    {task.title}
                                </h3>
                                {task.description && (
                                    <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-1">
                                        {task.description}
                                    </p>
                                )}
                                {task.dueDate && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-[var(--color-text-muted)]">
                                        <span className="material-symbols-outlined text-[14px]">event</span>
                                        {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {/* Move to Project Button */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMoveDropdown(showMoveDropdown === task.id ? null : task.id); }}
                                        disabled={movingTaskId === task.id}
                                        className="p-2 rounded-lg hover:bg-indigo-500/10 text-[var(--color-text-muted)] hover:text-indigo-500 transition-all"
                                        title="Move to project"
                                    >
                                        {movingTaskId === task.id ? (
                                            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
                                        )}
                                    </button>

                                    {/* Project Dropdown */}
                                    {showMoveDropdown === task.id && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowMoveDropdown(null)} />
                                            <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl overflow-hidden animate-scale-up origin-top-right">
                                                <div className="px-3 py-2 border-b border-[var(--color-surface-border)] text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    Move to Project
                                                </div>
                                                <div className="max-h-48 overflow-y-auto">
                                                    {projects.length === 0 ? (
                                                        <div className="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">
                                                            No projects available
                                                        </div>
                                                    ) : (
                                                        projects.map(project => (
                                                            <button
                                                                key={project.id}
                                                                onClick={() => handleMoveToProject(task.id, project.id)}
                                                                className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2"
                                                            >
                                                                <span className="size-2 rounded-full bg-[var(--color-primary)]" />
                                                                <span className="truncate text-[var(--color-text-main)]">{project.title}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => handleDelete(e, task.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-500 transition-all"
                                    title="Delete task"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
