import React, { useState } from 'react';
import { Idea } from '../../types';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { IdeaCard } from './IdeaCard';
import { IdeaColumn } from './IdeaColumn';
import { createPortal } from 'react-dom';
import { PipelineStageConfig } from './constants';

interface IdeaPipelineBoardProps {
    ideas: Idea[];
    columns: PipelineStageConfig[];
    onIdeaMove: (ideaId: string, newStage: Idea['stage']) => void;
    onIdeaClick: (idea: Idea) => void;
}

export const IdeaPipelineBoard: React.FC<IdeaPipelineBoardProps> = ({ ideas, columns, onIdeaMove, onIdeaClick }) => {
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

        const activeIdea = ideas.find((i) => i.id === active.id);
        const overId = over.id as string;

        // Determine target stage
        let newStage = overId as Idea['stage'];

        // If dropped on another item, find that item's stage
        if (!columns.some(c => c.id === overId)) {
            const overIdea = ideas.find((i) => i.id === overId);
            if (overIdea) {
                newStage = overIdea.stage;
            }
        }

        // Safety check if stage is valid
        if (activeIdea && activeIdea.stage !== newStage && columns.some(c => c.id === newStage)) {
            onIdeaMove(active.id as string, newStage);
        }
    };

    const activeIdea = activeId ? ideas.find((i) => i.id === activeId) : null;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-4 overflow-x-auto pb-2 items-start snap-x snap-mandatory">
                {columns.map((column) => (
                    <div key={column.id} className="snap-start shrink-0 h-full">
                        <IdeaColumn
                            column={column}
                            ideas={ideas.filter((i) => (i.stage || columns[0].id) === column.id)}
                            onIdeaClick={onIdeaClick}
                        />
                    </div>
                ))}
            </div>

            {createPortal(
                <DragOverlay>
                    {activeIdea ? (
                        <div className="transform rotate-3 opacity-95 cursor-grabbing">
                            <IdeaCard idea={activeIdea} onClick={() => { }} isOverlay />
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
};
