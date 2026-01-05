import React, { useMemo } from 'react';
import { Idea } from '../../../types';
import { Card } from '../../ui/Card';
import { useLanguage } from '../../../context/LanguageContext';

interface GenericStageViewProps {
    idea: Idea;
    stageId: string;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const GenericStageView: React.FC<GenericStageViewProps> = ({ idea, stageId, onUpdate }) => {
    const { t } = useLanguage();

    const stageLabels = useMemo(() => ({
        Brainstorm: t('flows.stage.brainstorm'),
        Refining: t('flows.stage.refining'),
        Concept: t('flows.stage.concept'),
        Review: t('flows.stage.inReview'),
        Approved: t('flows.stage.approved'),
        Discovery: t('flows.stage.discovery'),
        Definition: t('flows.stage.definition'),
        Development: t('flows.stage.development'),
        Launch: t('flows.stage.launch'),
        Strategy: t('flows.stage.strategy'),
        Planning: t('flows.stage.planning'),
        Execution: t('flows.stage.execution'),
        Analysis: t('flows.stage.analysis'),
        CreativeLab: t('flows.stage.creativeLab'),
        Studio: t('flows.stage.studio'),
        Distribution: t('flows.stage.distribution'),
        Submit: t('flows.stage.submit'),
        Rejected: t('flows.stage.rejected'),
        Feasibility: t('flows.stage.feasibility'),
        Prototype: t('flows.stage.prototype'),
        Greenlight: t('flows.stage.greenlight'),
        Proposal: t('flows.stage.proposal'),
        Benchmark: t('flows.stage.benchmark'),
        Implementation: t('flows.stage.implementation'),
        Implemented: t('flows.stage.implemented'),
        Archived: t('flows.stage.archived'),
    }), [t]);

    const typeLabels = useMemo(() => ({
        Feature: t('flows.type.feature'),
        Product: t('flows.type.product'),
        Marketing: t('flows.type.marketing'),
        Social: t('flows.type.social'),
        Moonshot: t('flows.type.moonshot'),
        Optimization: t('flows.type.optimization'),
        SocialCampaign: t('flows.type.socialCampaign'),
    }), [t]);

    const stageLabel = stageLabels[stageId as keyof typeof stageLabels] || stageId;
    const typeLabel = typeLabels[idea.type as keyof typeof typeLabels] || idea.type;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                <div className="size-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-slate-400">construction</span>
                </div>
                <h3 className="text-lg font-bold text-main mb-2">
                    {t('flowStages.generic.title').replace('{stage}', stageLabel)}
                </h3>
                <p className="text-muted max-w-md mx-auto">
                    {t('flowStages.generic.subtitle').replace('{type}', typeLabel)}
                </p>
            </div>

            <Card className="p-6">
                <h4 className="font-bold text-main mb-4">{t('flowStages.generic.notesTitle')}</h4>
                <textarea
                    className="w-full h-32 bg-surface border border-surface rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                    placeholder={t('flowStages.generic.placeholder').replace('{stage}', stageLabel)}
                    defaultValue={idea.description}
                    onBlur={(e) => onUpdate({ description: e.target.value })}
                />
            </Card>
        </div>
    );
};
