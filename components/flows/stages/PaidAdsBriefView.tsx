import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextInput } from '../../common/Input/TextInput';
import { TextArea } from '../../common/Input/TextArea';
import { Select } from '../../common/Select/Select';
import { suggestObjective, rewriteText } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsBriefViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const OBJECTIVES = [
    { id: 'Traffic', labelKey: 'flowStages.paidAdsBrief.objectives.traffic.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.traffic.description', icon: 'link' },
    { id: 'Leads', labelKey: 'flowStages.paidAdsBrief.objectives.leads.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.leads.description', icon: 'person_add' },
    { id: 'Sales', labelKey: 'flowStages.paidAdsBrief.objectives.sales.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.sales.description', icon: 'shopping_cart' },
    { id: 'Brand Awareness', labelKey: 'flowStages.paidAdsBrief.objectives.brandAwareness.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.brandAwareness.description', icon: 'visibility' },
    { id: 'Engagement', labelKey: 'flowStages.paidAdsBrief.objectives.engagement.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.engagement.description', icon: 'favorite' },
    { id: 'Video Views', labelKey: 'flowStages.paidAdsBrief.objectives.videoViews.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.videoViews.description', icon: 'play_circle' },
    { id: 'App Installs', labelKey: 'flowStages.paidAdsBrief.objectives.appInstalls.title', descriptionKey: 'flowStages.paidAdsBrief.objectives.appInstalls.description', icon: 'download' },
];

const FUNNEL_STAGES = [
    { id: 'Awareness', labelKey: 'flowStages.paidAdsBrief.funnel.awareness' },
    { id: 'Consideration', labelKey: 'flowStages.paidAdsBrief.funnel.consideration' },
    { id: 'Conversion', labelKey: 'flowStages.paidAdsBrief.funnel.conversion' },
    { id: 'Retention', labelKey: 'flowStages.paidAdsBrief.funnel.retention' },
];

