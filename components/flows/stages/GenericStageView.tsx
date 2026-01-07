import React, { useMemo } from 'react';
import { Idea } from '../../../types';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
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
        <div className="flow-stage flow-stage--generic animate-fade-in">
            <div className="flow-stage__hero">
                <div className="flow-stage__hero-icon">
                    <span className="material-symbols-outlined">construction</span>
                </div>
                <h3 className="flow-stage__hero-title">
                    {t('flowStages.generic.title').replace('{stage}', stageLabel)}
                </h3>
                <p className="flow-stage__hero-subtitle">
                    {t('flowStages.generic.subtitle').replace('{type}', typeLabel)}
                </p>
            </div>

            <Card className="flow-stage__card">
                <h4 className="flow-stage__card-title">{t('flowStages.generic.notesTitle')}</h4>
                <TextArea
                    className="flow-stage__textarea-group"
                    placeholder={t('flowStages.generic.placeholder').replace('{stage}', stageLabel)}
                    defaultValue={idea.description}
                    onBlur={(e) => onUpdate({ description: e.target.value })}
                />
            </Card>
        </div>
    );
};
