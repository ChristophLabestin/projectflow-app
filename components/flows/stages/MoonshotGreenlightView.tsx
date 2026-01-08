import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { useLanguage } from '../../../context/LanguageContext';

interface MoonshotGreenlightViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface GreenlightData {
    resourceReqs: {
        budget: string;
        personnel: string;
        timeline: string;
    };
    decision: 'GO' | 'NO-GO' | 'PIVOT' | 'PENDING';
    decisionNotes: string;
}

const DECISIONS = [
    {
        id: 'GO' as const,
        labelKey: 'flowStages.moonshotGreenlight.decision.go.label',
        subtitleKey: 'flowStages.moonshotGreenlight.decision.go.subtitle',
        icon: 'check_circle',
        tone: 'success'
    },
    {
        id: 'PIVOT' as const,
        labelKey: 'flowStages.moonshotGreenlight.decision.pivot.label',
        subtitleKey: 'flowStages.moonshotGreenlight.decision.pivot.subtitle',
        icon: 'shuffle',
        tone: 'warning'
    },
    {
        id: 'NO-GO' as const,
        labelKey: 'flowStages.moonshotGreenlight.decision.noGo.label',
        subtitleKey: 'flowStages.moonshotGreenlight.decision.noGo.subtitle',
        icon: 'cancel',
        tone: 'error'
    }
];

export const MoonshotGreenlightView: React.FC<MoonshotGreenlightViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const data: GreenlightData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    resourceReqs: parsed.resourceReqs || { budget: '', personnel: '', timeline: '' },
                    decision: parsed.decision || 'PENDING',
                    decisionNotes: parsed.decisionNotes || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            resourceReqs: { budget: '', personnel: '', timeline: '' },
            decision: 'PENDING',
            decisionNotes: ''
        };
    })();

    const updateData = (updates: Partial<GreenlightData>) => {
        const newData = { ...data, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const updateResource = (field: keyof typeof data.resourceReqs, value: string) => {
        updateData({
            resourceReqs: {
                ...data.resourceReqs,
                [field]: value
            }
        });
    };

    return (
        <div className="flow-moonshot-greenlight">
            <div className="flow-moonshot-greenlight__grid">
                <Card className="flow-moonshot-greenlight__panel flow-moonshot-greenlight__panel--main">
                    <div className="flow-moonshot-greenlight__header">
                        <div>
                            <h2>{t('flowStages.moonshotGreenlight.title')}</h2>
                            <p>{t('flowStages.moonshotGreenlight.subtitle')}</p>
                        </div>
                        <div className="flow-moonshot-greenlight__accent" />
                    </div>

                    <div className="flow-moonshot-greenlight__resource-grid">
                        <TextInput
                            label={t('flowStages.moonshotGreenlight.resources.budget')}
                            value={data.resourceReqs.budget}
                            onChange={(event) => updateResource('budget', event.target.value)}
                            placeholder={t('flowStages.moonshotGreenlight.resources.budgetPlaceholder')}
                            className="flow-moonshot-greenlight__control"
                        />
                        <TextInput
                            label={t('flowStages.moonshotGreenlight.resources.team')}
                            value={data.resourceReqs.personnel}
                            onChange={(event) => updateResource('personnel', event.target.value)}
                            placeholder={t('flowStages.moonshotGreenlight.resources.teamPlaceholder')}
                            className="flow-moonshot-greenlight__control"
                        />
                        <TextInput
                            label={t('flowStages.moonshotGreenlight.resources.timeline')}
                            value={data.resourceReqs.timeline}
                            onChange={(event) => updateResource('timeline', event.target.value)}
                            placeholder={t('flowStages.moonshotGreenlight.resources.timelinePlaceholder')}
                            className="flow-moonshot-greenlight__control flow-moonshot-greenlight__control--wide"
                        />
                    </div>

                    <TextArea
                        label={t('flowStages.moonshotGreenlight.notes.label')}
                        value={data.decisionNotes}
                        onChange={(event) => updateData({ decisionNotes: event.target.value })}
                        placeholder={t('flowStages.moonshotGreenlight.notes.placeholder')}
                        className="flow-moonshot-greenlight__control flow-moonshot-greenlight__control--notes"
                    />
                </Card>

                <Card className="flow-moonshot-greenlight__panel flow-moonshot-greenlight__panel--decision" data-decision={data.decision}>
                    <h3>{t('flowStages.moonshotGreenlight.verdict.title')}</h3>
                    <div className="flow-moonshot-greenlight__decision-list">
                        {DECISIONS.map((decision) => {
                            const isActive = data.decision === decision.id;
                            return (
                                <button
                                    key={decision.id}
                                    type="button"
                                    onClick={() => updateData({ decision: decision.id })}
                                    className={`flow-moonshot-greenlight__decision ${isActive ? 'is-active' : ''}`}
                                    data-tone={decision.tone}
                                >
                                    <div>
                                        <span className="flow-moonshot-greenlight__decision-title">
                                            {t(decision.labelKey)}
                                        </span>
                                        <span className="flow-moonshot-greenlight__decision-subtitle">
                                            {t(decision.subtitleKey)}
                                        </span>
                                    </div>
                                    <span className="material-symbols-outlined">{decision.icon}</span>
                                </button>
                            );
                        })}
                    </div>

                    {data.decision === 'GO' && (
                        <Button
                            className="flow-moonshot-greenlight__initialize"
                            onClick={() => onUpdate({ stage: 'Approved' })}
                            icon={<span className="material-symbols-outlined">rocket_launch</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.moonshotGreenlight.actions.initialize')}
                        </Button>
                    )}
                </Card>
            </div>
        </div>
    );
};
