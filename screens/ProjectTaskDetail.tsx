import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addSubTask, getSubTasks, getTaskById, toggleSubTaskStatus, toggleTaskStatus } from '../services/dataService';
import { SubTask, Task } from '../types';

export const ProjectTaskDetail = () => {
    const { id, taskId } = useParams<{ id: string; taskId: string }>();
    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newSubTitle, setNewSubTitle] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const doneCount = subTasks.filter(s => s.isCompleted).length;
    const totalCount = subTasks.length;
    const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    useEffect(() => {
        if (!taskId) return;
        (async () => {
            try {
                const t = await getTaskById(taskId);
                setTask(t);
                const subs = await getSubTasks(taskId);
                setSubTasks(subs);
            } catch (err) {
                console.error('Failed to load task', err);
                setError('Failed to load task details.');
            } finally {
                setLoading(false);
            }
        })();
    }, [taskId]);

    const refreshSubs = async () => {
        if (!taskId) return;
        const subs = await getSubTasks(taskId);
        setSubTasks(subs);
    };

    const handleAddSubTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!taskId || !newSubTitle.trim()) return;
        setAdding(true);
        try {
            await addSubTask(taskId, newSubTitle.trim());
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
        await toggleSubTaskStatus(subId, currentStatus);
    };

    const handleToggleTask = async () => {
        if (!task) return;
        setSavingStatus(true);
        setTask({ ...task, isCompleted: !task.isCompleted });
        try {
            await toggleTaskStatus(task.id, task.isCompleted);
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

    return (
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
            {error && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    {error}
                </div>
            )}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            Task Detail
                        </span>
                        {task.priority && (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${priorityTone[task.priority] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {task.priority}
                            </span>
                        )}
                        {task.status && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                                {task.status}
                            </span>
                        )}
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
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">{task.title}</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
                        {task.description || 'No description added yet.'}
                    </p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                    <button
                        onClick={handleToggleTask}
                        disabled={savingStatus}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border ${
                            task.isCompleted
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'border-slate-300 text-slate-800 dark:text-slate-100 hover:border-slate-400'
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
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white">Subtasks</h3>
                            <span className="text-xs text-slate-500">{doneCount}/{totalCount} done</span>
                        </div>
                        {totalCount > 0 && (
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div className="h-full bg-slate-900 dark:bg-white rounded-full" style={{ width: `${progressPct}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{progressPct}%</span>
                            </div>
                        )}

                        <form onSubmit={handleAddSubTask} className="flex gap-2">
                            <input
                                className="flex-1 bg-transparent border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-500/20"
                                placeholder="Add a subtask..."
                                value={newSubTitle}
                                onChange={(e) => setNewSubTitle(e.target.value)}
                            />
                            <button type="submit" disabled={adding} className="px-3 py-2 text-sm font-bold bg-black text-white rounded-lg disabled:opacity-50">Add</button>
                        </form>

                        {subTasks.length === 0 ? (
                            <div className="text-center text-sm text-slate-500 py-6">No subtasks yet.</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {subTasks.map(sub => (
                                    <div key={sub.id} className="flex items-center gap-3 py-3">
                                        <div className="relative flex items-center justify-center size-5">
                                            <input
                                                readOnly
                                                checked={sub.isCompleted}
                                                className="peer appearance-none size-5 border-2 border-slate-300 dark:border-slate-600 rounded checked:bg-black checked:border-black dark:checked:bg-white dark:checked:border-white transition-all cursor-pointer"
                                                type="checkbox"
                                                onClick={() => handleToggleSubTask(sub.id, sub.isCompleted)}
                                            />
                                            <span className="material-symbols-outlined absolute text-white dark:text-black text-[14px] pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${sub.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>{sub.title}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-3">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Task Details</h4>
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <DetailRow label="Status" value={task.status || 'Not set'} icon="flag" />
                            <DetailRow label="Priority" value={task.priority || 'Not set'} icon="priority_high" />
                            <DetailRow label="Due date" value={task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'} icon="calendar_today" />
                            <DetailRow label="Assignee" value={task.assignee || 'Unassigned'} icon="person" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DetailRow = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
        <div className="flex items-center gap-2 text-slate-500">
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
            <span className="text-xs uppercase font-semibold tracking-wide">{label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
    </div>
);