export const PaidAdsBriefView: React.FC<PaidAdsBriefViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData, updateAdData, updateBudget } = usePaidAdsData(idea, onUpdate);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);

    const handleSuggestObjective = async () => {
        setIsSuggesting(true);
        try {
            const suggestion = await suggestObjective(idea.title, idea.description || adData.missionStatement || '');
            if (suggestion) {
                updateAdData({ objective: suggestion });
            }
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleRewriteAudience = async () => {
        if (!adData.missionStatement) return;
        setIsRewriting(true);
        try {
            const rewritten = await rewriteText(adData.missionStatement, 'Professional');
            updateAdData({ missionStatement: rewritten });
        } finally {
            setIsRewriting(false);
        }
    };

    const missionOffer = adData.offer || t('flowStages.paidAdsBrief.mission.offerFallback');
    const missionAudience = adData.missionStatement || t('flowStages.paidAdsBrief.mission.audienceFallback');
    const missionBudget = adData.budget?.amount ? `$${adData.budget.amount}` : t('flowStages.paidAdsBrief.mission.budgetFallback');
    const objectiveLabelKey = OBJECTIVES.find(obj => obj.id === adData.objective)?.labelKey;
    const missionObjective = objectiveLabelKey
        ? t(objectiveLabelKey)
        : (adData.objective || t('flowStages.paidAdsBrief.mission.objectiveFallback'));

    return (
        <div className="flow-paid-ads-brief">
            <div className="flow-paid-ads-brief__container">
                <Card className="flow-paid-ads-brief__hero">
                    <div className="flow-paid-ads-brief__hero-content">
                        <div className="flow-paid-ads-brief__badge">
                            {t('flowStages.paidAdsBrief.hero.badge')}
                        </div>
                        <h1 className="flow-paid-ads-brief__title">
                            {t('flowStages.paidAdsBrief.hero.title')}
                        </h1>
                        <div className="flow-paid-ads-brief__mission">
                            <p className="flow-paid-ads-brief__mission-text">
                                {t('flowStages.paidAdsBrief.mission.prefix')}{' '}
                                <span className="flow-paid-ads-brief__mission-highlight">
                                    {t('flowStages.paidAdsBrief.mission.campaignType')}
                                </span>{' '}
                                {t('flowStages.paidAdsBrief.mission.promoting')}{' '}
                                <span className="flow-paid-ads-brief__mission-highlight">
                                    {missionOffer}
                                </span>{' '}
                                {t('flowStages.paidAdsBrief.mission.targeting')}{' '}
                                <span className="flow-paid-ads-brief__mission-highlight">
                                    {missionAudience}
                                </span>{' '}
                                {t('flowStages.paidAdsBrief.mission.withBudget')}{' '}
                                <span className="flow-paid-ads-brief__mission-highlight">
                                    {missionBudget}
                                </span>{' '}
                                {t('flowStages.paidAdsBrief.mission.toDrive')}{' '}
                                <span className="flow-paid-ads-brief__mission-highlight">
                                    {missionObjective}
                                </span>.
                            </p>
                        </div>
                    </div>
                    <div className="flow-paid-ads-brief__hero-icon">
                        <span className="material-symbols-outlined">campaign</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-brief__grid">
                    <div className="flow-paid-ads-brief__main">
                        <div className="flow-paid-ads-brief__section-heading">
                            <span className="flow-paid-ads-brief__section-line" />
                            <span className="flow-paid-ads-brief__section-label">
                                {t('flowStages.paidAdsBrief.sections.strategyCore')}
                            </span>
                            <span className="flow-paid-ads-brief__section-line" />
                        </div>

                        <Card className="flow-paid-ads-brief__panel">
                            <div className="flow-paid-ads-brief__panel-header">
                                <h3>{t('flowStages.paidAdsBrief.sections.primaryObjective')}</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flow-paid-ads-brief__suggest"
                                    onClick={handleSuggestObjective}
                                    isLoading={isSuggesting}
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {isSuggesting
                                        ? t('flowStages.paidAdsBrief.actions.analyzing')
                                        : t('flowStages.paidAdsBrief.actions.suggest')}
                                </Button>
                            </div>
                            <div className="flow-paid-ads-brief__objective-grid">
                                {OBJECTIVES.map((obj) => {
                                    const isActive = adData.objective === obj.id;
                                    return (
                                        <button
                                            key={obj.id}
                                            type="button"
                                            onClick={() => updateAdData({ objective: obj.id })}
                                            className={`flow-paid-ads-brief__objective ${isActive ? 'is-active' : ''}`}
                                        >
                                            <div className="flow-paid-ads-brief__objective-icon">
                                                <span className="material-symbols-outlined">{obj.icon}</span>
                                            </div>
                                            <span className="flow-paid-ads-brief__objective-title">{t(obj.labelKey)}</span>
                                            <span className="flow-paid-ads-brief__objective-description">{t(obj.descriptionKey)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-brief__panel">
                            <h3 className="flow-paid-ads-brief__panel-title">
                                {t('flowStages.paidAdsBrief.sections.targeting')}
                            </h3>
                            <div className="flow-paid-ads-brief__panel-body">
                                <div className="flow-paid-ads-brief__field">
                                    <div className="flow-paid-ads-brief__field-header">
                                        <span className="flow-paid-ads-brief__field-label">
                                            {t('flowStages.paidAdsBrief.fields.audience.label')}
                                        </span>
                                        {adData.missionStatement && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flow-paid-ads-brief__rewrite"
                                                onClick={handleRewriteAudience}
                                                isLoading={isRewriting}
                                                icon={<span className="material-symbols-outlined">magic_button</span>}
                                            >
                                                {isRewriting
                                                    ? t('flowStages.paidAdsBrief.actions.rewriting')
                                                    : t('flowStages.paidAdsBrief.actions.rewrite')}
                                            </Button>
                                        )}
                                    </div>
                                    <TextArea
                                        value={adData.missionStatement || ''}
                                        onChange={(e) => updateAdData({ missionStatement: e.target.value })}
                                        placeholder={t('flowStages.paidAdsBrief.fields.audience.placeholder')}
                                        aria-label={t('flowStages.paidAdsBrief.fields.audience.label')}
                                        className="flow-paid-ads-brief__control flow-paid-ads-brief__control--textarea"
                                    />
                                </div>
                                <div className="flow-paid-ads-brief__field-grid">
                                    <TextInput
                                        label={t('flowStages.paidAdsBrief.fields.kpi.label')}
                                        value={adData.targetKPIs || ''}
                                        onChange={(e) => updateAdData({ targetKPIs: e.target.value })}
                                        placeholder={t('flowStages.paidAdsBrief.fields.kpi.placeholder')}
                                        className="flow-paid-ads-brief__control"
                                    />
                                    <TextInput
                                        label={t('flowStages.paidAdsBrief.fields.competitors.label')}
                                        value={adData.competitors || ''}
                                        onChange={(e) => updateAdData({ competitors: e.target.value })}
                                        placeholder={t('flowStages.paidAdsBrief.fields.competitors.placeholder')}
                                        className="flow-paid-ads-brief__control"
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-brief__panel">
                            <h3 className="flow-paid-ads-brief__panel-title">
                                {t('flowStages.paidAdsBrief.sections.offer')}
                            </h3>
                            <div className="flow-paid-ads-brief__panel-body">
                                <div className="flow-paid-ads-brief__field-grid">
                                    <TextInput
                                        label={t('flowStages.paidAdsBrief.fields.offer.label')}
                                        value={adData.offer || ''}
                                        onChange={(e) => updateAdData({ offer: e.target.value })}
                                        placeholder={t('flowStages.paidAdsBrief.fields.offer.placeholder')}
                                        className="flow-paid-ads-brief__control"
                                    />
                                    <Select
                                        label={t('flowStages.paidAdsBrief.fields.funnel.label')}
                                        value={adData.funnelStage || 'Awareness'}
                                        onChange={(value) => updateAdData({ funnelStage: value as any })}
                                        options={FUNNEL_STAGES.map(stage => ({
                                            value: stage.id,
                                            label: t(stage.labelKey)
                                        }))}
                                        placeholder={t('flowStages.paidAdsBrief.fields.funnel.placeholder')}
                                        className="flow-paid-ads-brief__control"
                                    />
                                </div>
                                <div className="flow-paid-ads-brief__field-grid">
                                    <TextInput
                                        label={t('flowStages.paidAdsBrief.fields.landing.label')}
                                        value={adData.landingPage || ''}
                                        onChange={(e) => updateAdData({ landingPage: e.target.value })}
                                        placeholder={t('flowStages.paidAdsBrief.fields.landing.placeholder')}
                                        className="flow-paid-ads-brief__control"
                                    />
                                    <TextInput
                                        label={t('flowStages.paidAdsBrief.fields.conversion.label')}
                                        value={adData.conversionEvent || ''}
                                        onChange={(e) => updateAdData({ conversionEvent: e.target.value })}
                                        placeholder={t('flowStages.paidAdsBrief.fields.conversion.placeholder')}
                                        className="flow-paid-ads-brief__control"
                                    />
                                </div>
                                <TextArea
                                    label={t('flowStages.paidAdsBrief.fields.guardrails.label')}
                                    value={adData.brandGuardrails || ''}
                                    onChange={(e) => updateAdData({ brandGuardrails: e.target.value })}
                                    placeholder={t('flowStages.paidAdsBrief.fields.guardrails.placeholder')}
                                    className="flow-paid-ads-brief__control flow-paid-ads-brief__control--textarea"
                                />
                            </div>
                        </Card>
                    </div>

                    <div className="flow-paid-ads-brief__aside">
                        <div className="flow-paid-ads-brief__section-heading">
                            <span className="flow-paid-ads-brief__section-line" />
                            <span className="flow-paid-ads-brief__section-label">
                                {t('flowStages.paidAdsBrief.sections.parameters')}
                            </span>
                            <span className="flow-paid-ads-brief__section-line" />
                        </div>

                        <Card className="flow-paid-ads-brief__summary">
                            <div className="flow-paid-ads-brief__summary-content">
                                <TextInput
                                    label={t('flowStages.paidAdsBrief.fields.budget.label')}
                                    type="number"
                                    value={adData.budget?.amount || ''}
                                    onChange={(e) => updateBudget({ amount: Number(e.target.value) })}
                                    placeholder={t('flowStages.paidAdsBrief.fields.budget.placeholder')}
                                    leftElement={<span className="material-symbols-outlined">attach_money</span>}
                                    className="flow-paid-ads-brief__summary-input"
                                />
                                <TextInput
                                    label={t('flowStages.paidAdsBrief.fields.timeline.label')}
                                    value={adData.duration || ''}
                                    onChange={(e) => updateAdData({ duration: e.target.value })}
                                    placeholder={t('flowStages.paidAdsBrief.fields.timeline.placeholder')}
                                    leftElement={<span className="material-symbols-outlined">calendar_month</span>}
                                    className="flow-paid-ads-brief__summary-input"
                                />
                            </div>

                            <Button
                                className="flow-paid-ads-brief__next"
                                onClick={() => onUpdate({ stage: 'Research' })}
                                icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                iconPosition="right"
                            >
                                <span className="flow-paid-ads-brief__next-text">
                                    <span className="flow-paid-ads-brief__next-label">
                                        {t('flowStages.paidAdsBrief.actions.nextStep')}
                                    </span>
                                    <span className="flow-paid-ads-brief__next-stage">
                                        {t('flowStages.paidAdsBrief.actions.research')}
                                    </span>
                                </span>
                            </Button>
                        </Card>

                        <Card className="flow-paid-ads-brief__tip">
                            <div className="flow-paid-ads-brief__tip-icon">
                                <span className="material-symbols-outlined">tips_and_updates</span>
                            </div>
                            <div>
                                <h4 className="flow-paid-ads-brief__tip-title">
                                    {t('flowStages.paidAdsBrief.tip.title')}
                                </h4>
                                <p className="flow-paid-ads-brief__tip-text">
                                    {t('flowStages.paidAdsBrief.tip.body')}
                                </p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
