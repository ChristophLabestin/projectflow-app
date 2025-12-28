import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';

interface ProjectBoardProps {
    tasks: Task[];
    renderTask: (task: Task) => React.ReactNode;
    stickyOffset?: string;
}

type BoardColumn = {
    id: string;
    title: string;
    statuses: TaskStatus[];
    color: string;
};

const COLUMNS: (BoardColumn & { style: { borderColor: string; dotColor: string; badgeBg: string; badgeText: string; } })[] = [
    {
        id: 'backlog',
        title: 'Backlog',
        statuses: ['Backlog'],
        color: 'slate',
        style: {
            borderColor: 'border-slate-200/50 dark:border-slate-500/20',
            dotColor: 'bg-slate-500',
            badgeBg: 'bg-slate-100 dark:bg-slate-500/20',
            badgeText: 'text-slate-700 dark:text-slate-300'
        }
    },
    {
        id: 'todo',
        title: 'To Do',
        statuses: ['Todo', 'Open', 'On Hold'],
        color: 'blue',
        style: {
            borderColor: 'border-blue-200/50 dark:border-blue-500/20',
            dotColor: 'bg-blue-500',
            badgeBg: 'bg-blue-100 dark:bg-blue-500/20',
            badgeText: 'text-blue-700 dark:text-blue-300'
        }
    },
    {
        id: 'inprogress',
        title: 'In Progress',
        statuses: ['In Progress'],
        color: 'indigo',
        style: {
            borderColor: 'border-indigo-200/50 dark:border-indigo-500/20',
            dotColor: 'bg-indigo-500',
            badgeBg: 'bg-indigo-100 dark:bg-indigo-500/20',
            badgeText: 'text-indigo-700 dark:text-indigo-300'
        }
    },
    {
        id: 'review',
        title: 'Review',
        statuses: ['Review'],
        color: 'purple',
        style: {
            borderColor: 'border-purple-200/50 dark:border-purple-500/20',
            dotColor: 'bg-purple-500',
            badgeBg: 'bg-purple-100 dark:bg-purple-500/20',
            badgeText: 'text-purple-700 dark:text-purple-300'
        }
    },
    {
        id: 'done',
        title: 'Done',
        statuses: ['Done'],
        color: 'emerald',
        style: {
            borderColor: 'border-emerald-200/50 dark:border-emerald-500/20',
            dotColor: 'bg-emerald-500',
            badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
            badgeText: 'text-emerald-700 dark:text-emerald-300'
        }
    },
];

export const ProjectBoard: React.FC<ProjectBoardProps> = ({ tasks, renderTask, stickyOffset = '0px' }) => {

    const columnsWithTasks = useMemo(() => {
        return COLUMNS.map(col => {
            const colTasks = tasks.filter(t => {
                if (col.id === 'todo') {
                    // Catch-all for undefined status or explicit Todo/Open/OnHold
                    return !t.status || col.statuses.includes(t.status);
                }
                return t.status && col.statuses.includes(t.status);
            });
            return {
                ...col,
                tasks: colTasks
            };
        });
    }, [tasks]);

    return (
        <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 md:px-0">
            {columnsWithTasks.map(col => (
                <div key={col.id} className="flex-none w-80 flex flex-col gap-4">
                    {/* Column Header */}
                    <div
                        className={`
                            flex items-center justify-between px-4 py-3 rounded-2xl border backdrop-blur-md
                            bg-white/60 dark:bg-black/20
                            ${col.style.borderColor}
                            sticky z-10
                        `}
                        style={{ top: stickyOffset }}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`size-2 rounded-full ${col.style.dotColor}`} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-main)]">
                                {col.title}
                            </h3>
                        </div>
                        <span className={`
                            text-xs font-bold px-2 py-0.5 rounded-full
                            ${col.style.badgeBg}
                            ${col.style.badgeText}
                        `}>
                            {col.tasks.length}
                        </span>
                    </div>

                    {/* Tasks List */}
                    <div className="flex flex-col gap-3 min-h-[150px]">
                        {col.tasks.map(task => (
                            <div key={task.id} className="transform transition-all">
                                {renderTask(task)}
                            </div>
                        ))}
                        {col.tasks.length === 0 && (
                            <div className="h-full border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-center p-8 opacity-50">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Empty</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
