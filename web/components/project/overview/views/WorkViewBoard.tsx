import React from 'react';
import { format } from 'date-fns';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
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

const STATUS_COLS = ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'];
const PRIORITY_COLS = ['Urgent', 'High', 'Medium', 'Low'];

type Column = { key: string; label: string };

const priorityVariant = (priority?: string): 'neutral' | 'warning' | 'error' =>
    priority === 'Urgent' ? 'error' : priority === 'High' ? 'warning' : 'neutral';

const Card: React.FC<{ item: WorkItem; ctx: WorkViewContext; draggable: boolean; overlay?: boolean }> = ({ item, ctx, draggable, overlay }) => {
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
            className={`po-board__task ${isDragging ? 'is-dragging' : ''} ${draggable ? 'is-draggable' : ''}`.trim()}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
            onClick={() => ctx.onItemClick(item)}
            role="button"
            tabIndex={0}
        >
            <span className={`po-board__task-kind po-board__task-kind--${item.kind}`}>
                <span className="material-symbols-outlined">{item.kind === 'initiative' ? 'rocket_launch' : 'task_alt'}</span>
            </span>
            <p className="po-board__task-title">{item.title}</p>
            <div className="po-board__task-meta">
                {item.priority && <Badge variant={priorityVariant(item.priority)}>{ctx.labels.priorityLabels[item.priority] || item.priority}</Badge>}
                {ctx.groupBy !== 'status' && <span>{ctx.labels.statusLabels[item.status] || item.status}</span>}
                {due && <span>{format(due, ctx.dateFormat, { locale: ctx.dateLocale })}</span>}
            </div>
        </div>
    );
};

const Lane: React.FC<{ column: Column; items: WorkItem[]; ctx: WorkViewContext }> = ({ column, items, ctx }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` });
    return (
        <section
            ref={setNodeRef}
            data-status={ctx.groupBy === 'status' ? column.key : undefined}
            className={`po-board__lane ${isOver ? 'is-over' : ''}`.trim()}
            aria-label={column.label}
        >
            <header className="po-board__lane-head">
                <span className="po-board__lane-title">{column.label}</span>
                <span className="po-board__lane-count">{items.length}</span>
            </header>
            <div className="po-board__lane-body">
                {items.length === 0
                    ? <div className="po-board__lane-empty">{ctx.t('tasks.board.empty', 'Nothing here')}</div>
                    : items.map((item) => (
                        <Card key={`${item.kind}-${item.id}`} item={item} ctx={ctx} draggable={ctx.canManageTasks} />
                    ))}
            </div>
        </section>
    );
};

const columnKeyOf = (item: WorkItem, groupBy: WorkViewContext['groupBy']): string => {
    switch (groupBy) {
        case 'priority': return item.priority || 'Medium';
        case 'initiative': return item.kind === 'task' ? (item.initiativeId || '__standalone__') : item.id;
        case 'assignee': return item.assigneeIds[0] || '__unassigned__';
        case 'none': return '__all__';
        case 'status':
        default: return STATUS_COLS.includes(item.status) ? item.status : 'Open';
    }
};

export const WorkViewBoard: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { items, initiatives, labels, groupBy, t } = ctx;
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const columns = React.useMemo<Column[]>(() => {
        switch (groupBy) {
            case 'priority':
                return PRIORITY_COLS.map((p) => ({ key: p, label: labels.priorityLabels[p] || p }));
            case 'initiative':
                return [
                    ...initiatives.map((i) => ({ key: i.id, label: i.title })),
                    { key: '__standalone__', label: t('projectOverview.workspace.board.standalone', 'Standalone') }
                ];
            case 'assignee': {
                const ids = new Set<string>();
                items.forEach((item) => item.assigneeIds.forEach((id) => ids.add(id)));
                return [
                    ...Array.from(ids).map((id) => ({ key: id, label: labels.assigneeLabels[id] || id })),
                    { key: '__unassigned__', label: t('projectOverview.v2.command.unassigned', 'Unassigned') }
                ];
            }
            case 'none':
                return [{ key: '__all__', label: t('projectOverview.v2.group.none', 'All work') }];
            case 'status':
            default:
                return STATUS_COLS.map((s) => ({ key: s, label: labels.statusLabels[s] || s }));
        }
    }, [groupBy, initiatives, items, labels, t]);

    const byColumn = React.useMemo(() => {
        const map: Record<string, WorkItem[]> = {};
        columns.forEach((col) => { map[col.key] = []; });
        items.forEach((item) => {
            const key = columnKeyOf(item, groupBy);
            (map[key] = map[key] || []).push(item);
        });
        return map;
    }, [columns, items, groupBy]);

    const activeItem = React.useMemo(() => {
        if (!activeId) return null;
        const [kind, id] = activeId.split(':');
        return items.find((i) => i.kind === kind && i.id === id) || null;
    }, [activeId, items]);

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const overId = String(over.id);
        if (!overId.startsWith('col:')) return;
        const targetKey = overId.slice(4);
        const [kind, id] = String(active.id).split(':');
        const item = items.find((i) => i.kind === kind && i.id === id);
        if (item && columnKeyOf(item, groupBy) !== targetKey) {
            ctx.onMoveItemToGroup(item, groupBy, targetKey);
        }
    };

    if (items.length === 0) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">view_column</span>
                <p>{t('projectOverview.execution.noActiveTasks', 'No active work')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
            onDragEnd={handleDragEnd}
        >
            <div className="po-board">
                {columns.map((column) => (
                    <Lane key={column.key} column={column} items={byColumn[column.key] || []} ctx={ctx} />
                ))}
            </div>
            <DragOverlay>
                {activeItem ? <Card item={activeItem} ctx={ctx} draggable={false} overlay /> : null}
            </DragOverlay>
        </DndContext>
    );
};
