import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { Task, Sprint } from '../../types';
import { Button } from '../../components/common/Button/Button';
import { Badge } from '../../components/common/Badge/Badge';
import { Card } from '../../components/common/Card/Card';
import { useLanguage } from '../../context/LanguageContext';

const SprintItem = ({ sprint, tasks, onStart, onDelete, onEdit, isDroppable = false }: {
    sprint: Sprint,
    tasks: Task[],
    onStart: (id: string) => void,
    onDelete: (id: string) => void,
    onEdit: (sprint: Sprint) => void,
    isDroppable?: boolean
}) => {
    const { t, dateFormat, dateLocale } = useLanguage();
    const { setNodeRef, isOver } = useDroppable({
        id: `sprint-${sprint.id}`,
        data: { type: 'sprint', sprintId: sprint.id }
    });

    const statusLabels = useMemo(() => ({
        Active: t('projectSprints.status.active'),
        Planning: t('projectSprints.status.planning'),
        Completed: t('projectSprints.status.completed')
    }), [t]);

    const statusVariant = sprint.status === 'Active' ? 'success' : sprint.status === 'Completed' ? 'neutral' : 'neutral';
    const isPlanning = sprint.status === 'Planning';

    return (
        <div
            ref={isDroppable ? setNodeRef : undefined}
            className={`sprint-backlog__dropzone ${isOver ? 'is-over' : ''}`}
        >
            <Card className="sprint-backlog__sprint-card">
                <div className="sprint-backlog__sprint-header">
                    <div className="sprint-backlog__sprint-main">
                        <div className="sprint-backlog__sprint-title-row">
                            <h3 className="sprint-backlog__sprint-title">{sprint.name}</h3>
                            <Badge variant={statusVariant} className="sprint-backlog__status">
                                {statusLabels[sprint.status]}
                            </Badge>
                            {sprint.autoStart && sprint.status === 'Planning' && (
                                <Badge variant="warning" className="sprint-backlog__auto" title={t('projectSprints.upcoming.autoTitle')}>
                                    {t('projectSprints.upcoming.auto')}
                                </Badge>
                            )}
                        </div>
                        <p className="sprint-backlog__sprint-dates">
                            {format(new Date(sprint.startDate), dateFormat, { locale: dateLocale })}
                            <span className="sprint-backlog__date-separator">-</span>
                            {format(new Date(sprint.endDate), dateFormat, { locale: dateLocale })}
                        </p>
                        {sprint.goal && (
                            <p className="sprint-backlog__sprint-goal">{sprint.goal}</p>
                        )}
                    </div>
                    <div className="sprint-backlog__sprint-actions">
                        {isPlanning && (
                            <Button size="sm" variant="ghost" onClick={() => onStart(sprint.id)}>
                                {t('projectSprints.actions.start')}
                            </Button>
                        )}
                        <Button
                            size="icon"
                            variant="ghost"
                            className="sprint-backlog__icon-button"
                            onClick={() => onEdit(sprint)}
                            aria-label={t('projectSprints.actions.edit')}
                        >
                            <span className="material-symbols-outlined">edit</span>
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="sprint-backlog__icon-button sprint-backlog__icon-button--danger"
                            onClick={() => onDelete(sprint.id)}
                            aria-label={t('projectSprints.actions.delete')}
                        >
                            <span className="material-symbols-outlined">delete</span>
                        </Button>
                    </div>
                </div>

                <div className="sprint-backlog__sprint-stats">
                    <span>
                        <span className="material-symbols-outlined">list</span>
                        {t('projectSprints.backlog.stats.tasks').replace('{count}', String(tasks.length))}
                    </span>
                    <span className="sprint-backlog__stat-divider" />
                    <span>
                        <span className="material-symbols-outlined">check_circle</span>
                        {t('projectSprints.backlog.stats.done').replace('{count}', String(tasks.filter(t => t.isCompleted).length))}
                    </span>
                </div>

                {isDroppable && isOver && (
                    <div className="sprint-backlog__drop-hint">
                        {t('projectSprints.sprints.drop')}
                    </div>
                )}
            </Card>
        </div>
    );
};

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
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`sprint-backlog__draggable ${isDragging ? 'is-dragging' : ''}`}>
            {renderTask(task)}
        </div>
    );
};

interface SprintBacklogProps {
    backlogTasks: Task[];
    sprints: Sprint[];
    allTasks: Task[];
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
    const { t } = useLanguage();
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

    const sortedSprints = [...sprints].sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const { setNodeRef: setBacklogRef, isOver: isBacklogOver } = useDroppable({
        id: 'backlog-area',
        data: { type: 'backlog' }
    });

    const sortedBacklogTasks = [...backlogTasks].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="sprint-backlog">
                <div
                    ref={setBacklogRef}
                    className={`sprint-backlog__panel ${isBacklogOver ? 'is-over' : ''}`}
                >
                    <div className="sprint-backlog__panel-header">
                        <h2>{t('projectSprints.backlog.title')}</h2>
                        <span className="sprint-backlog__count">{sortedBacklogTasks.length}</span>
                    </div>

                    <div className="sprint-backlog__panel-body">
                        {sortedBacklogTasks.map(task => (
                            <DraggableTask key={task.id} task={task} renderTask={renderTask} />
                        ))}
                        {sortedBacklogTasks.length === 0 && (
                            <div className="sprint-backlog__empty">
                                <span className="material-symbols-outlined">inbox</span>
                                <span>{t('projectSprints.backlog.empty.title')}</span>
                                <p>{t('projectSprints.backlog.empty.description')}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="sprint-backlog__list">
                    <div className="sprint-backlog__list-header">
                        <h2>{t('projectSprints.sprints.title')}</h2>
                    </div>

                    <div className="sprint-backlog__list-body">
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
                            <div className="sprint-backlog__empty-card">
                                <h3>{t('projectSprints.sprints.empty.title')}</h3>
                                <p>{t('projectSprints.sprints.empty.description')}</p>
                                <Button variant="secondary" onClick={onCreateSprint}>
                                    {t('projectSprints.sprints.empty.action')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DragOverlay>
                {activeDraggable ? (
                    <div className="sprint-backlog__drag-overlay">
                        {renderTask(activeDraggable)}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
