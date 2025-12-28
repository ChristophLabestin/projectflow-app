import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { getProjectTasks, subscribeProjectTasks } from '../services/dataService';
import { Button } from './ui/Button';

interface TaskDependencySelectorProps {
    projectId: string;
    currentTaskId?: string; // To exclude self
    selectedDependencyIds: string[];
    onChange: (ids: string[]) => void;
}

export const TaskDependencySelector: React.FC<TaskDependencySelectorProps> = ({
    projectId,
    currentTaskId,
    selectedDependencyIds,
    onChange
}) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        // Subscribe to tasks to get the list for dependencies
        const unsubscribe = subscribeProjectTasks(projectId, (data) => {
            setTasks(data);
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [projectId]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter tasks: exclude current task, exclude already selected (logic handled in render), match search
    const filteredTasks = tasks.filter(t =>
        t.id !== currentTaskId &&
        t.title.toLowerCase().includes(search.toLowerCase()) &&
        !selectedDependencyIds.includes(t.id) &&
        !t.isCompleted // Optional: don't allow depend on completed tasks? Maybe allow it.
    );

    const toggleSelection = (taskId: string) => {
        if (selectedDependencyIds.includes(taskId)) {
            onChange(selectedDependencyIds.filter(id => id !== taskId));
        } else {
            onChange([...selectedDependencyIds, taskId]);
        }
        setSearch(''); // Reset search after selection? Maybe keep it.
    };

    const removeDependency = (taskId: string) => {
        onChange(selectedDependencyIds.filter(id => id !== taskId));
    };

    // Look up selected tasks to display their titles
    const selectedTasks = tasks.filter(t => selectedDependencyIds.includes(t.id));

    return (
        <div className="flex flex-col gap-3" ref={containerRef}>
            {/* Selected Dependencies List */}
            {selectedTasks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                    {selectedTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20">
                            <span className="material-symbols-outlined text-[14px]">link</span>
                            <span className="truncate max-w-[150px]">{task.title}</span>
                            <button
                                type="button"
                                onClick={() => removeDependency(task.id)}
                                className="ml-1 hover:text-indigo-900 dark:hover:text-indigo-100"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="relative">
                <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start text-[var(--color-text-muted)] border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-input)] hover:bg-[var(--color-surface-hover)] p-0 h-auto"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2 w-full px-3 py-2.5">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">add_link</span>
                        <input
                            type="text"
                            className="bg-transparent border-none outline-none text-sm w-full pl-7 placeholder:text-[var(--color-text-muted)]"
                            placeholder="Add dependency..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setIsOpen(true);
                            }}
                            onFocus={() => setIsOpen(true)}
                        />
                        <span className="material-symbols-outlined text-[var(--color-text-muted)] text-sm">expand_more</span>
                    </div>
                </Button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                        {loading && tasks.length === 0 ? (
                            <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">Loading tasks...</div>
                        ) : filteredTasks.length === 0 ? (
                            <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
                                {search ? 'No matching tasks found' : 'No other tasks available'}
                            </div>
                        ) : (
                            <div className="p-1">
                                {filteredTasks.map(task => (
                                    <button
                                        key={task.id}
                                        type="button"
                                        onClick={() => {
                                            toggleSelection(task.id);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] flex items-center gap-2 group transition-colors"
                                    >
                                        <div className={`
                                            size-2 rounded-full 
                                            ${task.isCompleted ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}
                                        `} />
                                        <span className="text-sm font-medium text-[var(--color-text-main)] truncate">{task.title}</span>
                                        {task.priority === 'Urgent' && (
                                            <span className="ml-auto text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">URGENT</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
