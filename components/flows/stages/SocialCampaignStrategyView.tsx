import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Idea, SocialPlatform, SocialStrategy as SocialStrategyType, SocialCampaign, SocialPostFormat } from '../../../types';
import { PLATFORM_FORMATS } from '../constants';
import {
    generateSocialCampaignStrategyAI,
    generateAudienceAlternativesAI
} from '../../../services/geminiService';
import { subscribeSocialStrategy, subscribeCampaigns } from '../../../services/dataService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { PLATFORM_FREQUENCY_GUIDELINES, YOUTUBE_SYNERGY, getDefaultPlatformFrequency } from '../constants/platformFrequencyData';

interface SocialCampaignStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface Phase {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: 'Days' | 'Weeks' | 'Months';
    focus: string;
}

interface CampaignStrategy {
    phases: Phase[];
    platforms: {
        id: string;
        role: string;
        frequencyValue?: number;
        frequencyUnit?: string;
        frequency?: string; // Keep for migration/compat
        phaseFrequencies?: { phaseId: string; frequencyValue?: number; frequencyUnit: string; format?: SocialPostFormat }[];
        format?: SocialPostFormat;
    }[];
    kpis: { metric: string; target: string }[];
    audienceSegments: string[];
    campaignType: string;
    subGoal: string;
    pillar: string;
    aiSuggestedPlatforms?: string[];
    aiTactics?: any[];
}

const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube Video', 'YouTube Shorts'];

