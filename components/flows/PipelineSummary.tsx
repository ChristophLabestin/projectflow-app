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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {stageConfigs.map((config) => {
                const count = stats.byStage[config.id] || 0;
                // Parse the bgGradient to get a border or subtle bg
                // For this summary, we want a clean card look.
                // Extract base color from the config.color (e.g., 'bg-slate-500' -> 'slate')
                const colorMatch = config.color.match(/bg-(\w+)-/);
                const colorName = colorMatch ? colorMatch[1] : 'slate';

                // Construct dynamic classes safely
                // Note: we assume Tailwind safelist or JIT. If specific classes are used in constants.ts they are safe.

                return (
                    <div
                        key={config.id}
                        className={`
                            relative overflow-hidden rounded-xl border border-surface
                            bg-surface-paper hover:border-[var(--color-surface-border-hover)]
                            transition-all duration-200 group
                        `}
                    >
                        <div className={`absolute top-0 left-0 w-1 h-full ${config.color}`} />

                        <div className="p-3 pl-4 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-0.5">
                                    {config.title}
                                </span>
                                <span className="text-2xl font-bold text-main">
                                    {count}
                                </span>
                            </div>

                            <div className={`
                                size-8 rounded-lg flex items-center justify-center
                                bg-${colorName}-50 text-${colorName}-600
                                dark:bg-${colorName}-900/20 dark:text-${colorName}-400
                            `}>
                                <span className="material-symbols-outlined text-[18px]">{config.icon}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
