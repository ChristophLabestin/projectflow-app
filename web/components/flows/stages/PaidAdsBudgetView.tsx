import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextInput } from '../../common/Input/TextInput';
import { generateBudgetRecommendation } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsBudgetViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const BID_STRATEGIES = [
    { id: 'Lowest Cost', labelKey: 'flowStages.paidAdsBudget.strategies.lowestCost.title', descriptionKey: 'flowStages.paidAdsBudget.strategies.lowestCost.description', icon: 'savings' },
    { id: 'Cost Cap', labelKey: 'flowStages.paidAdsBudget.strategies.costCap.title', descriptionKey: 'flowStages.paidAdsBudget.strategies.costCap.description', icon: 'price_check' },
    { id: 'Bid Cap', labelKey: 'flowStages.paidAdsBudget.strategies.bidCap.title', descriptionKey: 'flowStages.paidAdsBudget.strategies.bidCap.description', icon: 'gavel' },
    { id: 'Target ROAS', labelKey: 'flowStages.paidAdsBudget.strategies.targetRoas.title', descriptionKey: 'flowStages.paidAdsBudget.strategies.targetRoas.description', icon: 'trending_up' },
];

export const PaidAdsBudgetView: React.FC<PaidAdsBudgetViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData, updateBudget } = usePaidAdsData(idea, onUpdate);
    const [isAnalysing, setIsAnalysing] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState<{ recommendedBudget: number; rationale: string } | null>(null);

    const budget = adData.budget || {
        amount: 0,
        type: 'Daily',
        currency: 'USD',
        bidStrategy: 'Lowest Cost'
    };

    const budgetTypeLabel = budget.type === 'Lifetime'
        ? t('flowStages.paidAdsBudget.types.lifetime')
        : t('flowStages.paidAdsBudget.types.daily');

    const handleGetRecommendation = async () => {
        setIsAnalysing(true);
        try {
            const objective = (adData.objective || 'General').toString();
            const result = await generateBudgetRecommendation(objective, 'Broad');
            setAiRecommendation(result);
            if (result.recommendedBudget) {
                updateBudget({ amount: result.recommendedBudget });
            }
        } finally {
            setIsAnalysing(false);
        }
    };

    const durationLabel = budget.startDate && budget.endDate
        ? t('flowStages.paidAdsBudget.labels.duration').replace('{count}', `${Math.ceil((new Date(budget.endDate).getTime() - new Date(budget.startDate).getTime()) / (1000 * 60 * 60 * 24))}`)
        : t('flowStages.paidAdsBudget.labels.durationTbd');

    return (
        <div className="flow-paid-ads-budget">
            <div className="flow-paid-ads-budget__container">
                <Card className="flow-paid-ads-budget__hero">
                    <div className="flow-paid-ads-budget__hero-content">
                        <div className="flow-paid-ads-budget__badge">
                            {t('flowStages.paidAdsBudget.hero.badge')}
                        </div>
                        <h1 className="flow-paid-ads-budget__title">
                            {t('flowStages.paidAdsBudget.hero.title')}
                        </h1>
                    </div>
                    <div className="flow-paid-ads-budget__hero-icon">
                        <span className="material-symbols-outlined">payments</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-budget__grid">
                    <div className="flow-paid-ads-budget__main">
                        <Card className="flow-paid-ads-budget__panel">
                            <h3 className="flow-paid-ads-budget__panel-title">
                                {t('flowStages.paidAdsBudget.sections.allocation')}
                            </h3>

                            <div className="flow-paid-ads-budget__row">
                                <div className="flow-paid-ads-budget__field">
                                    <span className="flow-paid-ads-budget__label">
                                        {t('flowStages.paidAdsBudget.labels.budgetType')}
                                    </span>
                                    <div className="flow-paid-ads-budget__segmented">
                                        {['Daily', 'Lifetime'].map((type) => {
                                            const isActive = budget.type === type;
                                            return (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => updateBudget({ type: type as 'Daily' | 'Lifetime' })}
                                                    className={`flow-paid-ads-budget__segment ${isActive ? 'is-active' : ''}`}
                                                    aria-pressed={isActive}
                                                >
                                                    {type === 'Daily'
                                                        ? t('flowStages.paidAdsBudget.types.daily')
                                                        : t('flowStages.paidAdsBudget.types.lifetime')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flow-paid-ads-budget__field">
                                    <div className="flow-paid-ads-budget__field-header">
                                        <span className="flow-paid-ads-budget__label">
                                            {t('flowStages.paidAdsBudget.labels.amount')}
                                        </span>
                                        {aiRecommendation && (
                                            <span className="flow-paid-ads-budget__hint">
                                                {t('flowStages.paidAdsBudget.labels.recommended')}
                                            </span>
                                        )}
                                    </div>
                                    <TextInput
                                        type="number"
                                        value={budget.amount || ''}
                                        onChange={(e) => updateBudget({ amount: Number(e.target.value) })}
                                        placeholder={t('flowStages.paidAdsBudget.placeholders.amount')}
                                        leftElement={<span className="flow-paid-ads-budget__currency">$</span>}
                                        className="flow-paid-ads-budget__control"
                                    />
                                </div>
                            </div>

                            <div className="flow-paid-ads-budget__field">
                                <span className="flow-paid-ads-budget__label">
                                    {t('flowStages.paidAdsBudget.sections.bidStrategy')}
                                </span>
                                <div className="flow-paid-ads-budget__strategy-grid">
                                    {BID_STRATEGIES.map((strategy) => {
                                        const isActive = budget.bidStrategy === strategy.id;
                                        return (
                                            <button
                                                key={strategy.id}
                                                type="button"
                                                onClick={() => updateBudget({ bidStrategy: strategy.id })}
                                                className={`flow-paid-ads-budget__strategy ${isActive ? 'is-active' : ''}`}
                                            >
                                                <div className="flow-paid-ads-budget__strategy-icon">
                                                    <span className="material-symbols-outlined">{strategy.icon}</span>
                                                </div>
                                                <div>
                                                    <span className="flow-paid-ads-budget__strategy-title">
                                                        {t(strategy.labelKey)}
                                                    </span>
                                                    <span className="flow-paid-ads-budget__strategy-description">
                                                        {t(strategy.descriptionKey)}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-budget__panel">
                            <div className="flow-paid-ads-budget__panel-header">
                                <h3>{t('flowStages.paidAdsBudget.sections.flightDates')}</h3>
                                <div className="flow-paid-ads-budget__duration">
                                    <span className="material-symbols-outlined">schedule</span>
                                    <span>{durationLabel}</span>
                                </div>
                            </div>

                            <div className="flow-paid-ads-budget__field-grid">
                                <TextInput
                                    type="date"
                                    label={t('flowStages.paidAdsBudget.labels.startDate')}
                                    value={budget.startDate || ''}
                                    onChange={(e) => updateBudget({ startDate: e.target.value })}
                                    className="flow-paid-ads-budget__control"
                                />
                                <TextInput
                                    type="date"
                                    label={t('flowStages.paidAdsBudget.labels.endDate')}
                                    value={budget.endDate || ''}
                                    onChange={(e) => updateBudget({ endDate: e.target.value })}
                                    className="flow-paid-ads-budget__control"
                                />
                            </div>

                            <div className="flow-paid-ads-budget__field">
                                <span className="flow-paid-ads-budget__label">
                                    {t('flowStages.paidAdsBudget.labels.pacing')}
                                </span>
                                <div className="flow-paid-ads-budget__segmented">
                                    {['Standard', 'Accelerated'].map((pacing) => {
                                        const isActive = budget.pacing === pacing;
                                        return (
                                            <button
                                                key={pacing}
                                                type="button"
                                                onClick={() => updateBudget({ pacing })}
                                                className={`flow-paid-ads-budget__segment ${isActive ? 'is-active' : ''}`}
                                                aria-pressed={isActive}
                                            >
                                                {pacing === 'Standard'
                                                    ? t('flowStages.paidAdsBudget.labels.pacing.standard')
                                                    : t('flowStages.paidAdsBudget.labels.pacing.accelerated')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="flow-paid-ads-budget__aside">
                        <Card className="flow-paid-ads-budget__summary">
                            <div className="flow-paid-ads-budget__summary-header">
                                <h3>{t('flowStages.paidAdsBudget.sections.summary')}</h3>
                            </div>
                            <div className="flow-paid-ads-budget__summary-amount">
                                <span className="flow-paid-ads-budget__summary-value">
                                    ${budget.amount || '0'}
                                </span>
                                <span className="flow-paid-ads-budget__summary-type">
                                    {budgetTypeLabel}
                                </span>
                            </div>
                            <div className="flow-paid-ads-budget__summary-list">
                                <div className="flow-paid-ads-budget__summary-item">
                                    <span>{t('flowStages.paidAdsBudget.summary.bidStrategy')}</span>
                                    <span>{budget.bidStrategy || '-'}</span>
                                </div>
                                <div className="flow-paid-ads-budget__summary-item">
                                    <span>{t('flowStages.paidAdsBudget.summary.pacing')}</span>
                                    <span>{budget.pacing || '-'}</span>
                                </div>
                            </div>
                            <Button
                                className="flow-paid-ads-budget__advance"
                                onClick={() => onUpdate({ stage: 'Build' })}
                                icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                iconPosition="right"
                            >
                                {t('flowStages.paidAdsBudget.actions.advance')}
                            </Button>
                        </Card>

                        <Card className="flow-paid-ads-budget__insight">
                            <div className="flow-paid-ads-budget__insight-header">
                                <h4>{t('flowStages.paidAdsBudget.sections.insight')}</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleGetRecommendation}
                                    isLoading={isAnalysing}
                                    className="flow-paid-ads-budget__insight-action"
                                >
                                    {isAnalysing
                                        ? t('flowStages.paidAdsBudget.actions.analyzing')
                                        : t('flowStages.paidAdsBudget.actions.refresh')}
                                </Button>
                            </div>
                            <p className="flow-paid-ads-budget__insight-text">
                                {aiRecommendation ? aiRecommendation.rationale : t('flowStages.paidAdsBudget.insight.empty')}
                            </p>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
