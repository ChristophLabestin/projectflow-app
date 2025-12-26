import React from 'react';
import { Idea } from '../../../types';
import { Card } from '../../ui/Card';

interface GenericStageViewProps {
    idea: Idea;
    stageId: string;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const GenericStageView: React.FC<GenericStageViewProps> = ({ idea, stageId, onUpdate }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                <div className="size-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-slate-400">construction</span>
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">
                    {stageId} View
                </h3>
                <p className="text-[var(--color-text-muted)] max-w-md mx-auto">
                    This stage view for <strong>{idea.type}</strong> ideas is currently under construction.
                </p>
            </div>

            <Card className="p-6">
                <h4 className="font-bold text-[var(--color-text-main)] mb-4">Stage Notes</h4>
                <textarea
                    className="w-full h-32 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl p-4 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all resize-none"
                    placeholder={`Add notes for ${stageId}...`}
                    defaultValue={idea.description}
                    onBlur={(e) => onUpdate({ description: e.target.value })}
                />
            </Card>
        </div>
    );
};
