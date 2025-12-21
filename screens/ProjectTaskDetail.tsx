import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addSubTask, getProjectTasks, getSubTasks, getTaskById, toggleSubTaskStatus, toggleTaskStatus } from '../services/dataService';
import { SubTask, Task } from '../types';
import { CommentSection } from '../components/CommentSection';
import { Input } from '../components/ui/Input';
import { EditTaskModal } from '../components/EditTaskModal';
import { getProjectMembers, updateTaskFields } from '../services/dataService';

export const ProjectTaskDetail = () => {
    const { id, taskId } = useParams<{ id: string; taskId: string }>();
    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newSubTitle, setNewSubTitle] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [members, setMembers] = useState<string[]>([]);

    const doneCount = subTasks.filter(s => s.isCompleted).length;
    const totalCount = subTasks.length;
    const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    const loadData = async () => {
        if (!taskId) return;
        try {
            let t = await getTaskById(taskId, id);
            if (!t && id) {
                const projectTasks = await getProjectTasks(id);
                t = projectTasks.find((task) => task.id === taskId) || null;
            }
            setTask(t);
            const subs = await getSubTasks(taskId, id);
            setSubTasks(subs);

            if (id) {
                const m = await getProjectMembers(id);
                setMembers(m);
            }
        } catch (err) {
            console.error('Failed to load task', err);
            setError('Failed to load task details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [taskId, id]);

    const refreshSubs = async () => {
        if (!taskId) return;
        const subs = await getSubTasks(taskId, id);
        setSubTasks(subs);
    };

    const handleAddSubTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!taskId || !newSubTitle.trim()) return;
        setAdding(true);
        try {
            await addSubTask(taskId, newSubTitle.trim(), id);
            setNewSubTitle('');
            await refreshSubs();
        } catch (err) {
            console.error('Failed to add subtask', err);
            setError('Failed to add subtask. Please try again.');
        } finally {
            setAdding(false);
        }
    };

    const handleToggleSubTask = async (subId: string, currentStatus: boolean) => {
        setSubTasks(prev => prev.map(s => s.id === subId ? { ...s, isCompleted: !currentStatus } : s));
        await toggleSubTaskStatus(subId, currentStatus, taskId, id);
    };

    const handleToggleTask = async () => {
        if (!task) return;
        setSavingStatus(true);
        setTask({ ...task, isCompleted: !task.isCompleted });
        try {
            await toggleTaskStatus(task.id, task.isCompleted, id);
        } finally {
            setSavingStatus(false);
        }
    };

    const categories = useMemo(() => {
        if (!task?.category) return [];
        if (Array.isArray(task.category)) return task.category.filter(Boolean);
        return [task.category].filter(Boolean);
    }, [task]);

    const priorityTone: Record<string, string> = {
        Urgent: 'bg-rose-100 text-rose-700 border-rose-200',
        High: 'bg-amber-100 text-amber-700 border-amber-200',
        Medium: 'bg-blue-100 text-blue-700 border-blue-200',
        Low: 'bg-slate-100 text-slate-600 border-slate-200'
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
            </div>
        );
    }

    if (!task) {
        return <div className="p-4">Task not found.</div>;
    }

    const handleUpdateField = async (field: keyof Task, value: any) => {
        if (!task) return;
        setTask({ ...task, [field]: value });
        await updateTaskFields(task.id, { [field]: value }, id);
    };

    return (
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6 animate-fade-up">
            {isEditModalOpen && task && (
                <EditTaskModal
                    task={task}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={loadData}
                    projectMembers={members}
                />
            )}

            {error && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    {error}
                </div>
            )}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="app-pill">Task Detail</span>

                        {task.dueDate && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        )}
                        {categories.map(cat => (
                            <span key={cat} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                {cat}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-start gap-3 group">
                        <h1 className="text-3xl font-display font-bold text-[var(--color-text-main)] leading-tight">{task.title}</h1>
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="mt-1 size-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Edit Task"
                        >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                    </div>

                    <p className="text-sm text-[var(--color-text-muted)] max-w-3xl whitespace-pre-wrap">
                        {task.description || 'No description added yet.'}
                    </p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                    <button
                        onClick={handleToggleTask}
                        disabled={savingStatus}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${task.isCompleted ? 'btn-primary' : 'btn-secondary'
                            } disabled:opacity-50`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{task.isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
                        {task.isCompleted ? 'Completed' : 'Mark Complete'}
                    </button>
                    <Link to={`/project/${id}/tasks`} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:underline">Back to tasks</Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="app-card p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-[var(--color-text-main)]">Subtasks</h3>
                            <span className="text-xs text-[var(--color-text-muted)]">{doneCount}/{totalCount} done</span>
                        </div>
                        {totalCount > 0 && (
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-border)] overflow-hidden">
                                    <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold text-[var(--color-text-muted)]">{progressPct}%</span>
                            </div>
                        )}

                        <form onSubmit={handleAddSubTask} className="flex items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    placeholder="Add a subtask..."
                                    value={newSubTitle}
                                    onChange={(e) => setNewSubTitle(e.target.value)}
                                    className="bg-[var(--color-surface-bg)]"
                                />
                            </div>
                            <button type="submit" disabled={adding} className="h-[42px] px-4 rounded-xl font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">
                                Add
                            </button>
                        </form>

                        {subTasks.length === 0 ? (
                            <div className="text-center text-sm text-slate-500 py-6">No subtasks yet.</div>
                        ) : (
                            <div className="divide-y divide-[var(--color-surface-border)]">
                                {subTasks.map(sub => (
                                    <div key={sub.id} className="flex items-center gap-3 py-3">
                                        <div className="relative flex items-center justify-center size-5">
                                            <input
                                                readOnly
                                                checked={sub.isCompleted}
                                                className="peer appearance-none size-5 border-2 border-[var(--color-surface-border)] rounded checked:bg-[var(--color-primary)] checked:border-[var(--color-primary)] transition-all cursor-pointer"
                                                type="checkbox"
                                                onClick={() => handleToggleSubTask(sub.id, sub.isCompleted)}
                                            />
                                            <span className="material-symbols-outlined absolute text-[var(--color-primary-text)] text-[14px] pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${sub.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>{sub.title}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="app-card p-4 space-y-3">
                        <h4 className="text-sm font-bold text-[var(--color-text-main)]">Task Details</h4>
                        <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
                            <DetailRow label="Status" icon="flag">
                                <div className="group relative">
                                    <select
                                        value={task.status || 'Open'}
                                        onChange={(e) => handleUpdateField('status', e.target.value)}
                                        className="appearance-none bg-transparent text-[var(--color-text-main)] font-semibold cursor-pointer focus:outline-none text-right pr-5 hover:text-[var(--color-primary)] transition-colors"
                                    >
                                        <option value="Backlog">Backlog</option>
                                        <option value="Open">Open</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Review">Review</option>
                                        <option value="Blocked">Blocked</option>
                                        <option value="Done">Done</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)] transition-colors">
                                        expand_more
                                    </span>
                                </div>
                            </DetailRow>
                            <DetailRow label="Priority" icon="priority_high">
                                <div className="group relative">
                                    <select
                                        value={task.priority || 'Medium'}
                                        onChange={(e) => handleUpdateField('priority', e.target.value)}
                                        className={`appearance-none bg-transparent font-bold cursor-pointer focus:outline-none text-right pr-5 transition-all ${task.priority === 'Urgent' ? 'text-rose-600 dark:text-rose-400' :
                                                task.priority === 'High' ? 'text-amber-600 dark:text-amber-400' :
                                                    task.priority === 'Medium' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                                            } hover:opacity-80`}
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                    <span className={`material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none transition-opacity group-hover:opacity-100 opacity-60 ${task.priority === 'Urgent' ? 'text-rose-600 dark:text-rose-400' :
                                            task.priority === 'High' ? 'text-amber-600 dark:text-amber-400' :
                                                task.priority === 'Medium' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                                        }`}>
                                        expand_more
                                    </span>
                                </div>
                            </DetailRow>
                            <DetailRow label="Due date" value={task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'} icon="calendar_today" />
                            <DetailRow label="Assignee" value={task.assignee || 'Unassigned'} icon="person" />
                        </div>
                    </div>

                    <div className="app-card overflow-hidden">
                        <CommentSection projectId={id || ''} targetId={taskId} targetType="task" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const DetailRow = ({ label, value, icon, children }: { label: string; value?: string; icon: string; children?: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-surface-border)] last:border-b-0 min-h-[40px]">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
            <span className="text-xs uppercase font-semibold tracking-wide">{label}</span>
        </div>
        <div className="text-sm font-semibold text-[var(--color-text-main)]">
            {children || value}
        </div>
    </div>
);
