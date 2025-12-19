import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserTasks, toggleTaskStatus, addTask } from '../services/dataService';
import { Task } from '../types';

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [quickTaskTitle, setQuickTaskTitle] = useState('');

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const data = await getUserTasks();
                setTasks(data);
            } catch (error) {
                console.error("Failed to fetch tasks", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    const handleToggle = async (taskId: string, currentStatus: boolean) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus);
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickTaskTitle.trim()) return;
        
        // Optimistic add (requires knowing a project ID, here we might default to a 'Inbox' project or let backend handle)
        // For this demo, we'll try to add it to the first project or a 'Inbox'
        // Since addTask requires projectId, this Quick Add is best suited inside a project, 
        // but for a global list, we might just log it or require a project selection.
        // For simplicity, we won't implement global quick add in this view without project selector.
        alert("Please add tasks from within a specific project view.");
        setQuickTaskTitle('');
    };

    const filteredTasks = tasks.filter(t => {
        if (filter === 'active') return !t.isCompleted;
        if (filter === 'completed') return t.isCompleted;
        return true;
    });

    return (
        <div className="max-w-[1200px] mx-auto flex flex-col gap-6 md:gap-8 pb-10 p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl font-extrabold leading-tight tracking-[-0.033em]">My Work</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base font-medium">Manage tasks across all your active projects.</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white dark:bg-card-dark p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex p-1 bg-gray-50 dark:bg-gray-800 rounded-lg w-full sm:w-auto overflow-x-auto">
                    <button 
                        onClick={() => setFilter('all')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm whitespace-nowrap font-medium transition-colors ${filter === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}`}
                    >
                        All ({tasks.length})
                    </button>
                    <button 
                        onClick={() => setFilter('active')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm whitespace-nowrap font-medium transition-colors ${filter === 'active' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}`}
                    >
                        Active ({tasks.filter(t => !t.isCompleted).length})
                    </button>
                    <button 
                         onClick={() => setFilter('completed')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm whitespace-nowrap font-medium transition-colors ${filter === 'completed' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}`}
                    >
                        Completed ({tasks.filter(t => t.isCompleted).length})
                    </button>
                </div>
            </div>

            {loading ? (
                 <div className="flex justify-center py-20">
                    <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <span className="material-symbols-outlined text-4xl text-gray-400 mb-4">check_circle</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No tasks found</h3>
                    <p className="text-gray-500">You're all caught up!</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredTasks.map(task => (
                            <div key={task.id} className="group flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => handleToggle(task.id, task.isCompleted)}>
                                <div className="relative flex items-center justify-center size-5 shrink-0">
                                    <input 
                                        readOnly
                                        checked={task.isCompleted} 
                                        className="peer appearance-none size-5 border-2 border-gray-300 dark:border-gray-600 rounded checked:bg-black checked:border-black dark:checked:bg-white dark:checked:border-white transition-all cursor-pointer" 
                                        type="checkbox"
                                    />
                                    <span className="material-symbols-outlined absolute text-white dark:text-black text-[14px] pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium transition-colors truncate ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                                        {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                         {task.priority && (
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                task.priority === 'Urgent' ? 'text-red-500' :
                                                task.priority === 'High' ? 'text-orange-500' :
                                                'text-gray-500'
                                            }`}>
                                                {task.priority}
                                            </span>
                                         )}
                                         {task.dueDate && (
                                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                         )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500">
                                    {task.assignee ? task.assignee.substring(0,2).toUpperCase() : 'ME'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};