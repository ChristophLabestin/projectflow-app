import React from 'react';
import { Button } from '../../ui/Button';
import { subscribeSocialStrategy, subscribeCampaigns } from '../../../services/dataService';
import { SocialStrategy as SocialStrategyType, Idea, SocialPlatform, SocialCampaign } from '../../../types';
import {
    generateSocialStrategyAI,
    generateAudienceAlternativesAI,
    generateSocialPlaybookAI
} from '../../../services/geminiService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';

interface SocialStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface SocialStrategy {
    campaignType: string;
    subGoal: string;
    targetAudience: string;
    channels: SocialPlatform[];
    pillar: string;
    scope: 'post' | 'campaign';
    linkedCampaignId?: string;
    plays: Record<string, { play: string, tips: string[] }>;
}

export const SocialStrategyView: React.FC<SocialStrategyViewProps> = ({ idea, onUpdate }) => {
    const [projectStrategy, setProjectStrategy] = React.useState<SocialStrategyType | null>(null);
    const [availableCampaigns, setAvailableCampaigns] = React.useState<SocialCampaign[]>([]);
    const [generating, setGenerating] = React.useState(false);
    const [regeneratingPlatform, setRegeneratingPlatform] = React.useState<string | null>(null);
    const [audienceSuggestions, setAudienceSuggestions] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!idea.projectId) return;
        const unsubStrategy = subscribeSocialStrategy(idea.projectId, setProjectStrategy);
        const unsubCampaigns = subscribeCampaigns(idea.projectId, setAvailableCampaigns);
        return () => {
            unsubStrategy();
            unsubCampaigns();
        };
    }, [idea.projectId]);

    const strategy: SocialStrategy = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    campaignType: parsed.campaignType || '',
                    subGoal: parsed.subGoal || '',
                    targetAudience: parsed.targetAudience || '',
                    channels: Array.isArray(parsed.channels) ? parsed.channels : [],
                    pillar: parsed.pillar || '',
                    scope: parsed.scope || 'post',
                    linkedCampaignId: parsed.linkedCampaignId,
                    plays: parsed.plays || {},
                    ...parsed
                };
            }
        } catch { }
        return {
            campaignType: '',
            subGoal: '',
            targetAudience: '',
            channels: [],
            pillar: '',
            scope: 'post',
            plays: {}
        };
    })();

    const updateStrategy = (updates: Partial<SocialStrategy>) => {
        const newData = { ...strategy, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleGeneratePlaybook = async () => {
        if (generating || strategy.channels.length === 0) return;
        setGenerating(true);
        try {
            const playbookData = await generateSocialPlaybookAI(idea, strategy.channels, strategy.scope, {
                goal: strategy.campaignType,
                subGoal: strategy.subGoal,
                audience: strategy.targetAudience
            });
            updateStrategy({ plays: playbookData });
        } catch (error) {
            console.error("Playbook generation error:", error);
        } finally {
            setGenerating(false);
        }
    };

    const handleRegeneratePlatform = async (platform: SocialPlatform) => {
        if (regeneratingPlatform) return;
        setRegeneratingPlatform(platform);
        try {
            const singlePlaybook = await generateSocialPlaybookAI(idea, [platform], strategy.scope, {
                goal: strategy.campaignType,
                subGoal: strategy.subGoal,
                audience: strategy.targetAudience
            });
            updateStrategy({
                plays: {
                    ...strategy.plays,
                    ...singlePlaybook
                }
            });
        } catch (error) {
            console.error("Regeneration error:", error);
        } finally {
            setRegeneratingPlatform(null);
        }
    };

    const toggleChannel = (channel: SocialPlatform) => {
        const current = strategy.channels;
        if (current.includes(channel)) {
            updateStrategy({ channels: current.filter(c => c !== channel) });
        } else {
            updateStrategy({ channels: [...current, channel] });
        }
    };

    const GOALS = ['Brand Awareness', 'Engagement', 'Traffic / Link', 'Sales / Promo', 'Community Building', 'Education'];
    const ALL_CHANNELS: SocialPlatform[] = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];
    const COMMON_CHANNELS = projectStrategy?.defaultPlatforms && projectStrategy.defaultPlatforms.length > 0
        ? projectStrategy.defaultPlatforms
        : ALL_CHANNELS;

    const missionText = (
        <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            "We are creating a <span className="text-rose-500 font-black">{strategy.scope === 'post' ? 'Single Post' : 'Multi-Channel Campaign'}</span>
            {strategy.scope === 'post' && strategy.linkedCampaignId && availableCampaigns.find(c => c.id === strategy.linkedCampaignId) && (
                <>{' '}for <span className="text-rose-500 font-black">{availableCampaigns.find(c => c.id === strategy.linkedCampaignId)?.name}</span></>
            )}
            {' '}targeting <span className="text-rose-500 font-black">{strategy.targetAudience || 'our core audience'}</span>
            {' '}on <span className="text-rose-500 font-black">{strategy.channels.length > 0 ? strategy.channels.join(', ') : 'selected platforms'}</span>
            {' '}to drive <span className="text-rose-500 font-black">
                {strategy.campaignType || 'Impact'}
                {strategy.subGoal && <span className="text-slate-400 font-normal px-1">&</span>}
                {strategy.subGoal}
            </span>."
        </div>
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-4 pt-6 px-6">
                {/* Campaign Mission Hero */}
                <div className="bg-gradient-to-br from-rose-100 via-pink-50 to-white dark:from-rose-900/30 dark:via-pink-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-rose-200 dark:border-rose-800/50 relative overflow-hidden shadow-xl shadow-rose-100 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-rose-600 rotate-12 -translate-y-10 translate-x-10">flag</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-rose-200 dark:shadow-none">
                                    The Mission
                                </div>
                                <div className="h-[1px] w-8 bg-rose-200 dark:bg-rose-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                Strategic Social Playbook
                            </h1>
                        </div>
                        <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-rose-100/50 dark:shadow-none backdrop-blur-md">
                            {missionText}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">
                    {/* Column: Foundations */}
                    <div className="lg:col-span-4 space-y-5">
                        {/* Scope Selection */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50">Project Scope</h3>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button
                                    onClick={() => updateStrategy({ scope: 'post' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${strategy.scope === 'post' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">sticky_note_2</span>
                                    Single Post
                                </button>
                                <button
                                    onClick={() => updateStrategy({ scope: 'campaign' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${strategy.scope === 'campaign' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">layers</span>
                                    Campaign
                                </button>
                            </div>

                            {/* Campaign Link Select (Visible only for Single Post) */}
                            {strategy.scope === 'post' && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-2 block opacity-70 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px]">link</span>
                                        Link to Campaign
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={strategy.linkedCampaignId || ''}
                                            onChange={(e) => updateStrategy({ linkedCampaignId: e.target.value || undefined })}
                                            className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all pr-8"
                                        >
                                            <option value="">None (Standalone Post)</option>
                                            {availableCampaigns.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Channel Selection */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50">Social Channels</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {COMMON_CHANNELS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => toggleChannel(c)}
                                        className={`flex items-center justify-between p-2 rounded-xl border-2 transition-all group ${strategy.channels.includes(c)
                                            ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800 shadow-sm'
                                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="size-6 shadow-md group-hover:scale-110 transition-transform">
                                                <PlatformIcon platform={c} />
                                            </div>
                                            <span className={`text-[11px] font-black tracking-tight ${strategy.channels.includes(c) ? 'text-rose-900 dark:text-rose-100' : 'text-slate-500'}`}>
                                                {c}
                                            </span>
                                        </div>
                                        <div className={`size-4 rounded-md flex items-center justify-center border transition-all ${strategy.channels.includes(c) ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                                            {strategy.channels.includes(c) && <span className="material-symbols-outlined text-[10px] font-black">check</span>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest opacity-50">Base Strategy</h3>
                                <button
                                    onClick={async () => {
                                        setGenerating(true);
                                        try {
                                            // 1. Generate Base Strategy & Audience Alts in parallel
                                            const [strategyRes, altsRes] = await Promise.all([
                                                generateSocialStrategyAI(idea),
                                                generateAudienceAlternativesAI(idea)
                                            ]);

                                            // 2. Update Local State immediately for UI feedback
                                            setAudienceSuggestions(altsRes);
                                            updateStrategy({
                                                campaignType: strategyRes.goal,
                                                subGoal: strategyRes.subGoal,
                                                targetAudience: strategyRes.targetAudience,
                                                pillar: strategyRes.pillar
                                            });

                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setGenerating(false);
                                        }
                                    }}
                                    className="text-[9px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 rounded-full flex items-center gap-1 transition-all"
                                >
                                    <span className={`material-symbols-outlined text-[12px] ${generating ? 'animate-spin' : ''}`}>
                                        {generating ? 'progress_activity' : 'auto_awesome'}
                                    </span>
                                    AI SUPER SUGGEST
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70">Campaign Goal</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {GOALS.map(g => (
                                            <button
                                                key={g}
                                                onClick={() => updateStrategy({ campaignType: g })}
                                                className={`px-2 py-2 text-[10px] font-black rounded-lg border-2 transition-all ${strategy.campaignType === g ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200 dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-rose-200'}`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70">Secondary Goal (KPI)</label>
                                    <div className="relative">
                                        <select
                                            value={strategy.subGoal}
                                            onChange={(e) => updateStrategy({ subGoal: e.target.value })}
                                            className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-[11px] font-black text-slate-700 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
                                        >
                                            <option value="">Select Secondary Goal...</option>
                                            {GOALS.filter(g => g !== strategy.campaignType).map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70">Target Audience</label>
                                    <textarea
                                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none h-24 resize-none leading-snug tracking-tight text-slate-700 dark:text-slate-200"
                                        value={strategy.targetAudience}
                                        onChange={(e) => updateStrategy({ targetAudience: e.target.value })}
                                    />
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                            onClick={async () => {
                                                if (generating) return;
                                                setGenerating(true);
                                                try {
                                                    const alts = await generateAudienceAlternativesAI(idea);
                                                    setAudienceSuggestions(alts);
                                                } finally { setGenerating(false); }
                                            }}
                                            className="text-[9px] font-black text-slate-500 hover:text-rose-600 flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">auto_awesome</span> Suggest Alternatives
                                        </button>
                                    </div>
                                    {audienceSuggestions.length > 0 && (
                                        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-2 shadow-inner">
                                            {audienceSuggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { updateStrategy({ targetAudience: s }); setAudienceSuggestions([]); }}
                                                    className="w-full text-left text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:text-rose-900 leading-tight block hover:bg-white/50 dark:hover:bg-slate-900/50 p-1.5 rounded-lg transition-all"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column: The Playbook */}
                    <div className="lg:col-span-8 space-y-5 flex flex-col">
                        <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm min-h-[500px] flex flex-col">
                            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Strategic Blueprint</h3>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-tight">Platform-specific winning plays powered by Gemini AI</p>
                                </div>
                                <Button
                                    onClick={handleGeneratePlaybook}
                                    isLoading={generating}
                                    disabled={strategy.channels.length === 0}
                                    className="h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-none shadow-xl shadow-slate-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${generating ? 'animate-spin' : ''}`}>
                                        {generating ? 'progress_activity' : 'bolt'}
                                    </span>
                                    <span className="text-[11px] font-black uppercase tracking-widest">Generate Playbook</span>
                                </Button>
                            </div>

                            {strategy.channels.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="size-24 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-slate-800 mb-8">
                                        <span className="material-symbols-outlined text-5xl text-slate-300">ads_click</span>
                                    </div>
                                    <h4 className="text-xl font-black text-slate-400 tracking-tight">Setup Pending</h4>
                                    <p className="text-sm text-slate-400 font-bold max-w-[280px] mt-3 leading-relaxed opacity-60">Choose your distribution channels on the left to start building your tactical playbook.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {strategy.channels.map(c => (
                                        <div key={c} className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 border-2 border-slate-100 dark:border-slate-800 group hover:border-rose-400/30 transition-all hover:bg-white dark:hover:bg-slate-950/50 hover:shadow-xl hover:shadow-rose-100 dark:hover:shadow-none h-full flex flex-col">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 shadow-lg group-hover:rotate-6 transition-transform">
                                                        <PlatformIcon platform={c} />
                                                    </div>
                                                    <span className="font-black text-[12px] tracking-widest text-slate-900 dark:text-white uppercase">{c}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRegeneratePlatform(c); }}
                                                        disabled={!!regeneratingPlatform}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all opacity-0 group-hover:opacity-100"
                                                        title="Regenerate this play"
                                                    >
                                                        <span className={`material-symbols-outlined text-[18px] ${regeneratingPlatform === c ? 'animate-spin text-rose-600' : ''}`}>
                                                            {regeneratingPlatform === c ? 'sync' : 'refresh'}
                                                        </span>
                                                    </button>
                                                    <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-500 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                        <span className="material-symbols-outlined text-[18px]">sports_score</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {strategy.plays[c] ? (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1">
                                                    <div>
                                                        <div className="text-[9px] font-black text-rose-600 uppercase tracking-[.25em] mb-1.5 opacity-80">The Winning Play</div>
                                                        <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight tracking-tight">
                                                            {strategy.plays[c].play}
                                                        </h4>
                                                    </div>
                                                    <div className="space-y-2.5 pr-1">
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[.25em] mb-1.5 opacity-80">Tactical Tips</div>
                                                        {strategy.plays[c].tips.map((tip, idx) => (
                                                            <div key={idx} className="flex gap-2.5 items-start">
                                                                <div className="size-4 rounded-md bg-rose-600 text-white flex items-center justify-center text-[8px] font-black mt-0.5 shrink-0 shadow-sm">
                                                                    {idx + 1}
                                                                </div>
                                                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-snug tracking-tight">
                                                                    {tip}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center opacity-40">
                                                    <div className="material-symbols-outlined text-slate-300 text-4xl mb-3 animate-pulse">hourglass_bottom</div>
                                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tactical Play Pending...</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Integrated Footer Link */}
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <Button
                                className="h-14 px-10 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-[.2em] shadow-xl shadow-rose-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group"
                                onClick={() => onUpdate({ stage: 'CreativeLab' })}
                            >
                                Start Creative Lab
                                <div className="size-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-2 transition-all">
                                    <span className="material-symbols-outlined text-[18px] font-black">science</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
