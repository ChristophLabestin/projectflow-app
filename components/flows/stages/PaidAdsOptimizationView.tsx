import React, { useMemo, useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { Select } from '../../common/Select/Select';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsOptimizationViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const REPORTING_OPTIONS = [
    { value: 'Weekly', labelKey: 'flowStages.paidAdsOptimization.reporting.weekly' },
    { value: 'Bi-weekly', labelKey: 'flowStages.paidAdsOptimization.reporting.biWeekly' },
    { value: 'Monthly', labelKey: 'flowStages.paidAdsOptimization.reporting.monthly' },
];

export const PaidAdsOptimizationView: React.FC<PaidAdsOptimizationViewProps> = ({ idea, onUpdate }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const { adData, updateAdData } = usePaidAdsData(idea, onUpdate);
    const optimization = adData.optimization || {};
    const [hypothesisInput, setHypothesisInput] = useState('');

    const reportingOptions = useMemo(
        () => REPORTING_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
        [t]
    );

    const selectedReporting = REPORTING_OPTIONS.some((option) => option.value === optimization.reportingCadence)
        ? (optimization.reportingCadence as string)
        : REPORTING_OPTIONS[0].value;

    const addHypothesis = () => {
        if (!hypothesisInput.trim()) return;
        const current = optimization.hypotheses || [];
        updateAdData({ optimization: { hypotheses: [...current, hypothesisInput.trim()] } });
        setHypothesisInput('');
    };

    const removeHypothesis = (index: number) => {
        const current = optimization.hypotheses || [];
        updateAdData({ optimization: { hypotheses: current.filter((_, i) => i !== index) } });
    };

    return (
        <div className="flow-paid-ads-optimization">
            <div className="flow-paid-ads-optimization__container">
                <Card className="flow-paid-ads-optimization__hero">
                    <div className="flow-paid-ads-optimization__hero-content">
                        <span className="flow-paid-ads-optimization__badge">
                            {t('flowStages.paidAdsOptimization.hero.badge')}
                        </span>
                        <h1 className="flow-paid-ads-optimization__title">
                            {t('flowStages.paidAdsOptimization.hero.title')}
                        </h1>
                    </div>
                    <div className="flow-paid-ads-optimization__hero-icon">
                        <span className="material-symbols-outlined">auto_graph</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-optimization__grid">
                    <div className="flow-paid-ads-optimization__main">
                        <Card className="flow-paid-ads-optimization__panel">
                            <h3 className="flow-paid-ads-optimization__panel-title">
                                {t('flowStages.paidAdsOptimization.sections.backlog')}
                            </h3>
                            <div className="flow-paid-ads-optimization__input-row">
                                <TextInput
                                    value={hypothesisInput}
                                    onChange={(event) => setHypothesisInput(event.target.value)}
                                    onKeyDown={(event) => event.key === 'Enter' && addHypothesis()}
                                    placeholder={t('flowStages.paidAdsOptimization.placeholders.hypothesisInput')}
                                    aria-label={t('flowStages.paidAdsOptimization.fields.hypothesisInput')}
                                    className="flow-paid-ads-optimization__control"
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={addHypothesis}
                                    className="flow-paid-ads-optimization__add"
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('common.add')}
                                </Button>
                            </div>
                            <div className="flow-paid-ads-optimization__list">
                                {(optimization.hypotheses || []).length === 0 ? (
                                    <span className="flow-paid-ads-optimization__empty">
                                        {t('flowStages.paidAdsOptimization.empty')}
                                    </span>
                                ) : (
                                    (optimization.hypotheses || []).map((item, index) => (
                                        <div key={index} className="flow-paid-ads-optimization__item">
                                            <span>{item}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeHypothesis(index)}
                                                className="flow-paid-ads-optimization__remove"
                                                aria-label={t('common.delete')}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-optimization__panel">
                            <h3 className="flow-paid-ads-optimization__panel-title">
                                {t('flowStages.paidAdsOptimization.sections.learnings')}
                            </h3>
                            <TextArea
                                value={optimization.learnings || ''}
                                onChange={(event) => updateAdData({ optimization: { learnings: event.target.value } })}
                                placeholder={t('flowStages.paidAdsOptimization.placeholders.learnings')}
                                className="flow-paid-ads-optimization__control flow-paid-ads-optimization__control--tall"
                            />
                        </Card>
                    </div>

                    <div className="flow-paid-ads-optimization__aside">
                        <Card className="flow-paid-ads-optimization__panel">
                            <h3 className="flow-paid-ads-optimization__panel-title">
                                {t('flowStages.paidAdsOptimization.sections.scalingPlan')}
                            </h3>
                            <TextArea
                                value={optimization.scalingPlan || ''}
                                onChange={(event) => updateAdData({ optimization: { scalingPlan: event.target.value } })}
                                placeholder={t('flowStages.paidAdsOptimization.placeholders.scalingPlan')}
                                className="flow-paid-ads-optimization__control"
                            />
                        </Card>

                        <Card className="flow-paid-ads-optimization__panel">
                            <h3 className="flow-paid-ads-optimization__panel-title">
                                {t('flowStages.paidAdsOptimization.sections.reporting')}
                            </h3>
                            <div className="flow-paid-ads-optimization__field-stack">
                                <Select
                                    label={t('flowStages.paidAdsOptimization.fields.reportingCadence')}
                                    value={selectedReporting}
                                    onChange={(value) => updateAdData({ optimization: { reportingCadence: value as string } })}
                                    options={reportingOptions}
                                    className="flow-paid-ads-optimization__control"
                                />
                                <TextInput
                                    label={t('flowStages.paidAdsOptimization.fields.guardrails')}
                                    value={optimization.guardrails || ''}
                                    onChange={(event) => updateAdData({ optimization: { guardrails: event.target.value } })}
                                    placeholder={t('flowStages.paidAdsOptimization.placeholders.guardrails')}
                                    className="flow-paid-ads-optimization__control"
                                />
                            </div>
                        </Card>

                        {idea.convertedCampaignId && projectId && (
                            <Link
                                to={`/project/${projectId}/marketing/ads/${idea.convertedCampaignId}`}
                                className="flow-paid-ads-optimization__dashboard-link"
                            >
                                <span>{t('flowStages.paidAdsOptimization.actions.openDashboard')}</span>
                                <span className="material-symbols-outlined">analytics</span>
                            </Link>
                        )}

                        <Button
                            variant="ghost"
                            className="flow-paid-ads-optimization__back"
                            onClick={() => onUpdate({ stage: 'Live' })}
                        >
                            {t('flowStages.paidAdsOptimization.actions.backToLaunch')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
