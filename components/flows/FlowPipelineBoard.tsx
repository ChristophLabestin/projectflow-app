import React, { useState } from 'react';
import { Idea } from '../../types';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FlowCard } from './FlowCard';
import { FlowColumn } from './FlowColumn';
import { createPortal } from 'react-dom';
import { PipelineStageConfig } from './constants';

interface FlowPipelineBoardProps {
    flows: Idea[];
    columns: PipelineStageConfig[];
    onFlowMove: (flowId: string, newStage: Idea['stage']) => void;
    onFlowClick: (flow: Idea) => void;
}

export const FlowPipelineBoard: React.FC<FlowPipelineBoardProps> = ({ flows, columns, onFlowMove, onFlowClick }) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeFlow = flows.find((flow) => flow.id === active.id);
        const overId = over.id as string;

        // Determine target stage
        let newStage = overId as Idea['stage'];

        // If dropped on another item, find that item's stage
        if (!columns.some(c => c.id === overId)) {
            const overFlow = flows.find((flow) => flow.id === overId);
            if (overFlow) {
                newStage = overFlow.stage;
            }
        }

        // Safety check if stage is valid
        if (activeFlow && activeFlow.stage !== newStage && columns.some(c => c.id === newStage)) {
            onFlowMove(active.id as string, newStage);
        }
    };

    const activeFlow = activeId ? flows.find((flow) => flow.id === activeId) : null;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-4 overflow-x-auto pb-2 items-start snap-x snap-mandatory">
                {columns.map((column) => (
                    <div key={column.id} className="snap-start shrink-0 h-full flex flex-col w-80">


                        <FlowColumn
                            column={column}
                            flows={flows.filter((flow) => (flow.stage || columns[0].id) === column.id)}
                            onFlowClick={onFlowClick}
                        />
                    </div>
                ))}
            </div>

            {createPortal(
                <DragOverlay>
                    {activeFlow ? (
                        <div className="transform rotate-3 opacity-95 cursor-grabbing">
                            <FlowCard flow={activeFlow} onClick={() => { }} isOverlay />
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
};
