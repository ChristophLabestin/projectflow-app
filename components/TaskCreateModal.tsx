import React, { useEffect, useMemo, useState } from 'react';
import { addTask, getProjectCategories, getProjectTasks } from '../services/dataService';
import { IdeaGroup, Task, TaskCategory, TaskStatus } from '../types';
import { generateProjectDescription } from '../services/geminiService';

type Props = {
    projectId: string;
    onClose: () => void;
    onCreated?: (tasks: Task[], categories: TaskCategory[]) => void;
};

export const TaskCreateModal: React.FC<Props> = ({ projectId, onClose, onCreated }) => {
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDue, setNewTaskDue] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('Medium');
    const [newTaskCategories, setNewTaskCategories] = useState<IdeaGroup[]>([]);
    const [newTaskCategoryInput, setNewTaskCategoryInput] = useState('');
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('Open');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<TaskCategory[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [catData, taskData] = await Promise.all([
                    getProjectCategories(projectId),
                    getProjectTasks(projectId)
                ]);
                setCategories(catData);
                setTasks(taskData);
            } catch (err) {
                console.error('Failed to load data for task modal', err);
            }
        })();
    }, [projectId]);

    const categoryOptions = useMemo(
        () => Array.from(new Set([
            ...categories.map(c => c.name.trim()),
            ...tasks.flatMap(t => {
                const cats = Array.isArray(t.category) ? t.category : [t.category || ''];
                return cats.map(c => (c || '').trim());
            })
        ].filter(Boolean))),
        [categories, tasks]
    );
    const filteredNewCategories = useMemo(
        () => categoryOptions.filter(c => c.toLowerCase().includes((newTaskCategoryInput || '').toLowerCase()) && !newTaskCategories.includes(c)),
        [categoryOptions, newTaskCategoryInput, newTaskCategories]
    );

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        setIsAdding(true);
        setError(null);
        try {
            const categoriesToSave = Array.from(new Set([
                ...newTaskCategories,
                ...(newTaskCategoryInput.trim() ? [newTaskCategoryInput.trim()] : [])
            ]));
            await addTask(projectId, newTaskTitle.trim(), newTaskDue || undefined, undefined, newTaskPriority, {
                description: newTaskDescription,
                category: categoriesToSave.length ? categoriesToSave : undefined,
                status: newTaskStatus
            });
            const [refreshedTasks, refreshedCategories] = await Promise.all([
                getProjectTasks(projectId),
                getProjectCategories(projectId)
            ]);
            setTasks(refreshedTasks);
            setCategories(refreshedCategories);
            onCreated?.(refreshedTasks, refreshedCategories);
            setNewTaskTitle('');
            setNewTaskDue('');
            setNewTaskPriority('Medium');
            setNewTaskCategories([]);
            setNewTaskCategoryInput('');
            setNewTaskStatus('Open');
            setNewTaskDescription('');
            onClose();
        } catch (err) {
            console.error('Failed to add task', err);
            setError('Failed to add task. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleGenerateDescription = async () => {
        if (!newTaskTitle.trim()) return;
        setIsGeneratingDesc(true);
        setError(null);
        try {
            const desc = await generateProjectDescription(newTaskTitle, newTaskDescription || 'Task details');
            setNewTaskDescription(desc.slice(0, 280));
        } catch (err) {
            console.error('Failed to generate description', err);
            setError('Could not generate a description right now.');
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleAddTask} className="space-y-4">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-bold">New Task</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Add details, categories, and status in one place.</p>
                        </div>
                        <button type="button" onClick={onClose} className="text-xs text-slate-500">Close</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
                        <div className="lg:col-span-2 flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <label>Title</label>
                                    <span className="text-[11px] font-medium text-slate-400">{newTaskTitle.length}/50</span>
                                </div>
                                <input
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                                    placeholder="Add a new task..."
                                    value={newTaskTitle}
                                    maxLength={50}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Description</label>
                                <textarea
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                                    value={newTaskDescription}
                                    onChange={(e) => setNewTaskDescription(e.target.value)}
                                    placeholder="Add context, acceptance criteria, or notes"
                                    rows={4}
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleGenerateDescription}
                                        disabled={isGeneratingDesc}
                                        className="flex items-center gap-1.5 text-xs font-bold text-black hover:text-gray-700 transition-colors bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                                    >
                                        <span className={`material-symbols-outlined text-sm ${isGeneratingDesc ? 'animate-spin' : ''}`}>
                                            {isGeneratingDesc ? 'autorenew' : 'auto_awesome'}
                                        </span>
                                        {isGeneratingDesc ? 'Generating…' : 'Generate with Gemini'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Categories</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {newTaskCategories.map(c => (
                                        <span key={c} className="px-3 py-1 rounded-full text-xs border border-black/30 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 flex items-center gap-1">
                                            {c}
                                            <button type="button" onClick={() => setNewTaskCategories(prev => prev.filter(x => x !== c))} className="text-[10px] text-slate-500 hover:text-black dark:hover:text-white">✕</button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                                    value={newTaskCategoryInput}
                                    onChange={(e) => setNewTaskCategoryInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = newTaskCategoryInput.trim();
                                            if (val && !newTaskCategories.includes(val)) {
                                                setNewTaskCategories(prev => [...prev, val]);
                                            }
                                            setNewTaskCategoryInput('');
                                        }
                                    }}
                                    placeholder="Type and press Enter to add"
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(newTaskCategoryInput ? filteredNewCategories : categoryOptions).map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => {
                                                if (!newTaskCategories.includes(c)) {
                                                    setNewTaskCategories(prev => [...prev, c]);
                                                }
                                                setNewTaskCategoryInput('');
                                            }}
                                            className={`px-3 py-1 rounded-full text-xs border ${
                                                newTaskCategories.includes(c)
                                                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                    {categoryOptions.length === 0 && (
                                        <span className="text-xs text-slate-500">No categories yet</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Due date</label>
                                <input
                                    type="date"
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                                    value={newTaskDue}
                                    onChange={(e) => setNewTaskDue(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Priority</label>
                                <select
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                                    value={newTaskPriority}
                                    onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                                >
                                    <option value="Urgent">Urgent</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</label>
                                <select
                                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                                    value={newTaskStatus}
                                    onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                                >
                                    <option value="Backlog">Backlog</option>
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Blocked">Blocked</option>
                                    <option value="Done">Done</option>
                                </select>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                Tip: Use categories and status to keep the board organized. You can bulk-edit later.
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        {error ? <span className="text-sm text-rose-600">{error}</span> : <span className="text-xs text-slate-500">Press Enter in categories to create new pills or click suggestions below.</span>}
                        <div className="flex gap-2">
                            <button onClick={onClose} type="button" className="px-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                            <button type="submit" disabled={isAdding} className="px-4 py-2 text-sm font-bold bg-black text-white rounded-lg disabled:opacity-50">
                                {isAdding ? 'Adding…' : 'Add Task'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