const PHASE_COLORS = [
    { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
    { bg: 'from-orange-500 to-amber-500', light: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
    { bg: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    { bg: 'from-blue-500 to-indigo-500', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
];

export const SocialCampaignStrategyView: React.FC<SocialCampaignStrategyViewProps> = ({ idea, onUpdate }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const [socialStrategy, setSocialStrategy] = useState<SocialStrategyType | null>(null);
    const [generating, setGenerating] = useState(false);
    const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
    const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
    const [editingAudienceIndex, setEditingAudienceIndex] = useState<number | null>(null);
    const [audienceSuggestions, setAudienceSuggestions] = useState<string[]>([]);
    const [expandedPlatformId, setExpandedPlatformId] = useState<string | null>(null);
    const [showAIConfig, setShowAIConfig] = useState(false);
    const [aiInstructions, setAiInstructions] = useState('');

    useEffect(() => {
        if (!projectId) return;
        const unsubscribe = subscribeSocialStrategy(projectId, setSocialStrategy);
        return () => unsubscribe();
    }, [projectId]);

    const enabledPlatforms = useMemo(() => {
        const raw = socialStrategy?.defaultPlatforms || SOCIAL_PLATFORMS;
        const expanded: string[] = [];
        raw.forEach(p => {
            if (p === 'YouTube') {
                expanded.push('YouTube Video', 'YouTube Shorts');
            } else if (!expanded.includes(p)) {
                expanded.push(p);
            }
        });
        return expanded;
    }, [socialStrategy?.defaultPlatforms]);

    const getBasePlatform = (p: string): SocialPlatform => {
        if (p === 'YouTube Video' || p === 'YouTube Shorts') return 'YouTube';
        return p as SocialPlatform;
    };

    const phaseToDays = (phase: Phase): number => {
        const val = phase.durationValue || 1;
        switch (phase.durationUnit) {
            case 'Weeks': return val * 7;
            case 'Months': return val * 30;
            default: return val;
        }
    };

    const calculatePlatformTotal = (platform: { frequencyValue?: number; frequencyUnit?: string; phaseFrequencies?: any[] }, phases: Phase[]) => {
        let total = 0;
        phases.forEach(phase => {
            const days = phaseToDays(phase);
            const override = platform.phaseFrequencies?.find(pf => pf.phaseId === phase.id);

            let val = platform.frequencyValue || 1;
            let unit = platform.frequencyUnit || 'Posts/Week';

            if (override) {
                val = override.frequencyValue || 1;
                unit = override.frequencyUnit;
            }

            let dailyRate = 0;
            if (unit === 'Posts/Day') dailyRate = val;
            else if (unit === 'Posts/Week') dailyRate = val / 7;
            else if (unit === 'Posts/Month') dailyRate = val / 30;

            total += dailyRate * days;
        });
        return Math.ceil(total);
    };

    const strategyData: CampaignStrategy = useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                const phases = Array.isArray(parsed.phases) ? parsed.phases.map((p: any) => ({
                    id: p.id || Math.random().toString(36).substr(2, 9),
                    name: p.name || '',
                    durationValue: p.durationValue || parseInt(p.duration) || 1,
                    durationUnit: p.durationUnit || 'Days',
                    focus: p.focus || '',
                })) : [];
                const platforms = Array.isArray(parsed.platforms) ? parsed.platforms.map((p: any) => {
                    // Migration logic: if only string frequency exists, parse it
                    let frequencyValue = p.frequencyValue;
                    let frequencyUnit = p.frequencyUnit || 'Posts/Week';

                    if (frequencyValue === undefined && p.frequency) {
                        const match = p.frequency.match(/(\d+)/);
                        frequencyValue = match ? parseInt(match[1]) : 1;
                        if (p.frequency.toLowerCase().includes('day')) frequencyUnit = 'Posts/Day';
                        else if (p.frequency.toLowerCase().includes('month')) frequencyUnit = 'Posts/Month';
                    }

                    // Parse phase overrides
                    const phaseFrequencies = (p.phaseFrequencies || []).map((pf: any) => ({
                        phaseId: pf.phaseId,
                        frequencyValue: pf.frequencyValue || pf.value || 1,
                        frequencyUnit: pf.frequencyUnit || pf.unit || 'Posts/Week',
                        format: pf.format
                    }));

                    return {
                        ...p,
                        frequencyValue,
                        frequencyUnit,
                        phaseFrequencies
                    };
                }) : [];

                return {
                    phases,
                    platforms,
                    kpis: Array.isArray(parsed.kpis) ? parsed.kpis : [],
                    audienceSegments: Array.isArray(parsed.audienceSegments) ? parsed.audienceSegments : [],
                    campaignType: parsed.campaignType || '',
                    subGoal: parsed.subGoal || '',
                    pillar: parsed.pillar || '',
                    aiSuggestedPlatforms: Array.isArray(parsed.aiSuggestedPlatforms) ? parsed.aiSuggestedPlatforms : [],
                    aiTactics: Array.isArray(parsed.aiTactics) ? parsed.aiTactics : [],
                };
            }
        } catch (e) { console.error("Strategy Parse Error", e); }

        return { phases: [], platforms: [], kpis: [], audienceSegments: [], campaignType: '', subGoal: '', pillar: '', aiSuggestedPlatforms: [], aiTactics: [] };
    }, [idea.concept]);

    const totalCampaignPosts = useMemo(() => {
        return strategyData.platforms.reduce((sum, p) => sum + calculatePlatformTotal(p, strategyData.phases), 0);
    }, [strategyData.platforms, strategyData.phases]);

    const updateStrategy = (updates: Partial<CampaignStrategy>) => {
        let existingJson = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch { }
        onUpdate({ concept: JSON.stringify({ ...existingJson, ...updates }) });
    };

    const handleGenerateAI = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            let conceptContext = {};
            try {
                if (idea.concept && idea.concept.startsWith('{')) {
                    conceptContext = JSON.parse(idea.concept);
                }
            } catch { }

            const result = await generateSocialCampaignStrategyAI(idea, conceptContext, enabledPlatforms, aiInstructions, {
                preferredTone: socialStrategy?.preferredTone,
                brandPillars: socialStrategy?.brandPillars
            });

            const structuredPhases = result.phases.map((p: any) => {
                const durationStr = (p.duration || '1 week').toLowerCase();
                const numericMatch = durationStr.match(/(\d+)/);
                const durationValue = numericMatch ? parseInt(numericMatch[1]) : 1;
                let durationUnit: 'Days' | 'Weeks' | 'Months' = 'Days';
                if (durationStr.includes('week')) durationUnit = 'Weeks';
                else if (durationStr.includes('month')) durationUnit = 'Months';

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    name: p.name,
                    durationValue,
                    durationUnit,
                    focus: p.focus,
                };
            });

            const structuredPlatforms = result.platforms.map((p: any) => {
                const freqStr = (p.frequency || '').toLowerCase();

                // Enhanced frequency parsing - handle decimals and various formats
                const decimalMatch = freqStr.match(/(\d+\.?\d*)/);
                let val = decimalMatch ? parseFloat(decimalMatch[1]) : 3; // Default to 3 if no number found

                // Handle special cases like "daily" which means 1/day or 7/week
                if (freqStr.includes('daily') && !decimalMatch) {
                    val = 1;
                }

                let unit = 'Posts/Week';
                if (freqStr.includes('day') || freqStr.includes('daily')) unit = 'Posts/Day';
                else if (freqStr.includes('month')) unit = 'Posts/Month';

                // Round to nearest integer for display (can't post 0.5 times)
                const frequencyValue = Math.max(1, Math.round(val));

                // Map phase overrides
                const phaseFrequencies = (p.phaseFrequencies || []).map((pf: any) => {
                    // Find matching phase by name
                    const matchedPhase = structuredPhases.find(sp => sp.name === pf.phaseName);
                    if (!matchedPhase) return null;

                    const pfFreqStr = (pf.frequency || '').toLowerCase();
                    const pfDecimalMatch = pfFreqStr.match(/(\d+\.?\d*)/);
                    let pfVal = pfDecimalMatch ? parseFloat(pfDecimalMatch[1]) : 3;

                    if (pfFreqStr.includes('daily') && !pfDecimalMatch) {
                        pfVal = 1;
                    }

                    let pfUnit = 'Posts/Week';
                    if (pfFreqStr.includes('day') || pfFreqStr.includes('daily')) pfUnit = 'Posts/Day';
                    else if (pfFreqStr.includes('month')) pfUnit = 'Posts/Month';

                    const pfFrequencyValue = Math.max(1, Math.round(pfVal));

                    return {
                        phaseId: matchedPhase.id,
                        frequencyValue: pfFrequencyValue,
                        frequencyUnit: pfUnit,
                        format: pf.format
                    };
                }).filter(Boolean); // Remove nulls

                return {
                    ...p,
                    frequencyValue,
                    frequencyUnit: unit,
                    phaseFrequencies
                };
            });

            updateStrategy({
                phases: structuredPhases,
                platforms: structuredPlatforms, // Actually update the platforms with AI-generated data
                aiSuggestedPlatforms: result.platforms.map((p: any) => p.id),
                aiTactics: structuredPlatforms,
                campaignType: result.campaignType,
                subGoal: result.subGoal,
                pillar: result.pillar,
                kpis: result.kpis,
                audienceSegments: result.audienceSegments
            });
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const handleSuggestAudience = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const alts = await generateAudienceAlternativesAI(idea);
            setAudienceSuggestions(alts);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const addPhase = () => {
        const newPhase: Phase = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            durationValue: 1,
            durationUnit: 'Weeks',
            focus: '',
        };
        updateStrategy({ phases: [...strategyData.phases, newPhase] });
        setEditingPhaseId(newPhase.id);
    };

    const updatePhase = (index: number, field: string, value: any) => {
        const newPhases = [...strategyData.phases];
        newPhases[index] = { ...newPhases[index], [field]: value };
        updateStrategy({ phases: newPhases });
    };

    const removePhase = (index: number) => {
        updateStrategy({ phases: strategyData.phases.filter((_, i) => i !== index) });
        setEditingPhaseId(null);
    };

    const togglePlatform = (platform: string) => {
        const index = strategyData.platforms.findIndex(p => p.id === platform);
        if (index >= 0) {
            updateStrategy({ platforms: strategyData.platforms.filter((_, i) => i !== index) });
        } else {
            // Check if AI suggested this platform and use its data
            const aiData = strategyData.aiTactics?.find(p => p.id === platform);

            // Get smart default frequency from platform guidelines
            const smartDefault = getDefaultPlatformFrequency(platform);

            const newPlatform = aiData ? {
                id: platform,
                role: aiData.role || '',
                frequencyValue: aiData.frequencyValue,
                frequencyUnit: aiData.frequencyUnit,
                phaseFrequencies: aiData.phaseFrequencies || []
            } : {
                id: platform,
                role: '',
                frequencyValue: smartDefault.value,
                frequencyUnit: smartDefault.unit,
                phaseFrequencies: []
            };

            updateStrategy({ platforms: [...strategyData.platforms, newPlatform] });
        }
    };

    // YouTube synergy check: warn if Video is selected but Shorts is not
    const hasYouTubeVideo = strategyData.platforms.some(p => p.id === 'YouTube Video');
    const hasYouTubeShorts = strategyData.platforms.some(p => p.id === 'YouTube Shorts');
    const showYouTubeSynergyWarning = hasYouTubeVideo && !hasYouTubeShorts && enabledPlatforms.includes('YouTube Shorts');

    const updatePlatform = (platformId: string, updates: any) => {
        const newPlatforms = strategyData.platforms.map(p => {
            if (p.id === platformId) {
                return { ...p, ...updates };
            }
            return p;
        });
        updateStrategy({ platforms: newPlatforms });
    };

    const updatePhaseFrequency = (platformId: string, phaseId: string, frequencyValue: number | undefined, frequencyUnit: string, format?: SocialPostFormat) => {
        const platform = strategyData.platforms.find(p => p.id === platformId);
        if (!platform) return;

        const currentFreqs = platform.phaseFrequencies || [];
        const existingIndex = currentFreqs.findIndex(pf => pf.phaseId === phaseId);

        let newFreqs;
        if (existingIndex >= 0) {
            newFreqs = [...currentFreqs];
            newFreqs[existingIndex] = { phaseId, frequencyValue, frequencyUnit, format };
        } else {
            newFreqs = [...currentFreqs, { phaseId, frequencyValue, frequencyUnit, format }];
        }

        updatePlatform(platformId, { phaseFrequencies: newFreqs });
    };

    const GOALS = ['Brand Awareness', 'Engagement', 'Traffic / Link', 'Sales / Promo', 'Community Building', 'Education'];
    const PILLARS = ['Educational', 'Promotional', 'Entertainment', 'Inspirational', 'Community', 'Behind the Scenes'];

    const missionText = (
        <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            "We are launching a <span className="text-rose-500 font-black">Multi-Channel Campaign</span>
            {' '}targeting <span className="text-rose-500 font-black">{strategyData.audienceSegments[0] || 'our core audience'}</span>
            {' '}on <span className="text-rose-500 font-black">{strategyData.platforms.length > 0 ? strategyData.platforms.map(p => p.id).join(', ') : 'selected platforms'}</span>
            {' '}to drive <span className="text-rose-500 font-black">
                {strategyData.campaignType || 'Impact'}
                {strategyData.subGoal && <span className="text-slate-400 font-normal px-1">&</span>}
                {strategyData.subGoal}
            </span>
            {strategyData.pillar && <> as a <span className="text-rose-500 font-black">{strategyData.pillar}</span> strategy</>}."
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
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-rose-200 dark:shadow-none">
                                        The Mission
                                    </div>
                                    <div className="h-[1px] w-8 bg-rose-200 dark:bg-rose-800 rounded-full" />
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                    Campaign Rollout Strategy
                                </h1>
                            </div>
                            <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-rose-100/50 dark:shadow-none backdrop-blur-md">
                                {missionText}
                            </div>
                        </div>
                        <div className="relative z-10 flex flex-col justify-between items-end">
                            <Button
                                onClick={handleGenerateAI}
                                disabled={generating}
                                className="h-10 px-5 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm font-black text-[10px] uppercase tracking-[.2em] transition-all flex items-center gap-2"
                            >
                                <span className={`material-symbols-outlined text-[18px] ${generating ? 'animate-spin' : ''}`}>
                                    {generating ? 'progress_activity' : 'auto_awesome'}
                                </span>
                                {generating ? 'Dreaming...' : (showAIConfig ? 'Generating...' : 'AI Super Suggest')}
                            </Button>
                        </div>
                    </div>
                    {showAIConfig && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-rose-100 dark:border-rose-900 p-4 animate-in slide-in-from-top-2">
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custom Instructions (Optional)</label>
                                <textarea
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-rose-500 min-h-[80px]"
                                    placeholder="E.g., Focus heavily on video content for the first week, or prioritize LinkedIn for B2B engagement..."
                                    value={aiInstructions}
                                    onChange={(e) => setAiInstructions(e.target.value)}
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowAIConfig(false)}
                                        className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
                                    >
                                        Cancel
                                    </button>
                                    <Button
                                        onClick={() => {
                                            handleGenerateAI();
                                            setShowAIConfig(false);
                                        }}
                                        disabled={generating}
                                        className="h-8 px-6 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest"
                                    >
                                        Run Generator
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">

                    {/* Left Column: Execution Plan (8/12) */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Execution Plan</h2>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>

                        {/* Phase Timeline Section */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Rollout Timeline</h3>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-tight">Structured campaign phases and duration</p>
                                </div>
                                <Button
                                    onClick={addPhase}
                                    className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    Add Phase
                                </Button>
                            </div>

                            <div className="space-y-6 relative">
                                {/* Vertical Timeline Line */}
                                {strategyData.phases.length > 1 && (
                                    <div className="absolute left-[65px] md:left-[64px] top-10 bottom-10 w-px bg-slate-100 dark:bg-slate-800 z-0 hidden md:block" />
                                )}
                                {strategyData.phases.map((phase, i) => {
                                    const color = PHASE_COLORS[i % PHASE_COLORS.length];
                                    const isEditing = editingPhaseId === phase.id;

                                    return (
                                        <div key={phase.id} className="relative group z-10">
                                            <div
                                                className={`flex flex-col md:flex-row gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer ${isEditing ? `${color.border} bg-white dark:bg-slate-900 shadow-xl` : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-rose-400/30 hover:shadow-lg shadow-sm'}`}
                                                onClick={() => !isEditing && setEditingPhaseId(phase.id)}
                                            >
                                                <div className="flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-4 shrink-0 md:w-32 bg-inherit/50">
                                                    <div className={`size-10 rounded-2xl bg-gradient-to-br ${color.bg} flex items-center justify-center text-white text-base font-black shadow-lg relative z-10`}>
                                                        {i + 1}
                                                    </div>
                                                    <div className={`px-2 py-1 ${color.light} ${color.text} rounded-lg text-[10px] font-black uppercase tracking-wider`}>
                                                        {phase.durationValue} {phase.durationUnit}
                                                    </div>
                                                </div>

                                                <div className="flex-1 space-y-1">
                                                    {isEditing ? (
                                                        <div className="space-y-4 pr-1">
                                                            <div className="flex flex-col md:flex-row gap-3">
                                                                <input
                                                                    type="text"
                                                                    value={phase.name}
                                                                    onChange={(e) => updatePhase(i, 'name', e.target.value)}
                                                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                                                                    placeholder="Phase Name (e.g. Teaser Phase)"
                                                                    autoFocus
                                                                />
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="number"
                                                                        value={phase.durationValue}
                                                                        onChange={(e) => updatePhase(i, 'durationValue', parseInt(e.target.value) || 1)}
                                                                        className="w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-black text-slate-900 dark:text-white text-center focus:outline-none focus:border-rose-500"
                                                                    />
                                                                    <select
                                                                        value={phase.durationUnit}
                                                                        onChange={(e) => updatePhase(i, 'durationUnit', e.target.value)}
                                                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                                                                    >
                                                                        <option value="Days">Days</option>
                                                                        <option value="Weeks">Weeks</option>
                                                                        <option value="Months">Months</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <textarea
                                                                value={phase.focus}
                                                                onChange={(e) => updatePhase(i, 'focus', e.target.value)}
                                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none focus:border-rose-500 h-24 resize-none leading-relaxed"
                                                                placeholder="What's the core focus and activity of this phase?"
                                                            />
                                                            <div className="flex justify-between items-center pt-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removePhase(i); }}
                                                                    className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1.5"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                    Delete Phase
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingPhaseId(null); }}
                                                                    className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                                >
                                                                    Save Phase
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="pr-12">
                                                            <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight mb-1">{phase.name || 'Untitled Phase'}</h4>
                                                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                                                {phase.focus || 'Define the focus for this phase...'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {!isEditing && (
                                                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all">
                                                        <div className="size-8 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400">
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {strategyData.phases.length === 0 && (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                        <div className="size-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl mb-4">
                                            <span className="material-symbols-outlined text-3xl text-slate-200">timeline</span>
                                        </div>
                                        <h4 className="text-base font-black text-slate-400">No Phases Defined</h4>
                                        <p className="text-[11px] text-slate-400 font-bold max-w-[200px] mt-2 leading-relaxed">Click "Add Phase" or use the AI Strategist to create your rollout timeline.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Channel Strategy Detailed */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Channel Tactics</h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-none mb-1">{totalCampaignPosts} Posts</span>
                                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Reach</span>
                                    </div>
                                    <div className="size-8 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {strategyData.platforms.map((platform, i) => {
                                    const isEditing = editingPlatformId === platform.id;

                                    return (
                                        <div
                                            key={platform.id}
                                            className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 transition-all relative group cursor-pointer ${isEditing ? 'border-rose-400/50 shadow-xl' : 'border-slate-100 dark:border-slate-800 hover:border-rose-400/30 hover:shadow-lg shadow-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}
                                            onClick={() => !isEditing && setEditingPlatformId(platform.id)}
                                        >
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 shadow-lg group-hover:rotate-6 transition-transform">
                                                        <PlatformIcon platform={platform.id as SocialPlatform} />
                                                    </div>
                                                    <span className="font-black text-[12px] tracking-widest text-slate-900 dark:text-white uppercase">{platform.id}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-900 dark:text-white">{calculatePlatformTotal(platform, strategyData.phases)}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posts</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {isEditing ? (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[9px] font-black text-rose-600 uppercase tracking-[.25em] mb-1.5 block opacity-80">Strategic Role</label>
                                                            <textarea
                                                                value={platform.role}
                                                                onChange={(e) => updatePlatform(i, 'role', e.target.value)}
                                                                placeholder="Tactical purpose for this channel..."
                                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500 h-20 resize-none"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div>
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <label className="text-[9px] font-black text-rose-600 uppercase tracking-[.25em] mb-1.5 block opacity-80">Posting Frequency</label>
                                                                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (platform.phaseFrequencies && platform.phaseFrequencies.length > 0) {
                                                                                    if (confirm('Switching to Simple mode will remove phase-specific overrides. Continue?')) {
                                                                                        updatePlatform(platform.id, { phaseFrequencies: [] });
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${(!platform.phaseFrequencies || platform.phaseFrequencies.length === 0)
                                                                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                                                                : 'text-slate-400 hover:text-slate-600'
                                                                                }`}
                                                                        >
                                                                            Simple
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (!platform.phaseFrequencies || platform.phaseFrequencies.length === 0) {
                                                                                    // Initialize with current values
                                                                                    const initial = strategyData.phases.map(p => ({
                                                                                        phaseId: p.id,
                                                                                        frequencyValue: platform.frequencyValue || 1,
                                                                                        frequencyUnit: platform.frequencyUnit || 'Posts/Week'
                                                                                    }));
                                                                                    updatePlatform(platform.id, { phaseFrequencies: initial });
                                                                                }
                                                                            }}
                                                                            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${(platform.phaseFrequencies && platform.phaseFrequencies.length > 0)
                                                                                ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600'
                                                                                : 'text-slate-400 hover:text-slate-600'
                                                                                }`}
                                                                        >
                                                                            Advanced
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Global Format Selection (if not using advanced) */}
                                                                {(!platform.phaseFrequencies || platform.phaseFrequencies.length === 0) && (
                                                                    <div className="mb-2">
                                                                        <label className="text-[9px] font-black text-rose-600 uppercase tracking-[.25em] mb-1.5 block opacity-80">Format</label>
                                                                        <div className="flex gap-2 flex-wrap">
                                                                            {(PLATFORM_FORMATS[getBasePlatform(platform.id)] || []).map(fmt => (
                                                                                <button
                                                                                    key={fmt}
                                                                                    onClick={(e) => { e.stopPropagation(); updatePlatform(platform.id, { format: fmt }); }}
                                                                                    className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${platform.format === fmt
                                                                                        ? 'bg-rose-50 dark:bg-rose-900 border-rose-200 text-rose-700 dark:text-rose-300 shadow-sm'
                                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-rose-300'
                                                                                        }`}
                                                                                >
                                                                                    {fmt}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {!platform.phaseFrequencies || platform.phaseFrequencies.length === 0 ? (
                                                                    <div className="flex gap-2 animate-in fade-in duration-200">
                                                                        <input
                                                                            type="number"
                                                                            value={platform.frequencyValue ?? ''}
                                                                            onChange={(e) => updatePlatform(platform.id, { frequencyValue: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                                            placeholder="3"
                                                                            className="w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500 text-center"
                                                                        />
                                                                        <select
                                                                            value={platform.frequencyUnit}
                                                                            onChange={(e) => updatePlatform(platform.id, { frequencyUnit: e.target.value })}
                                                                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500"
                                                                        >
                                                                            <option value="Posts/Day">Posts / Day</option>
                                                                            <option value="Posts/Week">Posts / Week</option>
                                                                            <option value="Posts/Month">Posts / Month</option>
                                                                        </select>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-2 space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/50 animate-in slide-in-from-top-2">
                                                                        {strategyData.phases.map((phase) => {
                                                                            const phaseFreq = platform.phaseFrequencies?.find(pf => pf.phaseId === phase.id);
                                                                            const val = phaseFreq ? phaseFreq.frequencyValue : platform.frequencyValue ?? 1;
                                                                            const unit = phaseFreq ? phaseFreq.frequencyUnit : platform.frequencyUnit ?? 'Posts/Week';

                                                                            const phaseIndex = strategyData.phases.findIndex(p => p.id === phase.id);
                                                                            const colors = PHASE_COLORS[phaseIndex % PHASE_COLORS.length] || PHASE_COLORS[0];

                                                                            return (
                                                                                <div key={phase.id} className="flex flex-col gap-2 border-b border-indigo-100 dark:border-indigo-900/40 pb-3 last:pb-0 last:border-0">
                                                                                    <div className="flex items-center justify-between gap-4">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className={`size-2 rounded-full bg-gradient-to-r ${colors.bg}`} />
                                                                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{phase.name || 'Untitled Phase'}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <input
                                                                                                type="number"
                                                                                                value={val ?? ''}
                                                                                                onChange={(e) => updatePhaseFrequency(platform.id, phase.id, e.target.value === '' ? undefined : parseInt(e.target.value), unit || 'Posts/Week', phaseFreq?.format)}
                                                                                                className="w-10 h-6 rounded-md px-1 text-[10px] font-bold text-center border bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 focus:outline-none focus:border-rose-500"
                                                                                            />
                                                                                            <select
                                                                                                value={unit}
                                                                                                onChange={(e) => updatePhaseFrequency(platform.id, phase.id, val || 1, e.target.value, phaseFreq?.format)}
                                                                                                className="h-6 rounded-md px-1 text-[10px] font-bold border appearance-none bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 focus:outline-none focus:border-rose-500"
                                                                                            >
                                                                                                <option value="Posts/Day">/ Day</option>
                                                                                                <option value="Posts/Week">/ Week</option>
                                                                                                <option value="Posts/Month">/ Month</option>
                                                                                            </select>
                                                                                        </div>
                                                                                    </div>
                                                                                    {/* Per-phase Format Selection */}
                                                                                    <div className="flex gap-1 flex-wrap pl-4">
                                                                                        {(PLATFORM_FORMATS[getBasePlatform(platform.id)] || []).map(fmt => (
                                                                                            <button
                                                                                                key={fmt}
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    updatePhaseFrequency(platform.id, phase.id, val || 1, unit || 'Posts/Week', fmt);
                                                                                                }}
                                                                                                className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${phaseFreq?.format === fmt
                                                                                                    ? 'bg-indigo-50 dark:bg-indigo-900 border-indigo-200 text-indigo-700 dark:text-indigo-300'
                                                                                                    : 'bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900/50 text-slate-400 hover:border-indigo-200'
                                                                                                    }`}
                                                                                            >
                                                                                                {fmt}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); togglePlatform(platform.id); setEditingPlatformId(null); }}
                                                                className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1.5"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                Remove
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingPlatformId(null); }}
                                                                className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md"
                                                            >
                                                                Save Tactic
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="mb-4">
                                                            <label className="text-[9px] font-black text-rose-600 uppercase tracking-[.25em] mb-1.5 block opacity-50">Strategic Role</label>
                                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed min-h-[2.5rem]">
                                                                {platform.role || 'Define the tactical role for this channel...'}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            {platform.phaseFrequencies && platform.phaseFrequencies.length > 0 ? (
                                                                <div className="space-y-1.5">
                                                                    <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Advanced Schedule</div>
                                                                    {platform.phaseFrequencies.map((pf) => {
                                                                        const phase = strategyData.phases.find(p => p.id === pf.phaseId);
                                                                        if (!phase) return null;

                                                                        const phaseIndex = strategyData.phases.findIndex(p => p.id === phase.id);
                                                                        const colors = PHASE_COLORS[phaseIndex % PHASE_COLORS.length] || PHASE_COLORS[0];

                                                                        return (
                                                                            <div key={pf.phaseId} className="flex items-center gap-2">
                                                                                <div className={`size-1.5 rounded-full bg-gradient-to-r ${colors.bg}`} />
                                                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 w-16 truncate">{phase.name}</span>
                                                                                <div className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 rounded text-[9px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                                                    <span>{pf.frequencyValue} {pf.frequencyUnit?.replace('Posts/', '')}</span>
                                                                                    {pf.format && (
                                                                                        <>
                                                                                            <span className="text-indigo-300">•</span>
                                                                                            <span className="text-indigo-500">{pf.format}</span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="px-2.5 py-1 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                        <span>{platform.frequencyValue} {platform.frequencyUnit}</span>
                                                                        {platform.format && (
                                                                            <>
                                                                                <span className="text-rose-300">•</span>
                                                                                <span className="text-rose-500">{platform.format}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">Frequency</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all">
                                                            <div className="size-8 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 shadow-sm">
                                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {strategyData.platforms.length === 0 && (
                                    <div className="col-span-full py-12 text-center opacity-40">
                                        <div className="material-symbols-outlined text-slate-300 text-4xl mb-3 animate-pulse">hourglass_bottom</div>
                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select channels on the right to start tactical planning.</p>
                                    </div>
                                )}
                            </div>
                        </div>


                    </div>

                    {/* Right Column: The Brief (4/12) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">The Brief</h2>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>

                        {/* Channel Selection */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50">Social Channels</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {enabledPlatforms.map(c => {
                                    const isAdded = strategyData.platforms.find(p => p.id === c);
                                    const isRecommended = strategyData.aiSuggestedPlatforms?.includes(c);

                                    return (
                                        <div key={c} className="relative group">
                                            <button
                                                onClick={() => togglePlatform(c)}
                                                className={`w-full flex items-center justify-between p-2 rounded-xl border-2 transition-all ${isAdded
                                                    ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800 shadow-sm'
                                                    : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50 hover:border-rose-200'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="size-6 shadow-md group-hover:scale-110 transition-transform">
                                                        <PlatformIcon platform={c} />
                                                    </div>
                                                    <span className={`text-[11px] font-black tracking-tight ${isAdded ? 'text-rose-900 dark:text-rose-100' : 'text-slate-500'}`}>
                                                        {c}
                                                    </span>
                                                </div>
                                                <div className={`size-4 rounded-md flex items-center justify-center border transition-all ${isAdded ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                                                    {isAdded && <span className="material-symbols-outlined text-[10px] font-black">check</span>}
                                                </div>
                                            </button>

                                            {isRecommended && !isAdded && (
                                                <div className="absolute -top-1 -right-1 z-10 animate-bounce">
                                                    <div className="bg-violet-600 text-white text-[7px] font-black px-1 py-0.5 rounded shadow-lg border border-violet-400 uppercase tracking-tighter">
                                                        AI Rec
                                                    </div>
                                                </div>
                                            )}

                                            {isRecommended && isAdded && (
                                                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1 h-3 bg-violet-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.5)]" title="AI Recommended" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* YouTube Synergy Warning */}
                            {showYouTubeSynergyWarning && (
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50 animate-in slide-in-from-top-2">
                                    <div className="flex items-start gap-2.5">
                                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg mt-0.5">tips_and_updates</span>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-amber-800 dark:text-amber-200 uppercase tracking-wide mb-1">YouTube Synergy</p>
                                            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300 leading-relaxed">
                                                {YOUTUBE_SYNERGY.synergyMessage}
                                            </p>
                                            <button
                                                onClick={() => togglePlatform('YouTube Shorts')}
                                                className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">add</span>
                                                Add YouTube Shorts
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-6 opacity-50">Campaign Objectives</h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">target</span>
                                        Primary Goal
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {GOALS.map(g => (
                                            <button
                                                key={g}
                                                onClick={() => updateStrategy({ campaignType: g })}
                                                className={`px-2 py-2 text-[10px] font-black rounded-lg border-2 transition-all ${strategyData.campaignType === g ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200 dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-rose-200'}`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">analytics</span>
                                        Secondary Goal (KPI)
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={strategyData.subGoal}
                                            onChange={(e) => updateStrategy({ subGoal: e.target.value })}
                                            className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-[11px] font-black text-slate-700 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all pr-10"
                                        >
                                            <option value="">Select Secondary Goal...</option>
                                            {GOALS.filter(g => g !== strategyData.campaignType).map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">view_quilt</span>
                                        Content Pillar
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PILLARS.map(p => (
                                            <button
                                                key={p}
                                                onClick={() => updateStrategy({ pillar: p })}
                                                className={`px-2 py-2 text-[10px] font-black rounded-lg border-2 transition-all ${strategyData.pillar === p ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100 dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-amber-500'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Target Audience */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest opacity-50">Target Audience</h3>
                                <button
                                    onClick={handleSuggestAudience}
                                    disabled={generating}
                                    className="text-[9px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 rounded-full flex items-center gap-1 transition-all"
                                >
                                    <span className={`material-symbols-outlined text-[12px] ${generating ? 'animate-spin' : ''}`}>
                                        {generating ? 'progress_activity' : 'auto_awesome'}
                                    </span>
                                    AI SUGGEST
                                </button>
                            </div>

                            <div className="space-y-3">
                                {strategyData.audienceSegments.map((segment, i) => {
                                    const isEditing = editingAudienceIndex === i;

                                    return (
                                        <div
                                            key={i}
                                            className={`relative group p-4 rounded-xl border-2 transition-all cursor-pointer ${isEditing ? 'bg-white dark:bg-slate-900 border-rose-400/50 shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-rose-400/30'}`}
                                            onClick={() => !isEditing && setEditingAudienceIndex(i)}
                                        >
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        className="w-full text-xs font-bold bg-transparent border-0 outline-none h-24 resize-none leading-snug tracking-tight text-slate-700 dark:text-slate-200"
                                                        value={segment}
                                                        onChange={(e) => {
                                                            const newSegs = [...strategyData.audienceSegments];
                                                            newSegs[i] = e.target.value;
                                                            updateStrategy({ audienceSegments: newSegs });
                                                        }}
                                                        placeholder="Describe a segment..."
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateStrategy({ audienceSegments: strategyData.audienceSegments.filter((_, idx) => idx !== i) }); setEditingAudienceIndex(null); }}
                                                            className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                            Remove
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingAudienceIndex(null); }}
                                                            className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between gap-4">
                                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                                                        {segment || <span className="text-slate-400 italic font-medium">New audience segment...</span>}
                                                    </p>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                        <span className="material-symbols-outlined text-[18px] text-slate-400">edit</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button
                                    onClick={() => {
                                        const newSegs = [...strategyData.audienceSegments, ''];
                                        updateStrategy({ audienceSegments: newSegs });
                                        setEditingAudienceIndex(newSegs.length - 1);
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black text-slate-400 hover:border-rose-200 hover:text-rose-500 transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2 group mt-2"
                                >
                                    <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">add_circle</span>
                                    Add Segment
                                </button>

                                {audienceSuggestions.length > 0 && (
                                    <div className="mt-4 p-4 bg-gradient-to-br from-rose-50 to-pink-50/30 dark:from-rose-950/20 dark:to-pink-950/10 rounded-2xl border border-rose-100 dark:border-rose-900/30 space-y-3 shadow-inner">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest">AI Generated Alternatives</div>
                                            <button onClick={() => setAudienceSuggestions([])} className="text-rose-300 hover:text-rose-500 transition-colors">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {audienceSuggestions.map((s, i) => (
                                                <div key={i} className="flex items-stretch gap-1.5 group/sug">
                                                    <button
                                                        onClick={() => {
                                                            const newSegs = [...strategyData.audienceSegments];
                                                            let targetIdx = editingAudienceIndex;
                                                            if (targetIdx === null) {
                                                                const emptyIdx = newSegs.findIndex(seg => !seg || seg.trim() === '');
                                                                if (emptyIdx !== -1) targetIdx = emptyIdx;
                                                            }
                                                            if (targetIdx !== null) {
                                                                newSegs[targetIdx] = s;
                                                                updateStrategy({ audienceSegments: newSegs });
                                                            } else {
                                                                updateStrategy({ audienceSegments: [...newSegs, s] });
                                                                targetIdx = newSegs.length;
                                                            }
                                                            setAudienceSuggestions(audienceSuggestions.filter((_, idx) => idx !== i));
                                                            setEditingAudienceIndex(targetIdx);
                                                        }}
                                                        className="flex-1 text-left text-[11px] font-black text-rose-700 dark:text-rose-300 hover:text-white dark:hover:text-rose-100 leading-snug p-2.5 rounded-xl border border-rose-100/50 dark:border-rose-800/30 transition-all bg-white/50 dark:bg-slate-900/50 shadow-sm hover:bg-rose-600 dark:hover:bg-rose-900/50"
                                                        title="Replace active segment"
                                                    >
                                                        {s}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            updateStrategy({ audienceSegments: [...strategyData.audienceSegments, s] });
                                                            setAudienceSuggestions(audienceSuggestions.filter((_, idx) => idx !== i));
                                                            setEditingAudienceIndex(strategyData.audienceSegments.length);
                                                        }}
                                                        className="size-10 shrink-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-xl border border-rose-100/50 dark:border-rose-800/30 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm"
                                                        title="Add as new segment"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">add</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        {strategyData.audienceSegments.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    updateStrategy({ audienceSegments: [] });
                                                    setEditingAudienceIndex(null);
                                                }}
                                                className="w-full text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest pt-1 transition-colors"
                                            >
                                                Clear current segments
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Navigation Action */}
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white hover:bg-rose-600 dark:hover:bg-rose-500 text-white dark:text-slate-900 hover:text-white font-black text-xs uppercase tracking-[.2em] shadow-lg shadow-slate-200 dark:shadow-none transition-all flex items-center justify-center gap-2 group"
                                onClick={() => onUpdate({ stage: 'Planning' })}
                            >
                                Continue to Planning
                                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

