
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Idea } from '../../types';
import { IdeaCard } from './IdeaCard';

interface IdeaColumnProps {
    column: { id: string; title: string; color: string; icon: string; bgGradient: string };
    ideas: Idea[];
    onIdeaClick: (idea: Idea) => void;
}

export const IdeaColumn: React.FC<IdeaColumnProps> = ({ column, ideas, onIdeaClick }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                flex-shrink-0 w-80 rounded-2xl flex flex-col h-full
                bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)]
                transition-all duration-200
                ${isOver ? 'ring-2 ring-[var(--color-primary)]/30 scale-[1.01]' : ''}
            `}
        >
            {/* Column Header */}
            <div className={`p-4 rounded-t-2xl ${column.bgGradient}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`size-8 rounded-lg ${column.color} flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-[18px] text-white">{column.icon}</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-[var(--color-text-main)]">{column.title}</h3>
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                                {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}
                            </p>
                        </div>
                    </div>
                    <span className={`
                        text-xs font-bold px-2.5 py-1 rounded-full
                        ${column.color} text-white
                    `}>
                        {ideas.length}
                    </span>
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {ideas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="size-12 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-[24px] text-[var(--color-text-subtle)]">
                                {column.icon}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-[var(--color-text-muted)]">No ideas yet</p>
                        <p className="text-xs text-[var(--color-text-subtle)] mt-1">Drag ideas here or create new ones</p>
                    </div>
                ) : (
                    <SortableContext items={ideas.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        {ideas.map((idea) => (
                            <IdeaCard
                                key={idea.id}
                                idea={idea}
                                onClick={onIdeaClick}
                            />
                        ))}
                    </SortableContext>
                )}
            </div>
        </div>
    );
};
