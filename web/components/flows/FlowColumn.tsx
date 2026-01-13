
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Idea } from '../../types';
import { FlowCard } from './FlowCard';
import { useLanguage } from '../../context/LanguageContext';
import { PipelineStageConfig } from './constants';

interface FlowColumnProps {
    column: PipelineStageConfig;
    flows: Idea[];
    onFlowClick: (flow: Idea) => void;
}

export const FlowColumn: React.FC<FlowColumnProps> = ({ column, flows, onFlowClick }) => {
    const { t } = useLanguage();
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });
    const flowLabel = flows.length === 1 ? t('flows.labels.flow') : t('flows.labels.flows');
    const tone = column.tone || 'primary';

    return (
        <div
            ref={setNodeRef}
            className={`flow-column flow-tone--${tone} ${isOver ? 'is-over' : ''}`}
        >
            {/* Column Header */}
            <div className="flow-column__header">
                <div className="flow-column__header-main">
                    <div className="flow-column__icon">
                        <span className="material-symbols-outlined">{column.icon}</span>
                    </div>
                    <div>
                        <h3 className="flow-column__title">{column.title}</h3>
                        <p className="flow-column__subtitle">
                            {flows.length} {flowLabel}
                        </p>
                    </div>
                </div>
                <span className="flow-column__count">{flows.length}</span>
            </div>

            {/* Cards Container */}
            <div className="flow-column__body">
                {flows.length === 0 ? (
                    <div className="flow-column__empty">
                        <div className="flow-column__empty-icon">
                            <span className="material-symbols-outlined">{column.icon}</span>
                        </div>
                        <p className="flow-column__empty-title">{t('flows.column.empty.title')}</p>
                        <p className="flow-column__empty-subtitle">{t('flows.column.empty.subtitle')}</p>
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
