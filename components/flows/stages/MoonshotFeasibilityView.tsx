import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { useLanguage } from '../../../context/LanguageContext';

interface MoonshotFeasibilityViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface FeasibilityData {
    hypothesis: string;
    risks: {
        technical: string;
        market: string;
        regulatory: string;
    };
    expertReviews: {
        expertName: string;
        feedback: string;
        date: string;
    }[];
}

export const MoonshotFeasibilityView: React.FC<MoonshotFeasibilityViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const data: FeasibilityData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    hypothesis: parsed.hypothesis || '',
                    risks: parsed.risks || { technical: '', market: '', regulatory: '' },
                    expertReviews: Array.isArray(parsed.expertReviews) ? parsed.expertReviews : [],
                    ...parsed
                };
            }
        } catch { }
        return {
            hypothesis: '',
            risks: { technical: '', market: '', regulatory: '' },
            expertReviews: []
        };
    })();

    const updateData = (updates: Partial<FeasibilityData>) => {
        const newData = { ...data, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const updateRisk = (type: keyof typeof data.risks, value: string) => {
        updateData({
            risks: {
                ...data.risks,
                [type]: value
            }
        });
    };

    const addExpertReview = () => {
        const newReview = { expertName: '', feedback: '', date: new Date().toISOString() };
        updateData({ expertReviews: [...data.expertReviews, newReview] });
    };

    const updateReview = (index: number, field: string, value: string) => {
        const newReviews = [...data.expertReviews];
        newReviews[index] = { ...newReviews[index], [field]: value };
        updateData({ expertReviews: newReviews });
    };

    const removeReview = (index: number) => {
        const newReviews = [...data.expertReviews];
        newReviews.splice(index, 1);
        updateData({ expertReviews: newReviews });
    };

    return (
        <div className="flow-moonshot-feasibility">
            <div className="flow-moonshot-feasibility__grid">
                <Card className="flow-moonshot-feasibility__panel">
                    <div className="flow-moonshot-feasibility__header">
                        <h2>{t('flowStages.moonshotFeasibility.title')}</h2>
                        <p>{t('flowStages.moonshotFeasibility.subtitle')}</p>
                    </div>
                    <TextArea
                        label={t('flowStages.moonshotFeasibility.hypothesis.label')}
                        value={data.hypothesis}
                        onChange={(event) => updateData({ hypothesis: event.target.value })}
                        placeholder={t('flowStages.moonshotFeasibility.hypothesis.placeholder')}
                        className="flow-moonshot-feasibility__control flow-moonshot-feasibility__control--hypothesis"
                    />
                </Card>

                <Card className="flow-moonshot-feasibility__panel">
                    <div className="flow-moonshot-feasibility__header">
                        <h3>{t('flowStages.moonshotFeasibility.risks.title')}</h3>
                        <p>{t('flowStages.moonshotFeasibility.risks.subtitle')}</p>
                    </div>
                    <div className="flow-moonshot-feasibility__risk-list">
                        <TextArea
                            label={t('flowStages.moonshotFeasibility.risks.technical')}
                            value={data.risks.technical}
                            onChange={(event) => updateRisk('technical', event.target.value)}
                            placeholder={t('flowStages.moonshotFeasibility.risks.technicalPlaceholder')}
                            className="flow-moonshot-feasibility__control"
                        />
                        <TextArea
                            label={t('flowStages.moonshotFeasibility.risks.market')}
                            value={data.risks.market}
                            onChange={(event) => updateRisk('market', event.target.value)}
                            placeholder={t('flowStages.moonshotFeasibility.risks.marketPlaceholder')}
                            className="flow-moonshot-feasibility__control"
                        />
                        <TextArea
                            label={t('flowStages.moonshotFeasibility.risks.regulatory')}
                            value={data.risks.regulatory}
                            onChange={(event) => updateRisk('regulatory', event.target.value)}
                            placeholder={t('flowStages.moonshotFeasibility.risks.regulatoryPlaceholder')}
                            className="flow-moonshot-feasibility__control"
                        />
                    </div>
                    <Button
                        className="flow-moonshot-feasibility__advance"
                        onClick={() => onUpdate({ stage: 'Prototype' })}
                        icon={<span className="material-symbols-outlined">arrow_forward</span>}
                        iconPosition="right"
                    >
                        {t('flowStages.moonshotFeasibility.actions.advance')}
                    </Button>
                </Card>

                <Card className="flow-moonshot-feasibility__panel">
                    <div className="flow-moonshot-feasibility__header flow-moonshot-feasibility__header--row">
                        <div>
                            <h3>{t('flowStages.moonshotFeasibility.experts.title')}</h3>
                            <p>{t('flowStages.moonshotFeasibility.experts.subtitle')}</p>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={addExpertReview}
                            icon={<span className="material-symbols-outlined">add</span>}
                        >
                            {t('common.add')}
                        </Button>
                    </div>

                    {data.expertReviews.length === 0 ? (
                        <div className="flow-moonshot-feasibility__empty">
                            <span className="material-symbols-outlined">person_check</span>
                            <p>{t('flowStages.moonshotFeasibility.experts.empty')}</p>
                        </div>
                    ) : (
                        <div className="flow-moonshot-feasibility__reviews">
                            {data.expertReviews.map((review, index) => (
                                <div key={index} className="flow-moonshot-feasibility__review">
                                    <div className="flow-moonshot-feasibility__review-header">
                                        <TextInput
                                            value={review.expertName}
                                            onChange={(event) => updateReview(index, 'expertName', event.target.value)}
                                            placeholder={t('flowStages.moonshotFeasibility.experts.namePlaceholder')}
                                            className="flow-moonshot-feasibility__control"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeReview(index)}
                                            className="flow-moonshot-feasibility__remove"
                                            aria-label={t('common.delete')}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                    <TextArea
                                        value={review.feedback}
                                        onChange={(event) => updateReview(index, 'feedback', event.target.value)}
                                        placeholder={t('flowStages.moonshotFeasibility.experts.feedbackPlaceholder')}
                                        className="flow-moonshot-feasibility__control"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
