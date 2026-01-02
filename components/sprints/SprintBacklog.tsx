import React, { useState } from 'react';
import { Task, Sprint } from '../../types';
import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';

// Simplified Sprint Card for the list
const SprintItem = ({ sprint, tasks, onStart, onDelete, onEdit, isDroppable = false }: {
    sprint: Sprint,
    tasks: Task[],
    onStart: (id: string) => void,
    onDelete: (id: string) => void,
    onEdit: (sprint: Sprint) => void,
    isDroppable?: boolean
}) => {
    const { t, dateFormat } = useLanguage();
    const { setNodeRef, isOver } = useDroppable({
        id: `sprint-${sprint.id}`,
        data: { type: 'sprint', sprintId: sprint.id }
    });

    const isPlanning = sprint.status === 'Planning';

    return (
        <div
            ref={isDroppable ? setNodeRef : undefined}
            className={`
                flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-300
                ${isOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02] shadow-xl' : 'border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] hover:shadow-md'}
            `}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-[var(--color-text-main)]">{sprint.name}</h3>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${sprint.status === 'Active' ? 'bg-emerald-100/50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {sprint.status}
                        </span>
                        {sprint.autoStart && sprint.status === 'Planning' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100/50 border border-amber-200 px-2 py-0.5 rounded-full" title="Will auto-start on start date">
                                <span className="material-symbols-outlined text-xs">schedule</span>
                                Auto
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-medium mb-2">
                        {format(new Date(sprint.startDate), dateFormat)} - {format(new Date(sprint.endDate), dateFormat)}
                    </p>
                    {sprint.goal && (
                        <p className="text-sm text-[var(--color-text-subtle)] line-clamp-2">{sprint.goal}</p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {isPlanning && (
                        <Button size="sm" variant="ghost" className="text-[var(--color-primary)]" onClick={() => onStart(sprint.id)}>
                            Start
                        </Button>
                    )}
                    <button onClick={() => onEdit(sprint)} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onClick={() => onDelete(sprint.id)} className="p-2 text-[var(--color-text-muted)] hover:text-rose-500">
                        <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </div>

            {/* Task Stats */}
            <div className="flex items-center gap-3 text-xs font-bold text-[var(--color-text-muted)] bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">list</span>
                    {tasks.length} tasks
                </span>
                <span className="w-px h-3 bg-current opacity-20" />
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {tasks.filter(t => t.isCompleted).length} done
                </span>
            </div>

            {/* Droppable Hint */}
            {isDroppable && isOver && (
                <div className="flex items-center justify-center py-4 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50 text-indigo-500 font-bold text-sm">
                    Drop to assign
                </div>
            )}
        </div>
    );
};

// Draggable Task Row
const DraggableTask = ({ task, renderTask }: { task: Task, renderTask: (task: Task) => React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
        data: { type: 'task', task }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`touch-none ${isDragging ? 'opacity-50' : ''}`}>
            {renderTask(task)}
        </div>
    );
};

interface SprintBacklogProps {
    backlogTasks: Task[];
    sprints: Sprint[];
    allTasks: Task[]; // To select tasks for sprints
    renderTask: (task: Task) => React.ReactNode;
    onCreateSprint: () => void;
    onEditSprint: (sprint: Sprint) => void;
    onDeleteSprint: (id: string) => void;
    onStartSprint: (id: string) => void;
    onTaskDrop: (taskId: string, sprintId: string | null) => void;
}

export const SprintBacklog: React.FC<SprintBacklogProps> = ({
    backlogTasks,
    sprints,
    allTasks,
    renderTask,
    onCreateSprint,
    onEditSprint,
    onDeleteSprint,
    onStartSprint,
    onTaskDrop
}) => {
    const [activeDraggable, setActiveDraggable] = useState<Task | null>(null);

    const handleDragStart = (event: any) => {
        if (event.active.data.current?.type === 'task') {
            setActiveDraggable(event.active.data.current.task);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDraggable(null);

        if (!over) return;

        const taskId = active.id as string;
        const type = over.data.current?.type;

        if (type === 'sprint') {
            const sprintId = over.data.current?.sprintId;
            onTaskDrop(taskId, sprintId);
        } else if (type === 'backlog') {
            onTaskDrop(taskId, null);
        }
    };

    // Sort sprints: Active first, then Planning by date
    const sortedSprints = [...sprints].sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const { setNodeRef: setBacklogRef, isOver: isBacklogOver } = useDroppable({
        id: 'backlog-area',
        data: { type: 'backlog' }
    });

    // Sort backlog tasks by due date
    const sortedBacklogTasks = [...backlogTasks].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                {/* Left: Backlog (Unassigned Tasks) */}
                <div
                    ref={setBacklogRef}
                    className={`
                        lg:col-span-4 flex flex-col gap-4 rounded-[32px] p-6 border transition-all h-full overflow-hidden
                        ${isBacklogOver ? 'border-primary bg-primary/5' : 'border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]'}
                    `}
                >
                    <div className="flex items-center justify-between mb-2 shrink-0">
                        <h2 className="text-xl font-black text-[var(--color-text-main)]">Backlog</h2>
                        <span className="px-2 py-1 rounded-lg bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-muted)]">
                            {sortedBacklogTasks.length}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                        {sortedBacklogTasks.map(task => (
                            <DraggableTask key={task.id} task={task} renderTask={renderTask} />
                        ))}
                        {sortedBacklogTasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)] border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                <span className="text-sm font-medium">All caught up!</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Sprints List */}
                <div className="lg:col-span-8 flex flex-col gap-6 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-[var(--color-text-main)]">Sprints</h2>
                    </div>

                    <div className="space-y-4">
                        {sortedSprints.map(sprint => (
                            <SprintItem
                                key={sprint.id}
                                sprint={sprint}
                                tasks={allTasks.filter(t => t.sprintId === sprint.id)}
                                onStart={onStartSprint}
                                onDelete={onDeleteSprint}
                                onEdit={onEditSprint}
                                isDroppable={true}
                            />
                        ))}
                        {sortedSprints.length === 0 && (
                            <div className="p-12 text-center rounded-[32px] bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10">
                                <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">No Sprints Planned</h3>
                                <p className="text-[var(--color-text-muted)] mb-6">Create a sprint to organize your backlog tasks.</p>
                                <Button variant="secondary" onClick={onCreateSprint}>Create your first Sprint</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DragOverlay>
                {activeDraggable ? (
                    <div className="opacity-90 rotate-2 scale-105 pointer-events-none">
                        {renderTask(activeDraggable)}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext >
    );
};
