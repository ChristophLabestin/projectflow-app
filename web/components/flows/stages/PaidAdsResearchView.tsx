import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsResearchViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const PaidAdsResearchView: React.FC<PaidAdsResearchViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData, updateAdData } = usePaidAdsData(idea, onUpdate);
    const research = adData.research || {};
    const [angleInput, setAngleInput] = useState('');
    const angleIdeas = research.angleIdeas || [];

    const addAngle = () => {
        if (!angleInput.trim()) return;
        updateAdData({ research: { angleIdeas: [...angleIdeas, angleInput.trim()] } });
        setAngleInput('');
    };

    const removeAngle = (index: number) => {
        updateAdData({ research: { angleIdeas: angleIdeas.filter((_, i) => i !== index) } });
    };

    return (
        <div className="flow-paid-ads-research">
            <div className="flow-paid-ads-research__container">
                <Card className="flow-paid-ads-research__hero">
                    <div className="flow-paid-ads-research__hero-content">
                        <span className="flow-paid-ads-research__badge">
                            {t('flowStages.paidAdsResearch.hero.badge')}
                        </span>
                        <h1 className="flow-paid-ads-research__title">
                            {t('flowStages.paidAdsResearch.hero.title')}
                        </h1>
                    </div>
                    <div className="flow-paid-ads-research__hero-icon">
                        <span className="material-symbols-outlined">travel_explore</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-research__grid">
                    <div className="flow-paid-ads-research__main">
                        <Card className="flow-paid-ads-research__panel">
                            <h3 className="flow-paid-ads-research__panel-title">
                                {t('flowStages.paidAdsResearch.sections.marketInsights')}
                            </h3>
                            <TextArea
                                value={research.marketInsights || ''}
                                onChange={(event) => updateAdData({ research: { marketInsights: event.target.value } })}
                                placeholder={t('flowStages.paidAdsResearch.placeholders.marketInsights')}
                                className="flow-paid-ads-research__control flow-paid-ads-research__control--tall"
                            />
                        </Card>

                        <Card className="flow-paid-ads-research__panel">
                            <h3 className="flow-paid-ads-research__panel-title">
                                {t('flowStages.paidAdsResearch.sections.competitorNotes')}
                            </h3>
                            <TextArea
                                value={research.competitorNotes || ''}
                                onChange={(event) => updateAdData({ research: { competitorNotes: event.target.value } })}
                                placeholder={t('flowStages.paidAdsResearch.placeholders.competitorNotes')}
                                className="flow-paid-ads-research__control flow-paid-ads-research__control--tall"
                            />
                        </Card>

                        <Card className="flow-paid-ads-research__panel">
                            <h3 className="flow-paid-ads-research__panel-title">
                                {t('flowStages.paidAdsResearch.sections.customerObjections')}
                            </h3>
                            <TextArea
                                value={research.customerPainPoints || ''}
                                onChange={(event) => updateAdData({ research: { customerPainPoints: event.target.value } })}
                                placeholder={t('flowStages.paidAdsResearch.placeholders.customerObjections')}
                                className="flow-paid-ads-research__control"
                            />
                        </Card>
                    </div>

                    <div className="flow-paid-ads-research__aside">
                        <Card className="flow-paid-ads-research__panel">
                            <h3 className="flow-paid-ads-research__panel-title">
                                {t('flowStages.paidAdsResearch.sections.proofPoints')}
                            </h3>
                            <TextArea
                                value={research.proofPoints || ''}
                                onChange={(event) => updateAdData({ research: { proofPoints: event.target.value } })}
                                placeholder={t('flowStages.paidAdsResearch.placeholders.proofPoints')}
                                className="flow-paid-ads-research__control flow-paid-ads-research__control--tall"
                            />
                        </Card>

                        <Card className="flow-paid-ads-research__angles">
                            <div className="flow-paid-ads-research__angles-header">
                                <h3 className="flow-paid-ads-research__panel-title">
                                    {t('flowStages.paidAdsResearch.sections.angleIdeas')}
                                </h3>
                                <span className="flow-paid-ads-research__angles-count">
                                    {angleIdeas.length}
                                </span>
                            </div>
                            <div className="flow-paid-ads-research__angle-row">
                                <TextInput
                                    value={angleInput}
                                    onChange={(event) => setAngleInput(event.target.value)}
                                    onKeyDown={(event) => event.key === 'Enter' && addAngle()}
                                    placeholder={t('flowStages.paidAdsResearch.placeholders.angleInput')}
                                    aria-label={t('flowStages.paidAdsResearch.fields.angleInput')}
                                    className="flow-paid-ads-research__control"
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={addAngle}
                                    className="flow-paid-ads-research__angle-add"
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('common.add')}
                                </Button>
                            </div>
                            <div className="flow-paid-ads-research__angle-list">
                                {angleIdeas.length === 0 ? (
                                    <span className="flow-paid-ads-research__angle-empty">
                                        {t('flowStages.paidAdsResearch.angles.empty')}
                                    </span>
                                ) : (
                                    angleIdeas.map((angle, index) => (
                                        <div key={index} className="flow-paid-ads-research__angle-item">
                                            <span>{angle}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeAngle(index)}
                                                className="flow-paid-ads-research__angle-remove"
                                                aria-label={t('common.delete')}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Button
                            className="flow-paid-ads-research__advance"
                            onClick={() => onUpdate({ stage: 'Creative' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.paidAdsResearch.actions.advance')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
