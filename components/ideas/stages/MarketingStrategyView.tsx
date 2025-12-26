import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';

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

    const MARKETING_CHANNELS = ['Email Newsletter', 'Drip Campaign', 'Google Search Ads', 'Display Ads', 'Sponsorships', 'Affiliate'];
    const GOALS = ['Lead Generation', 'Sales / Revenue', 'Brand Awareness', 'User Retention', 'Event Promotion'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Strategy */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <span className="material-symbols-outlined text-[100px] text-[var(--color-surface-border)] rotate-12 -mr-6 -mt-6">ads_click</span>
                </div>

                <div className="flex flex-col h-full relative z-10">
                    <div className="mb-6">
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Campaign Strategy</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Define goals and audience</p>
                        <div className="h-1 w-10 bg-pink-500 rounded-full mt-3" />
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Campaign Goal</label>
                            <div className="grid grid-cols-2 gap-2">
                                {GOALS.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => updateStrategy({ campaignGoal: g })}
                                        className={`text-xs px-2 py-2 rounded-lg border transition-all truncate text-center ${strategy.campaignGoal === g
                                            ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-semibold'
                                            : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-pink-200'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Target Segments</label>
                            <input
                                type="text"
                                value={strategy.targetSegments}
                                onChange={(e) => updateStrategy({ targetSegments: e.target.value })}
                                placeholder="e.g., Churned users, High LTV customers"
                                className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none"
                            />
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Key Message / Offer</label>
                            <textarea
                                value={strategy.keyMessage}
                                onChange={(e) => updateStrategy({ keyMessage: e.target.value })}
                                className="w-full h-32 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none text-sm resize-none"
                                placeholder="What is the compelling offer?"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Column: Channels & Budget */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)]">Channels & Budget</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Where will this run?</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Select Channels</label>
                        <div className="flex flex-col gap-2">
                            {MARKETING_CHANNELS.map(channel => (
                                <button
                                    key={channel}
                                    onClick={() => toggleChannel(channel)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${strategy.channels.includes(channel)
                                        ? 'bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800'
                                        : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]'
                                        }`}
                                >
                                    <span className={`text-sm font-medium ${strategy.channels.includes(channel) ? 'text-pink-700 dark:text-pink-300' : 'text-[var(--color-text-main)]'}`}>
                                        {channel}
                                    </span>
                                    <div className={`size-5 rounded-full flex items-center justify-center border ${strategy.channels.includes(channel)
                                        ? 'bg-pink-500 border-pink-500 text-white'
                                        : 'border-[var(--color-text-muted)] text-transparent'
                                        }`}>
                                        <span className="material-symbols-outlined text-[14px]">check</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Budget Estimate</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                            <input
                                type="text"
                                value={strategy.budgetEstimate}
                                onChange={(e) => updateStrategy({ budgetEstimate: e.target.value })}
                                placeholder="0.00"
                                className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg pl-8 pr-3 py-2.5 focus:ring-1 focus:ring-pink-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-[var(--color-surface-border)]">
                    <Button
                        className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                        onClick={() => onUpdate({ stage: 'Planning' })}
                    >
                        <span className="font-bold pl-1">Proceed to Planning</span>
                        <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </div>
                    </Button>
                </div>
            </div>

            {/* Right Column: Key Metrics to Track (Preview) */}
            <div className="col-span-1 lg:col-span-1 flex flex-col h-full bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)]">Target Metrics</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">What does success look like?</p>
                </div>

                <div className="prose prose-sm dark:prose-invert">
                    <p className="text-sm text-[var(--color-text-muted)] italic">
                        Define specific KPIs in the Analysis phase. For now, focus on aligning the team on the qualitative goals.
                    </p>
                    <ul className="text-sm space-y-2 mt-4 text-[var(--color-text-main)]">
                        <li>• Clear Value Proposition</li>
                        <li>• Consistent Visual Identity</li>
                        <li>• Strong Call to Action</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
