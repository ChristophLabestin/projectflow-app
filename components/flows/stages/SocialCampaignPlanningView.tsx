import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '../../ui/Button';
import { Idea, SocialPlatform, SocialPostFormat } from '../../../types';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { PLATFORM_FORMATS } from '../constants';
import {
    generateCampaignWeekPlanAI,
    PostPlaceholder
} from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignPlanningViewProps {
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

interface Platform {
    id: string;
    role: string;
    frequencyValue?: number;
    frequencyUnit?: string;
    frequency?: string;
    phaseFrequencies?: { phaseId: string; frequencyValue?: number; frequencyUnit: string }[];
}

interface PlanningData {
    posts: PostPlaceholder[];
}

const CONTENT_TYPES: { id: SocialPostFormat; icon: string; labelKey: string; color: string }[] = [
    { id: 'Post', icon: 'image', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.post', color: 'bg-blue-500' },
    { id: 'Reel', icon: 'play_circle', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.reel', color: 'bg-pink-500' },
    { id: 'Story', icon: 'auto_stories', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.story', color: 'bg-amber-500' },
    { id: 'Carousel', icon: 'view_carousel', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.carousel', color: 'bg-violet-500' },
    { id: 'Short', icon: 'movie', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.short', color: 'bg-red-500' },
    { id: 'Video', icon: 'videocam', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.video', color: 'bg-red-600' },
    { id: 'Text', icon: 'text_fields', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.text', color: 'bg-slate-500' },
];

// Helper to get base platform name for PLATFORM_FORMATS lookup
const getBasePlatform = (platformId: string): SocialPlatform => {
    if (platformId === 'YouTube Video' || platformId === 'YouTube Shorts') return 'YouTube';
    return platformId as SocialPlatform;
};

const PHASE_COLORS = [
    { bg: 'bg-gradient-to-r from-rose-500 to-pink-500', light: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
    { bg: 'bg-gradient-to-r from-orange-500 to-amber-500', light: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
    { bg: 'bg-gradient-to-r from-emerald-500 to-teal-500', light: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    { bg: 'bg-gradient-to-r from-blue-500 to-indigo-500', light: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
    { bg: 'bg-gradient-to-r from-violet-500 to-purple-500', light: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
];

const phaseToDays = (phase: Phase): number => {
    const val = phase.durationValue || 1;
    switch (phase.durationUnit) {
        case 'Weeks': return val * 7;
        case 'Months': return val * 30;
        default: return val;
    }
};

const calculatePlatformTargets = (platform: Platform, phases: Phase[]): { perWeek: number; total: number; label: string } => {
    // If no phases, default to standard calculation
    if (phases.length === 0) {
        const val = platform.frequencyValue || 3;
        const perWeek = platform.frequencyUnit === 'Posts/Day' ? val * 7 :
            platform.frequencyUnit === 'Posts/Month' ? val / 4 : val;
        return {
            perWeek: Math.round(perWeek * 10) / 10,
            total: Math.ceil(perWeek * 2), // Default 2 weeks
            label: `${val} ${platform.frequencyUnit?.replace('Posts/', '') || '/wk'}`
        };
    }

    let totalPosts = 0;
    let weightedWeeklySum = 0;
    let totalDays = 0;

    phases.forEach(phase => {
        const days = phaseToDays(phase);
        totalDays += days;

        // Check for phase override
        const override = platform.phaseFrequencies?.find(pf => pf.phaseId === phase.id);

        let freqVal = platform.frequencyValue || 3;
        let freqUnit = platform.frequencyUnit || 'Posts/Week';

        if (override) {
            freqVal = override.frequencyValue || 1;
            freqUnit = override.frequencyUnit;
        }

        let postsPerDay = 0;
        if (freqUnit === 'Posts/Day') postsPerDay = freqVal;
        else if (freqUnit === 'Posts/Week') postsPerDay = freqVal / 7;
        else if (freqUnit === 'Posts/Month') postsPerDay = freqVal / 30;

        totalPosts += postsPerDay * days;
        weightedWeeklySum += (postsPerDay * 7) * days;
    });

    const averagePerWeek = totalDays > 0 ? weightedWeeklySum / totalDays : 0;

    // Construct label
    let label = `${platform.frequencyValue || 3} ${platform.frequencyUnit?.replace('Posts/', '') || '/wk'}`;
    if (platform.phaseFrequencies && platform.phaseFrequencies.length > 0) {
        label = 'Variable';
    }

    return {
        perWeek: Math.round(averagePerWeek * 10) / 10,
        total: Math.ceil(totalPosts),
        label
    };
};

export const SocialCampaignPlanningView: React.FC<SocialCampaignPlanningViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [genStage, setGenStage] = useState('');
    const progressRef = useRef<NodeJS.Timeout | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
    const [dragOverDay, setDragOverDay] = useState<number | null>(null);
    const contentTypes = useMemo(() => CONTENT_TYPES.map(type => ({ ...type, label: t(type.labelKey) })), [t]);
    const contentTypeById = useMemo(() => new Map(contentTypes.map(type => [type.id, type])), [contentTypes]);
    const frequencyUnitShortLabels: Record<string, string> = {
        'Posts/Day': t('flowStages.socialCampaignPlanning.frequencyUnits.day'),
        'Posts/Week': t('flowStages.socialCampaignPlanning.frequencyUnits.week'),
        'Posts/Month': t('flowStages.socialCampaignPlanning.frequencyUnits.month'),
    };
    const formatFrequencyUnitShort = (unit?: string) => frequencyUnitShortLabels[unit || ''] || unit?.replace('Posts/', '') || '';

    // Progress animation during generation
    useEffect(() => {
        if (generating) {
            setGenProgress(0);
            setGenStage(t('flowStages.socialCampaignPlanning.generate.initial'));
            const stages = [
                { at: 10, text: t('flowStages.socialCampaignPlanning.generate.readingGoals') },
                { at: 25, text: t('flowStages.socialCampaignPlanning.generate.analyzingFrequencies') },
                { at: 40, text: t('flowStages.socialCampaignPlanning.generate.planningThemes') },
                { at: 55, text: t('flowStages.socialCampaignPlanning.generate.scheduling') },
                { at: 70, text: t('flowStages.socialCampaignPlanning.generate.generatingHooks') },
                { at: 85, text: t('flowStages.socialCampaignPlanning.generate.finalizing') },
            ];
            let progress = 0;
            progressRef.current = setInterval(() => {
                progress += Math.random() * 3 + 1;
                if (progress > 92) progress = 92;
                setGenProgress(progress);
                const stage = stages.find(s => s.at <= progress && stages.indexOf(s) === stages.filter(st => st.at <= progress).length - 1);
                if (stage) setGenStage(stage.text);
            }, 200);
        } else {
            if (progressRef.current) {
                clearInterval(progressRef.current);
                progressRef.current = null;
            }
            if (genProgress > 0) {
                setGenProgress(100);
                setGenStage(t('flowStages.socialCampaignPlanning.generate.done'));
                setTimeout(() => {
                    setGenProgress(0);
                    setGenStage('');
                }, 1000);
            }
        }
        return () => {
            if (progressRef.current) clearInterval(progressRef.current);
        };
    }, [generating, t]);

    // Parse strategy data
    const strategyData = useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                const phases: Phase[] = Array.isArray(parsed.phases) ? parsed.phases.map((p: any) => ({
                    id: p.id || Math.random().toString(36).substr(2, 9),
                    name: p.name || 'Phase',
                    durationValue: p.durationValue || parseInt(p.duration) || 1,
                    durationUnit: p.durationUnit || 'Weeks',
                    focus: p.focus || '',
                })) : [];

                const platforms: Platform[] = Array.isArray(parsed.platforms) ? parsed.platforms.map((p: any) => {
                    let frequencyValue = p.frequencyValue;
                    let frequencyUnit = p.frequencyUnit || 'Posts/Week';
                    if (frequencyValue === undefined && p.frequency) {
                        const match = p.frequency.match(/(\d+)/);
                        if (match) frequencyValue = parseInt(match[1]);
                        const freqLower = p.frequency.toLowerCase();
                        if (freqLower.includes('day')) frequencyUnit = 'Posts/Day';
                        else if (freqLower.includes('month')) frequencyUnit = 'Posts/Month';
                    }

                    const phaseFrequencies = Array.isArray(p.phaseFrequencies) ? p.phaseFrequencies : [];

                    return { ...p, frequencyValue: frequencyValue || 3, frequencyUnit, phaseFrequencies };
                }) : [];

                return { phases, platforms, audienceSegments: parsed.audienceSegments || [], campaignType: parsed.campaignType || 'Engagement' };
            }
        } catch { }
        return { phases: [] as Phase[], platforms: [] as Platform[], audienceSegments: [] as string[], campaignType: 'Engagement' };
    }, [idea.concept]);

    // Campaign metrics
    const campaignMetrics = useMemo(() => {
        const totalDays = strategyData.phases.length > 0
            ? strategyData.phases.reduce((sum, p) => sum + phaseToDays(p), 0)
            : 14;
        const totalWeeks = Math.ceil(totalDays / 7);
        const platformTargets = strategyData.platforms.map(p => ({ ...p, ...calculatePlatformTargets(p, strategyData.phases) }));
        const totalTargetPosts = platformTargets.reduce((sum, p) => sum + p.total, 0);
        return { totalDays, totalWeeks, platformTargets, totalTargetPosts };
    }, [strategyData]);

    // Phase ranges
    const phaseRanges = useMemo(() => {
        let startDay = 0;
        return strategyData.phases.map((phase, i) => {
            const days = phaseToDays(phase);
            const range = { phase, startDay, endDay: startDay + days - 1, color: PHASE_COLORS[i % PHASE_COLORS.length] };
            startDay += days;
            return range;
        });
    }, [strategyData.phases]);

    // Planning data
    const planningData: PlanningData = useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return { posts: Array.isArray(parsed.planningPosts) ? parsed.planningPosts : [] };
            }
        } catch { }
        return { posts: [] };
    }, [idea.concept]);

    const updatePlanningData = useCallback((updates: Partial<PlanningData>) => {
        let existingJson: any = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch { }
        const newData = { ...existingJson, planningPosts: updates.posts ?? existingJson.planningPosts };
        onUpdate({ concept: JSON.stringify(newData) });
    }, [idea.concept, onUpdate]);

    // Week data with Day 1, Day 2 naming
    const weekData = useMemo(() => {
        const startDay = weekOffset * 7;
        const days = Array.from({ length: 7 }, (_, i) => {
            const dayOffset = startDay + i;
            const isInCampaign = dayOffset < campaignMetrics.totalDays;
            const phase = phaseRanges.find(r => dayOffset >= r.startDay && dayOffset <= r.endDay);
            const posts = planningData.posts.filter(p => p.dayOffset === dayOffset);
            return { dayOffset, dayNum: dayOffset + 1, isInCampaign, phase, posts };
        });
        const postsThisWeek = days.reduce((sum, d) => sum + d.posts.length, 0);
        return { days, postsThisWeek };
    }, [weekOffset, campaignMetrics.totalDays, phaseRanges, planningData.posts]);

    // AI Generate with correct frequency handling
    const handleGeneratePlan = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            // Build platform frequency info for AI
            const platformFrequencies = campaignMetrics.platformTargets.map(p => ({
                platform: p.id,
                postsPerWeek: p.perWeek,
                totalPosts: p.total,
            }));

            const posts = await generateCampaignWeekPlanAI(idea, {
                ...strategyData,
                totalDays: campaignMetrics.totalDays,
                totalWeeks: campaignMetrics.totalWeeks,
                targetPosts: campaignMetrics.totalTargetPosts,
                platformFrequencies,
                phaseRanges: phaseRanges.map(r => ({
                    name: r.phase.name,
                    startDay: r.startDay,
                    endDay: r.endDay,
                    focus: r.phase.focus,
                })),
            } as any, 0);
            updatePlanningData({ posts: posts.filter(p => p.dayOffset < campaignMetrics.totalDays) });
        } catch (e) { console.error(e); }
        finally { setGenerating(false); }
    };

    const addPost = (dayOffset: number) => {
        const newPost: PostPlaceholder = {
            id: Math.random().toString(36).substr(2, 9),
            dayOffset,
            platforms: strategyData.platforms.slice(0, 1).map(p => p.id),
            contentType: 'Post',
            hook: '',
            status: 'empty',
        };
        updatePlanningData({ posts: [...planningData.posts, newPost] });
        setSelectedPostId(newPost.id);
    };

    const updatePost = (id: string, updates: Partial<PostPlaceholder>) => {
        updatePlanningData({ posts: planningData.posts.map(p => p.id === id ? { ...p, ...updates } : p) });
    };

    const deletePost = (id: string) => {
        updatePlanningData({ posts: planningData.posts.filter(p => p.id !== id) });
        setSelectedPostId(null);
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, postId: string) => {
        setDraggedPostId(postId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, dayOffset: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverDay(dayOffset);
    };

    const handleDragLeave = () => {
        setDragOverDay(null);
    };

    const handleDrop = (e: React.DragEvent, targetDayOffset: number) => {
        e.preventDefault();
        setDragOverDay(null);
        if (draggedPostId) {
            updatePost(draggedPostId, { dayOffset: targetDayOffset });
            setDraggedPostId(null);
        }
    };

    const handleDragEnd = () => {
        setDraggedPostId(null);
        setDragOverDay(null);
    };

    const selectedPost = planningData.posts.find(p => p.id === selectedPostId);
    const totalPlanned = planningData.posts.length;
    const channelList = strategyData.platforms.map(p => p.id).join(', ') || t('flowStages.socialCampaignPlanning.hero.channelsFallback');
    const missionPlanned = t('flowStages.socialCampaignPlanning.hero.mission.planned')
        .replace('{planned}', `${totalPlanned}`)
        .replace('{target}', `${campaignMetrics.totalTargetPosts}`);
    const missionDays = t('flowStages.socialCampaignPlanning.hero.mission.days')
        .replace('{days}', `${campaignMetrics.totalDays}`);

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-6">

                {/* Hero Header */}
                <div className="bg-gradient-to-br from-cyan-100 via-teal-50 to-white dark:from-cyan-900/30 dark:via-teal-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-cyan-200 dark:border-cyan-800/50 relative overflow-hidden shadow-xl shadow-cyan-100 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-cyan-600 rotate-12 -translate-y-10 translate-x-10">calendar_month</span>
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-cyan-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-cyan-200 dark:shadow-none">
                                        {t('flowStages.socialCampaignPlanning.hero.badge')}
                                </div>
                                <div className="h-[1px] w-8 bg-cyan-200 dark:bg-cyan-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {t('flowStages.socialCampaignPlanning.hero.title')}
                            </h1>
                        </div>
                        <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-cyan-100/50 dark:shadow-none backdrop-blur-md">
                            <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    "{t('flowStages.socialCampaignPlanning.hero.mission.prefix')} <span className="text-cyan-600 font-black">{missionPlanned}</span>
                                    {' '}{t('flowStages.socialCampaignPlanning.hero.mission.across')} <span className="text-cyan-600 font-black">{channelList}</span>
                                    {' '}{t('flowStages.socialCampaignPlanning.hero.mission.over')} <span className="text-cyan-600 font-black">{missionDays}</span>."
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleGeneratePlan}
                            disabled={generating}
                            className="h-10 px-5 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm font-black text-[10px] uppercase tracking-[.2em] transition-all flex items-center gap-2"
                        >
                            <span className={`material-symbols-outlined text-[18px] ${generating ? 'animate-spin' : ''}`}>
                                {generating ? 'progress_activity' : 'auto_awesome'}
                            </span>
                                {generating ? t('flowStages.socialCampaignPlanning.actions.generating') : t('flowStages.socialCampaignPlanning.actions.aiFill')}
                        </Button>
                            {/* Progress Bar */}
                            {(generating || genProgress > 0) && (
                                <div className="w-48">
                                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${genProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] text-white/80 mt-1 text-right">{genStage}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Week Navigator */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                        disabled={weekOffset === 0}
                        className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center transition-all shrink-0"
                    >
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <div className="flex-1 flex gap-1 overflow-x-auto py-1">
                        {Array.from({ length: campaignMetrics.totalWeeks }).map((_, i) => {
                            const isActive = i === weekOffset;
                            const weekPosts = planningData.posts.filter(p => Math.floor(p.dayOffset / 7) === i).length;
                            return (
                                <button
                                    key={i}
                                    onClick={() => setWeekOffset(i)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-cyan-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                        }`}
                                >
                                    {t('flowStages.socialCampaignPlanning.weekLabel').replace('{week}', `${i + 1}`)}
                                    {weekPosts > 0 && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600'}`}>
                                            {weekPosts}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setWeekOffset(Math.min(campaignMetrics.totalWeeks - 1, weekOffset + 1))}
                        disabled={weekOffset >= campaignMetrics.totalWeeks - 1}
                        className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center transition-all shrink-0"
                    >
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-7">
                        {weekData.days.map((day, i) => (
                            <div
                                key={i}
                                className={`border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${!day.isInCampaign ? 'opacity-40' : ''}`}
                                onDragOver={(e) => day.isInCampaign && handleDragOver(e, day.dayOffset)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => day.isInCampaign && handleDrop(e, day.dayOffset)}
                            >
                                {/* Day Header */}
                                <div className={`p-3 border-b border-slate-100 dark:border-slate-800 ${day.phase ? day.phase.color.light : ''} ${dragOverDay === day.dayOffset ? 'bg-cyan-100 dark:bg-cyan-900/50' : ''}`}>
                                    <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('flowStages.socialCampaignPlanning.dayLabel')}</span>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">{day.isInCampaign ? day.dayNum : '–'}</span>
                                        </div>
                                        {day.phase && (
                                            <div className={`size-3 rounded-full ${day.phase.color.dot}`} title={day.phase.phase.name} />
                                        )}
                                    </div>
                                </div>

                                {/* Posts */}
                                <div className={`p-2 min-h-[200px] flex flex-col gap-2 transition-colors ${dragOverDay === day.dayOffset ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}`}>
                                    {day.posts.map(post => {
                                        const tc = contentTypeById.get(post.contentType) || contentTypes[0];
                                        const isSelected = post.id === selectedPostId;
                                        const isDragging = post.id === draggedPostId;
                                        return (
                                            <div
                                                key={post.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, post.id)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setSelectedPostId(isSelected ? null : post.id)}
                                                className={`p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-50 scale-95' :
                                                    isSelected ? 'bg-cyan-500 text-white shadow-lg ring-2 ring-cyan-300' :
                                                        'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    {post.platforms?.slice(0, 2).map(p => (
                                                        <div key={p} className="size-4 rounded overflow-hidden ring-1 ring-white/20">
                                                            <PlatformIcon platform={p as SocialPlatform} />
                                                        </div>
                                                    ))}
                                                <div className={`ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold ${isSelected ? 'bg-white/20' : tc.color + ' text-white'}`}>
                                                        {tc.label}
                                                </div>
                                            </div>
                                                {post.hook && (
                                                    <p className={`text-[9px] line-clamp-2 leading-snug ${isSelected ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {post.hook}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {day.isInCampaign && (
                                        <button
                                            onClick={() => addPost(day.dayOffset)}
                                            className="mt-auto w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-cyan-500 hover:border-cyan-400 transition-all flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-base">add</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Phase Legend */}
                {phaseRanges.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {phaseRanges.map((r, i) => (
                            <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${r.color.light}`}>
                                <div className={`size-2 rounded-full ${r.color.dot}`} />
                                <span className={`text-[10px] font-bold ${r.color.text}`}>{r.phase.name}</span>
                                <span className="text-[9px] text-slate-400">
                                    {t('flowStages.socialCampaignPlanning.dayRange')
                                        .replace('{start}', `${r.startDay + 1}`)
                                        .replace('{end}', `${r.endDay + 1}`)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Bottom Stats & Continue */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Channel Targets */}
                    <div className="lg:col-span-8 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('flowStages.socialCampaignPlanning.targets.title')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {campaignMetrics.platformTargets.map(p => {
                                const planned = planningData.posts.filter(post => post.platforms?.includes(p.id)).length;
                                const progress = Math.min(100, (planned / Math.max(1, p.total)) * 100);
                                return (
                                    <div key={p.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="size-8 rounded-lg overflow-hidden"><PlatformIcon platform={p.id as SocialPlatform} /></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.id}</div>
                                                <div className="text-[9px] text-slate-400">{p.frequencyValue} {formatFrequencyUnitShort(p.frequencyUnit)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-cyan-500'}`} style={{ width: `${progress}%` }} />
                                            </div>
                                            <span className={`text-xs font-black ${progress >= 100 ? 'text-green-600' : 'text-cyan-600'}`}>{planned}/{p.total}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Continue */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-3 flex-1">
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center flex flex-col justify-center">
                                <div className="text-2xl font-black text-cyan-600">{totalPlanned}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">{t('flowStages.socialCampaignPlanning.stats.planned')}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center flex flex-col justify-center">
                                <div className="text-2xl font-black text-slate-900 dark:text-white">{campaignMetrics.totalTargetPosts}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">{t('flowStages.socialCampaignPlanning.stats.target')}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center flex flex-col justify-center">
                                <div className="text-2xl font-black text-slate-900 dark:text-white">{campaignMetrics.totalDays}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">{t('flowStages.socialCampaignPlanning.stats.days')}</div>
                            </div>
                        </div>
                        <Button
                            onClick={() => onUpdate({ stage: 'Submit' })}
                            className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white hover:bg-cyan-600 dark:hover:bg-cyan-500 text-white dark:text-slate-900 hover:text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all group"
                        >
                            {t('flowStages.socialCampaignPlanning.actions.advance')}
                            <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Slide-out Post Editor Panel */}
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 z-50 ${selectedPost ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedPost && (
                    <div className="h-full flex flex-col">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-cyan-600">edit</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('flowStages.socialCampaignPlanning.editor.title')}</h2>
                                    <p className="text-[10px] text-slate-400">{t('flowStages.socialCampaignPlanning.editor.day').replace('{day}', `${selectedPost.dayOffset + 1}`)}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedPostId(null)}
                                className="size-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-slate-400">close</span>
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Platforms */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{t('flowStages.socialCampaignPlanning.editor.platforms')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {strategyData.platforms.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                const current = selectedPost.platforms || [];
                                                const updated = current.includes(p.id) ? current.filter(x => x !== p.id) : [...current, p.id];
                                                updatePost(selectedPost.id, { platforms: updated });
                                            }}
                                            className={`size-12 rounded-xl overflow-hidden border-2 transition-all ${selectedPost.platforms?.includes(p.id) ? 'border-cyan-500 ring-2 ring-cyan-200 dark:ring-cyan-800' : 'border-slate-200 dark:border-slate-700 opacity-50 hover:opacity-80'
                                                }`}
                                        >
                                            <PlatformIcon platform={p.id as SocialPlatform} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Content Type - filtered by selected platforms */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{t('flowStages.socialCampaignPlanning.editor.format')}</label>
                                {(() => {
                                    // Get valid formats for selected platforms
                                    const selectedPlatforms = selectedPost.platforms || [];
                                    let validFormats: SocialPostFormat[] = [];

                                    selectedPlatforms.forEach(p => {
                                        const basePlatform = getBasePlatform(p);
                                        const platformFormats = PLATFORM_FORMATS[basePlatform] || [];

                                        // Special handling for YouTube Video vs Shorts
                                        if (p === 'YouTube Video') {
                                            validFormats.push('Video');
                                        } else if (p === 'YouTube Shorts') {
                                            validFormats.push('Short');
                                        } else {
                                            validFormats = [...validFormats, ...platformFormats];
                                        }
                                    });

                                    // Deduplicate
                                    validFormats = [...new Set(validFormats)];

                                    // Filter content types to only show valid ones
                                    const filteredTypes = validFormats.length > 0
                                        ? contentTypes.filter(t => validFormats.includes(t.id))
                                        : contentTypes;

                                    return (
                                        <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(filteredTypes.length, 5)}, 1fr)` }}>
                                            {filteredTypes.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => updatePost(selectedPost.id, { contentType: t.id as any })}
                                                    className={`py-3 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all ${selectedPost.contentType === t.id ? `${t.color} text-white shadow-lg` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-lg">{t.icon}</span>
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Hook */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{t('flowStages.socialCampaignPlanning.editor.hook')}</label>
                                <textarea
                                    value={selectedPost.hook || ''}
                                    onChange={e => updatePost(selectedPost.id, { hook: e.target.value })}
                                    placeholder={t('flowStages.socialCampaignPlanning.editor.hookPlaceholder')}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm h-32 resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                                />
                            </div>

                            {/* Post Preview */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('flowStages.socialCampaignPlanning.editor.preview')}</div>
                                <div className="flex items-center gap-2 mb-2">
                                    {selectedPost.platforms?.map(p => (
                                        <div key={p} className="size-6 rounded overflow-hidden">
                                            <PlatformIcon platform={p as SocialPlatform} />
                                        </div>
                                    ))}
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${contentTypeById.get(selectedPost.contentType)?.color} text-white`}>
                                        {contentTypeById.get(selectedPost.contentType)?.label || selectedPost.contentType}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {selectedPost.hook || t('flowStages.socialCampaignPlanning.editor.previewEmpty')}
                                </p>
                            </div>
                        </div>

                        {/* Panel Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                            <button
                                onClick={() => deletePost(selectedPost.id)}
                                className="px-5 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold transition-all"
                            >
                                {t('flowStages.socialCampaignPlanning.editor.delete')}
                            </button>
                            <Button
                                onClick={() => setSelectedPostId(null)}
                                className="flex-1 h-12 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-black uppercase tracking-wider"
                            >
                                {t('flowStages.socialCampaignPlanning.editor.done')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Backdrop */}
            {selectedPost && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    onClick={() => setSelectedPostId(null)}
                />
            )}
        </div>
    );
};
