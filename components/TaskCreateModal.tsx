import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addTask, getProjectCategories, getProjectTasks } from '../services/dataService';
import { IdeaGroup, Task, TaskCategory, TaskStatus } from '../types';
import { generateProjectDescription } from '../services/geminiService';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { Card } from './ui/Card';

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
    // Removed ref in favor of autoFocus prop if available, or just rely on Input behavior

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

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const categoryOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...categories.map((c) => c.name.trim()),
                    ...tasks.flatMap((t) => {
                        const cats = Array.isArray(t.category) ? t.category : [t.category || ''];
                        return cats.map((c) => (c || '').trim());
                    })
                ].filter(Boolean))
            ),
        [categories, tasks]
    );

    const filteredNewCategories = useMemo(
        () =>
            categoryOptions.filter(
                (c) => c.toLowerCase().includes((newTaskCategoryInput || '').toLowerCase()) && !newTaskCategories.includes(c)
            ),
        [categoryOptions, newTaskCategoryInput, newTaskCategories]
    );

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        setIsAdding(true);
        setError(null);
        try {
            const categoriesToSave = Array.from(
                new Set([...
                    newTaskCategories,
                ...(newTaskCategoryInput.trim() ? [newTaskCategoryInput.trim()] : [])
                ])
            );
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 animate-fade-up bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleAddTask} className="space-y-6">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-surface-border)] pb-4">
                        <div>
                            <h2 className="text-xl font-bold text-[var(--color-text-main)]">New Task</h2>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">Capture details, status, and categories in one place.</p>
                        </div>
                        <Button type="button" variant="ghost" onClick={onClose} size="sm">
                            Close
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <Input
                                label="Title"
                                placeholder="Add a new task..."
                                value={newTaskTitle}
                                maxLength={50}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                autoFocus
                                required
                            />

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-[var(--color-text-main)]">Description</label>
                                    <Button
                                        type="button"
                                        onClick={handleGenerateDescription}
                                        disabled={isGeneratingDesc || !newTaskTitle}
                                        variant="ghost"
                                        size="xs"
                                        loading={isGeneratingDesc}
                                        icon={<span className="material-symbols-outlined text-sm">auto_awesome</span>}
                                    >
                                        Generate with Gemini
                                    </Button>
                                </div>
                                <Textarea
                                    value={newTaskDescription}
                                    onChange={(e) => setNewTaskDescription(e.target.value)}
                                    placeholder="Add context, acceptance criteria, or notes"
                                    rows={4}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-[var(--color-text-main)]">Categories</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {newTaskCategories.map((c) => (
                                        <span key={c} className="px-2 py-1 rounded bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] text-xs font-medium text-[var(--color-text-main)] flex items-center gap-1">
                                            {c}
                                            <button
                                                type="button"
                                                onClick={() => setNewTaskCategories((prev) => prev.filter((x) => x !== c))}
                                                className="hover:text-red-500"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <Input
                                    value={newTaskCategoryInput}
                                    onChange={(e) => setNewTaskCategoryInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = newTaskCategoryInput.trim();
                                            if (val && !newTaskCategories.includes(val)) {
                                                setNewTaskCategories((prev) => [...prev, val]);
                                            }
                                            setNewTaskCategoryInput('');
                                        }
                                    }}
                                    placeholder="Type and press Enter to add"
                                />
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {(newTaskCategoryInput ? filteredNewCategories : categoryOptions).map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => {
                                                if (!newTaskCategories.includes(c)) {
                                                    setNewTaskCategories((prev) => [...prev, c]);
                                                }
                                                setNewTaskCategoryInput('');
                                            }}
                                            className={`px-2 py-1 rounded text-xs border transition-colors ${newTaskCategories.includes(c) ? 'bg-[var(--color-text-main)] text-[var(--color-surface-bg)] border-[var(--color-text-main)]' : 'bg-transparent border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-main)]'}`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                    {categoryOptions.length === 0 && <span className="text-xs text-[var(--color-text-muted)]">No categories yet</span>}
                                </div>
                            </div>
                        </div>

                        <Card className="flex flex-col gap-4 h-fit">
                            <Input
                                label="Due Date"
                                type="date"
                                value={newTaskDue}
                                onChange={(e) => setNewTaskDue(e.target.value)}
                            />

                            <Select
                                label="Priority"
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                            >
                                <option value="Urgent">Urgent</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </Select>

                            <Select
                                label="Status"
                                value={newTaskStatus}
                                onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                            >
                                <option value="Backlog">Backlog</option>
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Blocked">Blocked</option>
                                <option value="Done">Done</option>
                            </Select>

                            <div className="text-xs text-[var(--color-text-muted)] mt-2">
                                Tip: Use categories and status to keep the board organized.
                            </div>
                        </Card>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[var(--color-surface-border)]">
                        {error ? (
                            <span className="text-sm text-rose-600">{error}</span>
                        ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">Press Enter in categories to create new pills or click suggestions.</span>
                        )}
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={isAdding}>
                                Add Task
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
