import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface MarketingStrategy {
    campaignGoal: string;
    targetSegments: string;
    keyMessage: string;
    channels: string[];
    budgetEstimate: string;
}

export const MarketingStrategyView: React.FC<MarketingStrategyViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const strategy: MarketingStrategy = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    campaignGoal: parsed.campaignGoal || '',
                    targetSegments: parsed.targetSegments || '',
                    keyMessage: parsed.keyMessage || '',
                    channels: Array.isArray(parsed.channels) ? parsed.channels : [],
                    budgetEstimate: parsed.budgetEstimate || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            campaignGoal: '',
            targetSegments: '',
            keyMessage: '',
            channels: [],
            budgetEstimate: ''
        };
    })();

    const updateStrategy = (updates: Partial<MarketingStrategy>) => {
        const newData = { ...strategy, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const toggleChannel = (channel: string) => {
        const current = strategy.channels;
        if (current.includes(channel)) {
            updateStrategy({ channels: current.filter(c => c !== channel) });
        } else {
            updateStrategy({ channels: [...current, channel] });
        }
    };

    const MARKETING_CHANNELS = [
        { id: 'Email Newsletter', label: t('flowStages.marketingStrategy.channels.emailNewsletter') },
        { id: 'Drip Campaign', label: t('flowStages.marketingStrategy.channels.dripCampaign') },
        { id: 'Google Search Ads', label: t('flowStages.marketingStrategy.channels.googleSearchAds') },
        { id: 'Display Ads', label: t('flowStages.marketingStrategy.channels.displayAds') },
        { id: 'Sponsorships', label: t('flowStages.marketingStrategy.channels.sponsorships') },
        { id: 'Affiliate', label: t('flowStages.marketingStrategy.channels.affiliate') },
    ];
    const GOALS = [
        { id: 'Lead Generation', label: t('flowStages.marketingStrategy.goal.leadGeneration') },
        { id: 'Sales / Revenue', label: t('flowStages.marketingStrategy.goal.salesRevenue') },
        { id: 'Brand Awareness', label: t('flowStages.marketingStrategy.goal.brandAwareness') },
        { id: 'User Retention', label: t('flowStages.marketingStrategy.goal.userRetention') },
        { id: 'Event Promotion', label: t('flowStages.marketingStrategy.goal.eventPromotion') },
    ];

    return (
        <div className="flow-marketing-strategy">
            <div className="flow-marketing-strategy__container">
                <div className="flow-marketing-strategy__grid">
                    <Card className="flow-marketing-strategy__panel">
                        <div className="flow-marketing-strategy__header">
                            <div>
                                <h2 className="flow-marketing-strategy__title">{t('flowStages.marketingStrategy.title')}</h2>
                                <p className="flow-marketing-strategy__subtitle">{t('flowStages.marketingStrategy.subtitle')}</p>
                            </div>
                            <div className="flow-marketing-strategy__accent" />
                        </div>

                        <div className="flow-marketing-strategy__section">
                            <label className="flow-marketing-strategy__label">{t('flowStages.marketingStrategy.goal.label')}</label>
                            <div className="flow-marketing-strategy__goal-grid">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        type="button"
                                        onClick={() => updateStrategy({ campaignGoal: goal.id })}
                                        className={`flow-marketing-strategy__goal ${strategy.campaignGoal === goal.id ? 'is-active' : ''}`}
                                    >
                                        {goal.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flow-marketing-strategy__section">
                            <TextInput
                                label={t('flowStages.marketingStrategy.target.label')}
                                value={strategy.targetSegments}
                                onChange={(event) => updateStrategy({ targetSegments: event.target.value })}
                                placeholder={t('flowStages.marketingStrategy.target.placeholder')}
                                className="flow-marketing-strategy__control"
                            />
                        </div>

                        <div className="flow-marketing-strategy__section flow-marketing-strategy__section--stretch">
                            <TextArea
                                label={t('flowStages.marketingStrategy.message.label')}
                                value={strategy.keyMessage}
                                onChange={(event) => updateStrategy({ keyMessage: event.target.value })}
                                placeholder={t('flowStages.marketingStrategy.message.placeholder')}
                                className="flow-marketing-strategy__control flow-marketing-strategy__control--message"
                            />
                        </div>
                    </Card>

                    <Card className="flow-marketing-strategy__panel">
                        <div className="flow-marketing-strategy__section">
                            <h3 className="flow-marketing-strategy__panel-title">{t('flowStages.marketingStrategy.channels.title')}</h3>
                            <p className="flow-marketing-strategy__helper">{t('flowStages.marketingStrategy.channels.subtitle')}</p>
                        </div>

                        <div className="flow-marketing-strategy__section">
                            <label className="flow-marketing-strategy__label">{t('flowStages.marketingStrategy.channels.label')}</label>
                            <div className="flow-marketing-strategy__channel-list">
                                {MARKETING_CHANNELS.map((channel) => {
                                    const isActive = strategy.channels.includes(channel.id);
                                    return (
                                        <button
                                            key={channel.id}
                                            type="button"
                                            onClick={() => toggleChannel(channel.id)}
                                            className={`flow-marketing-strategy__channel ${isActive ? 'is-active' : ''}`}
                                        >
                                            <span>{channel.label}</span>
                                            <span className="flow-marketing-strategy__channel-check">
                                                <span className="material-symbols-outlined">check</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flow-marketing-strategy__section">
                            <TextInput
                                label={t('flowStages.marketingStrategy.budget.label')}
                                value={strategy.budgetEstimate}
                                onChange={(event) => updateStrategy({ budgetEstimate: event.target.value })}
                                placeholder={t('flowStages.marketingStrategy.budget.placeholder')}
                                leftElement={<span className="flow-marketing-strategy__currency">$</span>}
                                className="flow-marketing-strategy__control"
                            />
                        </div>

                        <Button
                            className="flow-marketing-strategy__advance"
                            onClick={() => onUpdate({ stage: 'Planning' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.marketingStrategy.actions.advance')}
                        </Button>
                    </Card>

                    <Card className="flow-marketing-strategy__panel flow-marketing-strategy__panel--aside">
                        <div className="flow-marketing-strategy__section">
                            <h3 className="flow-marketing-strategy__panel-title">{t('flowStages.marketingStrategy.metrics.title')}</h3>
                            <p className="flow-marketing-strategy__helper">{t('flowStages.marketingStrategy.metrics.subtitle')}</p>
                        </div>
                        <p className="flow-marketing-strategy__metrics-description">
                            {t('flowStages.marketingStrategy.metrics.description')}
                        </p>
                        <ul className="flow-marketing-strategy__metrics-list">
                            <li>{t('flowStages.marketingStrategy.metrics.point1')}</li>
                            <li>{t('flowStages.marketingStrategy.metrics.point2')}</li>
                            <li>{t('flowStages.marketingStrategy.metrics.point3')}</li>
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
};
