import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface MarketingStrategy {
    campaignGoal: string; // e.g., Brand Awareness, Lead Gen
    targetSegments: string;
    keyMessage: string;
    channels: string[]; // Email, Search Ads, Display Ads, Social Ads (maybe?)
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Strategy */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-surface shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <span className="material-symbols-outlined text-[100px] text-[var(--color-surface-border)] rotate-12 -mr-6 -mt-6">ads_click</span>
                </div>

                <div className="flex flex-col h-full relative z-10">
                    <div className="mb-6">
                        <h2 className="text-xl font-extrabold text-main tracking-tight">{t('flowStages.marketingStrategy.title')}</h2>
                        <p className="text-xs text-muted mt-1">{t('flowStages.marketingStrategy.subtitle')}</p>
                        <div className="h-1 w-10 bg-pink-500 rounded-full mt-3" />
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">{t('flowStages.marketingStrategy.goal.label')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => updateStrategy({ campaignGoal: goal.id })}
                                        className={`text-xs px-2 py-2 rounded-lg border transition-all truncate text-center ${strategy.campaignGoal === goal.id
                                            ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-semibold'
                                            : 'bg-surface border-surface text-muted hover:border-pink-200'
                                            }`}
                                    >
                                        {goal.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">{t('flowStages.marketingStrategy.target.label')}</label>
                            <input
                                type="text"
                                value={strategy.targetSegments}
                                onChange={(e) => updateStrategy({ targetSegments: e.target.value })}
                                placeholder={t('flowStages.marketingStrategy.target.placeholder')}
                                className="w-full text-sm bg-surface border border-surface rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none"
                            />
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">{t('flowStages.marketingStrategy.message.label')}</label>
                            <textarea
                                value={strategy.keyMessage}
                                onChange={(e) => updateStrategy({ keyMessage: e.target.value })}
                                className="w-full h-32 bg-surface border border-surface rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none text-sm resize-none"
                                placeholder={t('flowStages.marketingStrategy.message.placeholder')}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Column: Channels & Budget */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-surface shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-main">{t('flowStages.marketingStrategy.channels.title')}</h3>
                    <p className="text-xs text-muted">{t('flowStages.marketingStrategy.channels.subtitle')}</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">{t('flowStages.marketingStrategy.channels.label')}</label>
                        <div className="flex flex-col gap-2">
                            {MARKETING_CHANNELS.map((channel) => (
                                <button
                                    key={channel.id}
                                    onClick={() => toggleChannel(channel.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${strategy.channels.includes(channel.id)
                                        ? 'bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800'
                                        : 'bg-surface border-surface hover:border-muted'
                                        }`}
                                >
                                    <span className={`text-sm font-medium ${strategy.channels.includes(channel.id) ? 'text-pink-700 dark:text-pink-300' : 'text-main'}`}>
                                        {channel.label}
                                    </span>
                                    <div className={`size-5 rounded-full flex items-center justify-center border ${strategy.channels.includes(channel.id)
                                        ? 'bg-pink-500 border-pink-500 text-white'
                                        : 'border-muted text-transparent'
                                        }`}>
                                        <span className="material-symbols-outlined text-[14px]">check</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">{t('flowStages.marketingStrategy.budget.label')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                            <input
                                type="text"
                                value={strategy.budgetEstimate}
                                onChange={(e) => updateStrategy({ budgetEstimate: e.target.value })}
                                placeholder={t('flowStages.marketingStrategy.budget.placeholder')}
                                className="w-full text-sm bg-surface border border-surface rounded-lg pl-8 pr-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-surface">
                    <Button
                        className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                        onClick={() => onUpdate({ stage: 'Planning' })}
                    >
                        <span className="font-bold pl-1">{t('flowStages.marketingStrategy.actions.advance')}</span>
                        <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </div>
                    </Button>
                </div>
            </div>

            {/* Right Column: Key Metrics to Track (Preview) */}
            <div className="col-span-1 lg:col-span-1 flex flex-col h-full bg-surface-paper rounded-2xl border border-surface shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-main">{t('flowStages.marketingStrategy.metrics.title')}</h3>
                    <p className="text-xs text-muted">{t('flowStages.marketingStrategy.metrics.subtitle')}</p>
                </div>

                <div className="prose prose-sm dark:prose-invert">
                    <p className="text-sm text-muted italic">
                        {t('flowStages.marketingStrategy.metrics.description')}
                    </p>
                    <ul className="text-sm space-y-2 mt-4 text-main">
                        <li>• {t('flowStages.marketingStrategy.metrics.point1')}</li>
                        <li>• {t('flowStages.marketingStrategy.metrics.point2')}</li>
                        <li>• {t('flowStages.marketingStrategy.metrics.point3')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
