
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Idea } from '../../types';
import { FlowCard } from './FlowCard';
import { useLanguage } from '../../context/LanguageContext';

interface FlowColumnProps {
    column: { id: string; title: string; color: string; icon: string; bgGradient: string };
    flows: Idea[];
    onFlowClick: (flow: Idea) => void;
}

export const FlowColumn: React.FC<FlowColumnProps> = ({ column, flows, onFlowClick }) => {
    const { t } = useLanguage();
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });
    const flowLabel = flows.length === 1 ? t('flows.labels.flow') : t('flows.labels.flows');

    return (
        <div
            ref={setNodeRef}
            className={`
                flex-shrink-0 w-80 rounded-2xl flex flex-col h-full
                bg-surface-paper border border-surface
                transition-all duration-200
                ${isOver ? 'ring-2 ring-primary/30 scale-[1.01]' : ''}
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
                            <h3 className="font-bold text-sm text-main">{column.title}</h3>
                            <p className="text-[10px] text-muted uppercase tracking-wide">
                                {flows.length} {flowLabel}
                            </p>
                        </div>
                    </div>
                    <span className={`
                        text-xs font-bold px-2.5 py-1 rounded-full
                        ${column.color} text-white
                    `}>
                        {flows.length}
                    </span>
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {flows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="size-12 rounded-full bg-surface-hover flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-[24px] text-subtle">
                                    {column.icon}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-muted">{t('flows.column.empty.title')}</p>
                            <p className="text-xs text-subtle mt-1">{t('flows.column.empty.subtitle')}</p>
                        </div>
                    ) : (
                    <SortableContext items={flows.map(flow => flow.id)} strategy={verticalListSortingStrategy}>
                        {flows.map((flow) => (
                            <FlowCard
                                key={flow.id}
                                flow={flow}
                                onClick={onFlowClick}
                            />
                        ))}
                    </SortableContext>
                )}
            </div>
        </div>
    );
};
