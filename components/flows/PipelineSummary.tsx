import React from 'react';
import { PipelineStageConfig } from './constants';

interface PipelineSummaryProps {
    stats: {
        total: number;
        byStage: Record<string, number>;
    };
    stageConfigs: PipelineStageConfig[];
    pipelineName: string;
}

export const PipelineSummary: React.FC<PipelineSummaryProps> = ({ stats, stageConfigs, pipelineName }) => {
    return (
        <div className="flow-summary">
            {stageConfigs.map((config) => {
                const count = stats.byStage[config.id] || 0;
                const tone = config.tone || 'primary';

                return (
                    <div key={config.id} className={`flow-summary__card flow-tone--${tone}`}>
                        <div className="flow-summary__accent" />
                        <div className="flow-summary__content">
                            <span className="flow-summary__label">{config.title}</span>
                            <span className="flow-summary__count">{count}</span>
                        </div>
                        <div className="flow-summary__icon">
                            <span className="material-symbols-outlined">{config.icon}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
