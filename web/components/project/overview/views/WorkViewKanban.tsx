import React from 'react';
import { format } from 'date-fns';
import {
    DndContext,
    DragOverlay,
    DragEndEvent,
    DragStartEvent,
    PointerSensor,
    closestCorners,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { Badge } from '../../../common/Badge/Badge';
import type { WorkViewContext } from './shared/viewTypes';
import type { WorkItem } from './shared/useWorkItems';

const COLUMNS = ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'];

const priorityVariant = (priority?: string): 'neutral' | 'warning' | 'error' =>
    priority === 'Urgent' ? 'error' : priority === 'High' ? 'warning' : 'neutral';

const Card: React.FC<{ item: WorkItem; ctx: WorkViewContext; overlay?: boolean }> = ({ item, ctx, overlay }) => {
    const draggable = item.kind === 'task' && ctx.canManageTasks;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `${item.kind}:${item.id}`,
        disabled: !draggable
    });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    const due = item.dueDate ? new Date(item.dueDate) : null;

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={style}
            data-status={item.status}
            className={`po-kanban__card ${isDragging ? 'is-dragging' : ''} ${draggable ? 'is-draggable' : ''}`.trim()}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
            onClick={() => ctx.onItemClick(item)}
            role="button"
            tabIndex={0}
        >
            <span className={`po-kanban__card-kind po-kanban__card-kind--${item.kind}`}>
                <span className="material-symbols-outlined">{item.kind === 'initiative' ? 'rocket_launch' : 'task_alt'}</span>
                {item.kind === 'initiative'
                    ? ctx.t('projectOverview.workspace.workItem.initiative', 'Initiative')
                    : ctx.t('projectOverview.workspace.workItem.task', 'Task')}
            </span>
            <p className="po-kanban__card-title">{item.title}</p>
            <div className="po-kanban__card-meta">
                {item.priority && <Badge variant={priorityVariant(item.priority)}>{ctx.labels.priorityLabels[item.priority] || item.priority}</Badge>}
                {due && <span className="po-kanban__card-due">{format(due, ctx.dateFormat, { locale: ctx.dateLocale })}</span>}
            </div>
        </div>
    );
};

const Column: React.FC<{ status: string; items: WorkItem[]; ctx: WorkViewContext }> = ({ status, items, ctx }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
    return (
        <section ref={setNodeRef} data-status={status} className={`po-kanban__col ${isOver ? 'is-over' : ''}`.trim()} aria-label={ctx.labels.statusLabels[status] || status}>
            <header className="po-kanban__col-head">
                <span className="po-kanban__col-title">{ctx.labels.statusLabels[status] || status}</span>
                <span className="po-kanban__col-count">{items.length}</span>
            </header>
            <div className="po-kanban__col-body">
                {items.length === 0
                    ? <div className="po-kanban__col-empty">{ctx.t('tasks.board.empty', 'Nothing here')}</div>
                    : items.map((item) => <Card key={`${item.kind}-${item.id}`} item={item} ctx={ctx} />)}
            </div>
        </section>
    );
};

export const WorkViewKanban: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const byStatus = React.useMemo(() => {
        const map: Record<string, WorkItem[]> = {};
        for (const col of COLUMNS) map[col] = [];
        for (const item of ctx.items) {
            const key = COLUMNS.includes(item.status) ? item.status : 'Open';
            map[key].push(item);
        }
        return map;
    }, [ctx.items]);

    const activeItem = React.useMemo(() => {
        if (!activeId) return null;
        const [kind, id] = activeId.split(':');
        return ctx.items.find((i) => i.kind === kind && i.id === id) || null;
    }, [activeId, ctx.items]);

    const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const overId = String(over.id);
        if (!overId.startsWith('col:')) return;
        const status = overId.slice(4);
        const [kind, id] = String(active.id).split(':');
        const item = ctx.items.find((i) => i.kind === kind && i.id === id);
        if (item && item.status !== status) {
            ctx.onUpdateItemStatus(item, status);
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="po-kanban">
                {COLUMNS.map((status) => (
                    <Column key={status} status={status} items={byStatus[status]} ctx={ctx} />
                ))}
            </div>
            <DragOverlay>
                {activeItem ? <Card item={activeItem} ctx={ctx} overlay /> : null}
            </DragOverlay>
        </DndContext>
    );
};
