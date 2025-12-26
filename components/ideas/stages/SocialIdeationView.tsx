import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';

interface SocialIdeationViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface SocialStrategy {
    campaignType: string;
    keyMessage: string;
    targetAudience: string;
    channels: string[];
    creativeAngles: string[];
}

export const SocialIdeationView: React.FC<SocialIdeationViewProps> = ({ idea, onUpdate }) => {
    // Store social strategy in idea.concept as JSON
    const strategy: SocialStrategy = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                // Ensure all fields exist
                return {
                    campaignType: parsed.campaignType || '',
                    keyMessage: parsed.keyMessage || '',
                    targetAudience: parsed.targetAudience || '',
                    channels: Array.isArray(parsed.channels) ? parsed.channels : [],
                    creativeAngles: Array.isArray(parsed.creativeAngles) ? parsed.creativeAngles : [],
                    ...parsed // Keep other fields if any
                };
            }
        } catch { }
        return {
            campaignType: '',
            keyMessage: '',
            targetAudience: '',
            channels: [],
            creativeAngles: []
        };
    })();

    const updateStrategy = (updates: Partial<SocialStrategy>) => {
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

    const addCreativeAngle = () => {
        updateStrategy({ creativeAngles: [...strategy.creativeAngles, ''] });
    };

    const updateCreativeAngle = (index: number, value: string) => {
        const newAngles = [...strategy.creativeAngles];
        newAngles[index] = value;
        updateStrategy({ creativeAngles: newAngles });
    };

    const removeCreativeAngle = (index: number) => {
        const newAngles = [...strategy.creativeAngles];
        newAngles.splice(index, 1);
        updateStrategy({ creativeAngles: newAngles });
    };

    const GOALS = ['Brand Awareness', 'Engagement', 'Traffic / Link', 'Sales / Promo', 'Community Building', 'Education'];
    const FORMATS = ['Static Image', 'Carousel', 'Reel / TikTok', 'Text / Thread', 'Video (Long)', 'Story'];
    const PILLARS = ['Educational', 'Inspirational', 'Promotional', 'Behind the Scenes', 'User Generated', 'Trending'];
    const COMMON_CHANNELS = ['LinkedIn', 'Twitter / X', 'Instagram', 'TikTok', 'YouTube', 'Facebook'];

    // Extended Strategy Type
    const scope = (strategy as any).scope || 'post';

    const setScope = (s: 'post' | 'campaign') => updateStrategy({ scope: s } as any);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Strategy Core */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <span className="material-symbols-outlined text-[100px] text-[var(--color-surface-border)] rotate-12 -mr-6 -mt-6">share</span>
                </div>

                <div className="flex flex-col h-full relative z-10">
                    <div className="mb-6">
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Social Strategy</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Define the goal, format, and pillar</p>
                        <div className="h-1 w-10 bg-rose-500 rounded-full mt-3" />
                    </div>

                    {/* Scope Selector */}
                    <div className="flex bg-[var(--color-surface-bg)] p-1 rounded-lg border border-[var(--color-surface-border)] mb-4">
                        <button
                            onClick={() => setScope('post')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${scope === 'post' ? 'bg-white dark:bg-slate-700 shadow text-rose-600' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            Single Post
                        </button>
                        <button
                            onClick={() => setScope('campaign')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${scope === 'campaign' ? 'bg-white dark:bg-slate-700 shadow text-rose-600' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            Campaign / Series
                        </button>
                    </div>

                    <div className="space-y-5 overflow-y-auto pr-2">
                        {/* Goal Selector */}
                        <div>
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
                                {scope === 'campaign' ? 'Campaign Goal' : 'Post Goal'}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {GOALS.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => updateStrategy({ campaignType: type })}
                                        className={`text-xs px-2 py-2 rounded-lg border transition-all truncate text-center ${strategy.campaignType === type
                                            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold'
                                            : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-rose-200'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Format Selector (Post Only) */}
                        {scope === 'post' && (
                            <div>
                                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Format</label>
                                <select
                                    value={(strategy as any).format || ''}
                                    onChange={(e) => updateStrategy({ format: e.target.value } as any)}
                                    className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-rose-500 outline-none"
                                >
                                    <option value="" disabled>Select Format...</option>
                                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Content Pillar Selector */}
                        <div>
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
                                {scope === 'campaign' ? 'Primary Theme' : 'Content Pillar'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {PILLARS.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => updateStrategy({ pillar: p } as any)}
                                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${((strategy as any).pillar === p)
                                            ? 'bg-rose-100 dark:bg-rose-900/40 border-rose-300 text-rose-800 dark:text-rose-200'
                                            : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-rose-200'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Target Audience</label>
                            <input
                                type="text"
                                value={strategy.targetAudience}
                                onChange={(e) => updateStrategy({ targetAudience: e.target.value })}
                                placeholder="e.g., CTOs of Series A startups"
                                className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-rose-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Column: Channels */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)]">Distribution Channels</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Where will this content live?</p>
                </div>

                <div className="flex flex-col gap-2 overflow-y-auto">
                    {COMMON_CHANNELS.map(channel => (
                        <button
                            key={channel}
                            onClick={() => toggleChannel(channel)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${strategy.channels.includes(channel)
                                ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'
                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]'
                                }`}
                        >
                            <span className={`text-sm font-medium ${strategy.channels.includes(channel) ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--color-text-main)]'}`}>
                                {channel}
                            </span>
                            <div className={`size-5 rounded-full flex items-center justify-center border ${strategy.channels.includes(channel)
                                ? 'bg-rose-500 border-rose-500 text-white'
                                : 'border-[var(--color-text-muted)] text-transparent'
                                }`}>
                                <span className="material-symbols-outlined text-[14px]">check</span>
                            </div>
                        </button>
                    ))}

                    <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)]">
                        <Button
                            className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                            // Advance to Drafting
                            onClick={() => onUpdate({ stage: 'Drafting' })}
                        >
                            <span className="font-bold pl-1">Start Drafting</span>
                            <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Right Column: Hooks & Angles */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-[var(--color-text-main)]">
                            {scope === 'campaign' ? 'Episode Ideas / Themes' : 'Strong Hooks'}
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {scope === 'campaign' ? 'Brainstorm the series content' : 'First 3 seconds matter most'}
                        </p>
                    </div>
                    <button
                        onClick={addCreativeAngle}
                        className="size-8 rounded-lg bg-[var(--color-surface-hover)] hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 p-1">
                    {strategy.creativeAngles.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">lightbulb_outline</span>
                            <p className="text-sm">{scope === 'campaign' ? 'No themes added yet' : 'No hooks added yet'}</p>
                            <Button size="sm" variant="ghost" onClick={addCreativeAngle} className="mt-2 text-rose-500">
                                {scope === 'campaign' ? 'Add First Theme' : 'Add First Hook'}
                            </Button>
                        </div>
                    ) : (
                        strategy.creativeAngles.map((angle, index) => (
                            <div key={index} className="p-3 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] group focus-within:ring-1 focus-within:ring-rose-500 transition-all">
                                <div className="flex items-start gap-2">
                                    <span className="text-[var(--color-text-muted)] font-mono text-xs mt-1.5 opacity-50">#{index + 1}</span>
                                    <textarea
                                        value={angle}
                                        onChange={(e) => updateCreativeAngle(index, e.target.value)}
                                        placeholder={scope === 'campaign' ? "e.g. Episode 1: The Basics..." : "e.g. 'Stop doing X if you want Y...'"}
                                        rows={2}
                                        className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm resize-none"
                                    />
                                    <button
                                        onClick={() => removeCreativeAngle(index)}
                                        className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-rose-500 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
